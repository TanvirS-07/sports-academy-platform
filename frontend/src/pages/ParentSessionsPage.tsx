import { useQueries } from '@tanstack/react-query'
import { Link } from 'react-router'

import { QueryState } from '../components/QueryState'
import { useBookings, useBookSession, useCancelBooking } from '../features/bookings/api'
import { playerQuery, usePlayers } from '../features/players/api'
import { useSessions, type TrainingSession } from '../features/sessions/api'
import { placesText } from '../features/sessions/places'
import { errorMessage } from '../lib/errors'
import { formatSessionTime } from '../lib/sydneyTime'

type Child = { id: string; name: string; programIds: string[] }

export function ParentSessionsPage() {
  const sessions = useSessions()
  const bookings = useBookings()
  const players = usePlayers()
  // Each child's programs, to know which children can book which session.
  const details = useQueries({ queries: (players.data ?? []).map((player) => playerQuery(player.id)) })
  const book = useBookSession()
  const cancel = useCancelBooking()

  const children: Child[] = details.flatMap((detail) =>
    detail.data
      ? [{
          id: detail.data.id,
          name: detail.data.first_name,
          programIds: detail.data.programs.map((program) => program.id),
        }]
      : [],
  )

  function confirmedBooking(session: TrainingSession, child: Child) {
    return bookings.data?.find(
      (booking) =>
        booking.session.id === session.id && booking.player.id === child.id && booking.status === 'CONFIRMED',
    )
  }

  const actionError = book.error ?? cancel.error
  const busy = book.isPending || cancel.isPending

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link to="/parent" className="text-sm text-emerald-700 hover:underline">← My players</Link>
        <h1 className="text-2xl font-bold">Sessions</h1>
        <p className="text-slate-600">Upcoming sessions in your children’s programs. Times are Sydney time.</p>
      </div>

      <QueryState isPending={sessions.isPending} error={sessions.error ?? bookings.error} />
      {actionError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorMessage(actionError)}
        </p>
      )}
      {sessions.data?.length === 0 && (
        <p className="text-slate-600">No upcoming sessions yet. They’ll show here once a coach adds them.</p>
      )}

      <ul className="space-y-3">
        {sessions.data?.map((session) => {
          const eligible = children.filter((child) => child.programIds.includes(session.program.id))
          return (
            <li key={session.id} className="space-y-3 rounded-md border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="font-medium">{formatSessionTime(session.starts_at, session.ends_at)}</p>
                <p className="text-sm text-slate-500">
                  {session.program.name} · {session.location} · {placesText(session)}
                </p>
              </div>
              {eligible.map((child) => {
                const booking = confirmedBooking(session, child)
                return (
                  <div key={child.id} className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="text-sm">
                      {child.name}: {booking ? 'booked' : 'not booked'}
                    </span>
                    {booking ? (
                      <button type="button" disabled={busy} onClick={() => cancel.mutate(booking.id)}
                        aria-label={`Cancel booking for ${child.name}`}
                        className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60">
                        Cancel booking
                      </button>
                    ) : (
                      <button type="button" disabled={busy || session.available === 0}
                        onClick={() => book.mutate({ sessionId: session.id, playerId: child.id })}
                        aria-label={`Book ${child.name}`}
                        className="rounded-md bg-emerald-700 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
                        {session.available === 0 ? 'Full' : 'Book'}
                      </button>
                    )}
                  </div>
                )
              })}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
