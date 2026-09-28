import { Tag } from '../../components/Tag'
import type { TrainingSession } from './api'
import { placesTag, placesText } from './places'

/** Places booked, with a Full, "2 left" or Cancelled tag when it matters. */
export function SessionPlaces({ session }: { session: TrainingSession }) {
  const tag = placesTag(session)
  return (
    <>
      {session.status !== 'CANCELLED' && (
        <span className="text-sm text-ink-muted tabular-nums">{placesText(session)}</span>
      )}
      {tag && <Tag tone={tag.tone}>{tag.text}</Tag>}
    </>
  )
}
