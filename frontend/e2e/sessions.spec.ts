import { expect, test, type Page } from '@playwright/test'

// Uses the same coach account as auth.spec.ts, created before the tests run.
const COACH_EMAIL = process.env.E2E_COACH_EMAIL ?? 'e2e-coach@example.com'
const COACH_PASSWORD = process.env.E2E_COACH_PASSWORD ?? 'e2e-coach-password'
const PARENT_PASSWORD = 'a-good-long-password'

/** A made-up surname, so this run's players are the only matches when the coach searches. */
function uniqueSurname() {
  const letters = Array.from({ length: 8 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26)))
  return `Test${letters.join('')}`
}

/** Two weeks from today as "YYYY-MM-DD", for the session date. */
function inTwoWeeks() {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
}

/** Login can send you back to the page you logged out from, so go to the sessions page directly. */
async function openSessions(page: Page) {
  await page.goto('/parent/sessions')
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible()
}

async function logOut(page: Page) {
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
}

async function registerWithChild(page: Page, email: string, parentName: string, childName: string, surname: string) {
  await page.goto('/register')
  await page.getByLabel('First name').fill(parentName)
  await page.getByLabel('Last name').fill(surname)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PARENT_PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/parent')

  await page.getByRole('link', { name: 'Add player' }).click()
  await page.getByLabel('First name').fill(childName)
  await page.getByLabel('Last name').fill(surname)
  await page.getByLabel('Date of birth').fill('2013-05-14')
  await page.getByRole('button', { name: 'Add player' }).click()
  await expect(page.getByRole('heading', { name: `${childName} ${surname}` })).toBeVisible()
  await logOut(page)
}

test('two parents compete for the last place in a session', async ({ page }) => {
  const surname = uniqueSurname()
  const firstParent = `parent-a-${surname.toLowerCase()}@example.com`
  const secondParent = `parent-b-${surname.toLowerCase()}@example.com`
  const programName = `U14 Sessions ${surname}`

  await registerWithChild(page, firstParent, 'Alex', 'Sam', surname)
  await registerWithChild(page, secondParent, 'Priya', 'Jo', surname)

  // The coach creates a program, enrols both children and adds a session with one place.
  await logIn(page, COACH_EMAIL, COACH_PASSWORD)
  await page.getByRole('link', { name: 'New program' }).click()
  await page.getByLabel('Name').fill(programName)
  await page.getByLabel('Age group').fill('Under 14')
  await expect(page.getByLabel('Sport')).toHaveValue(/.+/)
  await page.getByRole('button', { name: 'Create program' }).click()
  await expect(page.getByRole('heading', { name: programName })).toBeVisible()

  for (const child of ['Sam', 'Jo']) {
    await page.getByLabel('Player name').fill(`${child} ${surname}`)
    await page.getByRole('button', { name: 'Search' }).click()
    await page.getByRole('button', { name: `Enrol ${child} ${surname}` }).click()
    await expect(page.getByRole('button', { name: `Make inactive: ${child} ${surname}` })).toBeVisible()
  }

  await page.getByRole('link', { name: 'New session' }).click()
  await page.getByLabel('Date').fill(inTwoWeeks())
  await page.getByLabel('Start time').fill('10:00')
  await page.getByLabel('End time').fill('11:30')
  await page.getByLabel('Location').fill('Main oval')
  await page.getByLabel('Capacity').fill('1')
  await page.getByRole('button', { name: 'Create session' }).click()
  await expect(page.getByRole('heading', { name: /10:00 am to 11:30 am/ })).toBeVisible()
  await expect(page.getByText('Main oval · 0 of 1 booked, 1 left')).toBeVisible()
  await logOut(page)

  // The first parent takes the only place.
  await logIn(page, firstParent, PARENT_PASSWORD)
  await page.getByRole('link', { name: 'Book sessions' }).click()
  await page.getByRole('button', { name: 'Book Sam' }).click()
  await expect(page.getByText('Sam: booked')).toBeVisible()
  await logOut(page)

  // The second parent sees it's full.
  await logIn(page, secondParent, PARENT_PASSWORD)
  await openSessions(page)
  await expect(page.getByText(/Full \(1 of 1 booked\)/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Book Jo' })).toBeDisabled()
  await logOut(page)

  // The first parent cancels, which frees the place.
  await logIn(page, firstParent, PARENT_PASSWORD)
  await page.goto('/parent')
  await page.getByRole('link', { name: new RegExp(`Sam ${surname}`) }).click()
  await page.getByRole('button', { name: 'Cancel booking' }).click()
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible()
  await logOut(page)

  // Now the second parent can book.
  await logIn(page, secondParent, PARENT_PASSWORD)
  await openSessions(page)
  await page.getByRole('button', { name: 'Book Jo' }).click()
  await expect(page.getByText('Jo: booked')).toBeVisible()
})
