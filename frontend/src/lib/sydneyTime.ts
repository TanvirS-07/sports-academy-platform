/**
 * Session times are stored in UTC and shown in Sydney time, whatever time zone the
 * browser is in. This uses the browser's built-in Intl time zone data, which knows
 * about daylight saving, so no date library is needed.
 */

export const ACADEMY_TIME_ZONE = 'Australia/Sydney'

const dayFormat = new Intl.DateTimeFormat('en-AU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: ACADEMY_TIME_ZONE,
})

const timeFormat = new Intl.DateTimeFormat('en-AU', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: ACADEMY_TIME_ZONE,
})

const partsFormat = new Intl.DateTimeFormat('en-AU', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: ACADEMY_TIME_ZONE,
})

/** "Saturday 4 October" */
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso))
}

/** "10:00 am" */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso))
}

/** "Saturday 4 October, 10:00 am to 11:30 am" */
export function formatSessionTime(startsAt: string, endsAt: string): string {
  return `${formatDay(startsAt)}, ${formatTime(startsAt)} to ${formatTime(endsAt)}`
}

type WallTime = { date: string; time: string }

/** The Sydney date ("YYYY-MM-DD") and time ("HH:MM") of a moment. */
export function toSydney(iso: string | Date): WallTime {
  const parts: Record<string, string> = {}
  for (const part of partsFormat.formatToParts(new Date(iso))) parts[part.type] = part.value
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

function asUtcMillis({ date, time }: WallTime): number {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0)
}

/**
 * Turns a date and time typed in Sydney time into a UTC ISO string for the API.
 *
 * Returns null for a time that doesn't exist, which happens once a year when the
 * clocks go forward (2:00 to 3:00 am on the first Sunday in October).
 */
export function sydneyToUtc(date: string, time: string): string | null {
  const wanted = asUtcMillis({ date, time })
  // Guess using the offset at that moment, then correct once in case the guess
  // landed on the other side of a daylight saving change.
  let instant = wanted
  for (let attempt = 0; attempt < 2; attempt++) {
    const offset = asUtcMillis(toSydney(new Date(instant))) - instant
    instant = wanted - offset
    const result = toSydney(new Date(instant))
    if (result.date === date && result.time === time) return new Date(instant).toISOString()
  }
  return null
}

const partFormats = {
  weekday: new Intl.DateTimeFormat('en-AU', { weekday: 'short', timeZone: ACADEMY_TIME_ZONE }),
  day: new Intl.DateTimeFormat('en-AU', { day: 'numeric', timeZone: ACADEMY_TIME_ZONE }),
  month: new Intl.DateTimeFormat('en-AU', { month: 'short', timeZone: ACADEMY_TIME_ZONE }),
}

/** The pieces of a session's date for a fixture-style date column: "Tue", "6", "Oct". */
export function dateParts(iso: string): { weekday: string; day: string; month: string } {
  const date = new Date(iso)
  return {
    weekday: partFormats.weekday.format(date),
    day: partFormats.day.format(date),
    month: partFormats.month.format(date).slice(0, 3),
  }
}

/** "4:30 pm to 6:00 pm" */
export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)} to ${formatTime(endsAt)}`
}
