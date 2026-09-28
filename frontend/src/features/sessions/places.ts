import type { Tone } from '../../components/Tag'
import type { TrainingSession } from './api'

/** "7 / 10 places" */
export function placesText(session: Pick<TrainingSession, 'booked' | 'capacity'>): string {
  return `${session.booked} / ${session.capacity} places`
}

/** A tag when a session needs attention: cancelled, full, or nearly full. */
export function placesTag(session: TrainingSession): { tone: Tone; text: string } | null {
  if (session.status === 'CANCELLED') return { tone: 'danger', text: 'Cancelled' }
  if (session.available === 0) return { tone: 'warning', text: 'Full' }
  if (session.available <= 3) return { tone: 'warning', text: `${session.available} left` }
  return null
}
