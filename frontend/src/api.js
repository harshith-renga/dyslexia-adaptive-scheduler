/**
 * DysLexi Scheduler — API client
 * All requests go to the FastAPI backend (default: http://localhost:8000)
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/* ── Core request helper ─────────────────────────────────────────────── */
async function request(path, opts = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    })
  } catch (networkErr) {
    throw new Error('Cannot reach the server. Make sure the backend is running on port 8000.')
  }

  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = null }

  if (!res.ok) {
    let detail = json?.detail || json?.message || text || res.statusText
    // FastAPI validation errors (422) arrive as an array of { loc, msg }
    if (Array.isArray(detail)) {
      detail = detail.map(d => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ')
    } else if (typeof detail !== 'string') {
      detail = JSON.stringify(detail)
    }
    throw new Error(detail)
  }
  return json ?? {}
}

/* ── Auth ─────────────────────────────────────────────────────────────── */
export async function register({ username, email = '', password }) {
  return request('/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })
}

export async function login({ username, password }) {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

/* ── Sessions ─────────────────────────────────────────────────────────── */
export async function createSession(session) {
  return request('/session', {
    method: 'POST',
    body: JSON.stringify(session),
  })
}

export async function getSessions(userId) {
  return request(`/sessions/${userId}`)
}

export async function deleteSession(sessionId) {
  return request(`/session/${sessionId}`, { method: 'DELETE' })
}

export async function clearSessions(userId) {
  return request(`/sessions/${userId}/all`, { method: 'DELETE' })
}

/* ── Stats ─────────────────────────────────────────────────────────────── */
export async function getStats(userId) {
  return request(`/stats/${userId}`)
}

/* ── ML Prediction ─────────────────────────────────────────────────────── */
export async function predict(payload) {
  return request('/predict', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/* ── Model info ─────────────────────────────────────────────────────────── */
export async function getModelInfo() {
  return request('/model/info')
}

/* ── Forgetting curve ────────────────────────────────────────────────────── */
export async function forgetting(t, s) {
  return request(`/forgetting/${t}/${s}`)
}

/* ── Health check ────────────────────────────────────────────────────────── */
export async function healthCheck() {
  return request('/health')
}

export default {
  register, login,
  createSession, getSessions, deleteSession, clearSessions,
  getStats, predict, getModelInfo, forgetting, healthCheck,
}
