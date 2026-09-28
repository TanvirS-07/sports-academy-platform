import { useState, type ChangeEvent, type FormEvent } from 'react'

import { FormActions, FormError, FormField, SelectField, TextAreaField } from '../../components/FormField'
import { errorMessage } from '../../lib/errors'
import { useSports, type ProgramData } from './api'

type Props = {
  initial?: ProgramData
  submitLabel: string
  onSubmit: (data: ProgramData) => Promise<unknown>
  onCancel?: () => void
}

const empty: ProgramData = { name: '', sport_id: '', age_group: '', description: '', objectives: '' }

export function ProgramForm({ initial = empty, submitLabel, onSubmit, onCancel }: Props) {
  const sports = useSports()
  const [form, setForm] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Most academies have one sport, so pick it rather than making the coach choose.
  const sportId = form.sport_id || (sports.data?.length === 1 ? sports.data[0]?.id : '') || ''

  function update(field: keyof ProgramData) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [field]: e.target.value })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.name.trim() || !form.age_group.trim() || !sportId) {
      setError('Please fill in the name, sport and age group.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit({ ...form, sport_id: sportId })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <FormField label="Name" name="name" required placeholder="U14 Cricket Development"
        value={form.name} onChange={update('name')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Sport" name="sport_id" required value={sportId} onChange={update('sport_id')}>
          <option value="" disabled>Choose a sport</option>
          {sports.data?.map((sport) => (
            <option key={sport.id} value={sport.id}>{sport.name}</option>
          ))}
        </SelectField>
        <FormField label="Age group" name="age_group" required placeholder="Under 14"
          value={form.age_group} onChange={update('age_group')} />
      </div>
      <TextAreaField label="Description" name="description"
        value={form.description} onChange={update('description')} />
      <TextAreaField label="Training objectives" name="objectives"
        value={form.objectives} onChange={update('objectives')} />
      <FormActions busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  )
}
