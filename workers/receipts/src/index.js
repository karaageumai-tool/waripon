const MAX_BYTES = 300000
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

async function rpc(env, name, args = {}) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const errors = {
      RECEIPT_NOT_FOUND: [404, '支払いが未保存か、ページの期限が切れています。'],
      RECEIPT_TOO_LARGE: [413, '画像は圧縮後300KB以内にしてください。'],
      RECEIPT_LIMIT: [409, '画像は支払い1件につき3枚までです。処理中の場合は少し待ってください。'],
      RECEIPT_QUOTA: [507, '画像の保存容量が上限に達しました。'],
    }
    const known = errors[error.message]
    throw new HttpError(...(known || [503, '画像サービスに接続できません。しばらくして再度お試しください。']))
  }
  return response.status === 204 ? null : response.json()
}

export async function readImage(request) {
  if (request.headers.get('Content-Type') !== 'image/jpeg') throw new HttpError(415, 'JPEG画像を送信してください。')
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) throw new HttpError(413, '画像が大きすぎます。')
  if (!request.body) throw new HttpError(400, '画像を選択してください。')
  const reader = request.body.getReader()
  const chunks = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.length
    if (length > MAX_BYTES) { await reader.cancel(); throw new HttpError(413, '画像が大きすぎます。') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  if (length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255
    || bytes[length - 2] !== 255 || bytes[length - 1] !== 217) throw new HttpError(415, 'JPEG画像を読み取れません。')
  return bytes
}

async function route(request, env) {
  const url = new URL(request.url)
  if (url.pathname === '/health' && request.method === 'GET') return Response.json({ ok: true })
  const splitId = request.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!/^[A-Za-z0-9]{12,32}$/.test(splitId || '')) throw new HttpError(401, '割り勘ページから操作してください。')
  const expense = url.pathname.match(/^\/expenses\/([A-Za-z0-9-]{1,64})\/receipts$/)
  const receipt = url.pathname.match(/^\/receipts\/([^/]+)$/)
  if (expense && request.method === 'GET') {
    return Response.json(await rpc(env, 'list_receipts', { p_split: splitId, p_expense: expense[1] }))
  }
  if (expense && request.method === 'POST') {
    const bytes = await readImage(request)
    const item = await rpc(env, 'reserve_receipt', { p_split: splitId, p_expense: expense[1], p_bytes: bytes.length })
    // Keep failed/ambiguous uploads reserved: Cron deletes R2 first, then releases quota.
    await env.RECEIPTS.put(`receipts/${item.id}.jpg`, bytes, { httpMetadata: { contentType: 'image/jpeg' } })
    const ready = await rpc(env, 'finish_receipt', { p_split: splitId, p_id: item.id })
    if (!ready) throw new HttpError(410, 'ページの期限が切れたか、支払いが削除されました。')
    return Response.json({ id: ready.id, bytes: ready.bytes, expiresAt: ready.expires_at }, { status: 201 })
  }
  if (receipt && ID.test(receipt[1]) && ['GET', 'DELETE'].includes(request.method)) {
    const item = await rpc(env, 'access_receipt', {
      p_split: splitId, p_id: receipt[1], p_delete: request.method === 'DELETE',
    })
    if (!item) throw new HttpError(404, '画像が削除されたか、期限が切れています。')
    const key = `receipts/${item.id}.jpg`
    if (request.method === 'DELETE') {
      await env.RECEIPTS.delete(key)
      await rpc(env, 'forget_receipts', { p_ids: [item.id] })
      return new Response(null, { status: 204 })
    }
    const object = await env.RECEIPTS.get(key)
    if (!object || Date.parse(item.expires_at) <= Date.now()) throw new HttpError(404, '画像が見つからないか、期限が切れています。')
    return new Response(object.body, { headers: {
      'Content-Type': 'image/jpeg', 'Content-Disposition': 'inline; filename="receipt.jpg"',
    } })
  }
  throw new HttpError(404, '見つかりません。')
}

export async function cleanup(env) {
  const ids = await rpc(env, 'receipts_to_delete')
  if (!ids.length) return
  // Bulk deletion is idempotent. Do not forget metadata until every deletion succeeds.
  await env.RECEIPTS.delete(ids.map((id) => `receipts/${id}.jpg`))
  await rpc(env, 'forget_receipts', { p_ids: ids })
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin')
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim())
    if (origin && !allowed.includes(origin)) return new Response('Forbidden', { status: 403 })
    let response
    try {
      response = request.method === 'OPTIONS' ? new Response(null, { status: 204 }) : await route(request, env)
    } catch (error) {
      response = Response.json({ error: error instanceof HttpError ? error.message : '画像の処理に失敗しました。再度お試しください。' },
        { status: error instanceof HttpError ? error.status : 503 })
    }
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'no-store')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Vary', 'Origin')
    if (origin) headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type')
    return new Response(response.body, { status: response.status, headers })
  },
  async scheduled(_event, env) { await cleanup(env) },
}
