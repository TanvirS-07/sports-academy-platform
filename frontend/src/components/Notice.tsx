import type { ReactNode } from 'react'

const tones = {
  danger: 'border-danger/20 bg-danger-soft text-danger',
  success: 'border-success/20 bg-success-soft text-success',
  info: 'border-info/15 bg-info-soft text-info',
  warning: 'border-warning/20 bg-warning-soft text-warning',
}

/** An inline message. Errors are announced straight away; the rest politely. */
export function Notice({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-md border px-3.5 py-2.5 text-sm ${tones[tone]}`}>
      {children}
    </div>
  )
}
