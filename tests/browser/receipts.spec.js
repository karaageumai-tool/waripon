import { test, expect } from '@playwright/test'

const splitId = 'abcdefghijklmnopqrst'
const id = '11111111-1111-4111-8111-111111111111'

test('attach compressed image, view, reload, remove, and handle capacity errors', async ({ page }) => {
  let images = []
  let imageBody
  let full = false
  let expired = false
  let data = { members: ['A'], expenses: [{ id: 123, name: 'ランチ', payer: 'A', members: ['A'], amount: 1000 }] }
  await page.route('https://supabase.test/rest/v1/rpc/**', async (route) => {
    if (route.request().url().endsWith('save_split')) {
      data = route.request().postDataJSON().split_data
      await route.fulfill({ json: { updatedAt: '2026-09-09T00:00:00Z' } })
    } else {
      await route.fulfill({ json: expired ? null : { data, updatedAt: '2026-09-09T00:00:00Z', expiresAt: '2999-01-01T00:00:00Z' } })
    }
  })
  await page.route('https://receipts.test/**', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } })
      return
    }
    expect(request.headers().authorization).toBe(`Bearer ${splitId}`)
    if (request.method() === 'POST') {
      if (full) { await route.fulfill({ status: 507, json: { error: '画像の保存容量が上限に達しました。' } }); return }
      expect(request.headers()['content-type']).toBe('image/jpeg')
      imageBody = request.postDataBuffer()
      expect(imageBody.length).toBeLessThanOrEqual(300000)
      expect([...imageBody.subarray(0, 3)]).toEqual([255, 216, 255])
      const item = { expenseId: request.url().match(/expenses\/(\d+)/)[1], id, bytes: imageBody.length, expiresAt: '2999-01-01' }
      images.push(item)
      await route.fulfill({ status: 201, json: item })
    } else if (request.method() === 'DELETE') {
      images = []
      await route.fulfill({ status: 204 })
    } else if (request.url().endsWith(`/receipts/${id}`)) {
      await route.fulfill({ contentType: 'image/jpeg', body: imageBody })
    } else { await route.fulfill({ json: images.filter(item => request.url().includes(`/expenses/${item.expenseId}/`)) }) }
  })
  await page.goto(`/split/${splitId}`)
  const upload = page.getByRole('button', { name: /レシートを添付/ })
  await expect(upload).toBeEnabled()
  await expect(page.locator('.expense-input').getByRole('button', { name: /レシートを添付/ })).toBeVisible()
  await expect(page.locator('.expense-list').getByRole('button', { name: /レシートを添付/ })).toHaveCount(0)
  // Generate a test fixture, not a user image, using the browser canvas encoder.
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 800; canvas.height = 1200
    const context = canvas.getContext('2d')
    context.fillStyle = 'white'; context.fillRect(0, 0, 800, 1200)
    context.fillStyle = 'black'; context.font = '32px sans-serif'
    context.fillText('Receipt 1000 yen', 50, 100)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  const file = { name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }
  await page.getByLabel('内容', { exact: false }).fill('レシート付き支払い')
  await page.locator('.amount-input input').fill('500')
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.getByText('receipt.png（', { exact: false })).toBeVisible()
  expect(images.length).toBe(0)
  await page.getByRole('button', { name: '支払いを追加' }).click()
  await expect(page.getByRole('button', { name: '画像1を開く' })).toBeVisible()
  await page.getByRole('button', { name: '画像1を開く' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByAltText('添付したレシート')).toHaveJSProperty('naturalWidth', 800)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: '画像1を開く' })).toBeVisible()
  await page.getByRole('button', { name: '画像1を削除' }).click()
  await expect(page.getByRole('button', { name: '画像1を開く' })).toHaveCount(0)
  full = true
  await page.getByLabel('内容', { exact: false }).fill('再試行テスト')
  await page.locator('.amount-input input').fill('100')
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.getByText('receipt.png（', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '支払いを追加' }).click()
  await expect(page.getByRole('status')).toContainText('保存容量が上限')
  expect(data.expenses[0].amount).toBe(1000)
  full = false
  const countBeforeRetry = data.expenses.length
  await page.getByRole('button', { name: '画像の保存を再試行' }).click()
  await expect(page.getByRole('button', { name: '画像1を開く' })).toBeVisible()
  expect(data.expenses.length).toBe(countBeforeRetry)
  await page.locator('input[type=file]').setInputFiles([file, file, file, file])
  await expect(page.getByRole('status')).toContainText('3枚まで')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(upload).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expired = true
  await page.reload()
  await expect(page.getByRole('heading', { name: 'この割り勘ページは利用できません' })).toBeVisible()
  await expect(page.locator('input[type=file]')).toHaveCount(0)
})
