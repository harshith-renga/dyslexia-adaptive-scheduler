import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Brain, BookOpen, Coffee, Volume2, Type, MousePointer2, Moon } from 'lucide-react'
import { useAuth } from '../AuthContext'
import '../landing.css'

/* ── Real figures from ml/artifacts (the trained model) ─────────────────── */
const MODEL = {
  mae: '0.46',
  features: [
    { name: 'Dyslexia severity', value: 0.946 },
    { name: 'Prior review count', value: 0.814 },
    { name: 'Fatigue rating', value: 0.299 },
    { name: 'Sleep the night before', value: 0.167 },
    { name: 'Distraction level', value: 0.151 },
  ],
}

/* ── Illustrative schedule shown inside the frames (not user data) ──────── */
const BLOCKS = [
  { kind: 'study', label: 'Algebra', time: '16:00', min: 25, to: 41 },
  { kind: 'break', label: 'Break', time: '16:25', min: 5, to: 41 },
  { kind: 'study', label: 'English reading', time: '16:30', min: 25, to: 58 },
  { kind: 'break', label: 'Long break', time: '16:55', min: 15, to: 58 },
  { kind: 'study', label: 'Biology', time: '17:10', min: 25, to: 74 },
]

const SIZES = [
  { label: 'Small', px: 14 },
  { label: 'Normal', px: 16 },
  { label: 'Large', px: 18 },
  { label: 'X-Large', px: 20 },
]

function Frame({ title, note, children }) {
  return (
    <div className="lp-frame" role="img" aria-label={`${title}. ${note}`}>
      <div className="lp-frame-bar">
        <span className="lp-frame-title">{title}</span>
        <span className="lp-frame-note">{note}</span>
      </div>
      <div className="lp-frame-body" aria-hidden="true">{children}</div>
    </div>
  )
}

