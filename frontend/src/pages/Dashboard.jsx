import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Zap, TrendingUp, Clock, AlertCircle, Brain, RefreshCw, Save, Wifi, WifiOff } from 'lucide-react'
import { predict, createSession, getSessions, healthCheck } from '../api'
import { useAuth } from '../AuthContext'
import { useToast } from '../ToastContext'

/* ── Backend status banner ─────────────────────────────── */
function BackendStatus({ online }) {
  if (online === null) return null
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: 10,
        background: online ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${online ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        fontSize: 13, fontWeight: 500,
      }}
    >
      {online
        ? <><Wifi size={14} className="text-emerald-400" /> Backend connected</>
        : <><WifiOff size={14} className="text-red-400" /> Backend offline — start the FastAPI server on port 8000</>}
    </div>
  )
}

/* ── Stat card ─────────────────────────────────────────── */
function StatCard({ icon: Icon, color, label, value, sub, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-7"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-3 mb-4">
        <Icon size={22} style={{ color }} />
        <span className="text-sm font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div className="stat-number" style={{ color }}>{value}</div>
      {sub && <div className="text-slate-400 text-sm mt-2">{sub}</div>}
    </motion.div>
  )
}

/* ── Fatigue bar ────────────────────────────────────────── */
function FatigueBar({ pct }) {
  const color = pct <= 33 ? '#10B981' : pct <= 66 ? '#F59E0B' : '#EF4444'
  const label = pct <= 33
    ? '😊 Low — you\'re good to study'
    : pct <= 66
      ? '😐 Moderate — take short breaks'
      : '😴 High — rest is recommended'
  return (
    <div>
      <div className="progress-bar mb-3">
        <div
          className="progress-fill"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}80, ${color})` }}
        />
      </div>
      <p className="font-semibold text-sm" style={{ color }}>{label}</p>
      <p className="text-slate-400 text-xs mt-1">{pct}% average fatigue across your sessions</p>
    </div>
  )
}

/* ── Dashboard ──────────────────────────────────────────── */
export default function Dashboard({ darkMode }) {
  const { user } = useAuth()
  const toast = useToast()

  const [backendOnline, setBackendOnline] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [prediction, setPrediction] = useState(null)
  const [predicting, setPredicting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [topic, setTopic] = useState('')

  const [form, setForm] = useState({
    recall_accuracy:       0.65,
    fatigue_rating:        5,
    sleep_hours_prev_night: 7,
    session_duration_min:  30,
  })

  /* ── Check backend health on mount ── */
  useEffect(() => {
    healthCheck()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false))
  }, [])

  /* ── Load sessions ── */
  const loadSessions = useCallback(() => {
    if (!user) return
    setLoading(true)
    getSessions(user.user_id)
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(err => {
        setBackendOnline(false)
        setSessions([])
      })
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => { loadSessions() }, [loadSessions])

  /* ── Computed stats ── */
  const totalMin = sessions.reduce((sum, s) => {
    try { return sum + Math.max(0, (new Date(s.end_time) - new Date(s.start_time)) / 60000) }
    catch { return sum }
  }, 0)

  const avgRetention = sessions.length
    ? Math.round((sessions.reduce((a, b) => a + (b.retention_score || 0), 0) / sessions.length) * 100)
    : 0

  const avgFatiguePct = sessions.length
    ? Math.round((sessions.reduce((a, b) => a + (b.fatigue_level || 0), 0) / sessions.length) / 10 * 100)
    : 0

  const todayISO = new Date().toISOString().slice(0, 10)
  const todaySessions = sessions.filter(s => {
    try { return new Date(s.start_time).toISOString().slice(0, 10) === todayISO }
    catch { return false }
  })

  /* ── Predict ── */
  const handlePredict = async (e) => {
    e && e.preventDefault()
    setPredicting(true)
    try {
      const res = await predict({
        age: 14,
        dyslexia_severity: 'moderate',
        subject: topic.trim() || 'General',
        session_duration_min: Number(form.session_duration_min),
        time_of_day: (() => {
          const h = new Date().getHours()
          return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
        })(),
        days_since_last_review: 3,
        fatigue_rating: Number(form.fatigue_rating),
        sleep_hours_prev_night: Number(form.sleep_hours_prev_night),
        distraction_level: 2,
        phonological_load_flag: 0,
        wm_overload_flag: 0,
        cognitive_load_score: 0.35,
        recall_accuracy: Number(form.recall_accuracy),
        retention_score: Number(form.recall_accuracy) * 0.9,
        prior_review_count: sessions.length,
        session_date: new Date().toISOString(),
      })

      if (res.next_revision_interval !== undefined) {
        setPrediction(res.next_revision_interval)
        const src = res.source === 'ml_model' ? '(AI model)' : '(rule-based)'
        toast(`Review in ${Math.round(res.next_revision_interval)} day(s) ${src} 🧠`, 'success')
        setBackendOnline(true)
      } else {
        toast('Could not get prediction — check backend', 'error')
      }
    } catch (err) {
      toast(err.message, 'error')
      if (err.message.includes('server')) setBackendOnline(false)
    } finally {
      setPredicting(false)
    }
  }

  /* ── Save session ── */
  const handleSave = async () => {
    if (!topic.trim()) { toast('Please enter a topic before saving', 'error'); return }
    setSaving(true)
    try {
      const start = new Date().toISOString()
      const end   = new Date(Date.now() + Number(form.session_duration_min) * 60000).toISOString()
      await createSession({
        user_id:        user?.user_id || 1,
        topic:          topic.trim(),
        start_time:     start,
        end_time:       end,
        recall_score:   Number(form.recall_accuracy),
        fatigue_level:  Math.round(Number(form.fatigue_rating)),
        retention_score: Number(form.recall_accuracy) || 0.5,
      })
      toast('Session saved! ✅', 'success')
      setBackendOnline(true)
      loadSessions()
      setTopic('')
    } catch (err) {
      toast(err.message, 'error')
      if (err.message.includes('server')) setBackendOnline(false)
    } finally {
      setSaving(false)
    }
  }

  const chartData = sessions.slice(-10).map(s => ({
    name: new Date(s.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    'Retention %': Math.round((s.retention_score || 0) * 100),
    'Fatigue /10': s.fatigue_level || 0,
  }))

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-extrabold mb-2">
            <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Welcome back, <strong className="text-slate-200">{user?.username}</strong>. Here's your study health.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <BackendStatus online={backendOnline} />
          <button
            onClick={loadSessions}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            title="Refresh sessions"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          icon={Clock} color="#6366F1" label="Total Study Time" delay={0}
          value={`${Math.floor(totalMin / 60)}h ${Math.round(totalMin % 60)}m`}
          sub="All recorded sessions"
        />
        <StatCard
          icon={TrendingUp} color="#10B981" label="Avg Retention" delay={0.08}
          value={`${avgRetention}%`}
          sub="Across all sessions"
        />
        <StatCard
          icon={Brain} color="#F59E0B" label="Sessions Logged" delay={0.16}
          value={sessions.length}
          sub="Total saved to account"
        />
      </div>

      {/* ── 3-col grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Today's sessions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="card p-7" style={{ borderTop: '3px solid #6366F1' }}
        >
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock size={20} className="text-indigo-400" /> Today's Sessions
          </h2>
          {todaySessions.length === 0 ? (
            <div className="text-slate-400 text-sm leading-relaxed space-y-2">
              <p>No sessions recorded today.</p>
              <p>
                Go to the <strong className="text-indigo-400">Planner</strong> to build
                your schedule, then save it.
              </p>
            </div>
          ) : (
            <ul className="space-y-3 max-h-[240px] overflow-y-auto">
              {todaySessions.map((s, i) => (
                <li
                  key={s.id || i}
                  className="flex justify-between items-center text-sm"
                  style={{ padding: '10px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: 10 }}
                >
                  <div>
                    <div className="font-semibold">{s.topic}</div>
                    <div className="text-slate-400">
                      {new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="font-bold text-indigo-400 text-right">
                    {Math.round((new Date(s.end_time) - new Date(s.start_time)) / 60000)} min
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        {/* Fatigue indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="card p-7" style={{ borderTop: '3px solid #F59E0B' }}
        >
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Zap size={20} className="text-amber-400" /> Fatigue Indicator
          </h2>
          {avgFatiguePct === 0 ? (
            <p className="text-slate-400 text-sm">
              Save a session below to see your fatigue trend here.
            </p>
          ) : (
            <FatigueBar pct={avgFatiguePct} />
          )}
          <div className="mt-6 text-xs text-slate-500 leading-relaxed">
            💡 High fatigue? Shorten sessions to 20 minutes with 10-minute breaks.
          </div>
        </motion.div>

        {/* Quick session entry */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="card p-7" style={{ borderTop: '3px solid #10B981' }}
        >
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-400" /> Quick Session Entry
          </h2>

          <form onSubmit={handlePredict} className="flex flex-col gap-4">
            {/* Topic */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-300">
                Topic studied <span className="text-red-400">*</span>
              </label>
              <input
                className="input"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Algebra ch. 3, Reading…"
              />
            </div>

            {/* Recall accuracy */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-300">
                How well did I recall? —{' '}
                <span className="text-emerald-400">{Math.round(form.recall_accuracy * 100)}%</span>
              </label>
              <input type="range" min="0" max="1" step="0.05"
                value={form.recall_accuracy}
                onChange={e => setForm(f => ({ ...f, recall_accuracy: parseFloat(e.target.value) }))} />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Forgot everything</span><span>Remembered all</span>
              </div>
            </div>

            {/* Fatigue */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-300">
                Tiredness right now —{' '}
                <span className="text-amber-400">{form.fatigue_rating}/10</span>
              </label>
              <input type="range" min="0" max="10" step="1"
                value={form.fatigue_rating}
                onChange={e => setForm(f => ({ ...f, fatigue_rating: parseFloat(e.target.value) }))} />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Not tired</span><span>Exhausted</span>
              </div>
            </div>

            {/* Sleep */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-300">
                Hours slept last night —{' '}
                <span className="text-indigo-400">{form.sleep_hours_prev_night}h</span>
              </label>
              <input type="range" min="0" max="12" step="0.5"
                value={form.sleep_hours_prev_night}
                onChange={e => setForm(f => ({ ...f, sleep_hours_prev_night: parseFloat(e.target.value) }))} />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-300">
                Session length —{' '}
                <span className="text-purple-400">{form.session_duration_min} min</span>
              </label>
              <input type="range" min="5" max="120" step="5"
                value={form.session_duration_min}
                onChange={e => setForm(f => ({ ...f, session_duration_min: parseFloat(e.target.value) }))} />
            </div>

            {/* Prediction result */}
            {prediction !== null && (
              <div style={{
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 12, padding: '12px 16px',
              }}>
                <div className="text-emerald-400 font-bold">
                  📅 Review in {Math.round(prediction)} day(s)
                </div>
                <p className="text-slate-400 text-xs mt-1">
                  Based on your recall, fatigue, and sleep. Save the session to track progress.
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 mt-1">
              <button
                id="btn-predict"
                type="submit"
                disabled={predicting}
                className="btn btn-primary btn-md flex-1"
              >
                {predicting
                  ? <><RefreshCw size={15} className="animate-spin" /> Predicting…</>
                  : <><Brain size={15} /> Predict Review</>}
              </button>
              <button
                id="btn-save-session"
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn btn-success btn-md flex-1"
              >
                {saving
                  ? <><RefreshCw size={15} className="animate-spin" /> Saving…</>
                  : <><Save size={15} /> Save Session</>}
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* ── Tip banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="flex gap-4 items-start p-6 mb-6"
        style={{
          background: 'rgba(245,158,11,0.07)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 16,
        }}
      >
        <AlertCircle size={22} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-amber-300 mb-1 text-sm">Study tip for dyslexic readers</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Short, frequent sessions beat long ones. The <strong className="text-amber-300">Planner</strong> automatically
            inserts breaks so you never over-study. Aim for 25-minute blocks with 5-minute breaks.
          </p>
        </div>
      </motion.div>

      {/* ── Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="card p-7"
      >
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <TrendingUp size={20} className="text-indigo-400" />
          Retention &amp; Fatigue — Last 10 Sessions
        </h2>

        {chartData.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-slate-500">
            <TrendingUp size={40} className="mb-4 opacity-30" />
            <p>No session data yet. Save a session above to start seeing trends.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="name" stroke="#64748B" tick={{ fontFamily: 'Lexend', fontSize: 11 }} />
              <YAxis stroke="#64748B" tick={{ fontFamily: 'Lexend', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#1E293B',
                  border: '1px solid rgba(148,163,184,0.15)',
                  borderRadius: 10,
                  fontFamily: 'Lexend',
                  color: '#F1F5F9',
                  fontSize: 13,
                }}
              />
              <Legend wrapperStyle={{ fontFamily: 'Lexend', fontSize: 13 }} />
              <Line
                type="monotone" dataKey="Retention %"
                stroke="#6366F1" strokeWidth={2.5}
                dot={{ fill: '#6366F1', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone" dataKey="Fatigue /10"
                stroke="#F59E0B" strokeWidth={2.5}
                dot={{ fill: '#F59E0B', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </motion.div>
    </div>
  )
}
