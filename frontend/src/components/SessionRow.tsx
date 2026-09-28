import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { dateParts, formatDay, formatTimeRange } from '../lib/sydneyTime'

/** The date the way a fixture list shows it: TUE / 6 / OCT. */
function DateBlock({ iso, muted = false }: { iso: string; muted?: boolean }) {
  const { weekday, day, month } = dateParts(iso)
  return (
    <div
      className={`flex w-11 shrink-0 flex-col items-center border-r border-line pr-3 leading-none sm:w-12 sm:pr-4 ${muted ? 'opacity-55' : ''}`}
      aria-hidden="true"
    >
      <span className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">{weekday}</span>
      <span className="my-1 text-2xl font-bold tabular-nums">{day}</span>
      <span className="text-[11px] tracking-wide text-ink-muted uppercase">{month}</span>
    </div>
  )
}

const chevron = (
  <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-ink-faint" fill="currentColor" aria-hidden="true">
    <path d="M7.2 14.8a.75.75 0 0 1 0-1.06L10.94 10 7.2 6.26a.75.75 0 1 1 1.06-1.06l4.27 4.27a.75.75 0 0 1 0 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0Z" />
  </svg>
)

/**
 * One session in a list: the date column, the time, a line of detail, and
 * whatever belongs on the right (a tag, places left, buttons). With `to`, the
 * time links to the session.
 */
export function SessionRow({
  startsAt,
  endsAt,
  detail,
  aside,
  to,
  muted = false,
  children,
}: {
  startsAt: string
  endsAt: string
  detail: ReactNode
  aside?: ReactNode
  to?: string
  muted?: boolean
  children?: ReactNode
}) {
  const time = (
    <>
      <span className="sr-only">{formatDay(startsAt)}, </span>
      <span className="tabular-nums">{formatTimeRange(startsAt, endsAt)}</span>
    </>
  )
  const body = (
    <>
      <div className={`self-center ${aside ? 'row-span-2 @md:row-span-1' : ''}`}>
        <DateBlock iso={startsAt} muted={muted} />
      </div>
      <div className={`min-w-0 ${muted ? 'text-ink-muted' : ''}`}>
        <p className="text-[15px] font-semibold">{time}</p>
        <div className="mt-0.5 text-sm text-ink-muted">{detail}</div>
        {children}
      </div>
      {aside && (
        <div className="col-start-2 flex flex-wrap items-center gap-2 @md:col-start-3 @md:row-start-1 @md:justify-end">{aside}</div>
      )}
    </>
  )

  if (to) {
    return (
      <li className="@container">
        <Link to={to} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-subtle/70 sm:gap-4 sm:px-5">
          <div className={grid}>{body}</div>
          {chevron}
        </Link>
      </li>
    )
  }
  return (
    <li className="@container px-4 py-3.5 sm:px-5">
      <div className={grid}>{body}</div>
    </li>
  )
}

// In a narrow list (phones, sidebars) the tags and places drop under the time.
// With room, they sit on the right.
const grid = 'grid flex-1 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 @md:grid-cols-[auto_1fr_auto] @md:gap-x-4'

/** A row for a person or thing that links somewhere, like a player or a program. */
export function LinkRow({ to, title, detail, aside }: { to: string; title: ReactNode; detail?: ReactNode; aside?: ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-subtle/70 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{title}</p>
          {detail && <div className="mt-0.5 text-sm text-ink-muted">{detail}</div>}
        </div>
        {aside}
        {chevron}
      </Link>
    </li>
  )
}
