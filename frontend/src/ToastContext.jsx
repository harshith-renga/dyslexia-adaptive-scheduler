import { createContext, useContext, useState, useCallback } from 'react'

export const ToastContext = createContext(null)
export function useToast() { return useContext(ToastContext) }

export function ToastProvider({ children, renderToasts }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      {renderToasts ? renderToasts(toasts) : null}
    </ToastContext.Provider>
  )
}
