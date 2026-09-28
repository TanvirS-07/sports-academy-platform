import { useQueries } from '@tanstack/react-query'

import { Button, ButtonLink } from '../components/Button'
import { ConfirmAction } from '../components/Confirm'
import { Notice } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, Panel, RowList } from '../components/Panel'
import { QueryState } from '../components/QueryState'
import { SessionRow } from '../components/SessionRow'
import { Tag } from '../components/Tag'
import { useToast } from '../components/Toast'
import { useBookings, useBookSession, useCancelBooking } from '../features/bookings/api'
import { playerQuery, usePlayers } from '../features/players/api'
import { useSessions, type TrainingSession } from '../features/sessions/api'
import { SessionPlaces } from '../features/sessions/SessionPlaces'
import { errorMessage } from '../lib/errors'
import { formatDay, toSydney } from '../lib/sydneyTime'

type Child = { id: string; name: string; programIds: string[] }

const weekFormat = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', timeZone: 'UTC' })

/** The Monday of a session's week in Sydney, as "YYYY-MM-DD". */
function weekOf(iso: string): string {
  const date = new Date(`${toSydney(iso).date}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

function weekTitle(monday: string): string {
  const thisWeek = weekOf(new Date().toISOString())
  if (monday === thisWeek) return 'This week'
  const next = new Date(`${thisWeek}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 7)
  if (monday === next.toISOString().slice(0, 10)) return 'Next week'
  return `Week of ${weekFormat.format(new Date(`${monday}T00:00:00Z`))}`
}

function byWeek(sessions: TrainingSession[]): [string, TrainingSession[]][] {
  const weeks = new Map<string, TrainingSession[]>()
  for (const session of sessions) {
    const week = weekOf(session.starts_at)
    weeks.set(week, [...(weeks.get(week) ?? []), session])
  }
  return [...weeks.entries()]
}

export function ParentSessionsPage() {
  const sessions = useSessions()
  const bookings = useBookings()
  const players = usePlayers()
  // Each child's programs, to know which children can book which session.
  const details = useQueries({ queries: (players.data ?? []).map((player) => playerQuery(player.id)) })
  const book = useBookSession()
  const cancel = useCancelBooking()
  const toast = useToast()

  const children: Child[] = details.flatMap((detail) =>
    detail.data
      ? [{
          id: detail.data.id,
          name: detail.data.first_name,
          programIds: detail.data.programs.map((program) => program.id),
        }]
      : [],
  )
  const detailsLoaded = details.every((detail) => !detail.isPending)
  const enrolledChildren = children.filter((child) => child.programIds.length > 0)

  function confirmedBooking(session: TrainingSession, child: Child) {
    return bookings.data?.find(
      (booking) =>
        booking.session.id === session.id && booking.player.id === child.id && booking.status === 'CONFIRMED',
    )
  }

  function isBooking(session: TrainingSession, child: Child) {
    return book.isPending && book.variables?.sessionId === session.id && book.variables.playerId === child.id
  }

  const actionError = book.error ?? cancel.error

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Upcoming sessions in your children’s programs. Times are Sydney time."
      />

      <div className="max-w-3xl space-y-6">
        <QueryState
          isPending={sessions.isPending || players.isPending}
          error={sessions.error ?? bookings.error ?? players.error}
        />
        {actionError && <Notice tone="danger">{errorMessage(actionError)}</Notice>}

        {players.data?.length === 0 && (
          <Panel>
            <EmptyState action={<ButtonLink to="/parent/players/new">Add player</ButtonLink>}>
              Add your child first. Once their coach enrols them in a program, its sessions show here.
            </EmptyState>
          </Panel>
        )}
        {players.data && players.data.length > 0 && detailsLoaded && enrolledChildren.length === 0 && (
          <Notice tone="info">
            {children.map((child) => child.name).join(' and ')} {children.length === 1 ? 'isn’t' : 'aren’t'} in a
            program yet. Once their coach enrols them, their sessions show here.
          </Notice>
        )}
        {sessions.data?.length === 0 && enrolledChildren.length > 0 && (
          <Panel>
            <EmptyState>No upcoming sessions yet. They’ll show here once a coach adds them.</EmptyState>
          </Panel>
        )}

        {byWeek(sessions.data ?? []).map(([week, weekSessions]) => (
          <Panel key={week} title={weekTitle(week)} id={`week-${week}`}>
            <RowList>
              {weekSessions.map((session) => {
                const eligible = children.filter((child) => child.programIds.includes(session.program.id))
                const cancelled = session.status === 'CANCELLED'
                return (
                  <SessionRow
                    key={session.id}
                    startsAt={session.starts_at}
                    endsAt={session.ends_at}
                    muted={cancelled}
                    detail={
                      <>
                        <span className="font-medium text-ink">{session.program.name}</span> · {session.location}
                      </>
                    }
                    aside={<SessionPlaces session={session} />}
                  >
                    {!cancelled && eligible.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {eligible.map((child) => {
                          const booking = confirmedBooking(session, child)
                          return (
                            <li key={child.id} className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
                              {booking ? (
                                <>
                                  <Tag tone="success">{child.name} booked</Tag>
                                  <ConfirmAction
                                    label="Cancel"
                                    ariaLabel={`Cancel booking for ${child.name}`}
                                    question={`Cancel ${child.name}’s place?`}
                                    confirmLabel="Cancel booking"
                                    busy={cancel.isPending}
                                    onConfirm={() =>
                                      cancel.mutate(booking.id, {
                                        onSuccess: () =>
                                          toast(`${child.name}’s booking for ${formatDay(session.starts_at)} is cancelled.`),
                                      })
                                    }
                                  />
                                </>
                              ) : (
                                <Button size="sm" variant={session.available === 0 ? 'secondary' : 'primary'}
                                  disabled={isBooking(session, child) || session.available === 0}
                                  onClick={() =>
                                    book.mutate(
                                      { sessionId: session.id, playerId: child.id },
                                      { onSuccess: () => toast(`${child.name} is booked for ${formatDay(session.starts_at)}.`) },
                                    )
                                  }>
                                  {isBooking(session, child) ? 'Booking…' : `Book ${child.name}`}
                                </Button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </SessionRow>
                )
              })}
            </RowList>
          </Panel>
        ))}
      </div>
    </>
  )
}
