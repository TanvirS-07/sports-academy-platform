const dateFormat = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Formats a "YYYY-MM-DD" date from the API, like "14 May 2013". */
export function formatDate(value: string): string {
  return dateFormat.format(new Date(`${value}T00:00:00Z`))
}

/** Today as "YYYY-MM-DD" in the browser's timezone, for the max of a date input. */
export function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
