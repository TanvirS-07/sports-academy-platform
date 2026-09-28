import { useState, type ChangeEvent, type FormEvent } from 'react'

import { FormActions, FormError, FormField } from '../../components/FormField'
import { todayIso } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import type { PlayerData } from './api'

type Props = {
  initial?: PlayerData
  submitLabel: string
  onSubmit: (data: PlayerData) => Promise<unknown>
  onCancel?: () => void
}

const empty: PlayerData = { first_name: '', last_name: '', date_of_birth: '' }

export function PlayerForm({ initial = empty, submitLabel, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<PlayerData>({
    first_name: initial.first_name,
    last_name: initial.last_name,
    date_of_birth: initial.date_of_birth,
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function update(field: keyof PlayerData) {
    return (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim() || !form.date_of_birth) {
      setError('Please fill in every field.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit(form)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" name="first_name" required
          value={form.first_name} onChange={update('first_name')} />
        <FormField label="Last name" name="last_name" required
          value={form.last_name} onChange={update('last_name')} />
      </div>
      <FormField label="Date of birth" name="date_of_birth" type="date" required max={todayIso()}
        hint="Only you and your child's coaches can see this."
        value={form.date_of_birth} onChange={update('date_of_birth')} />
      <FormActions busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  )
}
