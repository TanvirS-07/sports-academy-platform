import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { QueryState } from '../components/QueryState'
import { useSaveAttendance, useSessionAttendance } from '../features/attendance/api'
import { AttendanceForm } from '../features/attendance/AttendanceForm'
import { useCancelBooking } from '../features/bookings/api'
import { useCancelSession, useSession, useSessionBookings, useUpdateSession } from '../features/sessions/api'
import { placesText } from '../features/sessions/places'
import { SessionForm } from '../features/sessions/SessionForm'
import { errorMessage } from '../lib/errors'
import { formatSessionTime } from '../lib/sydneyTime'

export function CoachSessionPage() {
  const { sessionId = '' } = useParams()
  const session = useSession(sessionId)
  const bookings = useSessionBookings(sessionId)
  const updateSession = useUpdateSession(sessionId)
  const cancelSession = useCancelSession(sessionId)
  const cancelBooking = useCancelBooking()
  const [editing, setEditing] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const actionError = cancelSession.error ?? cancelBooking.error
  const scheduled = session.data?.status === 'SCHEDULED'
  const upcoming = scheduled && new Date(session.data?.starts_at ?? 0) > new Date()
  // Attendance opens when the session starts. Bookings can't change after that.
  const started = scheduled && !upcoming
  const attendance = useSessionAttendance(sessionId, started)
  const saveAttendance = useSaveAttendance(sessionId)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {session.data && (
        <Link to={`/coach/programs/${session.data.program.id}`} className="text-sm text-emerald-700 hover:underline">
          ← {session.data.program.name}
        </Link>
      )}
      <QueryState isPending={session.isPending} error={session.error} />

      {session.data && (
        <>
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold">{formatSessionTime(session.data.starts_at, session.data.ends_at)}</h1>
                <p className="text-slate-600">{session.data.location} · {placesText(session.data)}</p>
              </div>
              {upcoming && !editing && (
                <button type="button" onClick={() => setEditing(true)}
                  className="text-sm font-medium text-emerald-700 hover:underline">
                  Edit
                </button>
              )}
            </div>
            {editing && (
              <SessionForm
                initial={session.data}
                submitLabel="Save changes"
                onSubmit={async (data) => {
                  await updateSession.mutateAsync(data)
                  setEditing(false)
                }}
              />
            )}
          </div>

          {actionError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {errorMessage(actionError)}
            </p>
          )}

          {started && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Attendance</h2>
              <QueryState isPending={attendance.isPending} error={attendance.error} />
              {attendance.data?.length === 0 && <p className="text-slate-600">Nobody was booked into this session.</p>}
              {attendance.data && attendance.data.length > 0 && (
                <AttendanceForm rows={attendance.data} onSave={(records) => saveAttendance.mutateAsync(records)} />
              )}
            </section>
          )}

          {!started && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Booked players</h2>
              <QueryState isPending={bookings.isPending} error={bookings.error} />
              {bookings.data?.length === 0 && <p className="text-slate-600">Nobody has booked yet.</p>}
              <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                {bookings.data?.map((booking) => {
                  const name = `${booking.player.first_name} ${booking.player.last_name}`
                  return (
                    <li key={booking.id} className="flex items-center justify-between px-4 py-3">
                      <span className="font-medium">{name}</span>
                      {upcoming && (
                        <button type="button" disabled={cancelBooking.isPending}
                          onClick={() => cancelBooking.mutate(booking.id)}
                          aria-label={`Cancel booking: ${name}`}
                          className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60">
                          Cancel booking
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
              {upcoming && <p className="text-sm text-slate-500">You can mark attendance once the session starts.</p>}
            </section>
          )}

          {upcoming && (
            <section className="space-y-2">
              {confirmingCancel ? (
                <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-900">
                    Cancel this session? Every booking for it will be cancelled too.
                  </p>
                  <div className="flex gap-3">
                    <button type="button" disabled={cancelSession.isPending}
                      onClick={() => cancelSession.mutate(undefined, { onSettled: () => setConfirmingCancel(false) })}
                      className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60">
                      Yes, cancel it
                    </button>
                    <button type="button" onClick={() => setConfirmingCancel(false)}
                      className="text-sm font-medium text-slate-700 hover:underline">
                      Keep it
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmingCancel(true)}
                  className="text-sm font-medium text-red-700 hover:underline">
                  Cancel session
                </button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
