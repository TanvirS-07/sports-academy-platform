import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { QueryState } from '../components/QueryState'
import { usePlayerAttendance } from '../features/attendance/api'
import { AttendanceHistory } from '../features/attendance/AttendanceHistory'
import { useBookings, useCancelBooking, type Booking } from '../features/bookings/api'
import { useNotes } from '../features/notes/api'
import { NoteList } from '../features/notes/NoteList'
import { usePlayer, useUpdatePlayer } from '../features/players/api'
import { PlayerForm } from '../features/players/PlayerForm'
import { formatDate } from '../lib/dates'
import { formatSessionTime } from '../lib/sydneyTime'

/** Hides an old cancelled booking when the child has booked the same session again. */
function withoutRebooked(bookings: Booking[]): Booking[] {
  const confirmed = new Set(bookings.filter((b) => b.status === 'CONFIRMED').map((b) => b.session.id))
  return bookings.filter((b) => b.status === 'CONFIRMED' || !confirmed.has(b.session.id))
}

export function PlayerPage() {
  const { playerId = '' } = useParams()
  const player = usePlayer(playerId)
  const updatePlayer = useUpdatePlayer(playerId)
  const bookings = useBookings(playerId)
  const cancel = useCancelBooking()
  const attendance = usePlayerAttendance(playerId)
  const notes = useNotes(playerId)
  const [editing, setEditing] = useState(false)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link to="/parent" className="text-sm text-emerald-700 hover:underline">← My players</Link>
      <QueryState isPending={player.isPending} error={player.error} />

      {player.data && (
        <>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">{player.data.first_name} {player.data.last_name}</h1>
              <p className="text-slate-600">Born {formatDate(player.data.date_of_birth)}</p>
            </div>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)}
                className="text-sm font-medium text-emerald-700 hover:underline">
                Edit
              </button>
            )}
          </div>

          {editing && (
            <PlayerForm
              initial={player.data}
              submitLabel="Save changes"
              onSubmit={async (data) => {
                await updatePlayer.mutateAsync(data)
                setEditing(false)
              }}
            />
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Programs</h2>
            {player.data.programs.length === 0 ? (
              <p className="text-slate-600">Not enrolled in a program yet. Their coach will add them.</p>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                {player.data.programs.map((program) => (
                  <li key={program.id} className="px-4 py-3">
                    <p className="font-medium">{program.name}</p>
                    <p className="text-sm text-slate-500">
                      {program.sport} · {program.age_group} · Coach {program.coach_name}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Upcoming bookings</h2>
              <Link to="/parent/sessions" className="text-sm font-medium text-emerald-700 hover:underline">
                Book sessions
              </Link>
            </div>
            <QueryState isPending={bookings.isPending} error={bookings.error ?? cancel.error} />
            {bookings.data?.length === 0 && <p className="text-slate-600">No upcoming bookings.</p>}
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {withoutRebooked(bookings.data ?? []).map((booking) => (
                <li key={booking.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className={booking.status === 'CONFIRMED' ? 'font-medium' : 'font-medium text-slate-400'}>
                      {formatSessionTime(booking.session.starts_at, booking.session.ends_at)}
                    </p>
                    <p className="text-sm text-slate-500">{booking.session.program.name} · {booking.session.location}</p>
                  </div>
                  {booking.status === 'CONFIRMED' ? (
                    <button type="button" disabled={cancel.isPending} onClick={() => cancel.mutate(booking.id)}
                      className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60">
                      Cancel booking
                    </button>
                  ) : (
                    <span className="text-sm text-slate-500">
                      {booking.session.status === 'CANCELLED' ? 'Session cancelled' : 'Cancelled'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Attendance</h2>
            <QueryState isPending={attendance.isPending} error={attendance.error} />
            {attendance.data && <AttendanceHistory attendance={attendance.data} showProgram />}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Development notes</h2>
            <QueryState isPending={notes.isPending} error={notes.error} />
            {notes.data && <NoteList notes={notes.data} showProgram />}
          </section>
        </>
      )}
    </div>
  )
}
