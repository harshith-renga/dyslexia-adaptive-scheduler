"""
Training pipeline: preprocessing + HistGradientBoostingClassifier + RandomizedSearchCV
Target: dyslexia_severity  →  3-class classification
  Class 0 – mild
  Class 1 – moderate
  Class 2 – severe

Pipeline notes:
  • dyslexia_severity is the TARGET, so it is removed from the feature set.
  • recommended_next_review_days is kept as an input feature (numeric).
  • session_date is engineered into numeric features before the split.
  • time_of_day uses OrdinalEncoder (ordered); subject uses OneHotEncoder.
  • Groups (student_id) drive GroupKFold to prevent student leakage.
  • class_weight='balanced' is simulated via compute_sample_weight at fit time
    because HistGradientBoostingClassifier accepts sample_weight directly.
"""

import os
import json
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, RandomizedSearchCV, GroupKFold
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import (
    StandardScaler, OneHotEncoder, OrdinalEncoder, LabelEncoder
)
from sklearn.metrics import (
    accuracy_score, f1_score, classification_report, confusion_matrix
)
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.inspection import permutation_importance
import joblib
import warnings
warnings.filterwarnings('ignore')

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_CSV  = os.path.join(BASE_DIR, 'data', 'dyslexic_adaptive_scheduler_dataset_clean.csv')
MODEL_OUT = os.path.join(BASE_DIR, 'models', 'dyslexia_severity_classifier.pkl')
FEAT_OUT  = os.path.join(BASE_DIR, 'artifacts', 'feature_names_severity.json')
FI_OUT    = os.path.join(BASE_DIR, 'artifacts', 'feature_importances_severity.json')
LE_OUT    = os.path.join(BASE_DIR, 'models', 'label_encoder_severity.pkl')

# ── Config ────────────────────────────────────────────────────────────────────
TARGET      = 'dyslexia_severity'                        # ← classification target
SEVERITY_ORDER = ['mild', 'moderate', 'severe']          # ordinal order for display
KEEP_TOPIC  = False
RANDOM_SEED = 42
TEST_SIZE   = 0.2
N_ITER      = 20


# ── Helpers ───────────────────────────────────────────────────────────────────

def engineer_date_features(df: pd.DataFrame) -> pd.DataFrame:
    """Parse session_date → three numeric columns, drop the raw string column."""
    dates = pd.to_datetime(df['session_date'], errors='coerce')
    df = df.copy()
    df['session_day_of_week']  = dates.dt.dayofweek    # 0 Mon … 6 Sun
    df['session_month']        = dates.dt.month         # 1–12
    df['session_day_of_month'] = dates.dt.day           # 1–31
    df.drop(columns=['session_date'], inplace=True)
    return df


