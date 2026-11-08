import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { TrendingUp, BarChart3, Clock, Target, BookOpen, RefreshCw } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { getSessions } from '../api'

/* ── Week number utility ──────────────────────────────── */
function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  // "2026-W09": year included so weeks sort correctly and never collide across years
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/* ── Stat card ────────────────────────────────────────── */
function StatCard({ icon: Icon, color, label, value, sub, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
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

/* ── Custom tooltip ───────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontFamily: 'Lexend' }}>
      <p className="text-slate-300 text-sm mb-2 font-semibold">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="text-sm">
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

/* ── Analytics ────────────────────────────────────────── */
export default function Analytics({ darkMode }) {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)

  const loadSessions = () => {
    if (!user) return
    setLoading(true)
    getSessions(user.user_id)
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSessions() }, [user])

  /* ── Computed values ──── */
  const totalMin = sessions.reduce((sum, s) => {
    try { return sum + Math.max(0, (new Date(s.end_time) - new Date(s.start_time)) / 60000) } catch { return sum }
  }, 0)
  const avgRetention = sessions.length
    ? Math.round((sessions.reduce((a, b) => a + (b.retention_score || 0), 0) / sessions.length) * 100)
    : 0
  const avgFatigue = sessions.length
    ? Math.round(sessions.reduce((a, b) => a + (b.fatigue_level || 0), 0) / sessions.length * 10)
    : 0

  /* Weekly progress (last 6 weeks) */
  const weekly = {}
  sessions.forEach(s => {
    try {
      const d = new Date(s.start_time)
      const k = getWeekNumber(d)
      weekly[k] = weekly[k] || { minutes: 0, retSum: 0, count: 0 }
      weekly[k].minutes += Math.max(0, (new Date(s.end_time) - new Date(s.start_time)) / 60000)
      weekly[k].retSum += (s.retention_score || 0)
      weekly[k].count += 1
    } catch (_) {}
  })
  const progressData = Object.keys(weekly).sort().slice(-6).map(k => ({
    name: k.slice(5),
    'Study (min)': Math.round(weekly[k].minutes),
    'Retention %': Math.round((weekly[k].retSum / weekly[k].count) * 100),
  }))

  /* Subject performance */
  const subjects = {}
  sessions.forEach(s => {
    const sub = (s.topic || s.subject || 'General').split(' — ')[0].slice(0, 20)
    subjects[sub] = subjects[sub] || { sum: 0, count: 0 }
    subjects[sub].sum += (s.retention_score || 0)
    subjects[sub].count += 1
  })
  const subjectData = Object.keys(subjects).map(k => ({
    subject: k,
    'Avg Retention %': Math.round((subjects[k].sum / subjects[k].count) * 100),
  }))

  /* Empty state */
  const isEmpty = sessions.length === 0

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">
            <span className="gradient-text">Analytics</span>
          </h1>
          <p className="text-slate-400 text-lg">Track your learning progress over time.</p>
        </div>
        <button
          id="btn-refresh-analytics"
          onClick={loadSessions}
          disabled={loading}
          className="btn btn-ghost btn-md flex items-center gap-2"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* ── Stat cards ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <StatCard icon={Clock}    color="#2F9E8C" label="Total Study Time" value={`${Math.floor(totalMin/60)}h ${Math.round(totalMin%60)}m`} sub="All sessions" delay={0} />
        <StatCard icon={Target}   color="#10B981" label="Avg Retention"   value={`${avgRetention}%`} sub="Across sessions"  delay={0.08} />
        <StatCard icon={BookOpen} color="#F59E0B" label="Sessions"        value={sessions.length}    sub="Recorded total"  delay={0.16} />
        <StatCard icon={TrendingUp} color="#2F9E8C" label="Avg Fatigue"   value={`${avgFatigue}%`} sub="After sessions"   delay={0.24} />
      </div>

      {isEmpty ? (
        /* ── Empty state ─── */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card p-16 text-center"
        >
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(47,158,140,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <BarChart3 size={38} className="text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold mb-3">No data yet</h2>
          <p className="text-slate-400 max-w-sm mx-auto">
            Go to the <strong className="text-indigo-400">Planner</strong> to build a schedule and save sessions. Your analytics will appear here automatically.
          </p>
        </motion.div>
      ) : (
        <>
          {/* ── Progress chart ──────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-8 mb-6"
          >
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp size={22} className="text-indigo-400" /> Weekly Progress
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="name" stroke="#8A867D" tick={{ fontFamily: 'Lexend', fontSize: 12 }} />
                <YAxis stroke="#8A867D" tick={{ fontFamily: 'Lexend', fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontFamily: 'Lexend', fontSize: 13 }} />
                <Line type="monotone" dataKey="Study (min)" stroke="#2F9E8C" strokeWidth={2.5} dot={{ fill: '#2F9E8C', r: 4 }} />
                <Line type="monotone" dataKey="Retention %"  stroke="#10B981" strokeWidth={2.5} dot={{ fill: '#10B981', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* ── Subject chart ───────────────────── */}
          {subjectData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card p-8"
            >
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <BarChart3 size={22} className="text-emerald-400" /> Retention by Topic
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={subjectData} barSize={36}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.08)" />
                  <XAxis dataKey="subject" stroke="#8A867D" tick={{ fontFamily: 'Lexend', fontSize: 11 }} />
                  <YAxis stroke="#8A867D" tick={{ fontFamily: 'Lexend', fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Avg Retention %" fill="#2F9E8C" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
