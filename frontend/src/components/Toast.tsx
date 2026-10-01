import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type Toast = { id: number; message: string; action?: { label: string; onClick: () => void } }

const ToastContext = createContext<(message: string, action?: Toast['action']) => void>(() => {})

/** Shows a short confirmation after something is saved, with an optional Undo. */
export function useToast() {
  return useContext(ToastContext)
}

const DISMISS_AFTER_MS = 6000
const LEAVE_MS = 180

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const [leaving, setLeaving] = useState(false)
  const nextId = useRef(1)

  const show = useCallback((message: string, action?: Toast['action']) => {
    setLeaving(false)
    setToast({ id: nextId.current++, message, action })
  }, [])

  // Fades the toast out, then removes it.
  const dismiss = useCallback(() => setLeaving(true), [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(dismiss, DISMISS_AFTER_MS)
    return () => clearTimeout(timer)
  }, [toast, dismiss])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => {
      setToast(null)
      setLeaving(false)
    }, LEAVE_MS)
    return () => clearTimeout(timer)
  }, [leaving])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 sm:justify-end sm:px-6"
      >
        {toast && (
          <div
            key={toast.id}
            className={`pointer-events-auto flex max-w-md items-center gap-4 rounded-md bg-ink px-4 py-3 text-sm text-white shadow-lg shadow-ink/20 ${leaving ? 'animate-toast-out' : 'animate-toast-in'}`}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick()
                  dismiss()
                }}
                className="font-semibold text-accent hover:underline"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismiss}
              className="-mr-1 ml-auto rounded p-1 text-white/60 hover:text-white"
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden="true">
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L8.94 10l-4.72 4.72a.75.75 0 1 0 1.06 1.06L10 11.06l4.72 4.72a.75.75 0 1 0 1.06-1.06L11.06 10l4.72-4.72a.75.75 0 0 0-1.06-1.06L10 8.94 5.28 4.22Z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
