import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Button, TextButton } from './Button'

/**
 * A destructive action that asks first. The trigger is a small red text button;
 * pressing it shows the question with a confirm and a "Keep it" button in place.
 */
export function ConfirmAction({
  label,
  ariaLabel,
  question,
  confirmLabel,
  onConfirm,
  busy = false,
}: {
  label: string
  ariaLabel?: string
  question: ReactNode
  confirmLabel: string
  onConfirm: () => void
  busy?: boolean
}) {
  const [asking, setAsking] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const keep = useRef<HTMLButtonElement>(null)
  const opened = useRef(false)

  // Keyboard users land on "Keep it" when asked, and back on the trigger after.
  useEffect(() => {
    if (asking) keep.current?.focus()
    else if (opened.current) trigger.current?.focus()
    opened.current = asking
  }, [asking])

  if (!asking) {
    return (
      <TextButton ref={trigger} tone="danger" aria-label={ariaLabel} onClick={() => setAsking(true)}>
        {label}
      </TextButton>
    )
  }

  return (
    <div role="group" aria-label={question && typeof question === 'string' ? question : label}
      className="flex flex-wrap items-center justify-end gap-2 rounded-md bg-danger-soft py-1.5 pr-1.5 pl-3 text-sm text-danger">
      <span className="font-medium">{question}</span>
      <Button
        size="sm"
        variant="danger"
        disabled={busy}
        onClick={() => {
          onConfirm()
          setAsking(false)
        }}
      >
        {confirmLabel}
      </Button>
      <Button ref={keep} size="sm" variant="secondary" onClick={() => setAsking(false)}>
        Keep it
      </Button>
    </div>
  )
}
