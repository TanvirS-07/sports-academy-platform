import { expect, test, type Page } from '@playwright/test'

// Uses the same coach account as auth.spec.ts, created before the tests run.
const COACH_EMAIL = process.env.E2E_COACH_EMAIL ?? 'e2e-coach@example.com'
const COACH_PASSWORD = process.env.E2E_COACH_PASSWORD ?? 'e2e-coach-password'
const PARENT_PASSWORD = 'a-good-long-password'

/** A made-up surname, so this run's player is the only match when the coach searches. */
function uniqueSurname() {
  const letters = Array.from({ length: 8 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26)))
  return `Test${letters.join('')}`
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

async function logOut(page: Page) {
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
}

test('a coach enrols a parent’s child and the parent sees the program', async ({ page }) => {
  const surname = uniqueSurname()
  const parentEmail = `parent-${surname.toLowerCase()}@example.com`
  const programName = `U14 Development ${surname}`

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
  await expect(page.getByRole('heading', { name: `Sam ${surname}` })).toBeVisible()
  await expect(page.getByText('Not enrolled in a program yet.')).toBeVisible()
  await logOut(page)

  // The coach creates a program and enrols the child.
  await logIn(page, COACH_EMAIL, COACH_PASSWORD)
  await page.getByRole('link', { name: 'New program' }).click()
  await page.getByLabel('Name').fill(programName)
  await page.getByLabel('Age group').fill('Under 14')
  await expect(page.getByLabel('Sport')).toHaveValue(/.+/)
  await page.getByRole('button', { name: 'Create program' }).click()
  await expect(page.getByRole('heading', { name: programName })).toBeVisible()

  await page.getByLabel('Player name').fill(`Sam ${surname}`)
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByText('Parent: Alex')).toBeVisible()
  await page.getByRole('button', { name: `Enrol Sam ${surname}` }).click()
  await expect(page.getByRole('button', { name: `Make inactive: Sam ${surname}` })).toBeVisible()
  await expect(page.getByText('Born 14 May 2013')).toBeVisible()
  await logOut(page)

  // The parent now sees the program on their child's page.
  await logIn(page, parentEmail, PARENT_PASSWORD)
  await page.getByRole('link', { name: new RegExp(`Sam ${surname}`) }).click()
  await expect(page.getByText(programName)).toBeVisible()
  await expect(page.getByText('Cricket · Under 14 · Coach E2E Coach')).toBeVisible()
})
