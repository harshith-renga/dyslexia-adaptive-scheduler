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
        sans: ['Lexend', 'sans-serif'],
        display: ['Lexend', 'sans-serif'],
      },
      colors: {
        navy: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
        accent: {
          DEFAULT: '#6366F1',
          light: '#A5B4FC',
          dark: '#4F46E5',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease',
        'slide-up': 'slideUp 0.25s ease',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: 1 },
          '50%':       { opacity: 0.65 },
        },
      },
      boxShadow: {
        'glow': '0 0 24px rgba(99,102,241,0.35)',
        'glow-sm': '0 0 12px rgba(99,102,241,0.25)',
      },
    },
  },
  plugins: [],
}