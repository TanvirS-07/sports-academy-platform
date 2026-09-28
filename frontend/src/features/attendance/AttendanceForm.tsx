import { useState, type FormEvent } from 'react'

import { Button } from '../../components/Button'
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

  const unmarked = rows.filter(({ player }) => !marks[player.id]).length

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <p className="text-sm text-ink-muted" aria-live="polite">
          {unmarked === 0 ? 'Everyone is marked.' : `${unmarked} of ${rows.length} not marked yet.`}
        </p>
        <Button size="sm" variant="secondary" disabled={unmarked === 0}
          onClick={() => {
            setMarks(Object.fromEntries(rows.map(({ player }) => [player.id, marks[player.id] ?? 'PRESENT'])))
            setSaved(false)
          }}>
          Mark the rest present
        </Button>
      </div>
      <ul className="divide-y divide-line">
        {rows.map(({ player }) => {
          const name = `${player.first_name} ${player.last_name}`
          return (
            <li key={player.id}>
              <fieldset className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:px-5">
                <legend className="sr-only">{name}</legend>
                <span aria-hidden="true" className="font-semibold">{name}</span>
                <div className="grid grid-cols-3 overflow-hidden rounded-md border border-control sm:inline-grid">
                  {statuses.map((status) => (
                    <label key={status}
                      className={`flex h-10 cursor-pointer items-center justify-center border-l border-control px-4 text-sm font-medium transition-colors first:border-l-0 hover:bg-subtle has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-brand ${selectedClasses[status]}`}>
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
      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <SubmitButton busy={busy} full={false}>Save attendance</SubmitButton>
        {saved && <p role="status" className="text-sm font-medium text-success">Attendance saved.</p>}
        <div className="sm:flex-1"><FormError message={error} /></div>
      </div>
    </form>
  )
}

const selectedClasses: Record<AttendanceStatus, string> = {
  PRESENT: 'has-[:checked]:bg-success has-[:checked]:text-white',
  ABSENT: 'has-[:checked]:bg-ink has-[:checked]:text-white',
  EXCUSED: 'has-[:checked]:bg-brand-soft has-[:checked]:text-brand',
}