def print_confusion_matrix(cm: np.ndarray, labels: list) -> None:
    col_w  = max(len(str(l)) for l in labels) + 2
    header = ' ' * col_w + ''.join(f'{str(l):>{col_w}}' for l in labels)
    print(header)
    for i, row_label in enumerate(labels):
        row = f'{str(row_label):>{col_w}}' + ''.join(f'{v:>{col_w}}' for v in cm[i])
        print(row)


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':

    # ── Load ──────────────────────────────────────────────────────────────────
    if not os.path.exists(DATA_CSV):
        raise SystemExit(f'Dataset not found: {DATA_CSV}')
    print('Loading dataset:', DATA_CSV)
    df = pd.read_csv(DATA_CSV)
    print(f'  Shape: {df.shape}')

    if TARGET not in df.columns:
        raise SystemExit(f'Target column "{TARGET}" not found in dataset.')

    # ── Feature engineering (whole df, before split) ──────────────────────────
    if 'session_date' in df.columns:
        df = engineer_date_features(df)

    if not KEEP_TOPIC and 'topic' in df.columns:
        df.drop(columns=['topic'], inplace=True)
        print('  Dropped: topic (redundant with subject)')

    # ── Encode the target: mild=0, moderate=1, severe=2 ───────────────────────
    le = LabelEncoder()
    le.fit(SEVERITY_ORDER)                        # fixes the order explicitly
    df[TARGET] = le.transform(df[TARGET].str.strip().str.lower())

    print('\n  Target class distribution:')
    vc = df[TARGET].value_counts().sort_index()
    for code, label in enumerate(le.classes_):
        n = vc.get(code, 0)
        print(f'    [{code}] {label:<10} → {n:>5} samples ({n/len(df)*100:.1f}%)')

    # ── Separate features / target / groups ───────────────────────────────────
    groups  = df['student_id'].values if 'student_id' in df.columns else None
    exclude = [TARGET] + (['student_id'] if 'student_id' in df.columns else [])
    X = df.drop(columns=exclude)
    y = df[TARGET]

    # ── Feature type definitions ───────────────────────────────────────────────
    # dyslexia_severity is now the TARGET → removed from features
    ORDINAL_COLS = {
        'time_of_day': ['Morning', 'Afternoon', 'Evening'],
    }
    NOMINAL_COLS     = ['subject']
    known_cat        = list(ORDINAL_COLS.keys()) + NOMINAL_COLS
    numeric_features = [c for c in X.columns if c not in known_cat]

    # Coerce all remaining columns to float
    for col in numeric_features:
        X[col] = pd.to_numeric(X[col], errors='coerce')

    print(f'\n  Numeric features  ({len(numeric_features)}): {numeric_features}')
    print(f'  Ordinal features  ({len(ORDINAL_COLS)}):      {list(ORDINAL_COLS.keys())}')
    print(f'  Nominal features  ({len(NOMINAL_COLS)}):      {NOMINAL_COLS}')

    # ── Train / test split ────────────────────────────────────────────────────
    if groups is not None:
        X_train, X_test, y_train, y_test, g_train, g_test = train_test_split(
            X, y, groups,
            test_size=TEST_SIZE,
            random_state=RANDOM_SEED,
        )
        X_train = X_train.reset_index(drop=True)
        X_test  = X_test.reset_index(drop=True)
        y_train = y_train.reset_index(drop=True)
        y_test  = y_test.reset_index(drop=True)
        g_train = (g_train.reset_index(drop=True)
                   if hasattr(g_train, 'reset_index')
                   else pd.Series(g_train).reset_index(drop=True))
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=TEST_SIZE,
            random_state=RANDOM_SEED,
            stratify=y,              # balanced class split when no groups
        )
        g_train = g_test = None

    # Class-balanced sample weights (compensates for imbalanced severity classes)
    sample_weights_train = compute_sample_weight(class_weight='balanced', y=y_train)

    print(f'\n  Train: {X_train.shape}, Test: {X_test.shape}')

    # ── Preprocessing pipeline ────────────────────────────────────────────────
    numeric_transformer = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler',  StandardScaler()),
    ])

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

    preprocessor = ColumnTransformer([
        ('num',     numeric_transformer,  numeric_features),
        ('ordinal', ordinal_transformer,  list(ORDINAL_COLS.keys())),
        ('nominal', nominal_transformer,  NOMINAL_COLS),
    ], remainder='drop')

    # ── Classifier + hyperparameter search ────────────────────────────────────
    pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('model', HistGradientBoostingClassifier(random_state=RANDOM_SEED)),
    ])

    param_dist = {
        'model__max_iter':          [100, 200, 400],
        'model__max_depth':         [None, 6, 10, 16],
        'model__learning_rate':     [0.01, 0.05, 0.1, 0.2],
        'model__max_leaf_nodes':    [15, 31, 63, None],
        'model__l2_regularization': [0.0, 0.1, 0.5],
        'model__min_samples_leaf':  [5, 10, 20],
        'model__early_stopping':    [True, False],
    }

    cv = GroupKFold(n_splits=5) if g_train is not None else 5

    search = RandomizedSearchCV(
        pipeline,
        param_distributions=param_dist,
        n_iter=N_ITER,
        cv=cv,
        scoring='f1_weighted',
        random_state=RANDOM_SEED,
        n_jobs=-1,
        verbose=1,
        refit=True,
    )

    print('\nStarting hyperparameter search …')
    fit_kwargs = {'model__sample_weight': sample_weights_train}
    if g_train is not None:
        fit_kwargs['groups'] = g_train

    search.fit(X_train, y_train, **fit_kwargs)

    best = search.best_estimator_
    print('\nBest params:')
    for k, v in search.best_params_.items():
        print(f'  {k}: {v}')

    # ── Evaluation ────────────────────────────────────────────────────────────
    y_pred = best.predict(X_test)

    acc  = accuracy_score(y_test, y_pred)
    f1_w = f1_score(y_test, y_pred, average='weighted')
    f1_m = f1_score(y_test, y_pred, average='macro')

    print(f'\n{"─"*50}')
    print(f'  Accuracy          : {acc:.4f}')
    print(f'  F1 (weighted)     : {f1_w:.4f}')
    print(f'  F1 (macro)        : {f1_m:.4f}')
    print(f'{"─"*50}')

    print('\nClassification Report:')
    print(classification_report(
        y_test, y_pred,
        labels=[0, 1, 2],
        target_names=le.classes_,   # ['mild', 'moderate', 'severe']
        digits=4,
    ))

    print('\nConfusion Matrix (rows=actual, cols=predicted):')
    cm = confusion_matrix(y_test, y_pred, labels=[0, 1, 2])
    print_confusion_matrix(cm, le.classes_)

    # ── Feature importances ───────────────────────────────────────────────────
    pre = best.named_steps['preprocessor']

    feature_names = list(numeric_features)
    feature_names += list(ORDINAL_COLS.keys())
    ohe = pre.named_transformers_['nominal'].named_steps['onehot']
    for col, cats in zip(NOMINAL_COLS, ohe.categories_):
        feature_names.extend([f'{col}__{c}' for c in cats])

    try:
        importances = best.named_steps['model'].feature_importances_
        fi = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
    except AttributeError:
        print('\nComputing permutation importances …')
        perm = permutation_importance(
            best, X_test, y_test,
            n_repeats=10,
            random_state=RANDOM_SEED,
            scoring='f1_weighted',
            n_jobs=-1,
        )
        fi = sorted(zip(feature_names, perm.importances_mean),
                    key=lambda x: x[1], reverse=True)

    print('\nTop 15 feature importances:')
    for name, score in fi[:15]:
        print(f'  {name:<40} {score:.4f}')

    # ── Save artefacts ────────────────────────────────────────────────────────
    joblib.dump(best, MODEL_OUT)
    print(f'\nModel saved       → {MODEL_OUT}')

    joblib.dump(le, LE_OUT)
    print(f'LabelEncoder      → {LE_OUT}')

    with open(FEAT_OUT, 'w', encoding='utf-8') as f:
        json.dump([k for k, _ in fi], f, indent=2)
    print(f'Features saved    → {FEAT_OUT}')

    with open(FI_OUT, 'w', encoding='utf-8') as f:
        json.dump([{'feature': k, 'importance': float(v)} for k, v in fi], f, indent=2)
    print(f'Importances saved → {FI_OUT}')

    # ── CV summary ────────────────────────────────────────────────────────────
    print('\nCV Results (top 5 by mean F1-weighted):')
    cv_df = pd.DataFrame(search.cv_results_)
    top5  = cv_df.nlargest(5, 'mean_test_score')[
        ['mean_test_score', 'std_test_score', 'params']
    ]
    for _, row in top5.iterrows():
        print(f'  F1={row["mean_test_score"]:.4f} ± {row["std_test_score"]:.4f} | {row["params"]}')

    print('\nDone.')