import { motion } from 'framer-motion'
import { Brain, Clock, ArrowRight, Eye, Coffee, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'

const EASE = [0.22, 1, 0.36, 1]

const FEATURES = [
  {
    icon: Brain,
    title: 'Revision timing that learns from you',
    desc: 'A trained model reads your recall, sleep and fatigue after each session and picks the day to revisit each topic.',
  },
  {
    icon: Clock,
    title: 'Breaks placed for you',
    desc: 'The planner spaces short breaks between study blocks, so you stop before your focus runs out.',
  },
  {
    icon: Eye,
    title: 'Made for dyslexic readers',
    desc: 'Lexend type, adjustable text size, a reading guide, text to speech and a cream light theme, all in the settings page.',
  },
]

const STEPS = [
  { num: '1', title: 'Describe how you study', desc: 'Enter your sleep, fatigue and dyslexia severity.' },
  { num: '2', title: 'Add today’s topics', desc: 'List what you want to cover, with time and difficulty.' },
  { num: '3', title: 'Follow the timeline', desc: 'Get a study and break schedule, then save it with one tap.' },
]

const SAMPLE = [
  { kind: 'study', time: '16:00', label: 'Study block', note: '25 min' },
  { kind: 'break', time: '16:25', label: 'Break', note: '5 min' },
  { kind: 'study', time: '16:30', label: 'Study block', note: '25 min' },
  { kind: 'break', time: '16:55', label: 'Long break', note: '15 min' },
]

const reveal = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, ease: EASE },
}

export default function Landing() {
  const { user } = useAuth()

  return (
    <div style={{ background: 'var(--bg-primary)' }}>
      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 grid md:grid-cols-12 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="md:col-span-7"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-6" style={{ lineHeight: 1.08 }}>
            A revision planner that works around dyslexia and fatigue
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-10" style={{ maxWidth: '36rem' }}>
            Tell it how you slept and how tired you are. It builds a study and break
            timeline and predicts when to revise each topic again.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to={user ? '/planner' : '/login'}
              id="cta-get-started"
              className="btn btn-primary btn-xl"
            >
              {user ? 'Open the planner' : 'Create your plan'} <ArrowRight size={20} />
            </Link>
            {user ? (
              <Link to="/dashboard" id="cta-dashboard" className="btn btn-ghost btn-xl">
                Go to dashboard
              </Link>
            ) : (
              <Link to="/dashboard" id="cta-demo" className="btn btn-ghost btn-xl">
                View the demo
              </Link>
            )}
          </div>
        </motion.div>

        {/* Sample schedule: real component styles, illustrative data */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
          className="md:col-span-5 card p-6"
          aria-label="Example study schedule"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold">Sample afternoon</span>
            <span className="text-sm text-slate-400">Example only</span>
          </div>
          <div className="flex flex-col gap-2">
            {SAMPLE.map(({ kind, time, label, note }, i) => (
              <div
                key={i}
                className={`schedule-block schedule-${kind} flex items-center justify-between`}
              >
                <span className="flex items-center gap-2 font-medium">
                  {kind === 'study'
                    ? <BookOpen size={16} className="text-indigo-400" />
                    : <Coffee size={16} className="text-amber-400" />}
                  {label}
                </span>
                <span className="text-sm text-slate-400 tabular">{time} · {note}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Features: alternating rows, not three equal cards ── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <motion.h2 {...reveal} className="text-3xl md:text-4xl font-bold mb-12" style={{ maxWidth: '32rem' }}>
          What it does for you
        </motion.h2>

        <div className="flex flex-col">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              {...reveal}
              className="grid md:grid-cols-12 gap-6 py-8 items-start"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div className={`md:col-span-1 ${i % 2 ? 'md:order-2 md:justify-self-end' : ''}`}>
                <Icon size={28} className="text-indigo-400" />
              </div>
              <h3 className={`text-2xl font-semibold md:col-span-5 ${i % 2 ? 'md:order-1' : ''}`}>{title}</h3>
              <p className={`text-lg text-slate-400 md:col-span-6 ${i % 2 ? 'md:order-3' : ''}`}>{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.h2 {...reveal} className="text-3xl md:text-4xl font-bold mb-12">
            How it works
          </motion.h2>

          <ol className="grid md:grid-cols-3 gap-8 list-none p-0 m-0">
            {STEPS.map(({ num, title, desc }, i) => (
              <motion.li
                key={num}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.08 }}
              >
                <div
                  className="tabular"
                  style={{ fontSize: 48, lineHeight: 1, fontWeight: 600, color: 'var(--accent-text)', marginBottom: 16 }}
                >
                  {num}
                </div>
                <h3 className="text-xl font-semibold mb-2">{title}</h3>
                <p className="text-slate-400">{desc}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Closing call to action ── */}
      <section className="max-w-6xl mx-auto px-6 py-24 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
        <motion.h2 {...reveal} className="text-3xl md:text-4xl font-bold" style={{ maxWidth: '28rem' }}>
          Plan your next study session
        </motion.h2>
        <motion.div {...reveal}>
          <Link to={user ? '/planner' : '/login'} id="cta-bottom" className="btn btn-primary btn-xl">
            {user ? 'Open the planner' : 'Create a free account'} <ArrowRight size={20} />
          </Link>
        </motion.div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)' }} className="px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between gap-2 text-sm text-slate-400">
          <span>DysLexi Scheduler</span>
          <span>Adaptive revision planning for dyslexic students</span>
        </div>
      </footer>
    </div>
  )
}
