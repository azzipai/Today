import { useEffect, useRef, useState } from 'react'
import { addEntry, deleteEntry, restoreEntry } from '../lib/db'

export default function Ledger({ day, entries, categories, onRefresh }) {
  const active = categories.filter((c) => !c.archived)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [catId, setCatId] = useState(active[0]?.id ?? null)
  const [undo, setUndo] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    if (!catId && active[0]) setCatId(active[0].id)
  }, [categories])

  useEffect(() => () => clearTimeout(timer.current), [])

  const total = entries.reduce((sum, e) => sum + e.amount, 0)

  const save = (e) => {
    e.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return
    addEntry(day, value, catId, note.trim())
    setAmount('')
    setNote('')
    onRefresh()
  }

  const remove = (entry) => {
    deleteEntry(entry.id)
    onRefresh()
    setUndo(entry)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setUndo(null), 6000)
  }

  const undoDelete = () => {
    if (!undo) return
    restoreEntry(undo)
    setUndo(null)
    clearTimeout(timer.current)
    onRefresh()
  }

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">
          <span className="sec-dot money" />
          记账
        </h2>
        <span className="section-meta">今日 ¥{total.toFixed(2)}</span>
      </div>

      <div className="card">
        <form onSubmit={save}>
          <div className="amount-row">
            <span className="currency">¥</span>
            <input
              className="amount-input"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            />
            <input
              className="note-input"
              placeholder="备注"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="chips">
            {active.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`chip${c.id === catId ? ' on' : ''}`}
                onClick={() => setCatId(c.id)}
              >
                {c.name}
              </button>
            ))}
            {active.length === 0 && <span className="empty-inline">还没有分类，去设置里加一个</span>}
          </div>

          <button className="primary" type="submit" disabled={!amount}>
            记一笔
          </button>
        </form>
      </div>

      {entries.length > 0 && (
        <div className="entry-list">
          {entries.map((e) => (
            <div className="entry" key={e.id}>
              <div className="entry-line">
                <span className="entry-cat">{e.categories?.name || '未分类'}</span>
                <span className="entry-amount">¥{e.amount.toFixed(2)}</span>
                <button className="rm" onClick={() => remove(e)} aria-label="删除这笔">×</button>
              </div>
              {e.note && <span className="entry-note">{e.note}</span>}
            </div>
          ))}
        </div>
      )}

      {undo && (
        <div className="toast">
          已删除一笔
          <button onClick={undoDelete}>撤销</button>
        </div>
      )}
    </section>
  )
}
