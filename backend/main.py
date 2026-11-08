"""
DysLexi Scheduler — FastAPI Backend
====================================
• SQLite persistence  (scheduler.db next to this file)
• Login / Register / Session CRUD / ML Prediction / Forgetting Curve
• Full CORS for local Vite dev servers
"""

from __future__ import annotations

import os
import sqlite3
import hashlib
import hmac
import json
import math
from contextlib import contextmanager
from datetime import datetime
from typing import Optional, List

import numpy as np
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── optional heavy deps ──────────────────────────────────────────────────────
try:
    import joblib
    import pandas as pd
    _HAS_ML = True
except ImportError:
    _HAS_ML = False

# ════════════════════════════════════════════════════════════════════════════
# App setup
# ════════════════════════════════════════════════════════════════════════════
app = FastAPI(title="DysLexi Scheduler API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ════════════════════════════════════════════════════════════════════════════
# SQLite database
# ════════════════════════════════════════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, "scheduler.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def db():
    conn = _get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create tables if they don't exist."""
    with db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            username    TEXT    UNIQUE NOT NULL,
            email       TEXT    NOT NULL DEFAULT '',
            password_hash TEXT  NOT NULL,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            topic          TEXT    NOT NULL DEFAULT 'Session',
            start_time     TEXT    NOT NULL,
            end_time       TEXT    NOT NULL,
            recall_score   REAL    NOT NULL DEFAULT 0.5,
            fatigue_level  INTEGER NOT NULL DEFAULT 5,
            retention_score REAL   NOT NULL DEFAULT 0.5,
            created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        """)


init_db()

# Optional Supabase storage (enabled only when SUPABASE_URL / SUPABASE_SERVICE_KEY are set)
import supabase_store as sb


# ════════════════════════════════════════════════════════════════════════════
# ML model (optional)
# ════════════════════════════════════════════════════════════════════════════
model = None
FEATURE_IMPORTANCES: list = []

if _HAS_ML:
    ML_DIR     = os.path.join(BASE_DIR, "..", "ml")
    MODEL_PATH = os.path.join(ML_DIR, "models", "revision_scheduler_model.pkl")
    FI_PATH    = os.path.join(ML_DIR, "artifacts", "feature_importances.json")

    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            print(f"[ML] Model loaded from {MODEL_PATH}")
        except Exception as e:
            print(f"[ML] Could not load model: {e}")

    if os.path.exists(FI_PATH):
        try:
            with open(FI_PATH, "r", encoding="utf-8") as f:
                FEATURE_IMPORTANCES = json.load(f)
        except Exception:
            pass


# ════════════════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════════════════
_PBKDF2_ROUNDS = 200_000


def _hash(password: str) -> str:
    """Salted PBKDF2 hash, stored as 'pbkdf2$<salt hex>$<hash hex>'."""
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2${salt.hex()}${digest.hex()}"


def _verify(password: str, stored: str) -> bool:
    """Check a password against a stored hash (supports legacy unsalted SHA-256)."""
    if stored.startswith("pbkdf2$"):
        try:
            _, salt_hex, hash_hex = stored.split("$")
            digest = hashlib.pbkdf2_hmac(
                "sha256", password.encode(), bytes.fromhex(salt_hex), _PBKDF2_ROUNDS
            )
            return hmac.compare_digest(digest.hex(), hash_hex)
        except ValueError:
            return False
    legacy = hashlib.sha256(password.encode()).hexdigest()
    return hmac.compare_digest(legacy, stored)


def _is_legacy_hash(stored: str) -> bool:
    return not stored.startswith("pbkdf2$")


def _parse_dt(value: str) -> datetime:
    """fromisoformat that also accepts a trailing 'Z' (Python < 3.11)."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


def _user_by_id(conn: sqlite3.Connection, uid: int) -> Optional[dict]:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    return _row_to_dict(row) if row else None


# ════════════════════════════════════════════════════════════════════════════
# Pydantic models
# ════════════════════════════════════════════════════════════════════════════
class RegisterRequest(BaseModel):
    username: str
    email:    str = ""
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str
    email:    str = ""   # ignored — kept for backwards compat with old clients


class StudySessionIn(BaseModel):
    user_id:        Optional[int] = None
    topic:          str  = "Session"
    start_time:     str
    end_time:       str
    recall_score:   float = Field(0.5, ge=0, le=1)
    fatigue_level:  int   = Field(5, ge=0, le=10)
    retention_score: float = Field(0.5, ge=0, le=1)


class PredictionRequest(BaseModel):
    age:                   int
    dyslexia_severity:     str
    subject:               str
    session_duration_min:  float
    time_of_day:           str
    days_since_last_review: float
    fatigue_rating:        float
    sleep_hours_prev_night: float
    distraction_level:     float
    phonological_load_flag: int
    wm_overload_flag:      int
    cognitive_load_score:  float
    recall_accuracy:       float
    retention_score:       float
    prior_review_count:    int
    session_date:          str


# ════════════════════════════════════════════════════════════════════════════
# Routes
# ════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"message": "DysLexi Scheduler API v2", "docs": "/docs"}


# ── Auth ────────────────────────────────────────────────────────────────────

@app.post("/register")
def register(body: RegisterRequest):
    if not body.username.strip():
        raise HTTPException(400, "Username cannot be empty")
    if len(body.password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters")

    if sb.enabled:
        name = body.username.strip()
        if sb.find_user_id(name):
            raise HTTPException(400, "Username already taken. Please choose another.")
        uid = sb.create_user(name, body.email.strip(), _hash(body.password))
        return {"message": "Account created successfully", "user_id": uid}

    with db() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ?", (body.username.strip(),)
        ).fetchone()
        if existing:
            raise HTTPException(400, "Username already taken. Please choose another.")

        cursor = conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (body.username.strip(), body.email.strip(), _hash(body.password))
        )
        user_id = cursor.lastrowid

    return {"message": "Account created successfully", "user_id": user_id}


