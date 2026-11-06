import { useEffect, useRef, useState } from 'react'
import {
  addDeadline,
  deleteDeadline,
  fetchDeadlines,
  renameDeadline,
  setDeadlineDone,
  setDeadlineDue,
  setDeadlineTime
} from '../lib/db'

function localDayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function daysFromToday(due) {
  const a = new Date(`${due}T00:00:00`)
  const b = new Date(`${localDayKey()}T00:00:00`)
  return Math.round((a - b) / 86400000)
}

function fmtDate(due) {
  const [, m, d] = due.split('-').map(Number)
  return `${m}月${d}日`
}

function dueMeta(due) {
  if (!due) return { cls: 'none', state: '无期限' }
  const rem = daysFromToday(due)
  if (rem < 0) return { cls: 'overdue', state: `逾期 ${-rem} 天` }
  if (rem === 0) return { cls: 'today', state: '今天到期' }
  if (rem === 1) return { cls: 'soon', state: '明天到期' }
  return { cls: 'future', state: `剩 ${rem} 天` }
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  )
}

function DeadlineItem({ item, onToggle, onRename, onChangeDue, onChangeTime, onDelete }) {
  const [title, setTitle] = useState(item.title)
  const pressTimer = useRef(null)

  useEffect(() => {
    setTitle(item.title)
  }, [item.title])

  const commit = () => {
    const v = title.trim()
    if (!v) {
      setTitle(item.title)
      return
    }
    if (v !== item.title) onRename(item.id, v)
  }

  const startPress = () => {
    pressTimer.current = setTimeout(() => {
      if (window.confirm(`删除「${item.title}」？`)) onDelete(item.id)
    }, 500)
  }
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  const meta = dueMeta(item.due_date)

  return (
    <div
      className={`deadline-row${item.done ? ' is-done' : ''}`}
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

      <div className="deadline-main">
        <input
          className="deadline-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <div className="deadline-sub">
          <label
            className={`due ${meta.cls}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {item.due_date ? fmtDate(item.due_date) : '无期限'}
            <input
              type="date"
              className="date-native"
              value={item.due_date || ''}
              onChange={(e) => onChangeDue(item.id, e.target.value)}
            />
          </label>
          {item.due_date && (
            <label
              className={`due ${meta.cls}`}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {item.due_time || '设定时间'}
              <input
                type="time"
                className="date-native"
                value={item.due_time || ''}
                onChange={(e) => onChangeTime(item.id, e.target.value)}
              />
            </label>
          )}
          <span className="due-state">{meta.state}</span>
        </div>
      </div>
    </div>
  )
}

export default function DeadlineBlock() {
  const [items, setItems] = useState(fetchDeadlines())
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [time, setTime] = useState('')

  const reload = () => setItems(fetchDeadlines())
  const active = items.filter((i) => !i.done).length

  const toggle = (id, done) => {
    setDeadlineDone(id, done)
    reload()
  }
  const rename = (id, t) => {
    renameDeadline(id, t)
    reload()
  }
  const changeDue = (id, d) => {
    setDeadlineDue(id, d)
    reload()
  }
  const changeTime = (id, t) => {
    setDeadlineTime(id, t)
    reload()
  }
  const del = (id) => {
    deleteDeadline(id)
    reload()
  }

  const submit = (e) => {
    e.preventDefault()
    const v = title.trim()
    if (!v) return
    addDeadline(v, due || null, time || null)
    setTitle('')
    setDue('')
    setTime('')
    reload()
  }

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">
          <span className="sec-dot deadline" />
          Deadline
        </h2>
        {active > 0 && <span className="section-meta">{active} 个待处理</span>}
      </div>

      <div className="card">
        {items.map((item) => (
          <DeadlineItem
            key={item.id}
            item={item}
            onToggle={toggle}
            onRename={rename}
            onChangeDue={changeDue}
            onChangeTime={changeTime}
            onDelete={del}
          />
        ))}

        {items.length === 0 && <div className="empty-journal">还没有期限任务，加一个吧。</div>}

        <form className="deadline-add" onSubmit={submit}>
          <input
            className="deadline-add-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="添加一个期限任务…"
          />
          <label className={`date-btn${due ? ' has' : ''}`} aria-label="选择截止日期">
            {due ? fmtDate(due) : <CalendarIcon />}
            <input
              type="date"
              className="date-native"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          {due && (
            <label className={`date-btn time-btn${time ? ' has' : ''}`} aria-label="选择截止时间">
              {time || '--:--'}
              <input
                type="time"
                className="date-native"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          )}
          <button type="submit" className="add-btn" aria-label="添加">+</button>
        </form>

        {items.length > 0 && <div className="deadline-hint">长按任务可删除</div>}
      </div>
    </section>
  )
}