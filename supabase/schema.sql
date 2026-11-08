-- DysLexi Scheduler: Supabase schema (mirrors backend/main.py SQLite tables).
-- Run once in the Supabase SQL editor.
-- The FastAPI backend connects with the service-role key, which bypasses RLS.
-- RLS is enabled with no policies so the public anon key can never read or write.

create table if not exists public.users (
  id            bigint generated always as identity primary key,
  username      text not null unique,
  email         text not null default '',
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.sessions (
  id              bigint generated always as identity primary key,
  user_id         bigint not null references public.users(id) on delete cascade,
  topic           text not null default 'Session',
  start_time      text not null,
  end_time        text not null,
  recall_score    double precision not null default 0.5,
  fatigue_level   integer not null default 5,
  retention_score double precision not null default 0.5,
  created_at      timestamptz not null default now()
);

create index if not exists idx_sessions_user on public.sessions(user_id);

alter table public.users    enable row level security;
alter table public.sessions enable row level security;
