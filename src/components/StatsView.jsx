import { useEffect, useMemo, useState } from 'react'
import { fetchRange } from '../lib/db'
import { logicalToday, shiftDay, shortLabel, weekDays, weekEnd, weekStart, weekdayCN } from '../lib/date'

export default function StatsView({ dayStart }) {
  const [start, setStart] = useState(() => weekStart(logicalToday(dayStart)))
  const [data, setData] = useState(null)
  const [sel, setSel] = useState(null)
  const [span, setSpan] = useState('12')

  const heat = useMemo(() => buildHeat(logicalToday(dayStart), span), [dayStart, span])

  useEffect(() => {
    setData(fetchRange(start, weekEnd(start)))
  }, [start])

  const days = weekDays(start)
  const tasks = data?.tasks || []
  const entries = data?.entries || []

  const counted = tasks.filter((t) => t.status !== 'carried')
  const done = counted.filter((t) => t.status === 'done').length
  const rate = counted.length ? Math.round((done / counted.length) * 100) : 0

  const total = entries.reduce((s, e) => s + e.amount, 0)
  const perDay = total / 7

  const dayTotals = days.map((d) => entries.filter((e) => e.day === d).reduce((s, e) => s + e.amount, 0))
  const maxDay = Math.max(...dayTotals, 1)

  const byCat = {}
  entries.forEach((e) => {
    const key = e.categories?.name || '未分类'
    byCat[key] = (byCat[key] || 0) + e.amount
  })
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1])

  return (
    <>
      <HeatSection heat={heat} sel={sel} onSelect={setSel} span={span} onSpan={setSpan} />

      <div className="datebar">
        <button className="navbtn" onClick={() => setStart(weekStart(shiftKey(start, -7)))} aria-label="上一周">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="datebox">
          <div className="date-main">{shortLabel(start)} — {shortLabel(weekEnd(start))}</div>
          <div className="date-sub">这一周</div>
        </div>
        <button className="navbtn" onClick={() => setStart(weekStart(shiftKey(start, 7)))} aria-label="下一周">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>

      {!data && <div className="empty">统计中…</div>}

      {data && (
        <>
          <div className="metrics">
            <div className="metric">
              <span className="metric-k">完成率</span>
              <span className="metric-v">{rate}%</span>
              <span className="metric-s">{done} / {counted.length} 个块</span>
            </div>
            <div className="metric">
              <span className="metric-k">本周支出</span>
              <span className="metric-v">¥{money(total)}</span>
              <span className="metric-s">日均 ¥{money(perDay)}</span>
            </div>
          </div>

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">每日支出</h2>
            </div>
            <div className="card chart-card">
              <div className="bars">
                {days.map((d, i) => (
                  <div className="bar-col" key={d}>
                    <span className="bar-val">{dayTotals[i] ? `¥${money(dayTotals[i])}` : ''}</span>
                    <div className="bar-track">
                      <div
                        className={`bar${dayTotals[i] ? '' : ' zero'}`}
                        style={{ height: `${Math.round((dayTotals[i] / maxDay) * 100)}%` }}
                      />
                    </div>
                    <span className="bar-label">{weekdayCN(d)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">分类占比</h2>
              <span className="section-meta">{catRows.length} 类</span>
            </div>
            {catRows.length === 0 ? (
              <div className="empty">这周还没有记账。</div>
            ) : (
              <div className="cat-list">
                {catRows.map(([name, value]) => (
                  <div className="cat-row" key={name}>
                    <span className="cat-name">{name}</span>
                    <div className="cat-track">
                      <div className="cat-fill" style={{ width: `${Math.round((value / total) * 100)}%` }} />
                    </div>
                    <span className="cat-amount">¥{money(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}

function money(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function shiftKey(key, delta) {
  const d = new Date(`${key}T00:00:00`)
  d.setDate(d.getDate() + delta)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 生成每周每天完成情况：mode 为 '4' | '12' | 'all' */
function buildHeat(today, mode = '12') {
  const thisWeekStart = weekStart(today)
  const end = weekEnd(thisWeekStart)

  let firstWeekStart
  if (mode === 'all') {
    const all = fetchRange('1970-01-01', end).tasks
    const ds = all.map((t) => t.day).filter(Boolean)
    firstWeekStart = ds.length ? weekStart(ds.reduce((a, b) => (a < b ? a : b))) : thisWeekStart
  } else {
    const n = mode === '4' ? 4 : 12
    firstWeekStart = shiftDay(thisWeekStart, -(n - 1) * 7)
  }

  const spanMs = (new Date(`${thisWeekStart}T00:00:00`) - new Date(`${firstWeekStart}T00:00:00`)) / (7 * 86400000)
  const weeksCount = Math.max(1, Math.round(spanMs) + 1)

  const { tasks } = fetchRange(firstWeekStart, end)
  const byDay = {}
  tasks.forEach((t) => {
    ;(byDay[t.day] || (byDay[t.day] = [])).push(t)
  })

  const weeks = []
  for (let w = 0; w < weeksCount; w++) {
    const startKey = shiftDay(firstWeekStart, w * 7)
    const days = []
    for (let i = 0; i < 7; i++) {
      const day = shiftDay(startKey, i)
      const list = byDay[day] || []
      const done = list.filter((t) => t.status === 'done').length
      const total = list.length
      days.push({
        day,
        hasTask: total > 0,
        done,
        total,
        rate: total ? Math.round((done / total) * 100) : 0
      })
    }
    weeks.push({ startKey, days })
  }
  return { weeks, firstWeekStart, end }
}

function heatLevel(d) {
  if (!d.hasTask) return null
  const r = d.rate
  if (r <= 0) return 0
  if (r <= 25) return 1
  if (r <= 50) return 2
  if (r <= 75) return 3
  return 4
}

function HeatSection({ heat, sel, onSelect, span, onSpan }) {
  const { weeks, firstWeekStart, end } = heat
  const WD = ['一', '二', '三', '四', '五', '六', '日']

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">每周完成率</h2>
        <span className="section-meta">{shortLabel(firstWeekStart)} — {shortLabel(end)}</span>
      </div>
      <div className="card">
        <div className="heat-spans">
          {[['4', '近 4 周'], ['12', '近 12 周'], ['all', '全部']].map(([k, label]) => (
            <button key={k} className={`span-btn${span === k ? ' on' : ''}`} onClick={() => onSpan(k)}>
              {label}
            </button>
          ))}
        </div>

        <div className="heat-grid">
          <div className="heat-weekdays">
            {WD.map((l, i) => <span key={i}>{l}</span>)}
          </div>

          <div className="heat-weeks">
            {weeks.map((w, wi) => (
              <div
                key={wi}
                className={`heat-week${sel === wi ? ' active' : ''}`}
                onClick={() => onSelect(sel === wi ? null : wi)}
              >
                {w.days.map((d, di) => {
                  const lv = heatLevel(d)
                  return <span key={di} className={`heat-cell${lv == null ? '' : ` lv${lv}`}`} />
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="heat-legend">
          <span>少</span>
          <span className="heat-cell lv0" />
          <span className="heat-cell lv1" />
          <span className="heat-cell lv2" />
          <span className="heat-cell lv3" />
          <span className="heat-cell lv4" />
          <span>多</span>
          <span className="legend-note">灰 = 当天无任务</span>
        </div>

        {sel != null && (
          <div className="heat-detail">
            <div className="heat-detail-head">
              {shortLabel(weeks[sel].startKey)} — {shortLabel(weekEnd(weeks[sel].startKey))}
            </div>
            {weeks[sel].days.map((d) => (
              <div className="heat-detail-row" key={d.day}>
                <span className="hd-day">{shortLabel(d.day)} {weekdayCN(d.day)}</span>
                <span className="hd-val">{d.hasTask ? `${d.done}/${d.total}` : '无任务'}</span>
              </div>
            ))}
          </div>
        )}

        <div className="heat-hint">一列一周，从上到下是周一到周日；点某列看该周明细。</div>
      </div>
    </section>
  )
}
