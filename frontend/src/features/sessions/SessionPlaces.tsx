import { Tag } from '../../components/Tag'
import type { TrainingSession } from './api'
import { placesTag, placesText } from './places'

/** Places booked, with a Full, "2 left" or Cancelled tag when it matters. */
export function SessionPlaces({ session }: { session: TrainingSession }) {
  const tag = placesTag(session)
  return (
    <>
      {session.status !== 'CANCELLED' && (
        <span className="flex items-center gap-2">
          <CapacityBar booked={session.booked} capacity={session.capacity} />
          <span className="text-sm text-ink-muted tabular-nums">{placesText(session)}</span>
        </span>
      )}
      {tag && <Tag tone={tag.tone}>{tag.text}</Tag>}
    </>
  )
}

/** A small bar that fills to show how booked a session is. Amber when nearly full. */
function CapacityBar({ booked, capacity }: { booked: number; capacity: number }) {
  const ratio = capacity > 0 ? Math.min(booked / capacity, 1) : 0
  const colour = ratio >= 0.8 ? 'bg-accent' : 'bg-brand'
  return (
    <span aria-hidden="true" className="block h-1.5 w-14 overflow-hidden rounded-full bg-line">
      <span
        className={`block h-full origin-left animate-bar-fill rounded-full ${colour}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </span>
  )
}
