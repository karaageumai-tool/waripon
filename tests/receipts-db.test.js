import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('receipt SQL enforces authorization, quotas, expiry and durable cleanup', async () => {
  const db = new PGlite()
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;')
    await db.exec(await readFile(new URL('../supabase/migrations/20260903000000_create_splits.sql', import.meta.url), 'utf8'))
    const expiration = await readFile(new URL('../supabase/migrations/20260909000000_expire_splits.sql', import.meta.url), 'utf8')
    await db.exec(expiration.split('create extension if not exists pg_cron;')[0])
    await db.exec(await readFile(new URL('../supabase/migrations/20260910000000_receipts.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20260911000000_receipts_300kb.sql', import.meta.url), 'utf8'))
    const rpc = async (expression, args = []) => (await db.query(`select ${expression} as result`, args)).rows[0].result
    const split = (await rpc('public.create_split()')).id
    const other = (await rpc('public.create_split()')).id
    await rpc('public.save_split($1, $2)', [split, { members: ['A'], expenses: [{ id: 123 }] }])
    assert.equal(await rpc("has_function_privilege('anon', 'public.reserve_receipt(text,text,integer)', 'execute')"), false)
    assert.equal(await rpc("has_function_privilege('authenticated', 'public.access_receipt(text,uuid,boolean)', 'execute')"), false)
    assert.equal(await rpc("has_table_privilege('anon', 'public.receipts', 'select')"), false)
    assert.equal(await rpc("has_function_privilege('service_role', 'public.reserve_receipt(text,text,integer)', 'execute')"), true)
    await assert.rejects(rpc('public.reserve_receipt($1,$2,$3)', [other, '123', 100]), /RECEIPT_NOT_FOUND/)
    await assert.rejects(rpc('public.reserve_receipt($1,$2,$3)', [split, '123', 300001]), /RECEIPT_TOO_LARGE/)
    const first = await rpc('public.reserve_receipt($1,$2,$3)', [split, '123', 100])
    assert.equal((await rpc('public.list_receipts($1,$2)', [split, '123'])).length, 0)
    await rpc('public.finish_receipt($1,$2)', [split, first.id])
    assert.equal(await rpc('public.access_receipt($1,$2)', [other, first.id]), null)
    assert.equal((await rpc('public.list_receipts($1,$2)', [split, '123'])).length, 1)
    const second = await rpc('public.reserve_receipt($1,$2,$3)', [split, '123', 100])
    await rpc('public.reserve_receipt($1,$2,$3)', [split, '123', 100])
    await assert.rejects(rpc('public.reserve_receipt($1,$2,$3)', [split, '123', 100]), /RECEIPT_LIMIT/)
    await db.exec('update public.receipt_quota set limit_bytes = 300')
    await assert.rejects(rpc('public.reserve_receipt($1,$2,$3)', [split, '123', 100]), /RECEIPT_QUOTA/)
    assert.equal((await db.query('select used_bytes from public.receipt_quota')).rows[0].used_bytes, 300)
    await rpc('public.access_receipt($1,$2,true)', [split, first.id])
    assert.equal(await rpc('public.access_receipt($1,$2)', [split, first.id]), null)
    assert.deepEqual(await rpc('public.receipts_to_delete()'), [first.id])
    // Repeated cleanup retries retain accounting until the R2 delete is acknowledged.
    assert.deepEqual(await rpc('public.receipts_to_delete()'), [first.id])
    await rpc('public.forget_receipts($1)', [[first.id]])
    await rpc('public.forget_receipts($1)', [[first.id]])
    assert.equal((await db.query('select used_bytes from public.receipt_quota')).rows[0].used_bytes, 200)
    await rpc('public.finish_receipt($1,$2)', [split, second.id])
    // A removed expense immediately blocks reads, without touching its split.
    await rpc('public.save_split($1,$2)', [split, { members: [], expenses: [] }])
    assert.equal(await rpc('public.access_receipt($1,$2)', [split, second.id]), null)
    assert.ok((await rpc('public.receipts_to_delete()')).includes(second.id))
    // The original split cleanup does not cascade-delete receipt metadata.
    await db.query('delete from public.splits where id = $1', [split])
    assert.equal((await db.query('select count(*)::int as count from public.receipts')).rows[0].count, 2)
    await db.exec("update public.receipts set created_at = now() - interval '2 hours'")
    const orphanIds = await rpc('public.receipts_to_delete()')
    assert.equal(orphanIds.length, 2)
    await rpc('public.forget_receipts($1)', [orphanIds])
    assert.equal((await db.query('select used_bytes from public.receipt_quota')).rows[0].used_bytes, 0)

    await db.exec('update public.receipt_quota set limit_bytes = 8000000000')
    await rpc('public.save_split($1,$2)', [other, { members: [], expenses: [{ id: 5 }] }])
    const expired = await rpc('public.reserve_receipt($1,$2,$3)', [other, '5', 200])
    await rpc('public.finish_receipt($1,$2)', [other, expired.id])
    const pending = await rpc('public.reserve_receipt($1,$2,$3)', [other, '5', 200])
    await db.exec("update public.splits set expires_at = now(); update public.receipts set expires_at = now();")
    assert.equal(await rpc('public.access_receipt($1,$2)', [other, expired.id]), null)
    assert.equal(await rpc('public.finish_receipt($1,$2)', [other, pending.id]), null)
    await assert.rejects(rpc('public.reserve_receipt($1,$2,$3)', [other, '5', 100]), /RECEIPT_NOT_FOUND/)
    const expiredIds = await rpc('public.receipts_to_delete()')
    assert.ok(expiredIds.includes(expired.id))
    assert.ok(!expiredIds.includes(pending.id), 'in-flight uploads get a cleanup grace period')
  } finally { await db.close() }
})
