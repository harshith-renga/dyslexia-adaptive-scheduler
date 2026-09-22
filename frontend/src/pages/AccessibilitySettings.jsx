import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Volume2, VolumeX, Moon, Sun, Type, MousePointer2,
  BookOpen, CheckCircle, Info
} from 'lucide-react'
import { useToast } from '../ToastContext'

/* ── Section Card ─────────────────────────────────────── */
function Section({ icon: Icon, color, title, desc, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-8"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <Icon size={24} style={{ color }} />
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {desc && <p className="text-slate-400 text-sm mb-6 leading-relaxed">{desc}</p>}
      {children}
    </motion.div>
  )
}

/* ── Toggle switch ────────────────────────────────────── */
function Toggle({ on, onChange, id, label }) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer select-none">
      <div
        id={id}
        role="switch"
        aria-checked={on}
        tabIndex={0}
        onClick={() => onChange(!on)}
        onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onChange(!on)}
        style={{
          width: 52, height: 28, borderRadius: 99,
          background: on ? '#6366F1' : 'rgba(148,163,184,0.2)',
          position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'absolute', top: 4, left: on ? 28 : 4,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      </div>
      {label && <span className="text-slate-300 font-medium">{label}</span>}
    </label>
  )
}

/* ── AccessibilitySettings ────────────────────────────── */
export default function AccessibilitySettings({ darkMode, setDarkMode, fontSize, setFontSize, readingGuide, setReadingGuide }) {
  const toast = useToast()
  const [speaking, setSpeaking] = useState(false)
  const [dyslexicFont, setDyslexicFont] = useState(() => localStorage.getItem('dyslexicFont') === 'true')

  // Restore font choice on every page load
  useEffect(() => {
    const saved = localStorage.getItem('dyslexicFont') === 'true'
    const fontValue = saved
      ? "'Lexend Deca', 'Lexend', sans-serif"
      : "'Lexend', sans-serif"
    document.documentElement.style.setProperty('--font-base', fontValue)
  }, [])

  /* TTS */
  const speak = (text) => {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.85
    u.pitch = 1.05
    u.onstart = () => setSpeaking(true)
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(u)
  }

  const stopSpeaking = () => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  /* Font toggle — sets the CSS variable so ALL elements pick it up */
  const toggleFont = (on) => {
    setDyslexicFont(on)
    localStorage.setItem('dyslexicFont', String(on))

    const fontValue = on
      ? "'Lexend Deca', 'Lexend', sans-serif"
      : "'Lexend', sans-serif"

    // Set the CSS variable on <html> → propagates everywhere via var(--font-base)
    document.documentElement.style.setProperty('--font-base', fontValue)

    if (on) {
      // Lazy-load Lexend Deca if not already in <head>
      if (!document.getElementById('dyslexic-font-link')) {
        const el = document.createElement('link')
        el.id = 'dyslexic-font-link'
        el.rel = 'stylesheet'
        el.href = 'https://fonts.googleapis.com/css2?family=Lexend+Deca:wght@400;500;600;700&display=swap'
        document.head.appendChild(el)
      }
      toast('Switched to Lexend Deca — made for dyslexic readers 📖', 'success')
    } else {
      toast('Switched back to standard Lexend font', 'info')
    }
  }

  const FONT_SIZES = [
    { label: 'Small',   value: '14' },
    { label: 'Normal',  value: '16' },
    { label: 'Large',   value: '18' },
    { label: 'X-Large', value: '20' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold mb-2">
          <span className="gradient-text">Accessibility</span>
        </h1>
        <p className="text-slate-400 text-lg">Customise the app so reading and studying feels comfortable for you.</p>
      </div>

      <div className="flex flex-col gap-6">

        {/* ── Text-to-Speech ──────────────────── */}
        <Section
          icon={Volume2}
          color="#6366F1"
          title="Text-to-Speech"
          desc="Hear text read aloud to reduce reading effort. Click the play button and the app will speak to you."
        >
          <div className="flex flex-wrap gap-3">
            <button
              id="btn-tts-test"
              onClick={() => speak('This is a test of text-to-speech. The app reads text aloud to help you learn without tiring your eyes.')}
              disabled={speaking}
              className="btn btn-primary btn-md"
            >
              <Volume2 size={18} /> {speaking ? 'Speaking…' : 'Test Read-Aloud'}
            </button>
            <button
              id="btn-tts-stop"
              onClick={stopSpeaking}
              disabled={!speaking}
              className="btn btn-danger btn-md"
            >
              <VolumeX size={18} /> Stop
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            💡 You can add read-aloud to any section in a future update. For now, test the voice quality here.
          </p>
        </Section>

        {/* ── Dark / Light Mode ───────────────── */}
        <Section
          icon={darkMode ? Moon : Sun}
          color={darkMode ? '#8B5CF6' : '#F59E0B'}
          title={`${darkMode ? 'Dark' : 'Light'} Mode`}
          desc="Dark mode uses less bright light, reducing eye strain during long study sessions. Switch any time."
        >
          <div className="flex items-center gap-6 flex-wrap">
            <Toggle id="toggle-dark" on={darkMode} onChange={setDarkMode} label={darkMode ? 'Dark mode ON' : 'Light mode ON'} />
            <button
              id="btn-dark-toggle"
              onClick={() => setDarkMode(d => !d)}
              className={`btn btn-md ${darkMode ? 'btn-ghost' : 'btn-primary'}`}
            >
              {darkMode ? <><Sun size={18} /> Switch to Light</> : <><Moon size={18} /> Switch to Dark</>}
            </button>
          </div>
        </Section>

        {/* ── Font Size ───────────────────────── */}
        <Section
          icon={Type}
          color="#10B981"
          title="Text Size"
          desc="Make all text bigger or smaller. Pick what feels most comfortable for reading."
        >
          <div className="flex gap-2 flex-wrap">
            {FONT_SIZES.map(({ label, value }) => (
              <button
                key={value}
                id={`btn-font-${label.toLowerCase()}`}
                onClick={() => { setFontSize(value); toast(`Text size set to ${label}`, 'info') }}
                className={`btn btn-md ${fontSize === value ? 'btn-primary' : 'btn-ghost'}`}
                style={{ minWidth: 90 }}
              >
                {fontSize === value && <CheckCircle size={15} />}
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Current size: <strong className="text-slate-300">{fontSize}px</strong>.
            This affects all text across the entire app.
          </p>
        </Section>

        {/* ── Reading Guide ───────────────────── */}
        <Section
          icon={MousePointer2}
          color="#F59E0B"
          title="Reading Guide"
          desc="A yellow highlight bar follows your mouse cursor to help you track which line you are reading."
        >
          <Toggle
            id="toggle-reading-guide"
            on={readingGuide}
            onChange={v => {
              setReadingGuide(v)
              toast(v ? 'Reading guide on — move your mouse to see it' : 'Reading guide off', 'info')
            }}
            label={readingGuide ? 'Reading guide ON — move your mouse' : 'Reading guide OFF'}
          />
        </Section>

        {/* ── Dyslexia Font ───────────────────── */}
        <Section
          icon={BookOpen}
          color="#A78BFA"
          title="Dyslexia-Optimised Font"
          desc="Lexend Deca is a font specially designed to reduce visual stress and improve reading speed for dyslexic readers."
        >
          <Toggle
            id="toggle-dyslexic-font"
            on={dyslexicFont}
            onChange={toggleFont}
            label={dyslexicFont ? 'Lexend Deca active' : 'Standard Lexend active'}
          />
        </Section>

        {/* ── Summary ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: '24px 28px' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Info size={20} className="text-indigo-400" />
            <h3 className="font-bold text-lg">Active Accessibility Features</h3>
          </div>
          <ul className="space-y-2 text-sm text-slate-300">
            {[
              ['Text-to-Speech', 'available — click Test button'],
              ['Dark Mode', darkMode ? 'ON ✅' : 'OFF'],
              ['Text Size', `${fontSize}px`],
              ['Reading Guide', readingGuide ? 'ON ✅' : 'OFF'],
              ['Dyslexia Font', dyslexicFont ? 'Lexend Deca ON ✅' : 'Lexend (standard)'],
              ['High Contrast', 'always on'],
              ['Large click targets', 'all buttons ≥ 44px'],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span className="text-slate-400">{k}</span>
                <span className="font-semibold">{v}</span>
              </li>
            ))}
          </ul>
        </motion.div>

      </div>
    </div>
  )
}
