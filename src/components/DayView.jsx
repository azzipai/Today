import { useEffect, useState } from 'react'
import {
  addNote as storeAddNote,
  addTask as storeAddTask,
  clearTaskHistory,
  deleteNote as storeDeleteNote,
  deleteTask as storeDeleteTask,
  fetchDay,
  removeTaskHistory,
  renameNote as storeRenameNote,
  renameTask as storeRenameTask,
  setNoteDone,
  setTaskAllSteps,
  setTaskStatus
} from '../lib/db'
import { dayLabel, logicalToday, shiftDay } from '../lib/date'
import TaskCard from './TaskCard'
import DeadlineBlock from './DeadlineBlock'
import InboxBlock from './InboxBlock'
import Ledger from './Ledger'

export default function DayView({ day, setDay, dayStart }) {
  const [state, setState] = useState({
    tasks: [],
    entries: [],
    categories: [],
    finishes: [],
    ideas: [],
    taskHistory: []
  })

  const reload = () => {
    setState(fetchDay(day))
  }

  useEffect(() => {
    setState(fetchDay(day))
  }, [day])

  const isToday = day === logicalToday(dayStart)

  const addTask = (title) => {
    storeAddTask(day, title)
    reload()
  }

  const toggleTask = (task) => {
    const steps = task.notes.filter((n) => n.kind === 'step')
    if (steps.length) {
      const allDone = steps.every((s) => s.done)
      setTaskAllSteps(task.id, !allDone)
    } else {
      setTaskStatus(task.id, task.status === 'done' ? 'planned' : 'done')
    }
    reload()
  }

  const renameTask = (id, title) => {
    storeRenameTask(id, title)
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, title } : t))
    }))
  }

  const deleteTask = (id) => {
    storeDeleteTask(id)
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
  }

  const addNote = (taskId, kind, content) => {
    storeAddNote(taskId, kind, content)
    reload()
  }

  const deleteNote = (noteId) => {
    storeDeleteNote(noteId)
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => ({ ...t, notes: t.notes.filter((n) => n.id !== noteId) }))
    }))
  }

  const toggleNote = (noteId, done) => {
    setNoteDone(noteId, done)
    reload()
  }

  const renameNote = (noteId, content) => {
    storeRenameNote(noteId, content)
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => ({
        ...t,
        notes: t.notes.map((n) => (n.id === noteId ? { ...n, content } : n))
      }))
    }))
  }

  const removeHistory = (id) => {
    removeTaskHistory(id)
    reload()
  }

  const clearHistory = () => {
    clearTaskHistory()
    reload()
  }

  // 待办整体完成度：有子步骤的块按子步骤算，没有的按整块状态算
  let planDone = 0
  let planTotal = 0
  for (const t of state.tasks) {
    const steps = t.notes.filter((n) => n.kind === 'step')
    if (steps.length) {
      planDone += steps.filter((s) => s.done).length
      planTotal += steps.length
    } else {
      planTotal += 1
      if (t.status === 'done') planDone += 1
    }
  }
  const planPct = planTotal ? Math.round((planDone / planTotal) * 100) : 0

  return (
    <>
      <div className="datebar">
        <button className="navbtn" onClick={() => setDay(shiftDay(day, -1))} aria-label="前一天">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="datebox">
          <div className="date-main">{dayLabel(day)}</div>
          {isToday ? (
            <div className="date-sub">今天</div>
          ) : (
            <button className="date-sub link" onClick={() => setDay(logicalToday(dayStart))}>回到今天</button>
          )}
        </div>
        <button className="navbtn" onClick={() => setDay(shiftDay(day, 1))} aria-label="后一天">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>

      {/* 待办 */}
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">
            <span className="sec-dot plan" />
            每日计划
          </h2>
        </div>

        {state.tasks.length > 0 && (
          <div className="plan-progress-row">
            <div className="plan-progress">
              <div className="plan-progress-fill" style={{ width: `${planPct}%` }} />
            </div>
            <span className="plan-count">{planDone}/{planTotal}</span>
          </div>
        )}

        {state.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onToggle={toggleTask}
            onRename={renameTask}
            onDelete={deleteTask}
            onAddNote={addNote}
            onDeleteNote={deleteNote}
            onToggleNote={toggleNote}
            onRenameNote={renameNote}
          />
        ))}

        {state.tasks.length === 0 && <div className="empty">今天还没有计划，写一个吧。</div>}

        <form
          className="add-row"
          onSubmit={(e) => {
            e.preventDefault()
            const input = e.currentTarget.querySelector('input')
            const v = input.value.trim()
            if (!v) return
            addTask(v)
            input.value = ''
          }}
        >
          <input placeholder="添加一个计划…" />
          <button type="submit" aria-label="添加">+</button>
        </form>

        {state.taskHistory.length > 0 && (
          <div className="fav-wrap">
            <div className="fav-head">
              <span className="fav-label">常用计划</span>
              <button className="fav-clear" onClick={clearHistory}>清空</button>
            </div>
            <div className="fav-chips">
              {state.taskHistory.map((h) => (
                <span className="fav-chip" key={h.id}>
                  <button onClick={() => addTask(h.title)}>{h.title}</button>
                  <button className="fav-x" onClick={() => removeHistory(h.id)} aria-label="移除">×</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Inbox（随手记 / 心愿） */}
      <InboxBlock />

      {/* Deadline（中期任务） */}
      <DeadlineBlock />

      <Ledger day={day} entries={state.entries} categories={state.categories} onRefresh={reload} />
    </>
  )
}