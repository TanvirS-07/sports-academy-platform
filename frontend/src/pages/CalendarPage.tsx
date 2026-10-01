import { useState } from 'react'
import { Link } from 'react-router'

import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, Panel, RowList } from '../components/Panel'
import { QueryState } from '../components/QueryState'
import { SessionRow } from '../components/SessionRow'
import { Tag } from '../components/Tag'
import { useBookings } from '../features/bookings/api'
import { useSessions, type TrainingSession } from '../features/sessions/api'
import { SessionPlaces } from '../features/sessions/SessionPlaces'
import { formatTime, toSydney } from '../lib/sydneyTime'

type Month = { year: number; month: number } // month is 0-11

const PROGRAM_COLOURS = [
  { edge: 'border-l-program-1', dot: 'bg-program-1' },
  { edge: 'border-l-program-2', dot: 'bg-program-2' },
  { edge: 'border-l-program-3', dot: 'bg-program-3' },
  { edge: 'border-l-program-4', dot: 'bg-program-4' },
]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const monthTitle = new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthName = new Intl.DateTimeFormat('en-AU', { month: 'long', timeZone: 'UTC' })

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Every day shown for a month: whole weeks, Monday first, as "YYYY-MM-DD". */
function gridDays({ year, month }: Month): string[] {
  const first = new Date(Date.UTC(year, month, 1))
  const start = new Date(first)
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7))
  const last = new Date(Date.UTC(year, month + 1, 0))
  const end = new Date(last)
  end.setUTCDate(last.getUTCDate() + (6 - ((last.getUTCDay() + 6) % 7)))
  const days: string[] = []
  for (const day = start; day <= end; day.setUTCDate(day.getUTCDate() + 1)) days.push(isoDate(day))
  return days
}

/**
 * The days to show. For the current month, weeks that are already over are
 * dropped (only upcoming sessions exist) and the next month's weeks fill the gap,
 * so the first view is never mostly empty.
 */
