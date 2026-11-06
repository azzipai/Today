import { useEffect, useRef, useState } from 'react'
import { addInbox, deleteInbox, fetchInbox, renameInbox, setInboxDone } from '../lib/db'

function InboxItem({ item, onToggle, onRename, onDelete }) {
  const [text, setText] = useState(item.content)
  const pressTimer = useRef(null)

  useEffect(() => {
    setText(item.content)
  }, [item.content])

  const commit = () => {
    const v = text.trim()
    if (!v) {
      setText(item.content)
      return
    }
    if (v !== item.content) onRename(item.id, v)
  }

  const startPress = () => {
    pressTimer.current = setTimeout(() => {
      if (window.confirm(`删除「${item.content}」？`)) onDelete(item.id)
    }, 500)
  }
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  return (
    <div
      className={`inbox-row${item.done ? ' is-done' : ''}`}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        className="check"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onToggle(item.id, !item.done)}
        aria-label="切换完成"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <input
        className="inbox-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
    </div>
  )
}

export default function InboxBlock() {
  const [items, setItems] = useState(fetchInbox())
  const [text, setText] = useState('')

  const reload = () => setItems(fetchInbox())
  const active = items.filter((i) => !i.done).length

  const toggle = (id, done) => {
    setInboxDone(id, done)
    reload()
  }
  const rename = (id, t) => {
    renameInbox(id, t)
    reload()
  }
  const del = (id) => {
    deleteInbox(id)
    reload()
  }

  const submit = (e) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    addInbox(v)
    setText('')
    reload()
  }

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">
          <span className="sec-dot inbox" />
          Inbox
        </h2>
        {active > 0 && <span className="section-meta">{active} 未完成</span>}
      </div>

      <div className="card">
        {items.map((item) => (
          <InboxItem key={item.id} item={item} onToggle={toggle} onRename={rename} onDelete={del} />
        ))}

        {items.length === 0 && <div className="empty-journal">随手记一句：想法、想做的小事…</div>}

        <form className="inbox-add" onSubmit={submit}>
          <input
            className="inbox-add-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="记一条…"
          />
          <button type="submit" className="add-btn" aria-label="添加">+</button>
        </form>

        {items.length > 0 && <div className="deadline-hint">长按可删除</div>}
      </div>
    </section>
  )
}