function ScheduleRows({ rows = BLOCKS }) {
  return (
    <div className="lp-rows">
      {rows.map((b, i) => (
        <div key={i} className={`schedule-block schedule-${b.kind} lp-row`}>
          <div className="lp-row-top">
            <span className="lp-row-label">
              {b.kind === 'study' ? <BookOpen size={16} /> : <Coffee size={16} />}
              {b.label}
            </span>
            <span className="lp-row-time tabular">{b.time} · {b.min} min</span>
          </div>
          <div className="lp-meter">
            <span className="lp-bar" style={{ '--to': `${b.to}%`, '--d': `${i * 0.18}s` }} />
          </div>
          <span className="lp-row-fatigue tabular">Fatigue {b.to}%</span>
        </div>
      ))}
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const [size, setSize] = useState(18)

  return (
    <div style={{ background: 'var(--bg-primary)' }}>
      {/* ── 1. Hero ── */}
      <section className="lp-screen">
        <div className="lp-wrap lp-grid">
          <div>
            <h1 className="lp-h1">
              Revision planning for dyslexic students, timed to your fatigue
            </h1>
            <p className="lp-lead">
              A trained model predicts your next review date to within {MODEL.mae} days,
              and the planner places your breaks before your focus runs out.
            </p>
            <div className="lp-actions">
              <Link to={user ? '/planner' : '/login'} id="cta-get-started" className="btn btn-primary btn-xl">
                {user ? 'Open the planner' : 'Create your plan'} <ArrowRight size={20} />
              </Link>
              {user ? (
                <Link to="/dashboard" id="cta-dashboard" className="btn btn-ghost btn-xl">Go to dashboard</Link>
              ) : (
                <Link to="/dashboard" id="cta-demo" className="btn btn-ghost btn-xl">Explore the dashboard</Link>
              )}
            </div>
          </div>

          <Frame title="Study timeline" note="Example data">
            <ScheduleRows />
          </Frame>
        </div>
      </section>

      {/* ── 2. The planner ── */}
      <section className="lp-screen">
        <div className="lp-wrap lp-grid lp-grid-flip">
          <div>
            <h2 className="lp-h2">A timeline that stops you before you burn out</h2>
            <p className="lp-body">
              Enter your sleep, how tired you are and your dyslexia severity. Each topic is
              ordered by priority, split into blocks, and given a fatigue estimate that rises
              with difficulty and distraction.
            </p>
            <p className="lp-body">Save the plan once and every block lands in your account.</p>
          </div>
          <Frame title="Your energy profile" note="Example data">
            <div className="lp-profile">
              {[
                ['Dyslexia severity', 'Moderate'],
                ['Hours slept', '6.5 h'],
                ['Tiredness now', '40%'],
                ['Break every', '45 min'],
              ].map(([k, v]) => (
                <div key={k} className="lp-kv"><span>{k}</span><strong className="tabular">{v}</strong></div>
              ))}
            </div>
            <ScheduleRows rows={BLOCKS.slice(0, 3)} />
          </Frame>
        </div>
      </section>

      {/* ── 3. The model: the one contrasting ground ── */}
      <section className="lp-screen lp-accent">
        <div className="lp-wrap lp-grid">
          <div>
            <div className="lp-big tabular" aria-label={`${MODEL.mae} days`}>{MODEL.mae}<span> days</span></div>
            <p className="lp-lead lp-lead-on">
              Average error when the model predicts your next revision date, measured by cross
              validation on the project's training data.
            </p>
          </div>
          <div className="lp-feat">
            <h2 className="lp-h3"><Brain size={22} /> What it weighs</h2>
            <ul className="lp-feat-list">
              {MODEL.features.map(f => (
                <li key={f.name}>
                  <div className="lp-feat-row">
                    <span>{f.name}</span>
                    <span className="tabular">{f.value.toFixed(2)}</span>
                  </div>
                  <div className="lp-feat-track"><span style={{ width: `${(f.value / 0.946) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 4. Reading comfort (live) ── */}
      <section className="lp-screen">
        <div className="lp-wrap lp-grid lp-grid-flip">
          <div>
            <h2 className="lp-h2">Set the page up for the way you read</h2>
            <p className="lp-body">
              Choose a text size, switch the reading font, turn on the reading guide, or have
              any text read aloud. Try the sizes on the right.
            </p>
            <Link to="/settings" className="lp-link">Open accessibility settings <ArrowRight size={18} /></Link>
          </div>
          <div className="lp-frame">
            <div className="lp-frame-bar">
              <span className="lp-frame-title">Reading comfort</span>
              <span className="lp-frame-note">Try it</span>
            </div>
            <div className="lp-frame-body">
              <div className="lp-seg" role="group" aria-label="Text size">
                {SIZES.map(s => (
                  <button
                    key={s.label}
                    type="button"
                    className={`lp-seg-btn ${size === s.px ? 'is-on' : ''}`}
                    aria-pressed={size === s.px}
                    onClick={() => setSize(s.px)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="lp-sample" style={{ fontSize: size }}>
                Short, frequent sessions beat long ones. Aim for 25 minute blocks with a short
                break between them.
              </p>
              <div className="lp-tools" aria-hidden="true">
                <span><Type size={16} /> Lexend font</span>
                <span><MousePointer2 size={16} /> Reading guide</span>
                <span><Moon size={16} /> Cream or dark theme</span>
                <span><Volume2 size={16} /> Read aloud</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Close ── */}
      <section className="lp-screen lp-close">
        <div className="lp-wrap">
          <h2 className="lp-h1 lp-h1-close">Plan your next study session</h2>
          <div className="lp-actions">
            <Link to={user ? '/planner' : '/login'} id="cta-bottom" className="btn btn-primary btn-xl">
              {user ? 'Open the planner' : 'Create a free account'} <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-row">
          <span>DysLexi Scheduler</span>
          <span>Adaptive revision planning for dyslexic students</span>
        </div>
      </footer>
    </div>
  )
}
