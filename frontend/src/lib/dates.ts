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

/** Age in whole years today, from a "YYYY-MM-DD" date of birth. */
export function ageOn(dateOfBirth: string, today: Date = new Date()): number {
  const [year, month, day] = dateOfBirth.split('-').map(Number)
  let age = today.getFullYear() - (year ?? 0)
  const beforeBirthday =
    today.getMonth() + 1 < (month ?? 1) || (today.getMonth() + 1 === month && today.getDate() < (day ?? 1))
  if (beforeBirthday) age -= 1
  return age
}
