import { expect, test } from '@playwright/test'

// Proves the whole Docker Compose stack works together:
// browser -> Vite frontend -> FastAPI backend -> PostgreSQL.
test('home page reports the API and database as healthy', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Sports Academy Management Platform' }),
  ).toBeVisible()
  await expect(page.getByTestId('api-status')).toHaveText('OK')
  await expect(page.getByTestId('database-status')).toHaveText('OK')
})

test('unknown routes show the not found page', async ({ page }) => {
  await page.goto('/this-page-does-not-exist')

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to home' }).click()
  await expect(page).toHaveURL('/')
})
