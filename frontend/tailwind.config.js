/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lexend', 'system-ui', 'sans-serif'],
        display: ['Lexend', 'system-ui', 'sans-serif'],
      },
      // Theme-aware colours: values flip between dark and light in index.css,
      // so existing text-slate-*, text-indigo-400 etc. keep working and stay readable.
      colors: {
        slate: {
          200: 'var(--c-slate-200)',
          300: 'var(--c-slate-300)',
          400: 'var(--c-slate-400)',
          500: 'var(--c-slate-500)',
        },
        indigo: { 400: 'var(--accent-text)' },
        purple: { 400: 'var(--accent-text)' },
        amber: { 300: 'var(--c-amber-300)', 400: 'var(--c-amber-400)' },
        emerald: { 400: 'var(--c-emerald-400)' },
        red: { 400: 'var(--c-red-400)' },
        accent: {
          DEFAULT: 'var(--accent)',
          text: 'var(--accent-text)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.22,1,0.36,1)',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.22,1,0.36,1)',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
