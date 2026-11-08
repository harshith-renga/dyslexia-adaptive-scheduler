# Dyslexia Adaptive Scheduler

> An intelligent, ML-powered study scheduling application designed specifically for students with dyslexia. It predicts personalized review intervals by factoring in dyslexia-specific cognitive and physiological metrics — going far beyond traditional Spaced Repetition Systems (SRS).

[![Python](https://img.shields.io/badge/Python-3.8%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.103%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.3%2B-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [ML Model](#ml-model)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Usage](#usage)
- [Model Performance](#model-performance)
- [Feature Importances](#feature-importances)
- [Tech Stack](#tech-stack)

---

## Overview

Traditional SRS algorithms (SM-2 / Anki) are built for neurotypical learners and use a simple memory-decay curve. Students with dyslexia experience unique cognitive challenges:

- **Phonological Processing Deficits** — high phonological load drastically reduces short-term retention.
- **Working Memory Constraints** — frequent overload requires shorter, more frequent sessions.
- **Cognitive Fatigue** — decoding text depletes cognitive resources faster, making session timing critical.

This application pioneers a **context-aware spacing algorithm** that incorporates session-specific metrics (`fatigue_rating`, `cognitive_load_score`, `recall_accuracy`, `sleep_hours_prev_night`, `phonological_load_flag`) to predict the **exact optimal number of days** until the next review.

---

## Key Features

- 🧠 **Adaptive ML Predictions** — `HistGradientBoostingRegressor` predicts personalized review intervals
- 📊 **Analytics Dashboard** — visualize study history, retention trends, and upcoming reviews
- 🗓️ **Study Planner** — log sessions and immediately get a next-review recommendation
- 🔐 **User Authentication** — secure per-student profiles
- ♿ **Accessibility Settings** — dark mode, scalable fonts, dyslexia-friendly UI (Irlen syndrome support)
- ⚡ **Fast & Responsive** — React + Vite frontend with smooth Framer Motion animations

---

## Architecture

```
┌─────────────────────────────────┐       HTTP REST
│     React Frontend (Vite)       │ ─────────────────▶  ┌───────────────────────┐
│  Dashboard · Planner · Analytics│                      │  FastAPI Backend       │
│  Framer Motion · Tailwind CSS   │ ◀─────────────────   │  (Python / Uvicorn)   │
└─────────────────────────────────┘    JSON Response     └──────────┬────────────┘
                                                                     │
                                                         ┌───────────▼────────────┐
                                                         │   ML Inference Engine  │
                                                         │  HistGradientBoosting  │
                                                         │  revision_scheduler    │
                                                         │  _model.pkl            │
                                                         └────────────────────────┘
```

---

## ML Model

The core intelligence is a **`HistGradientBoostingRegressor`** pipeline trained on a dataset of dyslexic student study sessions.

### Training Pipeline

1. **Data Loading** — CSV dataset with 16 cognitive & contextual features
2. **Feature Engineering** — date decomposition (day of week, month, day of month), ordinal encoding for severity/time_of_day, one-hot encoding for subject
3. **GroupKFold Split** — student-aware splitting to prevent data leakage across users
4. **Preprocessing** — median imputation → StandardScaler for numeric; OrdinalEncoder for ordinal; OneHotEncoder for nominal
5. **Hyperparameter Tuning** — `RandomizedSearchCV` over `learning_rate`, `max_depth`, `max_iter`, `l2_regularization`
6. **Export** — serialized model + feature names + label encoders saved as `.pkl`/`.json`

---

## Project Structure

```
dyslexia-adaptive-scheduler/
├── README.md
├── docs/
│   └── RUN_GUIDE.md                       # Quick-start commands
│
├── backend/                               # FastAPI application
│   ├── main.py                            # API routes, auth, ML inference
│   ├── supabase_store.py                  # Optional Supabase storage layer
│   ├── requirements.txt                   # Python dependencies
│   └── .env.example                       # Supabase settings template
│
├── ml/                                    # Machine learning
│   ├── trained_model.py                   # Main training pipeline
│   ├── MCC_model.py                       # Multi-class severity classifier
│   ├── model_comparison.py                # Model benchmarking & comparison
│   ├── data/
│   │   └── dyslexic_adaptive_scheduler_dataset_clean.csv
│   ├── models/                            # Trained models (.pkl)
│   │   ├── revision_scheduler_model.pkl   # Primary model used by the API
│   │   ├── revision_scheduler_xgb_model.pkl
│   │   ├── dyslexia_severity_classifier.pkl
│   │   └── label_encoder_severity.pkl
│   └── artifacts/                         # Metrics, feature names, importances (.json)
│
├── supabase/
│   └── schema.sql                         # Postgres tables for the Supabase option
│
└── frontend/                              # React + Vite application
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── public/
    │   └── favicon.svg
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css                      # Design tokens and shared components
        ├── api.js                         # API client
        ├── AuthContext.jsx
        ├── ToastContext.jsx
        ├── components/
        │   └── Toast.jsx
        └── pages/
            ├── Landing.jsx
            ├── Login.jsx
            ├── Dashboard.jsx
            ├── StudyPlanner.jsx
            ├── Analytics.jsx
            └── AccessibilitySettings.jsx
```

---

## Prerequisites

### Backend (Python)
- Python 3.8+
- pip / venv

### Frontend (Node)
- Node.js 16+ or 18+
- npm

---

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Harshith-10/dyslexia-adaptive-scheduler.git
cd dyslexia-adaptive-scheduler
```

### 2. Set up the Backend

```bash
# Create and activate a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start the backend server
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

> Backend API docs available at: **http://127.0.0.1:8000/docs**

### 3. Set up the Frontend

```bash
# In a new terminal, from the project root
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

> Frontend available at: **http://127.0.0.1:5173**

---

## Usage

1. Open **http://127.0.0.1:5173** in your browser
2. Register a new student account or log in
3. Navigate to **Study Planner** to log a study session
4. Fill in cognitive metrics (fatigue, recall accuracy, sleep hours, etc.)
5. Submit — the ML model instantly predicts your **next optimal review date**
6. View your full schedule and retention trends on the **Analytics** page

---

## Model Performance

Evaluated using **GroupKFold cross-validation (5 splits)** on held-out test data:

| Metric | Value |
|--------|-------|
| **R² Score** | `0.9435` |
| **Mean Absolute Error (MAE)** | `0.3997 days` |
| **Root Mean Squared Error (RMSE)** | `0.5374 days` |

> The model explains **94.35%** of the variance in study timing, with predictions accurate to within ~10 hours on average.

---

## Feature Importances

Top predictive features driving review scheduling decisions (ordered by impact):

| Rank | Feature | Impact |
|------|---------|--------|
| 1 | `recall_accuracy` | ⚡ Strongest |
| 2 | `retention_score` | ⚡ Very High |
| 3 | `cognitive_load_score` | 🔥 High |
| 4 | `fatigue_rating` | 🔥 Significant |
| 5 | `prior_review_count` | 🔥 Significant |
| 6 | `distraction_level` | ⬆ Moderate |
| 7 | `phonological_load_flag` | ⬆ Moderate |
| 8 | `days_since_last_review` | → Minor |
| 9 | `wm_overload_flag` | → Minor |
| 10 | `sleep_hours_prev_night` | → Minor |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS, Framer Motion, Recharts, React Router |
| **Backend** | FastAPI, Uvicorn, Pydantic, SQLAlchemy |
| **ML** | scikit-learn (HistGradientBoostingRegressor), Pandas, NumPy, Joblib |
| **Tooling** | Python 3.8+, Node.js 18+, ESLint |

---

## License

This project is for educational and research purposes.

---

## ☁️ Optional: Supabase Backend

By default the app stores users and study sessions in a local SQLite file. To use
Supabase (hosted Postgres) instead, with no change to the API, frontend, or ML model:

1. Create a project at [supabase.com](https://supabase.com) and run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
2. `pip install -r backend/requirements.txt`
3. Copy `backend/.env.example` to `backend/.env` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (Project Settings → API → service_role).
4. Start the backend as usual. `GET /health` reports `"db": "supabase"` when active.

Remove the `.env` values to go back to SQLite. The service-role key is used only by the
FastAPI server (never the browser), and the tables have row level security enabled with
no public policies.
