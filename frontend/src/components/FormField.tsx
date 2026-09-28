import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

import { Button } from './Button'

export const inputClasses =
  'block w-full rounded-md border border-control bg-surface px-3 text-[15px] text-ink placeholder:text-ink-faint transition-colors hover:border-ink-muted focus:border-brand focus:ring-3 focus:ring-brand/15 focus:outline-none disabled:bg-subtle'

function Label({ htmlFor, children, optional }: { htmlFor?: string; children: ReactNode; optional?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {children}
      </label>
      {optional && <span className="text-[13px] text-ink-faint">Optional</span>}
    </div>
  )
}

function Hint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-[13px] text-ink-muted">
      {children}
    </p>
  )
}

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }

export function FormField({ label, hint, id, ...inputProps }: Props) {
  const inputId = id ?? inputProps.name
  const hintId = `${inputId}-hint`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <input id={inputId} className={`${inputClasses} h-10`} aria-describedby={hint ? hintId : undefined} {...inputProps} />
      {hint && <Hint id={hintId}>{hint}</Hint>}
    </div>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }

export function TextAreaField({ label, hint, id, ...textAreaProps }: TextAreaProps) {
  const inputId = id ?? textAreaProps.name
  const hintId = `${inputId}-hint`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} optional={!textAreaProps.required}>{label}</Label>
      <textarea id={inputId} rows={3} className={`${inputClasses} py-2 leading-6`}
        aria-describedby={hint ? hintId : undefined} {...textAreaProps} />
      {hint && <Hint id={hintId}>{hint}</Hint>}
    </div>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string }

export function SelectField({ label, id, children, ...selectProps }: SelectProps) {
  const inputId = id ?? selectProps.name
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <select id={inputId} className={`${inputClasses} h-10`} {...selectProps}>
        {children}
      </select>
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
      {message}
    </p>
  )
}

type SubmitProps = { busy: boolean; children: string; busyLabel?: string; full?: boolean }

export function SubmitButton({ busy, children, busyLabel = 'Saving…', full = true }: SubmitProps) {
  return (
    <Button type="submit" disabled={busy} aria-busy={busy} className={full ? 'w-full' : ''}>
      {busy && <Spinner />}
      {busy ? busyLabel : children}
    </Button>
  )
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** The submit button, and a Cancel when the form can be closed without saving. */
export function FormActions({ busy, submitLabel, onCancel }: { busy: boolean; submitLabel: string; onCancel?: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
      <SubmitButton busy={busy} full={false}>{submitLabel}</SubmitButton>
      {onCancel && (
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      )}
    </div>
  )
}
