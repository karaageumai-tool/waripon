export function sixMonthsFrom(value) {
  const date = new Date(value)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + 6)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date.toISOString()
}

export function isExpired(expiresAt, now = Date.now()) {
  const deadline = Date.parse(expiresAt)
  return !Number.isFinite(deadline) || deadline <= now
}

export function purgeLocalSplits(storage, remoteMode) {
  for (const key of Object.keys(storage)) {
    if (!key.startsWith('waripon:')) continue
    try {
      const data = JSON.parse(storage.getItem(key))
      if (remoteMode || isExpired(data?.expiresAt)) storage.removeItem(key)
    } catch { storage.removeItem(key) }
  }
}
