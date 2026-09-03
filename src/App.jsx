import { useEffect, useMemo, useState } from 'react'
import './App.css'

const getSplitId = () => window.location.pathname.match(/^\/split\/([^/]+)\/?$/)?.[1] || null

const readSplitData = (splitId) => {
  if (!splitId) return null
  try {
    if (window.location.hash.startsWith('#data=')) {
      return JSON.parse(decodeURIComponent(window.location.hash.slice(6)))
    }
    return JSON.parse(window.localStorage.getItem(`waripon:${splitId}`))
  } catch {
    return null
  }
}

const createSplitId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID().replaceAll('-', '').slice(0, 12)
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function App() {
  const [splitId, setSplitId] = useState(getSplitId)
  const savedData = readSplitData(splitId)
  const [members, setMembers] = useState(savedData?.members || [])
  const [newMember, setNewMember] = useState('')
  const [payer, setPayer] = useState(savedData?.members?.[0] || '')
  const [expenseName, setExpenseName] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedMembers, setSelectedMembers] = useState(savedData?.members || [])
  const [expenses, setExpenses] = useState(savedData?.expenses || [])
  const [notice, setNotice] = useState('')
  const [shareOpen, setShareOpen] = useState(false)

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const balances = useMemo(() => {
    const result = Object.fromEntries(members.map((member) => [member, 0]))
    expenses.forEach((expense) => {
      result[expense.payer] += expense.amount
      expense.members.forEach((member) => { result[member] -= expense.amount / expense.members.length })
    })
    return result
  }, [expenses, members])

  const settlements = useMemo(() => {
    const creditors = Object.entries(balances).filter(([, value]) => value > 0.5).map(([name, value]) => ({ name, value }))
    const debtors = Object.entries(balances).filter(([, value]) => value < -0.5).map(([name, value]) => ({ name, value: -value }))
    const result = []
    let debtorIndex = 0
    let creditorIndex = 0
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const paid = Math.min(debtors[debtorIndex].value, creditors[creditorIndex].value)
      result.push({ from: debtors[debtorIndex].name, to: creditors[creditorIndex].name, amount: Math.round(paid) })
      debtors[debtorIndex].value -= paid
      creditors[creditorIndex].value -= paid
      if (debtors[debtorIndex].value < 0.5) debtorIndex += 1
      if (creditors[creditorIndex].value < 0.5) creditorIndex += 1
    }
    return result
  }, [balances])

  useEffect(() => {
    if (!splitId) return
    const data = JSON.stringify({ members, expenses })
    try { window.localStorage.setItem(`waripon:${splitId}`, data) } catch { /* URLから復元できるため保存失敗を許容 */ }
    window.history.replaceState(null, '', `/split/${splitId}#data=${encodeURIComponent(data)}`)
  }, [splitId, members, expenses])

  const startNew = () => {
    const nextSplitId = createSplitId()
    setMembers([])
    setSelectedMembers([])
    setExpenses([])
    setPayer('')
    setSplitId(nextSplitId)
    window.history.pushState(null, '', `/split/${nextSplitId}`)
  }

  const addMember = (event) => {
    event.preventDefault()
    const name = newMember.trim()
    if (!name || members.includes(name)) return
    setMembers([...members, name])
    setSelectedMembers([...selectedMembers, name])
    if (members.length === 0) setPayer(name)
    setNewMember('')
  }

  const addExpense = (event) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!expenseName.trim()) { setNotice('支払い内容を入力してください'); return }
    if (numericAmount <= 0) { setNotice('金額を入力してください'); return }
    if (selectedMembers.length === 0) { setNotice('負担するメンバーを選択してください'); return }
    setExpenses([...expenses, { id: Date.now(), name: expenseName.trim(), payer, amount: numericAmount, members: selectedMembers }])
    setExpenseName('')
    setAmount('')
    setNotice('支払いを追加しました')
    window.setTimeout(() => setNotice(''), 2200)
  }

  const toggleMember = (member) => setSelectedMembers((current) => current.includes(member) ? current.filter((item) => item !== member) : [...current, member])
  const removeExpense = (id) => setExpenses(expenses.filter((expense) => expense.id !== id))
  const copyShareUrl = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setNotice('URLをコピーしました') } catch { setNotice('共有リンクを準備しました') }
    window.setTimeout(() => setNotice(''), 2200)
  }

  const shareUrl = encodeURIComponent(window.location.href)
  const shareText = encodeURIComponent('wariponで割り勘を共有しました')

  if (!splitId) {
    return <div className="landing-shell"><header className="landing-header"><a className="brand" href="/">waripon<span>。</span></a></header><main className="landing"><div className="landing-content"><h1>わりかんを、<br /><em>ポンっと軽やかに。</em></h1><button className="start-button" onClick={startNew}>新しい割り勘を作成 <span>→</span></button></div></main><footer className="landing-footer">waripon <span>支払いの記録を、みんなの安心に。</span></footer></div>
  }

  return (
    <div className="app-shell">
      <header className="topbar"><a className="brand" href="/">waripon<span>。</span></a><div className="top-actions"><span className="status-dot">●</span> 自動保存中 <button className="share-button" onClick={() => setShareOpen(true)} aria-haspopup="dialog">共有する <span>↗</span></button></div></header>
      <main>
        <section className="intro"><div><p className="eyebrow">GROUP EXPENSES / 01</p><h1>みんなのお金を、<br /><em>ポンっと</em>すっきり。</h1><p className="lead">誰がいくら立て替えたかを記録するだけ。<br />wariponが、いちばん少ない回数で精算します。</p></div><div className="total-block"><span>現在の合計</span><strong>¥{total.toLocaleString()}</strong><small>{members.length}人で割り勘中</small></div></section>
        <div className="workspace">
          <section className="panel input-panel"><div className="panel-heading"><div><span className="step">STEP 01</span><h2>メンバーを追加</h2></div><span className="member-count">{members.length}人</span></div><form className="member-form" onSubmit={addMember}><input value={newMember} onChange={(event) => setNewMember(event.target.value)} placeholder="名前を入力" /><button type="submit" aria-label="メンバーを追加">＋</button></form><div className="member-list">{members.map((member, index) => <span className={`member-chip color-${index % 4}`} key={member}><i />{member}<button type="button" onClick={() => { if (members.length > 1) { setMembers(members.filter((item) => item !== member)); setSelectedMembers(selectedMembers.filter((item) => item !== member)); if (payer === member) setPayer(members.find((item) => item !== member) || '') } }} aria-label={`${member}を削除`}>×</button></span>)}</div></section>
          <section className="panel input-panel expense-input"><div className="panel-heading"><div><span className="step">STEP 02</span><h2>支払いを記録</h2></div><span className="tip">レシートごとに入力</span></div><form onSubmit={addExpense}><div className="form-grid"><label>内容<input value={expenseName} onChange={(event) => setExpenseName(event.target.value)} placeholder="例：ランチ、ホテル代" /></label><label>支払った人<select value={payer} onChange={(event) => setPayer(event.target.value)}>{members.map((member) => <option key={member}>{member}</option>)}</select></label><label className="amount-field">金額<div className="amount-input"><span>¥</span><input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></div></label></div><div className="who-pays"><span>誰のぶん？</span><div>{members.map((member) => <button type="button" className={selectedMembers.includes(member) ? 'selected' : ''} key={member} onClick={() => toggleMember(member)}><span>{selectedMembers.includes(member) ? '✓' : ''}</span>{member}</button>)}</div></div><button className="primary-button" type="submit">支払いを追加 <span>＋</span></button></form></section>
        </div>
        <section className="lower-grid"><div className="panel expense-list"><div className="panel-heading"><div><span className="step">RECORDED</span><h2>支払い一覧</h2></div><span className="tip">{expenses.length}件</span></div>{expenses.length === 0 ? <p className="empty">支払いを追加すると、ここに表示されます。</p> : expenses.map((expense) => <article className="expense-row" key={expense.id}><div className="expense-icon">¥</div><div className="expense-detail"><strong>{expense.name}</strong><span>{expense.payer}が支払い · {expense.members.length}人分</span></div><strong className="expense-amount">¥{expense.amount.toLocaleString()}</strong><button className="delete-button" onClick={() => removeExpense(expense.id)} aria-label={`${expense.name}を削除`}>×</button></article>)}</div><div className="panel settlement"><div className="panel-heading"><div><span className="step">STEP 03</span><h2>精算する</h2></div><span className="spark">✦ 最小回数で計算</span></div>{settlements.length === 0 ? <div className="settled"><div>✓</div><strong>精算完了</strong><span>みんなの支払いはバランスしています。</span></div> : <div className="settlement-list">{settlements.map((item, index) => <div className="settlement-row" key={`${item.from}-${item.to}`}><div className={`avatar avatar-${index % 4}`}>{item.from.slice(0, 1)}</div><strong>{item.from}</strong><span className="arrow">→</span><div className="avatar avatar-to">{item.to.slice(0, 1)}</div><strong>{item.to}</strong><b>¥{item.amount.toLocaleString()}</b></div>)}<p className="settlement-note">この{settlements.length}回の送金で、精算が完了します。</p></div>}</div></section>
        {notice && <div className="toast">{notice}</div>}
        {shareOpen && <div className="share-backdrop" role="presentation" onMouseDown={() => setShareOpen(false)}><section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title" onMouseDown={(event) => event.stopPropagation()}><button className="share-close" type="button" onClick={() => setShareOpen(false)} aria-label="閉じる">×</button><span className="step">SHARE</span><h2 id="share-title">割り勘を共有</h2><p>このURLをメンバーに送ってください。</p><div className="share-url"><input value={window.location.href} readOnly aria-label="共有URL" onFocus={(event) => event.target.select()} /><button type="button" onClick={copyShareUrl}>コピー</button></div><div className="social-share"><a className="line-share" href={`https://social-plugins.line.me/lineit/share?url=${shareUrl}`} target="_blank" rel="noreferrer">LINEで共有</a><a className="x-share" href={`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}`} target="_blank" rel="noreferrer">Xで共有</a></div></section></div>}
      </main><footer>waripon <span>わりかんを、もっと軽やかに。</span></footer>
    </div>
  )
}

export default App
