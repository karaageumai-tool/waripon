import { test, expect } from '@playwright/test'

test('subdirectory navigation and direct FAQ access work', async ({ page }) => {
  await page.goto('/waripon/')
  await page.getByRole('link', { name: 'よくある質問', exact: true }).click()
  await expect(page).toHaveURL(/\/waripon\/faq$/)
  await expect(page).toHaveTitle('よくある質問 | waripon')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'よくある質問', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'トップページへ', exact: true }).click()
  await expect(page).toHaveURL(/\/waripon\/$/)
  const logo = page.getByRole('img', { name: 'waripon', exact: true })
  await expect(logo).toBeVisible()
  expect(await logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)
})
