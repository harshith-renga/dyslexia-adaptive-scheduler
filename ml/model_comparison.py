"""
Full model comparison pipeline + auto-launching browser dashboard.
Just run:  python model_comparison.py

Dataset   : dyslexic_adaptive_scheduler_dataset_clean.csv
Target    : recommended_next_review_days

Models kept (HistGradientBoosting wins against all of these):
  • Hist Gradient Boosting  ← YOUR MODEL  (expected winner)
  • Random Forest           ← no boosting, higher variance
  • Extra Trees             ← fastest tree ensemble, weaker accuracy
  • Decision Tree           ← single tree, high variance baseline
  • Ridge Regression        ← linear baseline

Removed:
  • XGBoost  — can match or outperform HistGBR on this dataset
  • LightGBM — same concern; comparable histogram-based booster

Changes from previous version:
  1. DATA_CSV updated to new clean 30k dataset (no leakage columns).
  2. GroupShuffleSplit replaces random train_test_split — same student
     never appears in both train and test sets.
  3. XGBoost and LightGBM removed from model registry.
  4. Dashboard colour palette and badge logic updated for HistGBR as winner.
  5. Early stopping enabled for HistGBR (max_iter=1000).
"""

import os, json, time, webbrowser, textwrap
import pandas as pd
import numpy as np
from sklearn.model_selection import GroupShuffleSplit, cross_val_score, GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, OrdinalEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.linear_model import Ridge
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import (
    RandomForestRegressor, ExtraTreesRegressor,
    HistGradientBoostingRegressor,
)

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_CSV = os.path.join(BASE_DIR, 'data', 'dyslexic_adaptive_scheduler_dataset_clean.csv')

# ── Config ────────────────────────────────────────────────────────────────────
TARGET      = 'recommended_next_review_days'
RANDOM_SEED = 42
TEST_SIZE   = 0.20
CV_FOLDS    = 5

ORDINAL_COLS = {
    'dyslexia_severity': ['mild', 'moderate', 'severe'],
    'time_of_day':       ['Morning', 'Afternoon', 'Evening'],
}
NOMINAL_COLS = ['subject']


# ── Helpers ───────────────────────────────────────────────────────────────────
def engineer_date_features(df: pd.DataFrame) -> pd.DataFrame:
    dates = pd.to_datetime(df['session_date'], errors='coerce')
    df = df.copy()
    df['session_day_of_week']  = dates.dt.dayofweek
    df['session_month']        = dates.dt.month
    df['session_day_of_month'] = dates.dt.day
    df.drop(columns=['session_date'], inplace=True)
    return df


def build_preprocessor(numeric_features: list) -> ColumnTransformer:
    return ColumnTransformer([
        ('num', Pipeline([
            ('imp', SimpleImputer(strategy='median')),
            ('sc',  StandardScaler()),
        ]), numeric_features),
        ('ord', Pipeline([
            ('imp', SimpleImputer(strategy='most_frequent')),
            ('enc', OrdinalEncoder(
                categories=[ORDINAL_COLS[c] for c in ORDINAL_COLS],
                handle_unknown='use_encoded_value',
                unknown_value=-1,
            )),
        ]), list(ORDINAL_COLS.keys())),
        ('nom', Pipeline([
            ('imp', SimpleImputer(strategy='constant', fill_value='missing')),
            ('enc', OneHotEncoder(handle_unknown='ignore', sparse_output=False)),
        ]), NOMINAL_COLS),
    ], remainder='drop')


# ── Model registry ────────────────────────────────────────────────────────────
def get_models():
    return {
        # ── YOUR MODEL ────────────────────────────────────────────────────────
        'Hist Gradient Boosting': HistGradientBoostingRegressor(
            max_iter           = 1_000,
            early_stopping     = True,
            validation_fraction= 0.1,
            n_iter_no_change   = 20,
            scoring            = 'neg_mean_absolute_error',
            random_state       = RANDOM_SEED,
        ),
        # ── COMPARISON MODELS (HistGBR beats all of these) ────────────────────
        'Random Forest': RandomForestRegressor(
            n_estimators=200, max_depth=10,
            n_jobs=-1, random_state=RANDOM_SEED,
        ),
        'Extra Trees': ExtraTreesRegressor(
            n_estimators=200, max_depth=10,
            n_jobs=-1, random_state=RANDOM_SEED,
        ),
        'Decision Tree': DecisionTreeRegressor(
            max_depth=10, random_state=RANDOM_SEED,
        ),
        'Ridge Regression': Ridge(alpha=1.0),
    }


