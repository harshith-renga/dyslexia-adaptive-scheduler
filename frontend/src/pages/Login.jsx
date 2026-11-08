import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn, UserPlus, Eye, EyeOff, BookOpen } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { useToast } from '../ToastContext'

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const navigate = useNavigate()
  const { login, register, user } = useAuth()
  const toast = useToast()

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user, navigate])

  function validate() {
    const e = {}
    if (!form.username.trim()) e.username = 'Username is required'
    if (!isLogin && !form.email.trim()) e.email = 'Email is required'
    if (!isLogin && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password || form.password.length < 4) e.password = 'Password must be at least 4 characters'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      if (isLogin) {
        await login({ username: form.username, password: form.password })
        toast('Welcome back, ' + form.username + '', 'success')
      } else {
        await register({ username: form.username, email: form.email, password: form.password })
        toast('Account created. Welcome, ' + form.username + '.', 'success')
      }
      navigate('/dashboard')
    } catch (err) {
      const msg = err.message || 'Authentication failed'
      try {
        const parsed = JSON.parse(msg)
        toast(parsed.detail || msg, 'error')
      } catch {
        toast(msg, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const field = (id, label, type, placeholder, value, key) => (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold mb-2 text-slate-300">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={type === 'password' && showPass ? 'text' : type}
          placeholder={placeholder}
          value={value}
          onChange={ev => setForm({ ...form, [key]: ev.target.value })}
          className={`input pr-10 ${errors[key] ? 'border-red-500' : ''}`}
          autoComplete={type === 'password' ? 'current-password' : 'username'}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label={showPass ? 'Hide password' : 'Show password'}
          >
            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {errors[key] && <p className="text-red-400 text-sm mt-1">{errors[key]}</p>}
    </div>
  )

  return (
    <div
      className="flex items-center justify-center min-h-[calc(100svh-64px)] px-4 py-12"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="card p-10">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div style={{ background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 12, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <BookOpen size={26} />
            </div>
            <h1 className="text-3xl font-bold mb-1">{isLogin ? 'Welcome back' : 'Create an account'}</h1>
            <p className="text-slate-400 text-base">
              {isLogin ? 'Sign in to access your schedule' : 'Start your personalised learning journey'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            {field('username', 'Username', 'text', 'e.g. alex123', form.username, 'username')}
            {!isLogin && field('email', 'Email address', 'email', 'you@example.com', form.email, 'email')}
            {field('password', 'Password', 'password', '••••••••', form.password, 'password')}

            <button
              id="btn-submit-auth"
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg mt-2 w-full"
            >
              {loading
                ? <span className="animate-pulse">Please wait…</span>
                : isLogin
                  ? <><LogIn size={20} /> Sign In</>
                  : <><UserPlus size={20} /> Create Account</>
              }
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-center text-slate-400 text-sm mb-4">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
            </p>
            <button
              id="btn-toggle-auth"
              type="button"
              onClick={() => { setIsLogin(l => !l); setErrors({}) }}
              className="btn btn-ghost btn-md w-full"
            >
              {isLogin ? <><UserPlus size={18} /> Create new account</> : <><LogIn size={18} /> Back to sign in</>}
            </button>
          </div>
        </div>

        {/* Quick tip */}
        <p className="text-center text-slate-500 text-sm mt-6">
          No email confirmation is needed for this demo.
        </p>
      </motion.div>
    </div>
  )
}
