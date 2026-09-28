import type { TrainingSession } from './api'

/** "7 of 10 booked, 3 left" or "Full (10 of 10 booked)" */
export function placesText(session: TrainingSession): string {
  if (session.status === 'CANCELLED') return 'Cancelled'
  if (session.available === 0) return `Full (${session.booked} of ${session.capacity} booked)`
  return `${session.booked} of ${session.capacity} booked, ${session.available} left`
}
