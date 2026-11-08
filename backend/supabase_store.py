"""
Optional Supabase (Postgres) storage for DysLexi Scheduler.

Off by default. Set SUPABASE_URL and SUPABASE_SERVICE_KEY (see .env.example)
and main.py routes users/sessions here instead of the local SQLite file.
The REST API, request/response shapes and ML code are unchanged.
"""

from __future__ import annotations

import os
from typing import Optional

try:  # optional dependency
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
# Keys never contain whitespace; drop any that slipped in when the value was pasted.
SUPABASE_KEY = "".join(os.getenv("SUPABASE_SERVICE_KEY", "").split())

_client = None
enabled = False

if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client

        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        enabled = True
        print(f"[Supabase] Storage enabled -> {SUPABASE_URL}")
    except Exception as e:  # missing package or bad credentials
        print(f"[Supabase] Disabled, falling back to SQLite: {e}")

SESSION_COLUMNS = (
    "id, user_id, topic, start_time, end_time, "
    "recall_score, fatigue_level, retention_score, created_at"
)


# ── Users ────────────────────────────────────────────────────────────────────
def find_user_id(username: str) -> Optional[int]:
    res = _client.table("users").select("id").eq("username", username).limit(1).execute()
    return res.data[0]["id"] if res.data else None


def create_user(username: str, email: str, password_hash: str) -> int:
    res = (
        _client.table("users")
        .insert({"username": username, "email": email, "password_hash": password_hash})
        .execute()
    )
    return res.data[0]["id"]


def get_user_for_login(username: str) -> Optional[dict]:
    res = (
        _client.table("users")
        .select("id, username, password_hash")
        .eq("username", username)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def update_password_hash(user_id: int, password_hash: str) -> None:
    _client.table("users").update({"password_hash": password_hash}).eq("id", user_id).execute()


def user_exists(user_id: int) -> bool:
    res = _client.table("users").select("id").eq("id", user_id).limit(1).execute()
    return bool(res.data)


# ── Sessions ─────────────────────────────────────────────────────────────────
def add_session(row: dict) -> None:
    _client.table("sessions").insert(row).execute()


def list_sessions(user_id: int) -> list[dict]:
    res = (
        _client.table("sessions")
        .select(SESSION_COLUMNS)
        .eq("user_id", user_id)
        .order("start_time")
        .execute()
    )
    return res.data


def delete_session(session_id: int) -> None:
    _client.table("sessions").delete().eq("id", session_id).execute()


def clear_sessions(user_id: int) -> None:
    _client.table("sessions").delete().eq("user_id", user_id).execute()
