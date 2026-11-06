import { useEffect, useRef, useState } from 'react'
import { logicalToday } from './lib/date'
import DayView from './components/DayView'
import StatsView from './components/StatsView'
import SettingsView from './components/SettingsView'
import { startReminderLoop, systemNotify } from './lib/reminders'

function readDayStart() {
  const saved = localStorage.getItem('dayStartHour')
  const v = saved === null ? 4 : Number(saved)
  return Number.isFinite(v) && v >= 0 && v <= 12 ? v : 4
}

export default function App() {
  const [view, setView] = useState('today')
  const [dayStart, setDayStart] = useState(readDayStart)
  const [day, setDay] = useState(() => logicalToday(readDayStart()))
  const [toasts, setToasts] = useState([])
  const toastSeq = useRef(0)

  const changeDayStart = (hour) => {
    localStorage.setItem('dayStartHour', String(hour))
    setDayStart(hour)
    setDay(logicalToday(hour))
  }

  useEffect(() => {
    const stop = startReminderLoop(dayStart, ({ title, body }) => {
      const id = ++toastSeq.current
      setToasts((t) => [...t, { id, title, body }])
      systemNotify(title, body)
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id))
      }, 9000)
    })
    return stop
  }, [dayStart])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Today<span className="brand-dot" />
        </div>
        {view === 'settings' ? (
          <button className="text-btn" onClick={() => setView('today')}>返回</button>
        ) : (
          <button className="icon-btn" aria-label="设置" onClick={() => setView('settings')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10.3 3v-.2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1.1z" />
            </svg>
          </button>
        )}
      </header>

      <main className="page">
        {view === 'today' && <DayView day={day} setDay={setDay} dayStart={dayStart} />}
        {view === 'stats' && <StatsView dayStart={dayStart} />}
        {view === 'settings' && (
          <SettingsView dayStart={dayStart} onChangeDayStart={changeDayStart} />
        )}
      </main>

      {view !== 'settings' && (
        <nav className="tabbar">
          <button className={`tab${view === 'today' ? ' on' : ''}`} onClick={() => setView('today')}>今天</button>
          <button className={`tab${view === 'stats' ? ' on' : ''}`} onClick={() => setView('stats')}>统计</button>
        </nav>
      )}

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <div className="toast-title">{t.title}</div>
            {t.body && <div className="toast-body">{t.body}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}