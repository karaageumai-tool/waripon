import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker, { cleanup } from '../workers/receipts/src/index.js'

const split = 'abcdefghijklmnopqrst'
const receiptId = '11111111-1111-4111-8111-111111111111'
const env = { ALLOWED_ORIGINS: 'https://waripon.vercel.app', SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-secret' }
const request = (path, options = {}) => new Request(`https://receipts.test${path}`, {
  ...options, headers: { Origin: 'https://waripon.vercel.app', Authorization: `Bearer ${split}`, ...options.headers },
})

test('Worker rejects wrong origins, missing tokens, oversized and non-JPEG uploads before storage', async () => {
  assert.equal((await worker.fetch(request('/expenses/1/receipts', { headers: { Origin: 'https://other.test' } }), env)).status, 403)
  assert.equal((await worker.fetch(request('/expenses/1/receipts', { headers: { Authorization: '' } }), env)).status, 401)
  const tooBig = request('/expenses/1/receipts', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: new Uint8Array(300001) })
  assert.equal((await worker.fetch(tooBig, env)).status, 413)
  const invalid = request('/expenses/1/receipts', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: '<script>bad</script>' })
  assert.equal((await worker.fetch(invalid, env)).status, 415)
})

test('Worker reserves quota before R2 put, then finalizes; reads are private and uncached', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const name = url.split('/').pop()
    calls.push(name)
    const args = JSON.parse(options.body)
    assert.equal(args.p_split, split)
    return Response.json({ id: receiptId, bytes: 5, expires_at: '2999-01-01' })
  })
  const storage = {
    async put(key) { calls.push('put'); assert.equal(key, `receipts/${receiptId}.jpg`) },
    async get() { return { body: new Uint8Array([255, 216, 255, 255, 217]) } },
  }
  const response = await worker.fetch(request('/expenses/1/receipts', {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: new Uint8Array([255, 216, 255, 255, 217]),
  }), { ...env, RECEIPTS: storage })
  assert.equal(response.status, 201)
  assert.deepEqual(calls, ['reserve_receipt', 'put', 'finish_receipt'])
  const read = await worker.fetch(request(`/receipts/${receiptId}`), { ...env, RECEIPTS: storage })
  assert.equal(read.status, 200)
  assert.equal(read.headers.get('Cache-Control'), 'no-store')
  assert.equal(read.headers.get('Content-Type'), 'image/jpeg')
  assert.equal(read.headers.get('Access-Control-Allow-Origin'), env.ALLOWED_ORIGINS)
})

test('unknown or expired image never reaches R2', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(null))
  const response = await worker.fetch(request(`/receipts/${receiptId}`), {
    ...env, RECEIPTS: { get() { assert.fail('must not read R2') } },
  })
  assert.equal(response.status, 404)
})

test('cleanup retains metadata when R2 fails, then acknowledges after success', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    const name = url.split('/').pop()
    calls.push(name)
    return Response.json(name === 'receipts_to_delete' ? [receiptId] : null)
  })
  await assert.rejects(cleanup({ ...env, RECEIPTS: { async delete() { throw new Error('R2 down') } } }), /R2 down/)
  assert.deepEqual(calls, ['receipts_to_delete'])
  calls.length = 0
  await cleanup({ ...env, RECEIPTS: { async delete(keys) { calls.push('delete'); assert.deepEqual(keys, [`receipts/${receiptId}.jpg`]) } } })
  assert.deepEqual(calls, ['receipts_to_delete', 'delete', 'forget_receipts'])
})
