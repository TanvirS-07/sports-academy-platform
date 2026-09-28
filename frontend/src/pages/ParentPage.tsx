import { useQueries } from '@tanstack/react-query'

import { useAuth } from '../auth/useAuth'
import { ButtonLink } from '../components/Button'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, Panel, RowList } from '../components/Panel'
import { QueryState } from '../components/QueryState'
import { LinkRow, SessionRow } from '../components/SessionRow'
import { Tag } from '../components/Tag'
import { useBookings, type Booking } from '../features/bookings/api'
import { playerQuery, usePlayers } from '../features/players/api'
import type { TrainingSession } from '../features/sessions/api'
import { formatDate } from '../lib/dates'
import { formatDay, formatTimeRange } from '../lib/sydneyTime'

type Upcoming = { session: TrainingSession; children: string[] }

/** Confirmed bookings grouped by session, soonest first, so siblings share a row. */
function upcomingSessions(bookings: Booking[]): Upcoming[] {
  const bySession = new Map<string, Upcoming>()
  for (const booking of bookings) {
    if (booking.status !== 'CONFIRMED' || booking.session.status !== 'SCHEDULED') continue
    const entry = bySession.get(booking.session.id) ?? { session: booking.session, children: [] }
    entry.children.push(booking.player.first_name)
    bySession.set(booking.session.id, entry)
  }
  return [...bySession.values()].sort((a, b) => a.session.starts_at.localeCompare(b.session.starts_at))
}

function joinNames(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? '')
}

export function ParentPage() {
  const { user } = useAuth()
  const players = usePlayers()
  const bookings = useBookings()
  // Each child's programs, shown under their name.
  const details = useQueries({ queries: (players.data ?? []).map((player) => playerQuery(player.id)) })
  const programsOf = (playerId: string) =>
    details.find((detail) => detail.data?.id === playerId)?.data?.programs.map((program) => program.name) ?? []

  const upcoming = upcomingSessions(bookings.data ?? [])
  const [next, ...later] = upcoming
  const hasPlayers = (players.data?.length ?? 0) > 0

  return (
    <>
      <PageHeader
        title={`Hi ${user?.first_name ?? ''}`}
        tabTitle="Home"
        description={
          players.data &&
          (hasPlayers
            ? `Parent account · ${players.data.length} ${players.data.length === 1 ? 'player' : 'players'}`
            : 'Parent account')
        }
        actions={hasPlayers && <ButtonLink to="/parent/sessions">Book sessions</ButtonLink>}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="min-w-0 space-y-6 lg:space-y-8">
          {next && (
            <section
              aria-labelledby="next-session-heading"
              className="rounded-lg border border-line border-l-4 border-l-brand bg-surface px-5 py-5 sm:px-6"
            >
              <h2 id="next-session-heading" className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
                Next session
              </h2>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-2xl font-bold tracking-tight">{formatDay(next.session.starts_at)}</p>
                  <p className="mt-1">
                    <span className="font-semibold tabular-nums">
                      {formatTimeRange(next.session.starts_at, next.session.ends_at)}
                    </span>
                    <span className="text-ink-muted"> · {next.session.program.name} with Coach {next.session.program.coach_name}</span>
                  </p>
                  <p className="text-sm text-ink-muted">{next.session.location}</p>
                </div>
                <div className="self-start sm:self-end">
                  <Tag tone="success">{joinNames(next.children)} booked</Tag>
                </div>
              </div>
            </section>
          )}

          <Panel title="Coming up" id="coming-up">
            <QueryState isPending={bookings.isPending} error={bookings.error} />
            {bookings.data && upcoming.length === 0 && (
              <EmptyState
                action={hasPlayers && <ButtonLink to="/parent/sessions" variant="secondary">See sessions</ButtonLink>}
              >
                {hasPlayers
                  ? 'Nothing booked yet. Sessions in your children’s programs are on the Sessions page.'
                  : 'Once you’ve added your child and their coach has enrolled them, their sessions show here.'}
              </EmptyState>
            )}
            {bookings.data && later.length > 0 && (
              <RowList>
                {later.map(({ session, children }) => (
                  <SessionRow
                    key={session.id}
                    startsAt={session.starts_at}
                    endsAt={session.ends_at}
                    detail={`${session.program.name} · ${session.location}`}
                    aside={<Tag tone="success">{joinNames(children)} booked</Tag>}
                  />
                ))}
              </RowList>
            )}
            {bookings.data && upcoming.length === 1 && (
              <p className="px-4 py-4 text-sm text-ink-muted sm:px-5">Nothing else booked after the next session.</p>
            )}
          </Panel>
        </div>

        <Panel
          title="Your players"
          id="players"
          action={hasPlayers && <ButtonLink to="/parent/players/new" variant="secondary" size="sm">Add player</ButtonLink>}
        >
          <QueryState isPending={players.isPending} error={players.error} />
          {players.data?.length === 0 && (
            <EmptyState action={<ButtonLink to="/parent/players/new">Add player</ButtonLink>}>
              Start by adding your child. Their coach then enrols them in a program, and you can book their sessions.
            </EmptyState>
          )}
          <RowList>
            {players.data?.map((player) => {
              const programs = programsOf(player.id)
              return (
                <LinkRow
                  key={player.id}
                  to={`/parent/players/${player.id}`}
                  title={`${player.first_name} ${player.last_name}`}
                  detail={
                    <>
                      <span>Born {formatDate(player.date_of_birth)}</span>
                      <span className="block">{programs.length > 0 ? programs.join(', ') : 'Not in a program yet'}</span>
                    </>
                  }
                />
              )
            })}
          </RowList>
        </Panel>
      </div>
    </>
  )
}
