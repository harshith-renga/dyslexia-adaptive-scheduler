import { motion } from 'framer-motion'
import { BookOpen, Brain, Clock, ArrowRight, CheckCircle, Star, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'

const FEATURES = [
  {
    icon: Brain,
    color: '#6366F1',
    glow: 'rgba(99,102,241,0.3)',
    title: 'AI-Powered Scheduling',
    desc: 'The app learns your memory patterns and suggests the perfect time to revise each topic.',
  },
  {
    icon: Clock,
    color: '#10B981',
    glow: 'rgba(16,185,129,0.3)',
    title: 'Fatigue Management',
    desc: 'Smart breaks are inserted automatically so you never over-study and tire your brain.',
  },
  {
    icon: Zap,
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.3)',
    title: 'Dyslexia Friendly',
    desc: 'Large fonts, high contrast, text-to-speech, and a reading guide — built in from day one.',
  },
]

const STEPS = [
  { num: '1', title: 'Create your profile', desc: 'Tell us your sleep, fatigue level, and dyslexia severity. That\'s all.' },
  { num: '2', title: 'Add today\'s tasks',   desc: 'List the topics you want to study with estimated time and difficulty.' },
  { num: '3', title: 'Follow your schedule', desc: 'The planner builds a break-spaced timeline. Save it with one tap.' },
]

const STATS = [
  { value: '40%', label: 'Less fatigue' },
  { value: '3×',  label: 'Better retention' },
  { value: '100%', label: 'Dyslexia focused' },
]

export default function Landing() {
  const { user } = useAuth()

  return (
    <div style={{ background: 'var(--bg-primary)' }}>
      {/* ── Hero ──────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-20 pb-32 flex flex-col items-center text-center">
        {/* Background blobs */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)', borderRadius: '50%' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative max-w-4xl"
        >
          {/* Tag */}
          <div className="inline-flex items-center gap-2 badge badge-indigo mb-8 text-sm px-4 py-2">
            <Star size={14} /> Built for dyslexic learners
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
            Study Smarter,<br />
            <span className="gradient-text">Not Harder</span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            An adaptive revision scheduler that accounts for your fatigue, sleep, and dyslexia — so every study session actually sticks.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={user ? '/planner' : '/login'}
              id="cta-get-started"
              className="btn btn-primary btn-xl"
            >
              Get Started <ArrowRight size={20} />
            </Link>
            {user && (
              <Link to="/dashboard" id="cta-dashboard" className="btn btn-ghost btn-xl">
                Go to Dashboard
              </Link>
            )}
            {!user && (
              <Link to="/dashboard" id="cta-demo" className="btn btn-ghost btn-xl">
                View Demo
              </Link>
            )}
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="relative flex flex-wrap justify-center gap-8 mt-20"
        >
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-4xl font-extrabold gradient-text">{value}</div>
              <div className="text-sm text-slate-400 mt-1">{label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── Features ──────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-center mb-4"
        >
          Everything you need to learn effectively
        </motion.h2>
        <p className="text-center text-slate-400 mb-16 text-lg">Simple tools. Big results.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {FEATURES.map(({ icon: Icon, color, glow, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              whileHover={{ y: -6 }}
              className="card p-8"
            >
              <div
                style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`, width: 64, height: 64, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}
              >
                <Icon size={30} style={{ color }} />
              </div>
              <h3 className="text-xl font-bold mb-3">{title}</h3>
              <p className="text-slate-400 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────── */}
      <section style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center mb-4"
          >
            How it works
          </motion.h2>
          <p className="text-center text-slate-400 mb-16 text-lg">Three simple steps. Zero confusion.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(({ num, title, desc }, i) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center text-center"
              >
                <div
                  style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 20, boxShadow: '0 0 24px rgba(99,102,241,0.4)' }}
                >
                  {num}
                </div>
                <h3 className="text-xl font-bold mb-2">{title}</h3>
                <p className="text-slate-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 24, padding: '48px 32px' }}
        >
          <CheckCircle size={48} className="mx-auto mb-6 text-indigo-400" />
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Ready to start learning better?</h2>
          <p className="text-slate-400 text-lg mb-8">Join thousands of dyslexic students who study smarter every day.</p>
          <Link to={user ? '/planner' : '/login'} id="cta-bottom" className="btn btn-primary btn-xl">
            {user ? 'Open Planner' : 'Create Free Account'} <ArrowRight size={20} />
          </Link>
        </motion.div>
      </section>
    </div>
  )
}