function visibleDays(shown: Month, today: string): string[] {
  const days = gridDays(shown)
  const current = currentMonth()
  if (shown.year !== current.year || shown.month !== current.month) return days
  const weeks: string[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  const upcoming = weeks.filter((week) => (week.at(-1) ?? '') >= today)
  while (upcoming.length < 5) {
    const lastDay = new Date(`${upcoming.at(-1)?.at(-1) ?? today}T00:00:00Z`)
    const week: string[] = []
    for (let d = 1; d <= 7; d++) {
      const day = new Date(lastDay)
      day.setUTCDate(lastDay.getUTCDate() + d)
      week.push(isoDate(day))
    }
    upcoming.push(week)
  }
  return upcoming.flat()
}

function currentMonth(): Month {
  const [year, month] = toSydney(new Date()).date.split('-').map(Number)
  return { year: year ?? 2026, month: (month ?? 1) - 1 }
}

function shiftMonth({ year, month }: Month, by: number): Month {
  const date = new Date(Date.UTC(year, month + by, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() }
}

export function CalendarPage() {
  const { user } = useAuth()
  const isParent = user?.role === 'PARENT'
  const sessions = useSessions()
  const bookings = useBookings(undefined, { enabled: isParent })
  const [shown, setShown] = useState(currentMonth)
  // Which way the month grid slides when you change month.
  const [slide, setSlide] = useState<'next' | 'prev' | null>(null)
  function goTo(month: Month) {
    const diff = (month.year - shown.year) * 12 + (month.month - shown.month)
    if (diff === 0) return
    setSlide(diff > 0 ? 'next' : 'prev')
    setShown(month)
  }
  const slideClass = slide === 'next' ? 'animate-month-next' : slide === 'prev' ? 'animate-month-prev' : ''
  const monthKey = `${shown.year}-${shown.month}`

  const today = toSydney(new Date()).date
  const days = visibleDays(shown, today)
  const current = currentMonth()
  // The current month's view runs into the next month, so every day in it counts as "in view".
  const rolling = shown.year === current.year && shown.month === current.month
  const monthPrefix = `${shown.year}-${String(shown.month + 1).padStart(2, '0')}`
  const inView = (day: string) => rolling || day.startsWith(monthPrefix)
  const firstDay = new Date(`${days[0]}T00:00:00Z`)
  // The Monday of the last week, so a Sunday spilling into the next month doesn't count.
  const lastDay = new Date(`${days.at(-7)}T00:00:00Z`)
  const title =
    rolling && firstDay.getUTCMonth() !== lastDay.getUTCMonth()
      ? `${monthName.format(firstDay)} to ${monthTitle.format(lastDay)}`
      : monthTitle.format(new Date(Date.UTC(shown.year, shown.month, 1)))

  // Programs keep the same colour whichever month is shown.
  const programs = [...new Map((sessions.data ?? []).map((s) => [s.program.id, s.program.name])).entries()].sort(
    (a, b) => a[1].localeCompare(b[1]),
  )
  const colourOf = (programId: string) =>
    PROGRAM_COLOURS[programs.findIndex(([id]) => id === programId) % PROGRAM_COLOURS.length] ?? PROGRAM_COLOURS[0]!

  const bookedSessionIds = new Set(
    (bookings.data ?? []).filter((b) => b.status === 'CONFIRMED').map((b) => b.session.id),
  )
  const bookedNames = (sessionId: string) =>
    (bookings.data ?? [])
      .filter((b) => b.status === 'CONFIRMED' && b.session.id === sessionId)
      .map((b) => b.player.first_name)

  const byDay = new Map<string, TrainingSession[]>()
  for (const session of sessions.data ?? []) {
    const day = toSydney(session.starts_at).date
    byDay.set(day, [...(byDay.get(day) ?? []), session])
  }
  const monthDays = [...byDay.keys()].filter((day) => days.includes(day) && inView(day)).sort()
  const linkFor = (session: TrainingSession) => (isParent ? '/parent/sessions' : `/coach/sessions/${session.id}`)

  return (
    <>
      <PageHeader
        title={title}
        tabTitle="Calendar"
        description={
          isParent
            ? 'Sessions in your children’s programs.'
            : 'Upcoming sessions across your programs.'
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => goTo(currentMonth())}>Today</Button>
            <div className="flex">
              <Button variant="secondary" className="rounded-r-none px-3" aria-label="Previous month"
                onClick={() => goTo(shiftMonth(shown, -1))}>
                <Chevron direction="left" />
              </Button>
              <Button variant="secondary" className="-ml-px rounded-l-none px-3" aria-label="Next month"
                onClick={() => goTo(shiftMonth(shown, 1))}>
                <Chevron direction="right" />
              </Button>
            </div>
          </>
        }
      />

      <QueryState isPending={sessions.isPending} error={sessions.error} />

      {programs.length > 0 && (
        <ul aria-label="Programs" className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
          {programs.map(([id, name]) => (
            <li key={id} className="flex items-center gap-2">
              <span aria-hidden="true" className={`h-3.5 w-1 rounded-sm ${colourOf(id).dot}`} />
              {name}
            </li>
          ))}
          {isParent && (
            <li className="hidden items-center gap-2 md:flex">
              <span aria-hidden="true" className="h-3.5 w-5 rounded-sm bg-brand-soft ring-1 ring-brand/20" />
              Booked
            </li>
          )}
        </ul>
      )}

      {/* Month grid on tablets and up. */}
      <div key={monthKey} className={`hidden overflow-hidden rounded-lg border border-line bg-surface md:block ${slideClass}`}>
        <div className="grid grid-cols-7 border-b border-line bg-subtle/60">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const inMonth = inView(day)
            const isToday = day === today
            const daySessions = byDay.get(day) ?? []
            return (
              <div
                key={day}
                className={`min-h-28 border-line p-1.5 ${index % 7 === 6 ? '' : 'border-r'} ${index >= 7 ? 'border-t' : ''} ${inMonth ? '' : 'bg-subtle/60'} ${day < today ? 'text-ink-faint' : ''}`}
              >
                <span
                  aria-current={isToday ? 'date' : undefined}
                  className={`grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums ${isToday ? 'bg-accent text-brand' : inMonth ? '' : 'text-ink-faint'}`}
                >
                  {Number(day.slice(8))}
                </span>
                <ul className="mt-1 space-y-1">
                  {daySessions.map((session) => {
                    const cancelled = session.status === 'CANCELLED'
                    const booked = bookedSessionIds.has(session.id)
                    return (
                      <li key={session.id}>
                        <Link
                          to={linkFor(session)}
                          title={`${session.program.name}, ${session.location}`}
                          className={`block rounded-sm border-l-2 px-1.5 py-1 text-xs leading-snug transition-colors hover:bg-subtle ${colourOf(session.program.id).edge} ${
                            cancelled ? 'text-ink-faint line-through' : booked ? 'bg-brand-soft font-medium text-ink' : 'text-ink ring-1 ring-line ring-inset'
                          }`}
                        >
                          <span className="block font-semibold tabular-nums">{formatTime(session.starts_at)}</span>
                          <span className="block truncate">{session.program.name}</span>
                          {cancelled && <span className="sr-only"> (cancelled)</span>}
                          {booked && <span className="sr-only"> (booked)</span>}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* A list by day on phones, where seven columns don't fit. */}
      <div key={`list-${monthKey}`} className={`space-y-4 md:hidden ${slideClass}`}>
        {sessions.data && monthDays.length === 0 && (
          <Panel>
            <EmptyState>No upcoming sessions this month.</EmptyState>
          </Panel>
        )}
        {monthDays.length > 0 && (
          <Panel>
            <RowList>
              {monthDays.flatMap((day) =>
                (byDay.get(day) ?? []).map((session) => {
                  const names = isParent ? bookedNames(session.id) : []
                  return (
                    <SessionRow
                      key={session.id}
                      startsAt={session.starts_at}
                      endsAt={session.ends_at}
                      to={linkFor(session)}
                      muted={session.status === 'CANCELLED'}
                      detail={
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true" className={`h-3.5 w-1 shrink-0 rounded-sm ${colourOf(session.program.id).dot}`} />
                          {session.program.name}
                        </span>
                      }
                      aside={
                        names.length > 0 ? <Tag tone="success">{names.join(' and ')} booked</Tag> : <SessionPlaces session={session} />
                      }
                    />
                  )
                }),
              )}
            </RowList>
          </Panel>
        )}
      </div>

      <p className="mt-4 text-[13px] text-ink-muted">Only upcoming sessions are shown.</p>
    </>
  )
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" className={`size-4 ${direction === 'left' ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden="true">
      <path d="M7.2 14.8a.75.75 0 0 1 0-1.06L10.94 10 7.2 6.26a.75.75 0 1 1 1.06-1.06l4.27 4.27a.75.75 0 0 1 0 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0Z" />
    </svg>
  )
}
