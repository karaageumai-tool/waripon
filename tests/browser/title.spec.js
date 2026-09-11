import { test, expect } from '@playwright/test'

test('optional title persists with expenses and can be cleared', async ({ page }) => {
  let data = { members: ['A'], expenses: [] }
  let revision = 0
  await page.route('https://supabase.test/rest/v1/rpc/**', async (route) => {
    if (route.request().url().endsWith('save_split')) {
      data = route.request().postDataJSON().split_data
      await route.fulfill({ json: { updatedAt: String(++revision) } })
    } else await route.fulfill({ json: { data, updatedAt: String(revision), expiresAt: '2999-01-01' } })
  })
  await page.route('https://receipts.test/**', (route) => route.fulfill({ json: [] }))
  await page.goto('/split/abcdefghijklmnopqrst')
  const title = page.locator('.split-title-field input')
  await title.fill('Weekend trip')
  await expect.poll(() => data.title).toBe('Weekend trip')
  await page.reload()
  await expect(title).toHaveValue('Weekend trip')
  await expect(page.locator('.intro h1')).toHaveText('Weekend trip')
  await expect(title).toHaveAttribute('maxlength', '60')
  await expect(page.locator('.member-form input')).toHaveAttribute('maxlength', '30')
  await expect(page.locator('.form-grid label:first-child input')).toHaveAttribute('maxlength', '100')
  await expect(page.locator('textarea')).toHaveAttribute('maxlength', '500')
  await expect(page.locator('.amount-input input')).toHaveAttribute('maxlength', '8')
  await page.locator('.form-grid label:first-child input').fill('Lunch')
  await page.locator('.amount-input input').fill('1000')
  await page.locator('.primary-button').click()
  await expect.poll(() => data.expenses.length).toBe(1)
  expect(data.title).toBe('Weekend trip')
  await title.fill('')
  await expect.poll(() => data.title).toBe('')
  await page.reload()
  await expect(title).toHaveValue('')
  await expect(page.locator('.intro h1')).not.toBeEmpty()
})