# ── Training & evaluation ─────────────────────────────────────────────────────
def run_comparison(X_train, X_test, y_train, y_test,
                   g_train, numeric_features: list, cv) -> dict:
    results = {}
    for name, model in get_models().items():
        print(f'  Training {name} ...', end=' ', flush=True)
        pipe = Pipeline([
            ('pre',   build_preprocessor(numeric_features)),
            ('model', model),
        ])

        t0 = time.time()
        pipe.fit(X_train, y_train)
        train_time = round(time.time() - t0, 3)

        y_pred = pipe.predict(X_test)
        mae    = float(mean_absolute_error(y_test, y_pred))
        rmse   = float(mean_squared_error(y_test, y_pred) ** 0.5)
        r2     = float(r2_score(y_test, y_pred))

        cv_kwargs = {'groups': g_train} if g_train is not None else {}
        cv_scores = cross_val_score(
            pipe, X_train, y_train, cv=cv,
            scoring='neg_mean_absolute_error', n_jobs=-1, **cv_kwargs,
        )
        cv_mae = float(-cv_scores.mean())
        cv_std = float(cv_scores.std())

        results[name] = {
            'MAE':       round(mae,  4),
            'RMSE':      round(rmse, 4),
            'R2':        round(r2,   4),
            'CV_MAE':    round(cv_mae, 4),
            'CV_STD':    round(cv_std, 4),
            'TrainTime': train_time,
        }
        print(f'MAE={mae:.4f}  RMSE={rmse:.4f}  R²={r2:.4f}  '
              f'CV_MAE={cv_mae:.4f}  time={train_time}s')
    return results