@app.post("/login")
def login(body: LoginRequest):
    if not body.username.strip() or not body.password:
        raise HTTPException(400, "Username and password are required")

    if sb.enabled:
        row = sb.get_user_for_login(body.username.strip())
    else:
        with db() as conn:
            row = conn.execute(
                "SELECT id, username, password_hash FROM users WHERE username = ?",
                (body.username.strip(),)
            ).fetchone()

    if not row or not _verify(body.password, row["password_hash"]):
        raise HTTPException(401, "Incorrect username or password")

    # Quietly upgrade accounts created with the old unsalted SHA-256 hash
    if _is_legacy_hash(row["password_hash"]):
        new_hash = _hash(body.password)
        if sb.enabled:
            sb.update_password_hash(row["id"], new_hash)
        else:
            with db() as conn:
                conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, row["id"]))

    return {"message": "Login successful", "user_id": row["id"], "username": row["username"]}


# ── Sessions ─────────────────────────────────────────────────────────────────

@app.post("/session")
def create_session(s: StudySessionIn):
    # Never write a session into another account: the user must be named and exist.
    if s.user_id is None:
        raise HTTPException(400, "user_id is required")
    uid = s.user_id

    try:
        if _parse_dt(s.end_time) < _parse_dt(s.start_time):
            raise HTTPException(400, "end_time must not be before start_time")
    except ValueError:
        raise HTTPException(400, "start_time and end_time must be ISO 8601 timestamps")

    if sb.enabled:
        if not sb.user_exists(uid):
            raise HTTPException(404, "User not found. Please sign in again.")
        sb.add_session({
            "user_id": uid, "topic": s.topic,
            "start_time": s.start_time, "end_time": s.end_time,
            "recall_score": s.recall_score, "fatigue_level": s.fatigue_level,
            "retention_score": s.retention_score,
        })
        return {"message": "Session saved"}

    with db() as conn:
        if not _user_by_id(conn, uid):
            raise HTTPException(404, "User not found. Please sign in again.")

        conn.execute(
            """INSERT INTO sessions
               (user_id, topic, start_time, end_time, recall_score, fatigue_level, retention_score)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (uid, s.topic, s.start_time, s.end_time,
             s.recall_score, s.fatigue_level, s.retention_score)
        )

    return {"message": "Session saved"}


@app.get("/sessions/{user_id}")
def get_sessions(user_id: int):
    if sb.enabled:
        return sb.list_sessions(user_id)
    with db() as conn:
        rows = conn.execute(
            """SELECT id, user_id, topic, start_time, end_time,
                      recall_score, fatigue_level, retention_score, created_at
               FROM sessions WHERE user_id = ?
               ORDER BY start_time ASC""",
            (user_id,)
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


@app.delete("/session/{session_id}")
def delete_session(session_id: int):
    if sb.enabled:
        sb.delete_session(session_id)
        return {"message": "Session deleted"}
    with db() as conn:
        conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    return {"message": "Session deleted"}


@app.delete("/sessions/{user_id}/all")
def clear_sessions(user_id: int):
    if sb.enabled:
        sb.clear_sessions(user_id)
        return {"message": "All sessions cleared"}
    with db() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    return {"message": "All sessions cleared"}


# ── Stats endpoint ────────────────────────────────────────────────────────────

@app.get("/stats/{user_id}")
def get_stats(user_id: int):
    if sb.enabled:
        sessions = sb.list_sessions(user_id)
    else:
        with db() as conn:
            rows = conn.execute(
                "SELECT recall_score, fatigue_level, retention_score, start_time, end_time FROM sessions WHERE user_id = ?",
                (user_id,)
            ).fetchall()
        sessions = [_row_to_dict(r) for r in rows]
    total_minutes = 0
    for s in sessions:
        try:
            start = _parse_dt(s["start_time"])
            end   = _parse_dt(s["end_time"])
            total_minutes += max(0, (end - start).total_seconds() / 60)
        except Exception:
            pass

    avg_retention = (
        sum(s["retention_score"] for s in sessions) / len(sessions)
        if sessions else 0
    )
    avg_fatigue = (
        sum(s["fatigue_level"] for s in sessions) / len(sessions)
        if sessions else 0
    )

    return {
        "session_count": len(sessions),
        "total_study_minutes": round(total_minutes, 1),
        "avg_retention_pct": round(avg_retention * 100, 1),
        "avg_fatigue_out_of_10": round(avg_fatigue, 1),
    }


# ── ML Prediction ─────────────────────────────────────────────────────────────

def _simple_predict(req: PredictionRequest) -> float:
    """
    Rule-based fallback when the sklearn model is unavailable.
    Uses Ebbinghaus-style interval with modifiers.
    """
    base = 1.0
    # Better recall → longer interval
    base += req.recall_accuracy * 6
    # More sleep → longer interval
    base += max(0, (req.sleep_hours_prev_night - 4)) * 0.4
    # Higher fatigue → shorter interval
    base -= req.fatigue_rating * 0.3
    # Longer session → slightly longer interval
    base += req.session_duration_min * 0.02
    # More prior reviews → longer spaced repetition gap
    base += req.prior_review_count * 0.5
    # Days since last review penalty
    base -= min(req.days_since_last_review * 0.1, 2)
    # Severity adjustment
    sev = {"mild": 1.0, "moderate": 0.85, "severe": 0.7}.get(req.dyslexia_severity.lower(), 0.85)
    base *= sev
    return max(1.0, round(base, 1))


@app.post("/predict")
def predict_next_revision(req: PredictionRequest):
    # Try ML model first
    if model and _HAS_ML:
        try:
            dt = datetime.fromisoformat(req.session_date.replace("Z", "+00:00"))
        except Exception:
            dt = datetime.now()

        row = {
            "age": req.age,
            "dyslexia_severity": req.dyslexia_severity,
            "subject": req.subject,
            "prior_review_count": req.prior_review_count,
            "session_duration_min": req.session_duration_min,
            "time_of_day": req.time_of_day,
            "days_since_last_review": req.days_since_last_review,
            "fatigue_rating": req.fatigue_rating,
            "sleep_hours_prev_night": req.sleep_hours_prev_night,
            "distraction_level": req.distraction_level,
            "phonological_load_flag": req.phonological_load_flag,
            "wm_overload_flag": req.wm_overload_flag,
            "cognitive_load_score": req.cognitive_load_score,
            "recall_accuracy": req.recall_accuracy,
            "retention_score": req.retention_score,
            "session_day_of_week": dt.weekday(),
            "session_month": dt.month,
            "session_day_of_month": dt.day,
        }
        try:
            df = pd.DataFrame([row])
            val = float(model.predict(df)[0])
            return {"next_revision_interval": val, "source": "ml_model"}
        except Exception as e:
            print(f"[ML] Prediction error (using fallback): {e}")

    # Rule-based fallback
    val = _simple_predict(req)
    return {"next_revision_interval": val, "source": "rule_based"}


# ── Forgetting curve ──────────────────────────────────────────────────────────

@app.get("/forgetting/{t}/{s}")
def forgetting_curve(t: float, s: float):
    if s <= 0:
        raise HTTPException(400, "Stability 's' must be > 0")
    retention = math.exp(-t / s)
    return {"retention": round(retention, 4), "t": t, "s": s}


# ── Model info ────────────────────────────────────────────────────────────────

@app.get("/model/info")
def model_info():
    return {
        "model_loaded": bool(model),
        "ml_available": _HAS_ML,
        "importances": FEATURE_IMPORTANCES[:10] if FEATURE_IMPORTANCES else [],
        "fallback": "rule-based spaced-repetition formula",
    }


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "db": "supabase" if sb.enabled else DB_PATH,
        "model_loaded": bool(model),
    }