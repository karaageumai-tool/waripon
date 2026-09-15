import { useState } from 'react'

export default function ExpenseEditor({ expense, members, disabled, onSave, onCancel }) {
  const [name, setName] = useState(expense.name)
  const [payer, setPayer] = useState(expense.payer)
  const [amount, setAmount] = useState(String(expense.amount))
  const [note, setNote] = useState(expense.note || '')
  const [selected, setSelected] = useState(expense.members)
  const [error, setError] = useState('')
  const beneficiaries = selected.filter((member) => members.includes(member))

  const submit = (event) => {
    event.preventDefault()
    if (disabled) return
    const value = Number(amount)
    if (!name.trim()) { setError('支払い内容を入力してください'); return }
    if (!Number.isInteger(value) || value < 1 || value > 99_999_999) { setError('金額は1〜99,999,999円の整数で入力してください'); return }
    if (!members.includes(payer)) { setError('支払った人を選択してください'); return }
    if (!beneficiaries.length) { setError('負担するメンバーを選択してください'); return }
    onSave({ name: name.trim(), payer, amount: value, note: note.trim(), members: beneficiaries })
  }

  return <form className="expense-editor" onSubmit={submit} aria-label={`${expense.name}の編集`}>
    <h3>支払いを編集</h3>
    <fieldset className="expense-fields" disabled={disabled}>
      <div className="form-grid">
        <label>内容（100文字まで）<input autoFocus maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>支払った人<select value={members.includes(payer) ? payer : ''} onChange={(event) => setPayer(event.target.value)}><option value="" disabled>選択してください</option>{members.map((member) => <option key={member}>{member}</option>)}</select></label>
        <label className="amount-field">金額<div className="amount-input"><span>¥</span><input aria-label="金額（1〜99,999,999円）" inputMode="numeric" maxLength={8} value={amount} onChange={(event) => { if (/^[0-9]*$/.test(event.target.value)) setAmount(event.target.value) }} /></div></label>
      </div>
      <label className="expense-note-field">備考（任意・500文字まで）<textarea maxLength={500} rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="who-pays"><span>誰のぶん？</span><div>{members.map((member, index) => <button type="button" key={member} className={`color-${index % 6} ${beneficiaries.includes(member) ? 'selected' : ''}`} aria-pressed={beneficiaries.includes(member)} onClick={() => setSelected((current) => current.includes(member) ? current.filter((item) => item !== member) : [...current, member])}><span>{beneficiaries.includes(member) ? '✓' : ''}</span>{member}</button>)}</div></div>
      {error && <p role="alert">{error}</p>}
      <div className="expense-edit-actions"><button className="primary-button" type="submit">変更を保存</button><button className="edit-button" type="button" onClick={onCancel}>キャンセル</button></div>
    </fieldset>
  </form>
}
