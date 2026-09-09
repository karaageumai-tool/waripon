import { useEffect, useRef, useState } from 'react'
import { receiptRequest } from '../lib/receipts'

export default function Receipts({ splitId, expenseId, disabled, revision }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState(null)
  const active = useRef(true)
  const working = useRef(false)
  const generation = useRef(0)
  const dialog = useRef(null)
  const path = `/expenses/${encodeURIComponent(expenseId)}/receipts`

  useEffect(() => {
    active.current = true
    let running = false
    const controller = new AbortController()
    const refresh = async () => {
      if (disabled || running || working.current || document.hidden) return
      const version = generation.current
      running = true
      try {
        const response = await receiptRequest(splitId, path, { signal: controller.signal })
        const data = await response.json()
        if (active.current && generation.current === version) setItems(data)
      } catch (error) {
        if (!controller.signal.aborted && active.current) setMessage(error.message)
      } finally { running = false }
    }
    refresh()
    const timer = window.setInterval(refresh, 30000)
    return () => { active.current = false; controller.abort(); window.clearInterval(timer) }
  }, [splitId, path, disabled, revision])

  useEffect(() => {
    if (!preview) return
    dialog.current?.showModal()
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const run = async (operation) => {
    if (working.current || disabled) return
    working.current = true
    generation.current += 1
    setBusy(true)
    setMessage('')
    try { await operation() } catch (error) { if (active.current) setMessage(error.message) }
    finally {
      working.current = false
      if (active.current) setBusy(false)
    }
  }

  const open = (id) => run(async () => {
    const response = await receiptRequest(splitId, `/receipts/${id}`)
    const blob = await response.blob()
    if (active.current) setPreview(URL.createObjectURL(blob))
  })

  const remove = (id) => run(async () => {
    await receiptRequest(splitId, `/receipts/${id}`, { method: 'DELETE' })
    if (active.current) setItems((current) => current.filter((item) => item.id !== id))
  })

  return <div className="receipts">
    <div className="receipt-actions">
      {items.map((item, index) => <div className="receipt-item" key={item.id}>
        <button type="button" disabled={busy} onClick={() => open(item.id)}>画像{index + 1}を開く</button>
        <button type="button" className="receipt-delete" disabled={busy} onClick={() => remove(item.id)} aria-label={`画像${index + 1}を削除`}>×</button>
      </div>)}
    </div>
    {items.length > 0 && <p className="receipt-help">画像はページと同じ有効期限です。</p>}
    {message && <p className="receipt-message" role="status">{message}</p>}
    {preview && <dialog className="receipt-dialog" ref={dialog} onClose={() => setPreview(null)} onClick={(event) => { if (event.target === dialog.current) dialog.current.close() }}>
      <button type="button" className="receipt-dialog-close" onClick={() => dialog.current.close()} autoFocus>閉じる ×</button>
      <img src={preview} alt="添付したレシート" />
    </dialog>}
  </div>
}
