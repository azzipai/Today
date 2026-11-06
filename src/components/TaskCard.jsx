import { useEffect, useState } from 'react'

function StepItem({ step, onToggle, onRename, onDelete }) {
  const [text, setText] = useState(step.content)

  useEffect(() => {
    setText(step.content)
  }, [step.content])

  const commit = () => {
    const v = text.trim()
    if (!v) {
      setText(step.content)
      return
    }
    if (v !== step.content) onRename(step.id, v)
  }

  return (
    <div className="step">
      <button
        className={`step-check${step.done ? ' on' : ''}`}
        onClick={() => onToggle(step.id, !step.done)}
        aria-label="切换子步骤"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <input
        className="step-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <button
        className="rm"
        onClick={() => {
          if (window.confirm('删除这个子步骤？')) onDelete(step.id)
        }}
        aria-label="删除"
      >×</button>
    </div>
  )
}

export default function TaskCard({ task, onToggle, onRename, onDelete, onAddNote, onDeleteNote, onToggleNote, onRenameNote }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [adding, setAdding] = useState(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setTitle(task.title)
  }, [task.title])

  const done = task.status === 'done'
  const steps = task.notes.filter((n) => n.kind === 'step')
  const learns = task.notes.filter((n) => n.kind === 'learn')
  const doneSteps = steps.filter((s) => s.done).length
  const hasSteps = steps.length > 0

  const commitTitle = () => {
    const v = title.trim()
    if (!v) {
      setTitle(task.title)
      return
    }
    if (v !== task.title) onRename(task.id, v)
  }

  const submitNote = (e) => {
    e.preventDefault()
    const v = draft.trim()
    if (!v) return
    onAddNote(task.id, adding, v)
    setDraft('')
    setAdding(null)
  }

  return (
    <article className={`task${done ? ' is-done' : ''}`}>
      <div className="task-row">
        <button className="check" onClick={() => onToggle(task)} aria-label={done ? '标记为未完成' : '标记为完成'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </button>

        <input
          className="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />

        <button className={`chev${open ? ' open' : ''}`} onClick={() => setOpen(!open)} aria-label="展开">
          {!open && hasSteps && <span className="chev-count">{doneSteps}/{steps.length}</span>}
          {!open && !hasSteps && learns.length > 0 && <span className="chev-count">{learns.length}</span>}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="task-body">
          {steps.map((s) => (
            <StepItem key={s.id} step={s} onToggle={onToggleNote} onRename={onRenameNote} onDelete={onDeleteNote} />
          ))}

          {learns.length > 0 && (
            <div className="learn">
              <div className="learn-tag">收获</div>
              {learns.map((n) => (
                <div className="note" key={n.id}>
                  <span className="dot" />
                  <span className="note-text">{n.content}</span>
                  <button
                    className="rm"
                    onClick={() => {
                      if (window.confirm('删除这条收获？')) onDeleteNote(n.id)
                    }}
                    aria-label="删除"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {adding ? (
            <form className="note-form" onSubmit={submitNote}>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setAdding(null)
                    setDraft('')
                  }
                }}
                placeholder={adding === 'step' ? '加一个子步骤…' : '今天从这件事里学到了什么…'}
              />
              <button type="submit">添加</button>
            </form>
          ) : (
            <div className="note-actions">
              <button onClick={() => setAdding('step')}>+ 步骤</button>
              <button onClick={() => setAdding('learn')}>+ 收获</button>
            </div>
          )}

          <button
            className="muted-link"
            onClick={() => {
              if (window.confirm(`删除「${task.title}」？子步骤和收获会一并删除。`)) onDelete(task.id)
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0l-.7 12a1 1 0 0 1-1 .9H8.7a1 1 0 0 1-1-.9L7 7" />
            </svg>
            删除这个块
          </button>
        </div>
      )}
    </article>
  )
}