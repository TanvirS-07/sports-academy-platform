import { execSync } from 'node:child_process'

import { expect, test, type Page } from '@playwright/test'

// Uses the same coach account as auth.spec.ts, created before the tests run.
const COACH_EMAIL = process.env.E2E_COACH_EMAIL ?? 'e2e-coach@example.com'
const COACH_PASSWORD = process.env.E2E_COACH_PASSWORD ?? 'e2e-coach-password'
const PARENT_PASSWORD = 'a-good-long-password'
// How to run a backend script. Set E2E_BACKEND_EXEC when the backend isn't running in Docker Compose.
const BACKEND_EXEC = process.env.E2E_BACKEND_EXEC ?? 'docker compose exec -T backend'

/** A made-up surname, so this run's player is the only match when the coach searches. */
function uniqueSurname() {
  const letters = Array.from({ length: 8 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26)))
  return `Test${letters.join('')}`
}

/** A week from today as "YYYY-MM-DD", for the session date. */
function inAWeek() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
}

async function logOut(page: Page) {
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Log in' })).toBeVisible()
}

test('a coach records attendance and a note, and the parent sees both', async ({ page }) => {
  const surname = uniqueSurname()
  const parentEmail = `parent-${surname.toLowerCase()}@example.com`
  const programName = `U14 Attendance ${surname}`
  const child = `Sam ${surname}`

  // The parent signs up and adds their child.
  await page.goto('/register')
  await page.getByLabel('First name').fill('Alex')
  await page.getByLabel('Last name').fill(surname)
  await page.getByLabel('Email').fill(parentEmail)
  await page.getByLabel('Password').fill(PARENT_PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/parent')
  await page.getByRole('link', { name: 'Add player' }).click()
  await page.getByLabel('First name').fill('Sam')
  await page.getByLabel('Last name').fill(surname)
  await page.getByLabel('Date of birth').fill('2013-05-14')
  await page.getByRole('button', { name: 'Add player' }).click()
  await expect(page.getByRole('heading', { name: child })).toBeVisible()
  await logOut(page)

  // The coach makes a program, enrols the child and adds a session.
  await logIn(page, COACH_EMAIL, COACH_PASSWORD)
  await page.getByRole('link', { name: 'New program' }).click()
  await page.getByLabel('Name').fill(programName)
  await page.getByLabel('Age group').fill('Under 14')
  await expect(page.getByLabel('Sport')).toHaveValue(/.+/)
  await page.getByRole('button', { name: 'Create program' }).click()
  await expect(page.getByRole('heading', { name: programName })).toBeVisible()
  const programUrl = page.url()
  await page.getByLabel('Player name').fill(child)
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('button', { name: `Enrol ${child}` }).click()
  await expect(page.getByRole('button', { name: `Make inactive: ${child}` })).toBeVisible()

  await page.getByRole('link', { name: 'New session' }).click()
  await page.getByLabel('Date').fill(inAWeek())
  await page.getByLabel('Start time').fill('10:00')
  await page.getByLabel('End time').fill('11:30')
  await page.getByLabel('Location').fill('Main oval')
  await page.getByLabel('Capacity').fill('5')
  await page.getByRole('button', { name: 'Create session' }).click()
  await expect(page.getByText('You can mark attendance once the session starts.')).toBeVisible()
  const sessionId = new URL(page.url()).pathname.split('/').pop()
  await logOut(page)

  // The parent books the child in.
  await logIn(page, parentEmail, PARENT_PASSWORD)
  await page.goto('/parent/sessions')
  await page.getByRole('button', { name: 'Book Sam' }).click()
  await expect(page.getByText('Sam booked', { exact: true })).toBeVisible()
  await logOut(page)

  // Pretend the session has happened. The API only creates future sessions.
  execSync(`${BACKEND_EXEC} python -m scripts.move_session_to_past ${sessionId}`, { stdio: 'pipe' })

  // The coach marks the child present and writes a note.
  await logIn(page, COACH_EMAIL, COACH_PASSWORD)
  await page.goto(programUrl)
  const past = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Past sessions' }) })
  await past.getByRole('link').first().click()
  await page.getByRole('group', { name: child }).getByText('Present').click()
  await page.getByRole('button', { name: 'Save attendance' }).click()
  await expect(page.getByText('Attendance saved.')).toBeVisible()

  await page.goto(programUrl)
  await page.getByRole('link', { name: child }).click()
  await expect(page.getByText('Attended 1 of 1 session')).toBeVisible()
  await page.getByLabel('Skills being worked on').fill('Front foot drive')
  await page.getByLabel('Areas to improve').fill('Keep the head still')
  await page.getByRole('button', { name: 'Add note' }).click()
  await expect(page.getByText('Keep the head still', { exact: true })).toBeVisible()
  await logOut(page)

  // The parent sees both on their child's page, but can't open the coach's session page.
  await logIn(page, parentEmail, PARENT_PASSWORD)
  await page.goto('/parent')
  await page.getByRole('link', { name: new RegExp(child) }).click()
  await expect(page.getByText('Attended 1 of 1 session')).toBeVisible()
  await expect(page.getByText('Present', { exact: true })).toBeVisible()
  await expect(page.getByText('Front foot drive')).toBeVisible()
  await expect(page.getByText('Coach E2E Coach', { exact: true })).toBeVisible()

  await page.goto(`/coach/sessions/${sessionId}`)
  await expect(page).toHaveURL('/parent')
})
