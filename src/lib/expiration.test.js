import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sixMonthsFrom, isExpired, purgeLocalSplits } from './expiration.js'

test('six calendar months clamps month ends and handles leap years', () => {
  assert.equal(sixMonthsFrom('2026-08-31T12:34:56Z'), '2027-02-28T12:34:56.000Z')
  assert.equal(sixMonthsFrom('2023-08-31T12:34:56Z'), '2024-02-29T12:34:56.000Z')
  assert.equal(sixMonthsFrom('2026-09-09T00:00:00Z'), '2027-03-09T00:00:00.000Z')
})

test('expires exactly at deadline and rejects missing or invalid timestamps', () => {
  const deadline = '2027-03-09T00:00:00Z'
  assert.equal(isExpired(deadline, Date.parse(deadline) - 1), false)
  assert.equal(isExpired(deadline, Date.parse(deadline)), true)
  assert.equal(isExpired(undefined), true)
  assert.equal(isExpired('invalid'), true)
})

test('purges expired and legacy storage; remote mode also removes live caches', () => {
  const storage = {
    'waripon:expired': JSON.stringify({ expiresAt: '2000-01-01' }),
    'waripon:legacy': JSON.stringify({ members: ['A'] }),
    'waripon:live': JSON.stringify({ expiresAt: '2999-01-01' }),
    unrelated: 'keep',
    getItem(key) { return this[key] },
    removeItem(key) { delete this[key] },
  }
  purgeLocalSplits(storage, false)
  assert.equal(storage['waripon:expired'], undefined)
  assert.equal(storage['waripon:legacy'], undefined)
  assert.ok(storage['waripon:live'])
  purgeLocalSplits(storage, true)
  assert.equal(storage['waripon:live'], undefined)
  assert.equal(storage.unrelated, 'keep')
})
