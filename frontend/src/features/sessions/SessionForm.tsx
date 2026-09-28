import { useState, type ChangeEvent, type FormEvent } from 'react'

import { FormActions, FormError, FormField } from '../../components/FormField'
import { errorMessage } from '../../lib/errors'
import { sydneyToUtc, toSydney } from '../../lib/sydneyTime'
import type { SessionData } from './api'

type Props = {
  initial?: SessionData
  submitLabel: string
  onSubmit: (data: SessionData) => Promise<unknown>
  onCancel?: () => void
}

type Fields = { date: string; start: string; end: string; location: string; capacity: string }

function toFields(initial?: SessionData): Fields {
  if (!initial) return { date: '', start: '', end: '', location: '', capacity: '' }
  const start = toSydney(initial.starts_at)
  return {
    date: start.date,
    start: start.time,
    end: toSydney(initial.ends_at).time,
    location: initial.location,
    capacity: String(initial.capacity),
  }
}

/** Times are typed in Sydney time and sent to the API in UTC. */
export function SessionForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState(() => toFields(initial))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function update(field: keyof Fields) {
    return (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value })
  }

  function check(): SessionData | string {
    if (!form.date || !form.start || !form.end || !form.location.trim() || !form.capacity) {
      return 'Please fill in every field.'
    }
    const capacity = Number(form.capacity)
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
      return 'Capacity must be a whole number from 1 to 100.'
    }
    const startsAt = sydneyToUtc(form.date, form.start)
    const endsAt = sydneyToUtc(form.date, form.end)
    if (!startsAt || !endsAt) {
      return 'That time doesn’t exist in Sydney because of daylight saving. Please pick another.'
    }
    if (endsAt <= startsAt) return 'The end time must be after the start time.'
    return { starts_at: startsAt, ends_at: endsAt, location: form.location.trim(), capacity }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = check()
    if (typeof result === 'string') {
      setError(result)
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit(result)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <FormField label="Date" name="date" type="date" required value={form.date} onChange={update('date')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Start time" name="start" type="time" required value={form.start}
          onChange={update('start')} hint="Sydney time" />
        <FormField label="End time" name="end" type="time" required value={form.end}
          onChange={update('end')} />
      </div>
      <FormField label="Location" name="location" required placeholder="Main oval"
        value={form.location} onChange={update('location')} />
      <FormField label="Capacity" name="capacity" type="number" min={1} max={100} required
        value={form.capacity} onChange={update('capacity')} hint="How many players can book" />
      <FormActions busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  )
}
