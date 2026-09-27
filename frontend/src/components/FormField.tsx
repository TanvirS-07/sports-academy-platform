import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }

const inputClasses =
  'block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none'

export function FormField({ label, hint, id, ...inputProps }: Props) {
  const inputId = id ?? inputProps.name
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input id={inputId} className={inputClasses} {...inputProps} />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }

export function TextAreaField({ label, id, ...textAreaProps }: TextAreaProps) {
  const inputId = id ?? textAreaProps.name
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea id={inputId} rows={3} className={inputClasses} {...textAreaProps} />
    </div>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string }

export function SelectField({ label, id, children, ...selectProps }: SelectProps) {
  const inputId = id ?? selectProps.name
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select id={inputId} className={inputClasses} {...selectProps}>
        {children}
      </select>
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  )
}

export function SubmitButton({ busy, children }: { busy: boolean; children: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
    >
      {busy ? 'Please wait…' : children}
    </button>
  )
}
