"""
=============================================================================
 Dyslexic Adaptive Revision Scheduler — Final Training Pipeline
 Model  : HistGradientBoostingRegressor + RandomizedSearchCV
 Target : recommended_next_review_days
=============================================================================

All fixes applied
─────────────────
 1. No leakage columns (recall_accuracy, retention_score,
    cognitive_load_score removed from dataset).
 2. session_date → day_of_week / month / day_of_month BEFORE split.
 3. topic dropped (redundant with subject).
 4. dyslexia_severity & time_of_day → OrdinalEncoder (ordered).
 5. GroupShuffleSplit for train/test so the SAME STUDENT never appears
    in both sets (prevents inflated metrics).
 6. GroupKFold CV keeps the same guarantee inside the search.
 7. Feature-type coercion done on full X before split.
 8. Groups index reset after split so GroupKFold aligns correctly.
 9. N_ITER = 30 (safe for 30 k rows).
10. Early stopping enabled — max_iter = 1 000, let the booster decide.
11. Permutation importance sign FIXED (no negation).
12. Console output includes ASCII bar chart for importances.
13. Artefacts: model .pkl, feature list .json, importances .json,
    evaluation metrics .json.
"""

import os
import json
import warnings
import pandas as pd
import numpy as np

from sklearn.model_selection import (
    GroupShuffleSplit, RandomizedSearchCV, GroupKFold
)
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, OrdinalEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib

warnings.filterwarnings('ignore')

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_CSV   = os.path.join(BASE_DIR, 'data', 'dyslexic_adaptive_scheduler_dataset_clean.csv')
MODEL_OUT  = os.path.join(BASE_DIR, 'models', 'revision_scheduler_model.pkl')
FEAT_OUT   = os.path.join(BASE_DIR, 'artifacts', 'feature_names.json')
FI_OUT     = os.path.join(BASE_DIR, 'artifacts', 'feature_importances.json')
EVAL_OUT   = os.path.join(BASE_DIR, 'artifacts', 'evaluation_metrics.json')

# ── Config ────────────────────────────────────────────────────────────────────
TARGET      = 'recommended_next_review_days'
RANDOM_SEED = 42
TEST_SIZE   = 0.20
CV_FOLDS    = 5
N_ITER      = 30     # RandomizedSearchCV iterations

# Ordinal columns and their ordered categories
ORDINAL_COLS = {
    'dyslexia_severity': ['mild', 'moderate', 'severe'],
    'time_of_day':       ['Morning', 'Afternoon', 'Evening'],
}
NOMINAL_COLS = ['subject']   # topic is dropped — redundant with subject

# ── Helpers ───────────────────────────────────────────────────────────────────

