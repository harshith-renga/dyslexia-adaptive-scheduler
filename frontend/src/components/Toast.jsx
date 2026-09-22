import { CheckCircle, AlertCircle, Info } from 'lucide-react'

const ICONS = {
  success: <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />,
  error:   <AlertCircle size={18} className="text-red-400 flex-shrink-0" />,
  info:    <Info        size={18} className="text-indigo-400 flex-shrink-0" />,
}

export default function Toast({ msg, type = 'info' }) {
  return (
    <div className={`toast toast-${type}`} role="alert" aria-live="polite">
      {ICONS[type] || ICONS.info}
      <span>{msg}</span>
    </div>
  )
}
