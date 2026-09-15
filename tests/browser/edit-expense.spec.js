import { test, expect } from '@playwright/test'

test('edit preserves identity, recalculates settlement, persists, and supports cancel and validation', async ({ page }) => {
  let data = { members: ['A', 'B'], expenses: [{ id: 123, name: 'Lunch', payer: 'A', amount: 1000, members: ['A', 'B'], note: 'original' }] }
  let revision = 0
  await page.route('https://supabase.test/rest/v1/rpc/**', async (route) => {
    if (route.request().url().endsWith('save_split')) {
      data = route.request().postDataJSON().split_data
      await route.fulfill({ json: { updatedAt: String(++revision) } })
    } else await route.fulfill({ json: { data, updatedAt: String(revision), expiresAt: '2999-01-01' } })
  })
  await page.route('https://receipts.test/**', (route) => route.fulfill({ json: [] }))
  await page.goto('/split/abcdefghijklmnopqrst')
  await page.getByRole('button', { name: 'Lunchを編集' }).click()
  const editor = page.getByRole('form', { name: 'Lunchの編集' })
  await editor.getByLabel('内容（100文字まで）').fill('Dinner')
  await editor.getByRole('button', { name: 'キャンセル' }).click()
  await expect(page.locator('.expense-detail strong')).toHaveText('Lunch')
  await page.getByRole('button', { name: 'Lunchを編集' }).click()
  await editor.getByLabel('金額（1〜99,999,999円）').fill('0')
  await editor.getByRole('button', { name: '変更を保存' }).click()
  await expect(editor.getByRole('alert')).toBeVisible()
  expect(data.expenses[0].amount).toBe(1000)
  await editor.getByLabel('内容（100文字まで）').fill('Dinner')
  await editor.getByLabel('金額（1〜99,999,999円）').fill('2400')
  await editor.getByLabel('支払った人').selectOption('B')
  await editor.getByLabel('備考（任意・500文字まで）').fill('updated')
  await editor.locator('.who-pays button').filter({ hasText: 'B' }).click()
  await editor.getByRole('button', { name: '変更を保存' }).click()
  await expect.poll(() => data.expenses).toEqual([{ id: 123, name: 'Dinner', payer: 'B', amount: 2400, members: ['A'], note: 'updated' }])
  await expect(page.locator('.total-block strong')).toHaveText('¥2,400')
  await expect(page.locator('.settlement-row')).toHaveText('AA→BB¥2,400')
  await page.reload()
  await expect(page.locator('.expense-detail strong')).toHaveText('Dinner')
  await expect(page.locator('.expense-note')).toHaveText('updated')
})