def engineer_date_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Expand session_date into three numeric columns, then drop the raw string.
    Must run BEFORE any train/test split to avoid transformer crashes
    and temporal leakage.
    """
    dates = pd.to_datetime(df['session_date'], errors='coerce')
    df = df.copy()
    df['session_day_of_week']  = dates.dt.dayofweek   # 0 = Mon … 6 = Sun
    df['session_month']        = dates.dt.month        # 1 – 12
    df['session_day_of_month'] = dates.dt.day          # 1 – 31
    df.drop(columns=['session_date'], inplace=True)
    return df


def build_preprocessor(numeric_features: list) -> ColumnTransformer:
    """
    Assembles a ColumnTransformer for numeric, ordinal, and nominal features.
    Called once; receives the final numeric_features list after date engineering.
    """
    numeric_transformer = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler',  StandardScaler()),
    ])

    # Preserve natural order: mild < moderate < severe, Morning < Afternoon < Evening
    ordinal_transformer = Pipeline([
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('ordinal', OrdinalEncoder(
            categories=[ORDINAL_COLS[c] for c in ORDINAL_COLS],
            handle_unknown='use_encoded_value',
            unknown_value=-1,
        )),
    ])

    nominal_transformer = Pipeline([
        ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
        ('onehot',  OneHotEncoder(handle_unknown='ignore', sparse_output=False)),
    ])

    return ColumnTransformer([
        ('num',     numeric_transformer,  numeric_features),
        ('ordinal', ordinal_transformer,  list(ORDINAL_COLS.keys())),
        ('nominal', nominal_transformer,  NOMINAL_COLS),
    ], remainder='drop')


def print_section(title: str) -> None:
    print(f'\n{"─" * 60}')
    print(f'  {title}')
    print(f'{"─" * 60}')


def print_importances(fi: list, top_n: int = 15) -> None:
    max_score = max(abs(v) for _, v in fi) or 1
    print(f'\n  {"Feature":<35} {"Score":>8}  Chart')
    print(f'  {"─" * 35} {"─" * 8}  {"─" * 22}')
    for name, score in fi[:top_n]:
        bar = '█' * int(abs(score) / max_score * 22)
        print(f'  {name:<35} {score:>8.4f}  {bar}')


# ══════════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':

    # ── 1. Load ───────────────────────────────────────────────────────────────
    print_section('1 · Loading dataset')
    if not os.path.exists(DATA_CSV):
        raise SystemExit(f'Dataset not found:\n  {DATA_CSV}')

    df = pd.read_csv(DATA_CSV)
    print(f'  Rows × Cols : {df.shape}')
    print(f'  Columns     : {df.columns.tolist()}')

    if TARGET not in df.columns:
        raise SystemExit(f'Target column "{TARGET}" not found.')

    # ── 2. Feature engineering (whole df, BEFORE split) ───────────────────────
    print_section('2 · Feature engineering')
    df = engineer_date_features(df)
    print('  session_date → day_of_week, month, day_of_month ✓')

    # Drop topic (encodes subject name → redundant, adds noise)
    if 'topic' in df.columns:
        df.drop(columns=['topic'], inplace=True)
        print('  Dropped: topic (redundant with subject) ✓')

    # ── 3. Separate X, y, groups ──────────────────────────────────────────────
    print_section('3 · Separating features / target / groups')
    groups  = df['student_id'].values   # used for GroupShuffleSplit + GroupKFold
    exclude = [TARGET, 'student_id']
    X = df.drop(columns=exclude)
    y = df[TARGET]

    known_cat        = list(ORDINAL_COLS.keys()) + NOMINAL_COLS
    numeric_features = [c for c in X.columns if c not in known_cat]

    # Coerce numerics BEFORE split (catches stray object columns)
    for col in numeric_features:
        X[col] = pd.to_numeric(X[col], errors='coerce')

    print(f'  Numeric  ({len(numeric_features)}) : {numeric_features}')
    print(f'  Ordinal  ({len(ORDINAL_COLS)})      : {list(ORDINAL_COLS.keys())}')
    print(f'  Nominal  ({len(NOMINAL_COLS)})       : {NOMINAL_COLS}')
    print(f'  Target   range   : {y.min()} – {y.max()} days  (mean={y.mean():.2f})')

    # ── 4. Train / test split — grouped by student ────────────────────────────
    print_section('4 · Train / test split (GroupShuffleSplit by student_id)')
    #
    # GroupShuffleSplit ensures every session of a given student lands
    # entirely in train OR test — never both.  This prevents the model
    # from "memorising" student-level patterns and then being tested on
    # the same student, which inflates R² by up to 0.2.
    #
    gss = GroupShuffleSplit(n_splits=1, test_size=TEST_SIZE, random_state=RANDOM_SEED)
    train_idx, test_idx = next(gss.split(X, y, groups=groups))

    X_train = X.iloc[train_idx].reset_index(drop=True)
    X_test  = X.iloc[test_idx].reset_index(drop=True)
    y_train = y.iloc[train_idx].reset_index(drop=True)
    y_test  = y.iloc[test_idx].reset_index(drop=True)
    g_train = pd.Series(groups[train_idx]).reset_index(drop=True)

    print(f'  Train : {X_train.shape}  |  unique students: {g_train.nunique()}')
    print(f'  Test  : {X_test.shape}   |  unique students: {pd.Series(groups[test_idx]).nunique()}')
    print(f'  Student overlap: {set(g_train) & set(groups[test_idx])} (must be empty)')

    # ── 5. Pipeline ───────────────────────────────────────────────────────────
    print_section('5 · Building pipeline')
    preprocessor = build_preprocessor(numeric_features)

    pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('model', HistGradientBoostingRegressor(
            # Early stopping: trains up to 1 000 rounds but stops automatically
            # when validation MAE stops improving for 20 consecutive rounds.
            # This replaces manual max_iter tuning and prevents overfitting.
            max_iter          = 1_000,
            early_stopping    = True,
            validation_fraction = 0.1,
            n_iter_no_change  = 20,
            scoring           = 'neg_mean_absolute_error',
            random_state      = RANDOM_SEED,
        )),
    ])
    print('  HistGradientBoostingRegressor with early stopping ✓')

    # ── 6. Hyperparameter search ──────────────────────────────────────────────
    print_section('6 · Hyperparameter search (RandomizedSearchCV)')

    param_dist = {
        # Tree depth and leaves — controls model capacity
        'model__max_depth':         [None, 4, 6, 8, 12],
        'model__max_leaf_nodes':    [15, 31, 63, 127, None],

        # Learning rate — lower = more robust, early stopping decides length
        'model__learning_rate':     [0.01, 0.05, 0.08, 0.1, 0.15, 0.2],

        # Stochastic training — row / feature subsampling
        'model__max_bins':          [128, 255],
        'model__min_samples_leaf':  [10, 20, 30, 50],

        # Regularisation
        'model__l2_regularization': [0.0, 0.05, 0.1, 0.3, 0.5, 1.0],
    }

    # GroupKFold: CV folds also respect student boundaries
    cv = GroupKFold(n_splits=CV_FOLDS)

    search = RandomizedSearchCV(
        pipeline,
        param_distributions = param_dist,
        n_iter              = N_ITER,
        cv                  = cv,
        scoring             = 'neg_mean_absolute_error',
        random_state        = RANDOM_SEED,
        n_jobs              = -1,
        verbose             = 1,
        refit               = True,
    )

    search.fit(X_train, y_train, groups=g_train)
    best = search.best_estimator_

    print(f'\n  Best params:')
    for k, v in search.best_params_.items():
        print(f'    {k.replace("model__", ""):<25} = {v}')
    print(f'\n  Best CV MAE : {-search.best_score_:.4f}')

    # ── 7. Evaluation on held-out test set ────────────────────────────────────
    print_section('7 · Test-set evaluation')
    y_pred = best.predict(X_test)

    mae  = mean_absolute_error(y_test, y_pred)
    rmse = mean_squared_error(y_test, y_pred) ** 0.5
    r2   = r2_score(y_test, y_pred)
    # Mean Absolute Percentage Error (interpretable in days)
    mape = np.mean(np.abs((y_test - y_pred) / y_test.clip(lower=1))) * 100

    print(f'  MAE   : {mae:.4f} days   ← average prediction error')
    print(f'  RMSE  : {rmse:.4f} days')
    print(f'  R²    : {r2:.4f}         ← variance explained')
    print(f'  MAPE  : {mape:.2f} %')

    # Residual sanity check
    residuals = y_test - y_pred
    print(f'\n  Residuals (actual − predicted):')
    print(f'    mean  = {residuals.mean():.4f}  (close to 0 = unbiased)')
    print(f'    std   = {residuals.std():.4f}')
    print(f'    max   = {residuals.max():.4f}')
    print(f'    min   = {residuals.min():.4f}')

    # ── 8. Feature importances ────────────────────────────────────────────────
    print_section('8 · Feature importances')

    # Reconstruct full post-preprocessing feature name list
    pre           = best.named_steps['preprocessor']
    feature_names = list(numeric_features) + list(ORDINAL_COLS.keys())
    ohe           = pre.transformers_[2][1].named_steps['onehot']
    for col, cats in zip(NOMINAL_COLS, ohe.categories_):
        feature_names.extend([f'{col}__{c}' for c in cats])

    try:
        # HistGBR built-in importances (gain-based, always non-negative)
        importances = best.named_steps['model'].feature_importances_
        fi = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
        imp_source = 'built-in gain-based'

    except AttributeError:
        # ── FIXED permutation importance ──────────────────────────────────
        # With scoring='neg_mean_absolute_error':
        #   perm.importances_mean > 0  →  shuffling HURTS  →  feature IS important
        #   near 0 / negative          →  feature adds little value
        #
        # PREVIOUS BUG:  used -perm.importances_mean  (sign flipped → wrong rank)
        # FIX:           use  perm.importances_mean   (correct sign, no negation)
        from sklearn.inspection import permutation_importance
        print('  (Falling back to permutation importance …)')
        perm = permutation_importance(
            best, X_test, y_test,
            n_repeats   = 10,
            random_state= RANDOM_SEED,
            scoring     = 'neg_mean_absolute_error',
            n_jobs      = -1,
        )
        # NO negation — perm.importances_mean is already correctly signed
        fi = sorted(
            zip(list(X.columns), perm.importances_mean),
            key=lambda x: x[1], reverse=True,
        )
        imp_source = 'permutation-based (fixed)'

    print(f'  Source: {imp_source}')
    print_importances(fi, top_n=15)
    print(f'\n  Most important  → {fi[0][0]}  ({fi[0][1]:.4f})')
    print(f'  Least important → {fi[-1][0]}  ({fi[-1][1]:.4f})')

    # ── 9. Save artefacts ─────────────────────────────────────────────────────
    print_section('9 · Saving artefacts')

    # Model
    joblib.dump(best, MODEL_OUT)
    print(f'  Model           → {MODEL_OUT}')

    # Ordered feature list (importance rank)
    with open(FEAT_OUT, 'w', encoding='utf-8') as f:
        json.dump([k for k, _ in fi], f, indent=2)
    print(f'  Feature list    → {FEAT_OUT}')

    # Feature importances
    with open(FI_OUT, 'w', encoding='utf-8') as f:
        json.dump([{'feature': k, 'importance': float(v)} for k, v in fi], f, indent=2)
    print(f'  Importances     → {FI_OUT}')

    # Evaluation metrics
    metrics = {
        'MAE':          round(mae,  4),
        'RMSE':         round(rmse, 4),
        'R2':           round(r2,   4),
        'MAPE_pct':     round(mape, 2),
        'CV_MAE':       round(-search.best_score_, 4),
        'best_params':  {k.replace('model__', ''): v for k, v in search.best_params_.items()},
    }
    with open(EVAL_OUT, 'w', encoding='utf-8') as f:
        json.dump(metrics, f, indent=2)
    print(f'  Eval metrics    → {EVAL_OUT}')

    print_section('Done')
    print(f'  MAE={mae:.4f}  RMSE={rmse:.4f}  R²={r2:.4f}  MAPE={mape:.2f}%')
    print()


# =============================================================================
# HOW TO USE THE SAVED MODEL IN PRODUCTION (real-time prediction)
# =============================================================================
#
#   import joblib, pandas as pd
#
#   model = joblib.load('ml/models/revision_scheduler_model.pkl')
#
#   # Build a single-row DataFrame with PRE-SESSION features only.
#   # The pipeline handles all preprocessing internally.
#   new_session = pd.DataFrame([{
#       'age':                    17,
#       'dyslexia_severity':      'moderate',
#       'session_date':           '2024-03-15',   # will be split into day/month/dow
#       'subject':                'Math',
#       'prior_review_count':     2,
#       'session_duration_min':   45,
#       'time_of_day':            'Afternoon',
#       'days_since_last_review': 5,
#       'fatigue_rating':         6.0,
#       'sleep_hours_prev_night': 6.5,
#       'distraction_level':      3,
#       'phonological_load_flag': 0,
#       'wm_overload_flag':       1,
#   }])
#
#   # Apply the same date engineering used at training time
#   from train_final import engineer_date_features
#   new_session = engineer_date_features(new_session)
#   new_session.drop(columns=['topic'], errors='ignore', inplace=True)
#
#   days = int(round(model.predict(new_session)[0]))
#   print(f'Recommended next review in {days} day(s)')
#