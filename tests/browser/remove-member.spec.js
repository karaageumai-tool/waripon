import { test, expect } from '@playwright/test'

test('removing members updates payments, totals, settlement and saved data', async ({ page }) => {
  let data = { members: ['A', 'B'], expenses: [
    { id: 1, name: 'A payment', payer: 'A', members: ['A', 'B'], amount: 1000 },
    { id: 2, name: 'Shared payment', payer: 'B', members: ['A', 'B'], amount: 600 },
    { id: 3, name: 'A only', payer: 'B', members: ['A'], amount: 200 },
  ] }
  await page.route('https://supabase.test/rest/v1/rpc/**', async (route) => {
    if (route.request().url().endsWith('save_split')) {
      data = route.request().postDataJSON().split_data
      await route.fulfill({ json: { updatedAt: '2026-09-09' } })
    } else await route.fulfill({ json: { data, updatedAt: '2026-09-09', expiresAt: '2999-01-01' } })
  })
  await page.route('https://receipts.test/**', (route) => route.fulfill({ json: [] }))
  await page.goto('/split/abcdefghijklmnopqrst')
  await page.getByRole('button', { name: 'Aを削除', exact: true }).click()
  await expect(page.locator('.expense-row')).toHaveCount(1)
  await expect(page.locator('.expense-row')).toContainText('Shared payment')
  await expect(page.locator('.total-block strong')).toHaveText('¥600')
  await expect(page.locator('.settled strong')).toHaveText('精算完了')
  await expect.poll(() => data.members).toEqual(['B'])
  expect(data.expenses).toEqual([{ id: 2, name: 'Shared payment', payer: 'B', members: ['B'], amount: 600 }])
  await page.reload()
  await expect(page.locator('.expense-row')).toHaveCount(1)
  await page.getByRole('button', { name: 'Bを削除', exact: true }).click()
  await expect(page.locator('.expense-row')).toHaveCount(0)
  await expect(page.locator('.total-block strong')).toHaveText('¥0')
  await expect.poll(() => data.members).toEqual([])
  expect(data.expenses).toEqual([])
})
