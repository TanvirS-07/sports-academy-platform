import { useState, type ChangeEvent, type FormEvent } from 'react'

import { FormActions, FormError, FormField, TextAreaField } from '../../components/FormField'
import { errorMessage } from '../../lib/errors'
import { toSydney } from '../../lib/sydneyTime'
import type { NoteData } from './api'

type Props = {
  initial?: NoteData
  submitLabel: string
  onSubmit: (data: NoteData) => Promise<unknown>
  onCancel?: () => void
}

const MAX_LENGTH = 2000

export function NoteForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  // The academy is in Sydney, so "today" is today in Sydney.
  const today = toSydney(new Date()).date
  const [form, setForm] = useState<NoteData>(
    () => initial ?? { noted_on: today, skills: '', improvements: '', progress: '' },
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function update(field: keyof NoteData) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [field]: e.target.value })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = {
      noted_on: form.noted_on,
      skills: form.skills.trim(),
      improvements: form.improvements.trim(),
      progress: form.progress.trim(),
    }
    if (!data.noted_on) {
      setError('Please pick a date.')
      return
    }
    if (!data.skills && !data.improvements && !data.progress) {
      setError('Write something in at least one of the boxes.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit(data)
      if (!initial) setForm({ noted_on: today, skills: '', improvements: '', progress: '' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <FormField label="Date" name="noted_on" type="date" max={today} required value={form.noted_on}
        onChange={update('noted_on')} />
      <TextAreaField label="Skills being worked on" name="skills" maxLength={MAX_LENGTH}
        value={form.skills} onChange={update('skills')} />
      <TextAreaField label="Areas to improve" name="improvements" maxLength={MAX_LENGTH}
        value={form.improvements} onChange={update('improvements')} />
      <TextAreaField label="Progress" name="progress" maxLength={MAX_LENGTH}
        value={form.progress} onChange={update('progress')} />
      <FormActions busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  )
}
