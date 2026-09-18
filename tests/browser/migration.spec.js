import { test, expect } from '@playwright/test'

test('Vercel shows migration link while existing splits remain editable', async ({ page }) => {
  let created = false
  let data = { title: 'Existing trip', members: ['A'], expenses: [] }
  let revision = 0
  await page.route('https://waripon.vercel.app/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.startsWith('/waripon/') ? url.pathname : `/waripon${url.pathname}`
    const response = await route.fetch({ url: `http://127.0.0.1:4175${path}${url.search}` })
    await route.fulfill({ response })
  })
  await page.route('https://supabase.test/rest/v1/rpc/**', async (route) => {
    const name = route.request().url().split('/').pop()
    if (name === 'create_split') created = true
    if (name === 'save_split') {
      data = route.request().postDataJSON().split_data
      await route.fulfill({ json: { updatedAt: String(++revision) } })
    } else await route.fulfill({ json: { data, updatedAt: String(revision), expiresAt: '2999-01-01' } })
  })
  await page.route('https://receipts.test/**', (route) => route.fulfill({ json: [] }))
  await page.goto('https://waripon.vercel.app/')
  await expect(page.getByRole('link', { name: '新しいサイトへ' })).toHaveAttribute('href', 'https://merylomm.com/waripon/')
  await expect(page.getByRole('button', { name: '新しい割り勘を作成' })).toHaveCount(0)
  expect(created).toBe(false)
  await page.goto('https://waripon.vercel.app/split/abcdefghijklmnopqrst')
  await expect(page.locator('.intro h1')).toHaveText('Existing trip')
  await page.locator('.split-title-field input').fill('Updated trip')
  await expect.poll(() => data.title).toBe('Updated trip')
  await page.reload()
  await expect(page.locator('.intro h1')).toHaveText('Updated trip')
})

test('current site retains new split creation', async ({ page }) => {
  await page.route('https://supabase.test/rest/v1/rpc/create_split', (route) => route.fulfill({
    json: { id: 'abcdefghijklmnopqrst', expiresAt: '2999-01-01' },
  }))
  await page.route('https://supabase.test/rest/v1/rpc/get_split', (route) => route.fulfill({
    json: { data: { members: [], expenses: [] }, updatedAt: '1', expiresAt: '2999-01-01' },
  }))
  await page.goto('/waripon/')
  await page.getByRole('button', { name: '新しい割り勘を作成' }).click()
  await expect(page).toHaveURL(/\/waripon\/split\/abcdefghijklmnopqrst$/)
  await expect(page.locator('.split-title-field input')).toBeVisible()
})
