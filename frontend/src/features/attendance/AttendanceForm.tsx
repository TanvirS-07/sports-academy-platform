import { useState, type FormEvent } from 'react'

import { FormError, SubmitButton } from '../../components/FormField'
import { errorMessage } from '../../lib/errors'
import { attendanceLabels, type AttendanceMark, type AttendanceStatus, type SessionAttendanceRow } from './api'

type Props = {
  rows: SessionAttendanceRow[]
  onSave: (records: AttendanceMark[]) => Promise<unknown>
}

const statuses: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'EXCUSED']

/** One row per booked player with Present, Absent and Excused, saved together. */
export function AttendanceForm({ rows, onSave }: Props) {
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | null>>(() =>
    Object.fromEntries(rows.map((row) => [row.player.id, row.status])),
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  function mark(playerId: string, status: AttendanceStatus) {
    setMarks({ ...marks, [playerId]: status })
    setSaved(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const records: AttendanceMark[] = []
    for (const [playerId, status] of Object.entries(marks)) {
      if (status) records.push({ player_id: playerId, status })
    }
    if (records.length === 0) {
      setError('Mark at least one player first.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSave(records)
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />
      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {rows.map(({ player }) => {
          const name = `${player.first_name} ${player.last_name}`
          return (
            <li key={player.id}>
              <fieldset className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <legend className="float-left font-medium">{name}</legend>
                <div className="flex gap-1">
                  {statuses.map((status) => (
                    <label key={status}
                      className="cursor-pointer rounded-md border border-slate-300 px-3 py-1 text-sm has-[:checked]:border-emerald-700 has-[:checked]:bg-emerald-700 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-600">
                      <input type="radio" name={`attendance-${player.id}`} value={status} className="sr-only"
                        checked={marks[player.id] === status} onChange={() => mark(player.id, status)} />
                      {attendanceLabels[status]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </li>
          )
        })}
      </ul>
      {saved && <p role="status" className="text-sm text-emerald-800">Attendance saved.</p>}
      <SubmitButton busy={busy}>Save attendance</SubmitButton>
    </form>
  )
}
