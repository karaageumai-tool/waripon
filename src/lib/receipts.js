export const receiptsApiUrl = (import.meta.env.VITE_RECEIPTS_API_URL || '').replace(/\/$/, '')
const MAX_BYTES = 300000

export async function receiptRequest(splitId, path, options = {}) {
  const response = await fetch(`${receiptsApiUrl}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${splitId}` },
    cache: 'no-store', signal: options.signal || AbortSignal.timeout(60000),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || '画像を読み込めませんでした。通信状況を確認してください。')
  }
  return response
}

export async function compressReceipt(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('JPEG・PNG・WebP画像を選択してください。HEICはJPEGに変換してください。')
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('元画像は20MB以内にしてください。')
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('画像を読み取れませんでした。別の画像を選択してください。') })
  try {
    const canvas = document.createElement('canvas')
    // Re-encoding removes EXIF (including location) and flattens transparency.
    for (const maxSide of [2400, 2000, 1600, 1200]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.85, 0.7, 0.55]) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
        if (blob && blob.size <= MAX_BYTES) return blob
      }
    }
    throw new Error('画像を小さくできませんでした。レシート部分を切り抜いて再度お試しください。')
  } finally { bitmap.close() }
}
