import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { Moon, Sun, Menu, X, BookOpen, LayoutDashboard, CalendarDays, BarChart2, Settings2, LogOut } from 'lucide-react'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import StudyPlanner from './pages/StudyPlanner'
import Analytics from './pages/Analytics'
import AccessibilitySettings from './pages/AccessibilitySettings'
import { AuthProvider, useAuth } from './AuthContext'
import { ToastProvider } from './ToastContext'
import Toast from './components/Toast'

/* ── Nav config ────────────────────────────────────────── */
const NAV_ITEMS = [
  { to: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/planner',    label: 'Planner',       icon: CalendarDays },
  { to: '/analytics',  label: 'Analytics',     icon: BarChart2 },
  { to: '/settings',   label: 'Accessibility', icon: Settings2 },
]

/* ── NavLink ─────────────────────────────────────────────*/
function NavLink({ to, label, Icon, onClick }) {
  const location = useLocation()
  const active = location.pathname === to
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`nav-link flex items-center gap-2 text-base ${active ? 'active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  )
}

/* ── Navbar ──────────────────────────────────────────────*/
function Navbar({ darkMode, setDarkMode }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const close = () => setMenuOpen(false)

  return (
    <nav className="site-nav" aria-label="Main">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2" onClick={close}>
          <div
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <BookOpen size={16} />
          </div>
          <span className="font-bold text-lg gradient-text">DysLexi</span>
          <span className="text-slate-400 font-medium text-lg hidden sm:inline">Scheduler</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} label={label} Icon={Icon} />
          ))}
          {!user && <NavLink to="/login" label="Login" Icon={LogOut} />}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden md:flex items-center gap-3">
              <span className="text-sm text-slate-400">
                Hi, <strong className="text-slate-200">{user.username}</strong>
              </span>
              <button
                onClick={logout}
                className="btn btn-ghost btn-sm"
                title="Sign out"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}

          <button
            onClick={() => setDarkMode(d => !d)}
            className="btn btn-ghost btn-sm p-2"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle colour mode"
          >
            {darkMode
              ? <Sun size={18} className="text-amber-400" />
              : <Moon size={18} className="text-slate-300" />}
          </button>

          <button
            onClick={() => setMenuOpen(o => !o)}
            className="md:hidden btn btn-ghost btn-sm p-2"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border)' }}
          className="mobile-panel md:hidden px-6 pb-6 pt-4 flex flex-col gap-2"
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} label={label} Icon={Icon} onClick={close} />
          ))}
          {!user && <NavLink to="/login" label="Login" Icon={LogOut} onClick={close} />}
          {user && (
            <button
              onClick={() => { logout(); close() }}
              className="btn btn-danger btn-sm mt-2 self-start"
            >
              <LogOut size={15} /> Sign out ({user.username})
            </button>
          )}
        </div>
      )}
    </nav>
  )
}

/* ── PrivateRoute ────────────────────────────────────────*/
function PrivateRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

/* ── App (inner) ─────────────────────────────────────────*/
function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try { return JSON.parse(localStorage.getItem('darkMode')) ?? true } catch { return true }
  })
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('fontSize') || '16')
  const [readingGuide, setReadingGuide] = useState(false)
  const [guideY, setGuideY] = useState(200)

  useEffect(() => {
    // Toggle 'light' class on <html> so CSS variables in .light {} activate
    if (darkMode) {
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode])

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`
    localStorage.setItem('fontSize', fontSize)
  }, [fontSize])

  // Apply the saved reading-font choice on every page, not only after visiting Settings
  useEffect(() => {
    if (localStorage.getItem('dyslexicFont') === 'true') {
      document.documentElement.style.setProperty('--font-base', "'Lexend Deca', 'Lexend', sans-serif")
    }
  }, [])

  useEffect(() => {
    if (!readingGuide) return
    const handler = e => setGuideY(e.clientY - 18)
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [readingGuide])

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <a href="#main" className="skip-link">Skip to content</a>
      {readingGuide && (
        <div className="reading-guide" style={{ top: guideY }} aria-hidden="true" />
      )}
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <main id="main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/settings" element={
            <AccessibilitySettings
              darkMode={darkMode} setDarkMode={setDarkMode}
              fontSize={fontSize}  setFontSize={setFontSize}
              readingGuide={readingGuide} setReadingGuide={setReadingGuide}
            />
          } />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard darkMode={darkMode} /></PrivateRoute>} />
          <Route path="/planner"   element={<PrivateRoute><StudyPlanner /></PrivateRoute>} />
          <Route path="/analytics" element={<PrivateRoute><Analytics darkMode={darkMode} /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

/* ── Root ────────────────────────────────────────────────*/
export default function AppWithProviders() {
  return (
    <AuthProvider>
      <ToastProvider
        renderToasts={(toasts) => (
          <div className="toast-container" aria-live="polite">
            {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} />)}
          </div>
        )}
      >
        <Router>
          <App />
        </Router>
      </ToastProvider>
    </AuthProvider>
  )
}