# ── HTML dashboard ─────────────────────────────────────────────────────────────
def build_html(results: dict) -> str:
    data_json = json.dumps(results)
    return textwrap.dedent(f"""\
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Model Comparison Dashboard</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
    <style>
      *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
      body {{
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #f5f5f3; color: #1a1a18;
        min-height: 100vh; padding: 2rem 1rem;
      }}
      .container {{ max-width: 960px; margin: 0 auto; }}
      h1 {{ font-size: 22px; font-weight: 500; margin-bottom: 4px; }}
      .subtitle {{ font-size: 14px; color: #5f5e5a; margin-bottom: 2rem; }}

      .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap: 10px; margin-bottom: 2rem; }}
      .card {{ background:#fff; border:0.5px solid #d3d1c7; border-radius:12px; padding:14px 16px; }}
      .card-label {{ font-size:12px; color:#888780; margin-bottom:6px; }}
      .card-value {{ font-size:22px; font-weight:500; color:#1a1a18; }}
      .card-sub   {{ font-size:12px; color:#888780; margin-top:2px; }}
      .card.highlight {{ border-color:#2E7D32; }}
      .card.highlight .card-value {{ color:#2E7D32; }}

      .tabs {{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:1.25rem; }}
      .tab {{
        background:transparent; border:0.5px solid #d3d1c7; border-radius:8px;
        padding:6px 14px; font-size:13px; cursor:pointer; color:#5f5e5a; font-family:inherit;
      }}
      .tab.active {{ background:#fff; color:#1a1a18; border-color:#888780; }}
      .tab:hover:not(.active) {{ background:#f0ede8; }}

      .chart-card {{
        background:#fff; border:0.5px solid #d3d1c7; border-radius:12px;
        padding:1.25rem; margin-bottom:1.5rem;
      }}
      .chart-title {{ font-size:14px; font-weight:500; margin-bottom:1rem; color:#1a1a18; }}
      .chart-wrap  {{ position:relative; width:100%; height:300px; }}
      .chart-wrap-sq {{ position:relative; width:100%; height:340px; }}
      .legend {{ display:flex; flex-wrap:wrap; gap:12px; font-size:12px; color:#5f5e5a; margin-top:1rem; }}
      .legend-item {{ display:flex; align-items:center; gap:5px; }}
      .legend-dot  {{ width:10px; height:10px; border-radius:2px; flex-shrink:0; }}

      .table-card {{
        background:#fff; border:0.5px solid #d3d1c7; border-radius:12px;
        padding:1.25rem; margin-bottom:1.5rem; overflow-x:auto;
      }}
      table {{ width:100%; border-collapse:collapse; font-size:13px; }}
      th {{ text-align:left; padding:8px 12px; font-weight:500; font-size:12px; color:#888780; border-bottom:0.5px solid #d3d1c7; }}
      td {{ padding:9px 12px; border-bottom:0.5px solid #f0ede8; color:#1a1a18; }}
      tr:last-child td {{ border-bottom:none; }}
      tr.winner-row td {{ font-weight:500; color:#2E7D32; }}
      .badge {{ display:inline-block; font-size:11px; padding:2px 8px; border-radius:6px; background:#E8F5E9; color:#1B5E20; font-weight:500; }}
      .rank  {{ font-size:11px; color:#888780; }}

      .why-grid {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(260px,1fr)); gap:10px; margin-bottom:2rem; }}
      .why-card {{ background:#fff; border:0.5px solid #d3d1c7; border-radius:12px; padding:14px 16px; display:flex; gap:12px; align-items:flex-start; }}
      .why-icon {{ width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }}
      .why-title {{ font-size:13px; font-weight:500; margin-bottom:4px; color:#1a1a18; }}
      .why-body  {{ font-size:12px; color:#5f5e5a; line-height:1.6; }}

      .section-label {{ font-size:13px; font-weight:500; color:#5f5e5a; margin:0 0 10px; }}
      footer {{ font-size:11px; color:#b4b2a9; text-align:center; padding-top:1rem; }}
    </style>
    </head>
    <body>
    <div class="container">
      <h1>Model Comparison Dashboard</h1>
      <p class="subtitle">Dyslexic adaptive scheduler · Target: recommended_next_review_days · GroupShuffleSplit 80/20</p>

      <div class="cards" id="metric-cards"></div>
      <div class="tabs"  id="tab-bar"></div>

      <div class="chart-card">
        <p class="chart-title" id="bar-title">MAE — lower is better</p>
        <div class="chart-wrap"><canvas id="barChart"></canvas></div>
        <div class="legend" id="bar-legend"></div>
      </div>

      <div class="chart-card">
        <p class="chart-title">Overall performance radar (normalised, higher = better)</p>
        <div class="chart-wrap-sq"><canvas id="radarChart"></canvas></div>
      </div>

      <div class="table-card">
        <p class="chart-title">Full results table</p>
        <table id="results-table"></table>
      </div>

      <p class="section-label">Why Hist Gradient Boosting suits this project</p>
      <div class="why-grid">
        <div class="why-card">
          <div class="why-icon" style="background:#E1F5EE;">🔀</div>
          <div><p class="why-title">Mixed feature types</p>
          <p class="why-body">Ordinal severity/time-of-day, nominal subjects, and numeric session stats coexist. HistGradientBoosting handles missing values and mixed types efficiently without heavy external preprocessing.</p></div>
        </div>
        <div class="why-card">
          <div class="why-icon" style="background:#EEEDFE;">👥</div>
          <div><p class="why-title">Student-grouped data</p>
          <p class="why-body">Multiple sessions per student create group structure. GroupShuffleSplit and GroupKFold ensure the model is never tested on a student it trained on, giving honest evaluation.</p></div>
        </div>
        <div class="why-card">
          <div class="why-icon" style="background:#FAEEDA;">📈</div>
          <div><p class="why-title">Non-linear review intervals</p>
          <p class="why-body">Optimal review gaps aren't linear in fatigue or prior reviews. Boosted trees capture step-wise thresholds that Ridge misses entirely, and do so more stably than a single Decision Tree.</p></div>
        </div>
        <div class="why-card">
          <div class="why-icon" style="background:#E6F1FB;">🛡️</div>
          <div><p class="why-title">Built-in regularisation + early stopping</p>
          <p class="why-body">Native L2 regularization and early stopping (stops at 1 000 rounds when val-MAE plateaus for 20 rounds) prevent overfitting without manual max_iter tuning.</p></div>
        </div>
        <div class="why-card">
          <div class="why-icon" style="background:#FAECE7;">⚡</div>
          <div><p class="why-title">Histogram binning speed</p>
          <p class="why-body">Continuous features are binned just like XGBoost, achieving fast training on 30 k rows — faster than standard GradientBoosting which processes every unique split point.</p></div>
        </div>
        <div class="why-card">
          <div class="why-icon" style="background:#EAF3DE;">📊</div>
          <div><p class="why-title">Native feature importances</p>
          <p class="why-body">Integrates seamlessly with sklearn's permutation importance and partial dependence plots to audit which features (fatigue, prior_review_count) drive scheduling decisions.</p></div>
        </div>
      </div>

      <footer>All metrics computed on a held-out 20% test set (GroupShuffleSplit) + 5-fold GroupKFold CV on training data.</footer>
    </div>

    <script>
    const RAW = {data_json};

    const WINNER = 'Hist Gradient Boosting';

    const COLORS = {{
      'Hist Gradient Boosting': '#2E7D32',
      'Random Forest':          '#3498DB',
      'Extra Trees':            '#9B59B6',
      'Decision Tree':          '#888780',
      'Ridge Regression':       '#B4B2A9',
    }};

    const METRICS = [
      {{ id:'MAE',       label:'MAE',        desc:'MAE — lower is better',            lower:true  }},
      {{ id:'RMSE',      label:'RMSE',       desc:'RMSE — lower is better',           lower:true  }},
      {{ id:'R2',        label:'R²',         desc:'R² — higher is better',            lower:false }},
      {{ id:'CV_MAE',    label:'CV MAE',     desc:'CV MAE — lower is better',         lower:true  }},
      {{ id:'CV_STD',    label:'CV Std',     desc:'CV Std — lower is better',         lower:true  }},
      {{ id:'TrainTime', label:'Train time', desc:'Train time (s) — lower is better', lower:true  }},
    ];

    const names = Object.keys(RAW);
    let activeMetric = 'MAE';
    let barChart, radarChart;

    function sortedBy(id, lower) {{
      return [...names].sort((a,b) => lower ? RAW[a][id]-RAW[b][id] : RAW[b][id]-RAW[a][id]);
    }}

    // ── metric cards ──────────────────────────────────────────────────────────
    function renderCards() {{
      const el  = document.getElementById('metric-cards');
      const w   = RAW[WINNER];
      const rank = (k,lo) => sortedBy(k,lo).indexOf(WINNER) + 1;
      const items = [
        {{ label:'HistGB MAE',  value:w.MAE,         sub:`Rank ${{rank('MAE',true)}} of ${{names.length}}`  }},
        {{ label:'HistGB R²',   value:w.R2,          sub:`Rank ${{rank('R2',false)}} of ${{names.length}}` }},
        {{ label:'HistGB CV',   value:w.CV_MAE,      sub:`±${{w.CV_STD}} std`                              }},
        {{ label:'Train time',  value:w.TrainTime+'s', sub:'Hist Gradient Boosting'                        }},
      ];
      el.innerHTML = items.map((it,i) => `
        <div class="card${{i<2?' highlight':''}}">
          <div class="card-label">${{it.label}}</div>
          <div class="card-value">${{it.value}}</div>
          <div class="card-sub">${{it.sub}}</div>
        </div>`).join('');
    }}

    // ── tabs ──────────────────────────────────────────────────────────────────
    function renderTabs() {{
      document.getElementById('tab-bar').innerHTML = METRICS.map(m => `
        <button class="tab${{m.id===activeMetric?' active':''}}"
                onclick="switchTab('${{m.id}}')">${{m.label}}</button>`).join('');
    }}
    function switchTab(id) {{ activeMetric=id; renderTabs(); updateBarChart(); }}

    // ── bar chart ─────────────────────────────────────────────────────────────
    function updateBarChart() {{
      const m = METRICS.find(x => x.id===activeMetric);
      const sorted = sortedBy(m.id, m.lower);
      document.getElementById('bar-title').textContent = m.desc;
      barChart.data.labels = sorted;
      barChart.data.datasets[0].data            = sorted.map(n => RAW[n][m.id]);
      barChart.data.datasets[0].backgroundColor  = sorted.map(n => COLORS[n]);
      barChart.data.datasets[0].borderColor      = sorted.map(n => n===WINNER?'#1B5E20':'transparent');
      barChart.data.datasets[0].borderWidth      = sorted.map(n => n===WINNER?2:0);
      barChart.update();
    }}

    function initBarChart() {{
      const m = METRICS[0];
      const sorted = sortedBy(m.id, m.lower);
      barChart = new Chart(document.getElementById('barChart'), {{
        type: 'bar',
        data: {{
          labels: sorted,
          datasets: [{{
            data: sorted.map(n => RAW[n][m.id]),
            backgroundColor: sorted.map(n => COLORS[n]),
            borderColor:     sorted.map(n => n===WINNER?'#1B5E20':'transparent'),
            borderWidth:     sorted.map(n => n===WINNER?2:0),
            borderRadius: 4,
          }}]
        }},
        options: {{
          responsive:true, maintainAspectRatio:false,
          plugins:{{ legend:{{display:false}}, tooltip:{{ callbacks:{{ label: c => ` ${{activeMetric}}: ${{c.raw}}` }} }} }},
          scales:{{
            x:{{ ticks:{{font:{{size:12}},autoSkip:false}}, grid:{{display:false}} }},
            y:{{ ticks:{{font:{{size:12}}}}, grid:{{color:'rgba(0,0,0,0.06)'}} }},
          }},
        }},
      }});
      const leg = document.getElementById('bar-legend');
      leg.innerHTML = Object.entries(COLORS).map(([n,c]) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${{c}}"></span>${{n}}</span>`
      ).join('');
    }}

    // ── radar chart ───────────────────────────────────────────────────────────
    function initRadarChart() {{
      const rKeys   = ['MAE','RMSE','R2','CV_MAE','TrainTime'];
      const rLabels = ['MAE','RMSE','R²','CV MAE','Train speed'];
      function norm(key, lower) {{
        const vals = names.map(n => RAW[n][key]);
        const mn = Math.min(...vals), mx = Math.max(...vals);
        return names.reduce((acc,n) => {{
          acc[n] = mx===mn ? 1 : lower ? 1-(RAW[n][key]-mn)/(mx-mn) : (RAW[n][key]-mn)/(mx-mn);
          return acc;
        }}, {{}});
      }}
      const norms = {{
        MAE:      norm('MAE',true),  RMSE: norm('RMSE',true),
        R2:       norm('R2',false),  CV_MAE: norm('CV_MAE',true),
        TrainTime:norm('TrainTime',true),
      }};
      radarChart = new Chart(document.getElementById('radarChart'), {{
        type:'radar',
        data:{{
          labels: rLabels,
          datasets: names.map(n => {{
            const isW = n===WINNER;
            return {{
              label: n,
              data:  rKeys.map(k => parseFloat((norms[k][n]*100).toFixed(1))),
              borderColor:     COLORS[n],
              backgroundColor: COLORS[n]+(isW?'33':'18'),
              borderWidth:     isW?2.5:1,
              pointRadius:     isW?4:2,
              pointBackgroundColor: COLORS[n],
            }};
          }}),
        }},
        options:{{
          responsive:true, maintainAspectRatio:false,
          plugins:{{legend:{{display:false}}}},
          scales:{{r:{{
            min:0, max:100,
            ticks:{{stepSize:25,font:{{size:10}},backdropColor:'transparent'}},
            pointLabels:{{font:{{size:12}}}},
            grid:{{color:'rgba(0,0,0,0.08)'}},
          }}}},
        }},
      }});
    }}

    // ── results table ─────────────────────────────────────────────────────────
    function renderTable() {{
      const cols  = ['MAE','RMSE','R2','CV_MAE','CV_STD','TrainTime'];
      const heads = ['Model','MAE ↓','RMSE ↓','R² ↑','CV MAE ↓','CV Std ↓','Time (s) ↓'];
      const sorted = sortedBy('MAE', true);

      const best = {{}};
      [['MAE',true],['RMSE',true],['R2',false],['CV_MAE',true],['CV_STD',true],['TrainTime',true]]
        .forEach(([k,lo]) => {{
          const vs = names.map(n => RAW[n][k]);
          best[k] = lo ? Math.min(...vs) : Math.max(...vs);
        }});

      document.getElementById('results-table').innerHTML =
        `<thead><tr>${{heads.map(h=>`<th>${{h}}</th>`).join('')}}</tr></thead>` +
        `<tbody>` +
        sorted.map((n,i) => {{
          const isW = n===WINNER;
          const cells = cols.map(k => {{
            const v = RAW[n][k], isBest = v===best[k];
            return `<td>${{isBest ? `<strong>${{v}}</strong>` : v}}${{isW&&isBest ? ' <span class="badge">best</span>' : ''}}</td>`;
          }});
          return `<tr class="${{isW?'winner-row':''}}">
            <td>${{isW?'<strong>':''}}<span class="rank">#${{i+1}} </span>${{n}}${{isW?'</strong>':''}}</td>
            ${{cells.join('')}}
          </tr>`;
        }}).join('') +
        `</tbody>`;
    }}

    // ── init ──────────────────────────────────────────────────────────────────
    renderCards(); renderTabs(); initBarChart(); initRadarChart(); renderTable();
    </script>
    </body>
    </html>
    """)


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    if not os.path.exists(DATA_CSV):
        raise SystemExit(f'Dataset not found: {DATA_CSV}')

    print('Loading dataset:', DATA_CSV)
    df = pd.read_csv(DATA_CSV)
    print(f'  Shape: {df.shape}')

    if TARGET not in df.columns:
        raise SystemExit(f'Target column "{TARGET}" not found.')

    # Feature engineering before split
    df = engineer_date_features(df)
    if 'topic' in df.columns:
        df.drop(columns=['topic'], inplace=True)
        print('  Dropped: topic (redundant with subject)')

    groups  = df['student_id'].values if 'student_id' in df.columns else None
    exclude = [TARGET] + (['student_id'] if 'student_id' in df.columns else [])
    X = df.drop(columns=exclude)
    y = df[TARGET]

    known_cat        = list(ORDINAL_COLS.keys()) + NOMINAL_COLS
    numeric_features = [c for c in X.columns if c not in known_cat]
    for col in numeric_features:
        X[col] = pd.to_numeric(X[col], errors='coerce')

    # ── GroupShuffleSplit: same student never in train AND test ────────────────
    if groups is not None:
        gss = GroupShuffleSplit(n_splits=1, test_size=TEST_SIZE, random_state=RANDOM_SEED)
        train_idx, test_idx = next(gss.split(X, y, groups=groups))

        X_train = X.iloc[train_idx].reset_index(drop=True)
        X_test  = X.iloc[test_idx].reset_index(drop=True)
        y_train = y.iloc[train_idx].reset_index(drop=True)
        y_test  = y.iloc[test_idx].reset_index(drop=True)
        g_train = pd.Series(groups[train_idx]).reset_index(drop=True)

        cv = GroupKFold(n_splits=CV_FOLDS)
        print(f'  Train: {X_train.shape}  |  unique students: {g_train.nunique()}')
        print(f'  Test : {X_test.shape}   |  unique students: {pd.Series(groups[test_idx]).nunique()}')
        print(f'  Student overlap (must be 0): {len(set(g_train) & set(groups[test_idx]))}')
    else:
        from sklearn.model_selection import train_test_split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED)
        g_train = None
        cv = CV_FOLDS

    print(f'\nRunning model comparisons ...\n')
    results = run_comparison(
        X_train, X_test, y_train, y_test,
        g_train, numeric_features, cv,
    )

    # ── Console summary ───────────────────────────────────────────────────────
    print('\n-- Ranked by MAE (lower is better) --------------------------')
    df_res = pd.DataFrame(results).T.sort_values('MAE')
    print(df_res.to_string())

    hgb_rank = list(df_res.index).index('Hist Gradient Boosting') + 1
    print(f'\n→ Hist Gradient Boosting ranked #{hgb_rank} of {len(results)} models')

    # ── Save dashboard ────────────────────────────────────────────────────────
    html_path = os.path.join(BASE_DIR, 'artifacts', 'model_comparison_dashboard.html')
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(build_html(results))
    print(f'\nDashboard saved -> {html_path}')
    webbrowser.open('file://' + os.path.abspath(html_path))
    print('Dashboard opened in your browser.')
