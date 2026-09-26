import { expect, test, type Page } from '@playwright/test'

// The coach account is created before the tests run, with scripts/create_coach.py.
// CI does this automatically. Locally, see "Running the end-to-end tests" in the README.
const COACH_EMAIL = process.env.E2E_COACH_EMAIL ?? 'e2e-coach@example.com'
const COACH_PASSWORD = process.env.E2E_COACH_PASSWORD ?? 'e2e-coach-password'

function uniqueParentEmail() {
  return `parent-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

async function registerParent(page: Page, email: string) {
  await page.goto('/register')
  await page.getByLabel('First name').fill('Alex')
  await page.getByLabel('Last name').fill('Taylor')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('a-good-long-password')
  await page.getByRole('button', { name: 'Create account' }).click()
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

test('a parent can register and ends up in the parent area', async ({ page }) => {
  await registerParent(page, uniqueParentEmail())

  await expect(page).toHaveURL('/parent')
  await expect(page.getByRole('heading', { name: 'Parent area' })).toBeVisible()
  await expect(page.getByTestId('header-user')).toHaveText('Alex')
})

test('a parent can log out and log back in', async ({ page }) => {
  const email = uniqueParentEmail()
  await registerParent(page, email)
  await expect(page).toHaveURL('/parent')

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()

  await logIn(page, email, 'a-good-long-password')
  await expect(page).toHaveURL('/parent')
})

test('a wrong password shows an error', async ({ page }) => {
  await logIn(page, uniqueParentEmail(), 'not-the-password')

  await expect(page.getByRole('alert')).toHaveText('Invalid email or password')
  await expect(page).toHaveURL('/login')
})

test('a coach can log in and reach the coach area', async ({ page }) => {
  await logIn(page, COACH_EMAIL, COACH_PASSWORD)

  await expect(page).toHaveURL('/coach')
  await expect(page.getByRole('heading', { name: 'Coach area' })).toBeVisible()

  await page.goto('/account')
  // A full page load clears the in-memory token (until Phase 2b), so this
  // checks the redirect to login rather than the account details.
  await expect(page).toHaveURL('/login')
})

test('a parent cannot open the coach area', async ({ page }) => {
  await registerParent(page, uniqueParentEmail())
  await expect(page).toHaveURL('/parent')

  // Navigate in-app so the in-memory login is kept.
  await page.evaluate(() => {
    window.history.pushState({}, '', '/coach')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  await expect(page).toHaveURL('/parent')
  await expect(page.getByRole('heading', { name: 'Coach area' })).not.toBeVisible()
})

test('logged-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/coach')

  await expect(page).toHaveURL('/login')
})
