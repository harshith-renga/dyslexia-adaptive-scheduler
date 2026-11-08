import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Timer, Zap, Plus, Trash2, X, ChevronRight,
  Clock, CheckCircle, RotateCcw, Copy, Save, AlertTriangle
} from 'lucide-react'
import { createSession } from '../api'
import { useAuth } from '../AuthContext'
import { useToast } from '../ToastContext'

/* ── Helpers ──────────────────────────────────────────── */
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

/** JSON from localStorage, or the fallback if it is missing or corrupt. */
function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw) ?? fallback
  } catch {
    return fallback
  }
}

/** Current local time formatted for <input type="datetime-local"> (YYYY-MM-DDTHH:mm). */
function localDateTimeInput(date = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fatigueColor(pct) {
  return pct <= 33 ? '#10B981' : pct <= 66 ? '#F59E0B' : '#EF4444'
}

function PriorityBadge({ p }) {
  const map = { High: 'badge-red', Medium: 'badge-amber', Low: 'badge-green' }
  return <span className={`badge ${map[p] || 'badge-indigo'}`}>{p}</span>
}

/* ── Confirm Modal ────────────────────────────────────── */
function ConfirmModal({ msg, onOk, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <AlertTriangle size={28} className="text-amber-400 flex-shrink-0" />
          <p className="text-lg font-semibold">{msg}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn btn-ghost btn-md" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger btn-md" onClick={onOk}>Yes, clear all</button>
        </div>
      </div>
    </div>
  )
}

/* ── Schedule block ───────────────────────────────────── */
function ScheduleBlock({ s, idx }) {
  const isBreak = s.title === 'Break'
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
      className={`schedule-block ${isBreak ? 'schedule-break' : 'schedule-study'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isBreak
              ? <Timer size={16} className="text-amber-400 flex-shrink-0" />
              : <BookOpen size={16} className="text-indigo-400 flex-shrink-0" />}
            <span className="font-bold truncate">{s.title}{s.subject ? ` — ${s.subject}` : ''}</span>
          </div>
          <div className="text-xs text-slate-400">
            {fmtTime(s.start)} → {fmtTime(s.end)}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-bold" style={{ color: isBreak ? '#F59E0B' : '#2F9E8C' }}>{s.duration} min</div>
          <div className="text-xs mt-1" style={{ color: fatigueColor(s.fatigueAfter) }}>
            {s.fatigueBefore}% → {s.fatigueAfter}%
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ── StudyPlanner ─────────────────────────────────────── */
const DEFAULT_PROFILE = { dyslexiaSeverity: 'moderate', sleepHours: '', priorStudyHours: '', currentFatigue: '', distractionLevel: 1 }
const DEFAULT_SETTINGS = { startTime: '', breakEveryMins: 45, breakDuration: 10 }
const DEFAULT_TASK = { title: '', subject: '', duration: '30', difficulty: 3, priority: 'Medium' }

export default function StudyPlanner() {
  const { user } = useAuth()
  const toast = useToast()

  const [tasks, setTasks]       = useState(() => {
    const saved = readStored('planner_tasks', [])
    return Array.isArray(saved) ? saved : []
  })
  const [profile, setProfile]   = useState(() => ({ ...DEFAULT_PROFILE, ...readStored('planner_profile', {}) }))
  const [settings, setSettings] = useState(() => {
    // startTime is never restored: an old saved start would schedule today's plan in the past.
    const { startTime: _ignored, ...saved } = readStored('planner_settings', {})
    return { ...DEFAULT_SETTINGS, ...saved, startTime: localDateTimeInput() }
  })
  const [newTask, setNewTask]   = useState(DEFAULT_TASK)
  const [errors, setErrors]     = useState([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving]     = useState(false)

  /* Persist */
  useEffect(() => { localStorage.setItem('planner_tasks',   JSON.stringify(tasks))    }, [tasks])
  useEffect(() => { localStorage.setItem('planner_profile', JSON.stringify(profile))  }, [profile])
  useEffect(() => { localStorage.setItem('planner_settings',JSON.stringify(settings)) }, [settings])
  const schedule = useMemo(() => computeSchedule(), [tasks, profile, settings])

  /* Fatigue calculation */
  function computeInitialFatigue() {
    if (profile.currentFatigue !== '' && profile.currentFatigue !== null) {
      const v = Number(profile.currentFatigue)
      if (!isNaN(v)) return clamp(v / 100, 0, 1)
    }
    const sleep    = Number(profile.sleepHours) || 0
    const prior    = Number(profile.priorStudyHours) || 0
    const sevMap   = { mild: 0.03, moderate: 0.08, severe: 0.14 }
    const severity = sevMap[profile.dyslexiaSeverity] || 0.08
    const sleepF   = clamp((8 - sleep) / 8, 0, 1)
    const priorF   = clamp(prior / 6, 0, 1)
    return clamp(0.05 + sleepF * 0.6 + priorF * 0.2 + severity, 0, 0.95)
  }

  /* Schedule engine */
  function computeSchedule() {
    if (!tasks.length) return []
    let fatigue = computeInitialFatigue()
    const blocks = []
    let cursor = settings.startTime ? new Date(settings.startTime) : new Date()
    let untilBreak = Number(settings.breakEveryMins) || 45

    const priorityOrder = { High: 0, Medium: 1, Low: 2 }
    const sorted = [...tasks].sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1))

    sorted.forEach((t, taskIdx) => {
      let remaining = Number(t.duration)
      const diff = Number(t.difficulty)
      while (remaining > 0) {
        const block = Math.min(remaining, untilBreak)
        const start = new Date(cursor)
        const end   = new Date(cursor.getTime() + block * 60000)
        const fb = clamp(fatigue, 0, 1)
        fatigue = clamp(fatigue + (block / 60) * (0.12 + diff * 0.03) + (Number(profile.distractionLevel) || 0) * 0.02, 0, 0.99)
        blocks.push({ taskId: t.id, title: t.title || t.subject || 'Task', subject: t.subject, start: start.toISOString(), end: end.toISOString(), duration: block, fatigueBefore: Math.round(fb * 100), fatigueAfter: Math.round(fatigue * 100) })
        cursor = new Date(end)
        remaining -= block
        untilBreak -= block
        // Only break if more work follows: no pointless trailing break at the end of the plan
        const moreWork = remaining > 0 || taskIdx < sorted.length - 1
        if (untilBreak <= 0 && moreWork) {
          const bd = Number(settings.breakDuration) || 10
          blocks.push({ taskId: null, title: 'Break', subject: '', start: new Date(cursor).toISOString(), end: new Date(cursor.getTime() + bd * 60000).toISOString(), duration: bd, fatigueBefore: Math.round(fatigue * 100), fatigueAfter: Math.round(fatigue * 100) })
          cursor = new Date(cursor.getTime() + bd * 60000)
          untilBreak = Number(settings.breakEveryMins) || 45
        }
      }
    })
    return blocks
  }

  /* Add task */
  function handleAddTask(e) {
    e.preventDefault()
    const errs = []
    if (!newTask.title.trim()) errs.push('Task title is required')
    const d = Number(newTask.duration)
    if (isNaN(d) || d < 5) errs.push('Duration must be at least 5 minutes')
    if (errs.length) { setErrors(errs); return }
    setTasks(prev => [...prev, { ...newTask, id: Date.now() }])
    setNewTask(DEFAULT_TASK)
    setErrors([])
    toast('Task added to schedule', 'success')
  }

  /* Save schedule to backend (one session per study block) */
  const handleSaveSchedule = async () => {
    setSaving(true)
    const studyBlocks = schedule.filter(s => s.title !== 'Break')
    if (!studyBlocks.length) { toast('No study blocks to save', 'error'); setSaving(false); return }
    try {
      await Promise.all(studyBlocks.map(s =>
        createSession({
          user_id: user.user_id,
          topic: s.title + (s.subject ? ` — ${s.subject}` : ''),
          start_time: s.start,
          end_time: s.end,
          recall_score: 0.5,
          fatigue_level: Math.round((s.fatigueBefore + s.fatigueAfter) / 2 / 10),
          retention_score: 0.5,
        })
      ))
      toast(`Saved ${studyBlocks.length} session(s) to your account`, 'success')
    } catch (err) {
      toast('Save failed: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  /* Copy */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(schedule, null, 2))
      toast('Schedule copied to clipboard', 'info')
    } catch {
      toast('Copy not supported in this browser', 'error')
    }
  }

  /* Clear */
  const handleClearAll = () => {
    setTasks([])
    localStorage.removeItem('planner_tasks')
    setShowConfirm(false)
    toast('All tasks cleared', 'info')
  }

  const studyMin = schedule.filter(s => s.title !== 'Break').reduce((a, b) => a + b.duration, 0)
  const breakMin = schedule.filter(s => s.title === 'Break').reduce((a, b) => a + b.duration, 0)
  const finalFatigue = schedule.length ? schedule[schedule.length - 1].fatigueAfter : 0
  const initPct = Math.round(computeInitialFatigue() * 100)

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {showConfirm && <ConfirmModal msg="Clear all tasks and schedule?" onOk={handleClearAll} onCancel={() => setShowConfirm(false)} />}

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-2">
          <span className="gradient-text">Study Planner</span>
        </h1>
        <p className="text-slate-400 text-lg">
          Add your tasks → the planner builds a break-spaced schedule tailored to your energy level.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Col 1: Profile ──────────────────── */}
        <section className="card p-7" aria-label="Your profile">
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
            <Zap size={20} className="text-amber-400" /> Your Energy Profile
          </h2>
          <p className="text-slate-400 text-sm mb-6">These values shape how fatigue is calculated in your schedule.</p>

          <div className="flex flex-col gap-5">
            {/* Severity */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">Dyslexia severity</label>
              <select className="select" value={profile.dyslexiaSeverity} onChange={e => setProfile({ ...profile, dyslexiaSeverity: e.target.value })}>
                <option value="mild">Mild — minimal impact</option>
                <option value="moderate">Moderate — needs regular breaks</option>
                <option value="severe">Severe — short sessions recommended</option>
              </select>
            </div>

            {/* Sleep */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">
                Hours slept last night — <span className="text-indigo-400">{profile.sleepHours || '?'}h</span>
              </label>
              <input type="range" min="0" max="12" step="0.5" value={profile.sleepHours || 7}
                onChange={e => setProfile({ ...profile, sleepHours: e.target.value })} />
              <div className="flex justify-between text-xs text-slate-500 mt-1"><span>0h</span><span>12h</span></div>
            </div>

            {/* Prior study */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">
                Study hours before now — <span className="text-purple-400">{profile.priorStudyHours || 0}h</span>
              </label>
              <input type="range" min="0" max="8" step="0.5" value={profile.priorStudyHours || 0}
                onChange={e => setProfile({ ...profile, priorStudyHours: e.target.value })} />
            </div>

            {/* Distraction */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">
                Distraction level — <span className="text-amber-400">{profile.distractionLevel}/5</span>
              </label>
              <input type="range" min="0" max="5" step="1" value={profile.distractionLevel || 0}
                onChange={e => setProfile({ ...profile, distractionLevel: Number(e.target.value) })} />
              <div className="flex justify-between text-xs text-slate-500 mt-1"><span>Focused</span><span>Very distracted</span></div>
            </div>

            {/* Override fatigue */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">Override fatigue % (optional)</label>
              <input className="input" type="number" min="0" max="100"
                value={profile.currentFatigue || ''}
                onChange={e => setProfile({ ...profile, currentFatigue: e.target.value })}
                placeholder="Leave empty = auto-calculated" />
            </div>

            {/* Schedule settings */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <h3 className="text-sm font-bold mb-4 text-slate-300 uppercase tracking-wider">Schedule Settings</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-300">Start time</label>
                  <input type="datetime-local" className="input" value={settings.startTime}
                    onChange={e => setSettings({ ...settings, startTime: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-300">
                    Break every — <span className="text-amber-400">{settings.breakEveryMins} min</span>
                  </label>
                  <input type="range" min="20" max="90" step="5" value={settings.breakEveryMins}
                    onChange={e => setSettings({ ...settings, breakEveryMins: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-300">
                    Break length — <span className="text-emerald-400">{settings.breakDuration} min</span>
                  </label>
                  <input type="range" min="5" max="30" step="5" value={settings.breakDuration}
                    onChange={e => setSettings({ ...settings, breakDuration: Number(e.target.value) })} />
                </div>
              </div>
            </div>

            {/* Fatigue preview */}
            <div style={{ background: 'rgba(47,158,140,0.18)', border: '1px solid rgba(47,158,140,0.18)', borderRadius: 12, padding: '14px 16px' }}>
              <div className="text-sm font-bold mb-1">
                Starting fatigue: <span style={{ color: fatigueColor(initPct) }}>{initPct}%</span>
                <span className="text-slate-500 font-normal ml-2">({profile.currentFatigue ? 'your value' : 'auto'})</span>
              </div>
              <div className="progress-bar mt-2">
                <div className="progress-fill" style={{ width: `${initPct}%`, background: fatigueColor(initPct) }} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Col 2: Add tasks ─────────────────── */}
        <section className="card p-7" aria-label="Add study tasks">
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
            <Plus size={20} className="text-indigo-400" /> Add a Study Task
          </h2>
          <p className="text-slate-400 text-sm mb-6">Each task becomes a block in your schedule. High priority tasks go first.</p>

          <form onSubmit={handleAddTask} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">Task name *</label>
              <input className="input" placeholder="e.g. Chapter 3 reading" value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">Subject or notes</label>
              <input className="input" placeholder="e.g. Biology — cell division" value={newTask.subject}
                onChange={e => setNewTask({ ...newTask, subject: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">
                Duration — <span className="text-indigo-400">{newTask.duration} min</span>
              </label>
              <input type="range" min="5" max="120" step="5" value={newTask.duration}
                onChange={e => setNewTask({ ...newTask, duration: e.target.value })} />
              <div className="flex justify-between text-xs text-slate-500 mt-1"><span>5 min</span><span>120 min</span></div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">
                Difficulty — <span className="text-amber-400">{newTask.difficulty}/5</span>
              </label>
              <input type="range" min="1" max="5" step="1" value={newTask.difficulty}
                onChange={e => setNewTask({ ...newTask, difficulty: Number(e.target.value) })} />
              <div className="flex justify-between text-xs text-slate-500 mt-1"><span>Easy</span><span>Hard</span></div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-300">Priority</label>
              <div className="flex gap-2">
                {['Low', 'Medium', 'High'].map(p => (
                  <button
                    key={p} type="button"
                    onClick={() => setNewTask({ ...newTask, priority: p })}
                    className={`flex-1 btn btn-sm ${newTask.priority === p
                      ? p === 'High' ? 'btn-danger' : p === 'Medium' ? 'bg-amber-500 text-white' : 'btn-success'
                      : 'btn-ghost'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {errors.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px' }}>
                {errors.map((e, i) => <p key={i} className="text-red-400 text-sm">{e}</p>)}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button id="btn-add-task" type="submit" className="btn btn-primary btn-md flex-1">
                <Plus size={18} /> Add Task
              </button>
              <button type="button" onClick={() => { setNewTask(DEFAULT_TASK); setErrors([]) }} className="btn btn-ghost btn-md" title="Reset form">
                <RotateCcw size={18} />
              </button>
            </div>
          </form>

          {/* Task list */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-300">Tasks ({tasks.length})</h3>
              {tasks.length > 0 && (
                <button onClick={() => setShowConfirm(true)} className="btn btn-danger btn-sm flex items-center gap-1" id="btn-clear-all">
                  <Trash2 size={14} /> Clear All
                </button>
              )}
            </div>
            <AnimatePresence>
              {tasks.length === 0 && <p className="text-slate-500 text-sm">No tasks yet — add one above.</p>}
              {tasks.map(t => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`mb-3 flex items-start justify-between gap-3 rounded-xl p-4 ${
                    t.priority === 'High' ? 'priority-high' : t.priority === 'Low' ? 'priority-low' : 'priority-medium'
                  }`}
                  style={{ background: 'rgba(30,41,59,0.6)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{t.title}</div>
                    {t.subject && <div className="text-xs text-slate-400 truncate">{t.subject}</div>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs text-slate-400">{t.duration} min</span>
                      <span className="text-xs text-slate-400">Diff {t.difficulty}/5</span>
                      <PriorityBadge p={t.priority} />
                    </div>
                  </div>
                  <button
                    onClick={() => setTasks(prev => prev.filter(x => x.id !== t.id))}
                    className="btn btn-ghost btn-sm p-1.5 flex-shrink-0"
                    aria-label={`Remove task ${t.title}`}
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* ── Col 3: Schedule ──────────────────── */}
        <section className="card p-7" aria-label="Generated schedule">
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
            <Clock size={20} className="text-emerald-400" /> Your Schedule
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Built automatically from your tasks and energy profile. Saves to dashboard history.
          </p>

          {schedule.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(47,158,140,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <BookOpen size={32} className="text-indigo-400" />
              </div>
              <p className="text-slate-400">Add at least one task to generate your schedule.</p>
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: 'Study', val: `${studyMin}m`, color: '#2F9E8C' },
                  { label: 'Breaks', val: `${breakMin}m`, color: '#F59E0B' },
                  { label: 'End fatigue', val: `${finalFatigue}%`, color: fatigueColor(finalFatigue) },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: 'rgba(30,41,59,0.5)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                    <div className="text-xl font-bold" style={{ color }}>{val}</div>
                    <div className="text-xs text-slate-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {/* Blocks */}
              <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
                {schedule.map((s, i) => <ScheduleBlock key={i} s={s} idx={i} />)}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  id="btn-save-schedule"
                  onClick={handleSaveSchedule}
                  disabled={saving}
                  className="btn btn-success btn-md flex-1"
                >
                  {saving
                    ? <><span className="animate-pulse">Saving…</span></>
                    : <><Save size={17} /> Save to Account</>
                  }
                </button>
                <button
                  id="btn-copy-schedule"
                  onClick={handleCopy}
                  className="btn btn-ghost btn-md"
                  title="Copy schedule as JSON"
                >
                  <Copy size={17} />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-3">Saving adds each block as a session so your Dashboard stays up-to-date.</p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
