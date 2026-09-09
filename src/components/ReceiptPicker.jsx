import { useRef, useState } from 'react'
import { compressReceipt } from '../lib/receipts'

export default function ReceiptPicker({ files, onChange, disabled, onBusy }) {
  const input = useRef(null)
  const processing = useRef(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const select = async (event) => {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    if (!selected.length || processing.current) return
    if (files.length + selected.length > 3) { setMessage('画像は支払い1件につき3枚までです。'); return }
    processing.current = true
    setBusy(true)
    onBusy(true)
    setMessage('')
    try {
      const prepared = []
      for (const file of selected) prepared.push({ name: file.name, blob: await compressReceipt(file), id: crypto.randomUUID() })
      onChange([...files, ...prepared])
    } catch (error) { setMessage(error.message) }
    finally { processing.current = false; setBusy(false); onBusy(false) }
  }
  return <div className="receipts receipt-picker">
    <div className="receipt-actions">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={select} disabled={disabled || busy} />
      <button className="receipt-upload" type="button" onClick={() => input.current.click()} disabled={disabled || busy || files.length >= 3}>
        {busy ? '画像を圧縮中…' : 'レシートを添付'} ({files.length}/3)
      </button>
    </div>
    {files.map((file) => <div className="receipt-draft" key={file.id}>
      <span>{file.name}（{Math.ceil(file.blob.size / 1000)}KB）</span>
      <button type="button" onClick={() => onChange(files.filter((item) => item.id !== file.id))} disabled={disabled || busy} aria-label={`${file.name}の添付を取り消す`}>×</button>
    </div>)}
    <p className="receipt-help">1枚300KBまで自動圧縮・最大3枚。</p>
    {message && <p className="receipt-message" role="status">{message}</p>}
  </div>
}
