import { fetchRange } from './db'
import { logicalToday, shiftDay, shortLabel, weekStart, weekEnd } from './date'

const C = {
  bg: '#F4F3EF',
  card: '#FFFFFF',
  ink: '#1A1917',
  ink2: '#6E6A63',
  ink3: '#A8A39A',
  line: '#E6E3DC',
  accent: '#3C5A49',
  soft: '#EDF1EC',
  money: '#8A67A8',
  heat: ['#ECE9E0', '#D3E2D5', '#C4D3C8', '#9BB6A6', '#6D9380', '#3C5A49']
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function monthStart(key) {
  const [y, m] = key.split('-').map(Number)
  return `${y}-${pad(m)}-01`
}

function monthEnd(key) {
  const [y, m] = key.split('-').map(Number)
  return `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`
}

function daysBetween(start, end) {
  const out = []
  let k = start
  while (k <= end) {
    out.push(k)
    k = shiftDay(k, 1)
  }
  return out
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function money(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function level(d) {
  if (!d.hasTask) return null
  const r = d.rate
  if (r <= 0) return 0
  if (r <= 25) return 1
  if (r <= 50) return 2
  if (r <= 75) return 3
  return 4
}

export function reportRange(mode, dayStartHour = 4) {
  const today = logicalToday(dayStartHour)
  if (mode === 'week') {
    const start = weekStart(today)
    return { mode, start, end: weekEnd(start), title: '本周报告', span: `${shortLabel(start)} — ${shortLabel(weekEnd(start))}` }
  }
  const start = monthStart(today)
  const end = monthEnd(today)
  const [y, m] = today.split('-').map(Number)
  return { mode, start, end, title: '本月报告', span: `${y}年${m}月` }
}

export function buildReportHTML(mode, dayStartHour = 4) {
  const range = reportRange(mode, dayStartHour)
  const { start, end } = range
  const { tasks, entries } = fetchRange(start, end)

  const counted = tasks.filter((t) => t.status !== 'carried')
  const doneCount = counted.filter((t) => t.status === 'done').length
  const rate = counted.length ? Math.round((doneCount / counted.length) * 100) : 0
  const total = entries.reduce((s, e) => s + e.amount, 0)
  const days = daysBetween(start, end)
  const perDay = days.length ? total / days.length : 0

  const dayStats = days.map((day) => {
    const t = tasks.filter((x) => x.day === day)
    const done = t.filter((x) => x.status === 'done').length
    const spent = entries.filter((e) => e.day === day).reduce((s, e) => s + e.amount, 0)
    return { day, hasTask: t.length > 0, done, total: t.length, rate: t.length ? Math.round((done / t.length) * 100) : 0, spent }
  })
  const maxSpent = Math.max(...dayStats.map((d) => d.spent), 1)

  const byCat = {}
  entries.forEach((e) => {
    const k = e.categories?.name || '未分类'
    byCat[k] = (byCat[k] || 0) + e.amount
  })
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1])

  const doneTasks = tasks.filter((t) => t.status === 'done').sort((a, b) => a.day.localeCompare(b.day))
  const entryRows = [...entries].sort((a, b) => b.day.localeCompare(a.day) || b.created_at.localeCompare(a.created_at))

  // 热力图：周报单行 7 格；月报按周多行（周一~周日）
  let heatRows
  if (mode === 'week') {
    heatRows = [dayStats.map((d) => ({ d, blank: false }))]
  } else {
    heatRows = groupByWeek(dayStats, start, end)
  }

  const now = new Date()
  const generated = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Today · ${range.title}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: ${C.bg}; color: ${C.ink}; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif; line-height: 1.6; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 640px; margin: 0 auto; padding: 24px 20px 48px; }
  header { margin-bottom: 20px; }
  .title { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
  .span { color: ${C.ink2}; font-size: 14px; margin-top: 2px; }
  .gen { color: ${C.ink3}; font-size: 12px; margin-top: 2px; }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .card { background: ${C.card}; border: 1px solid ${C.line}; border-radius: 14px; padding: 16px; }
  .k { font-size: 12.5px; color: ${C.ink2}; }
  .v { font-size: 26px; font-weight: 700; margin: 4px 0 2px; font-variant-numeric: tabular-nums; }
  .s { font-size: 12px; color: ${C.ink3}; }
  section { margin-bottom: 24px; }
  h2 { font-size: 15px; color: ${C.ink}; margin: 0 0 12px; }
  .panel { background: ${C.card}; border: 1px solid ${C.line}; border-radius: 14px; padding: 16px; }
  .heat { display: flex; gap: 10px; overflow-x: auto; }
  .heat-col { display: flex; flex-direction: column; gap: 4px; }
  .heat-col .wd { display: none; }
  .heat-cell { width: 22px; height: 22px; border-radius: 4px; background: ${C.heat[0]}; }
  .heat-weekdays { display: flex; gap: 4px; margin-bottom: 4px; }
  .heat-weekdays span { width: 22px; text-align: center; font-size: 10px; color: ${C.ink3}; }
  .legend { display: flex; align-items: center; gap: 4px; margin-top: 12px; font-size: 11px; color: ${C.ink3}; }
  .legend i { width: 14px; height: 14px; border-radius: 3px; display: inline-block; }
  .bars { display: flex; align-items: flex-end; gap: 6px; height: 120px; }
  .bar-col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; }
  .bar-val { font-size: 9px; color: ${C.ink3}; margin-bottom: 4px; white-space: nowrap; }
  .bar { width: 100%; max-width: 30px; background: ${C.money}; border-radius: 4px 4px 0 0; opacity: 0.85; min-height: 2px; }
  .bar-label { font-size: 10px; color: ${C.ink2}; margin-top: 6px; }
  .cat-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 13px; }
  .cat-name { flex: none; width: 74px; color: ${C.ink2}; }
  .cat-track { flex: 1; height: 10px; background: ${C.soft}; border-radius: 5px; overflow: hidden; }
  .cat-fill { height: 100%; background: ${C.accent}; border-radius: 5px; }
  .cat-amount { flex: none; min-width: 66px; text-align: right; font-variant-numeric: tabular-nums; }
  ul.list { list-style: none; margin: 0; padding: 0; }
  ul.list li { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid ${C.line}; font-size: 14px; }
  ul.list li:last-child { border-bottom: 0; }
  ul.list li > span:first-child { flex: 1; min-width: 0; }
  .li-day { color: ${C.ink3}; font-size: 12px; flex: none; width: 46px; text-align: right; }
  .li-amt { font-variant-numeric: tabular-nums; flex: none; min-width: 68px; text-align: right; }
  .none { color: ${C.ink3}; font-size: 13px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="title">Today · ${range.title}</div>
    <div class="span">${range.span}</div>
    <div class="gen">生成于 ${generated}</div>
  </header>

  <div class="cards">
    <div class="card">
      <div class="k">完成率</div>
      <div class="v">${rate}%</div>
      <div class="s">${doneCount} / ${counted.length} 个块</div>
    </div>
    <div class="card">
      <div class="k">${range.mode === 'week' ? '本周' : '本月'}支出</div>
      <div class="v">¥${money(total)}</div>
      <div class="s">日均 ¥${money(perDay)}</div>
    </div>
  </div>

  <section>
    <h2>每日完成率</h2>
    <div class="panel">
      ${mode === 'week' ? `<div class="heat-weekdays">${['一', '二', '三', '四', '五', '六', '日'].map((l) => `<span>${l}</span>`).join('')}</div>` : ''}
      <div class="heat">
        ${heatRows.map((row) => `
          <div class="heat-col">
            ${row.map(({ d, blank }) => {
              if (blank) return '<span class="heat-cell" style="opacity:0"></span>'
              const lv = level(d)
              const bg = lv == null ? C.heat[0] : C.heat[lv]
              const tip = `${d.day} ${d.total ? d.done + '/' + d.total : '无任务'}`
              return `<span class="heat-cell" style="background:${bg}" title="${tip}"></span>`
            }).join('')}
          </div>`).join('')}
      </div>
      <div class="legend">
        少
        ${['#D3E2D5', '#C4D3C8', '#9BB6A6', '#6D9380', '#3C5A49'].map((c) => `<i style="background:${c}"></i>`).join('')}
        多 <span style="margin-left:8px">灰 = 当天无任务</span>
      </div>
    </div>
  </section>

  <section>
    <h2>每日支出</h2>
    <div class="panel">
      <div class="bars">
        ${dayStats.map((d, i) => `
          <div class="bar-col">
            <div class="bar-val">${d.spent ? money(d.spent) : ''}</div>
            <div class="bar" style="height:${Math.round((d.spent / maxSpent) * 100)}%"></div>
            <div class="bar-label">${mode === 'week' ? ['一', '二', '三', '四', '五', '六', '日'][i] : new Date(d.day + 'T00:00:00').getDate()}</div>
          </div>`).join('')}
      </div>
    </div>
  </section>

  <section>
    <h2>分类占比</h2>
    <div class="panel">
      ${catRows.length === 0
        ? '<div class="none">这段时间还没有记账。</div>'
        : catRows.map(([name, value]) => `
          <div class="cat-row">
            <span class="cat-name">${esc(name)}</span>
            <div class="cat-track"><div class="cat-fill" style="width:${Math.round((value / total) * 100)}%"></div></div>
            <span class="cat-amount">¥${money(value)}</span>
          </div>`).join('')}
    </div>
  </section>

  <section>
    <h2>完成的待办</h2>
    <div class="panel">
      ${doneTasks.length === 0
        ? '<div class="none">这段时间还没有完成的待办。</div>'
        : `<ul class="list">${doneTasks.map((t) => `<li><span>${esc(t.title)}</span><span class="li-day">${shortLabel(t.day)}</span></li>`).join('')}</ul>`}
    </div>
  </section>

  <section>
    <h2>支出明细</h2>
    <div class="panel">
      ${entryRows.length === 0
        ? '<div class="none">这段时间还没有记账。</div>'
        : `<ul class="list">${entryRows.map((e) => `<li><span>${esc(e.note || '未备注')} <small style="color:${C.ink3}">· ${esc(e.categories?.name || '未分类')}</small></span><span class="li-day">${shortLabel(e.day)}</span><span class="li-amt">¥${money(e.amount)}</span></li>`).join('')}</ul>`}
    </div>
  </section>
</div>
</body>
</html>`
}

function groupByWeek(dayStats, start, end) {
  const ws = weekStart(start)
  const rows = []
  let w = 0
  for (;;) {
    const row = []
    for (let i = 0; i < 7; i++) {
      const d = shiftDay(ws, w * 7 + i)
      if (d < start || d > end) {
        row.push({ d: null, blank: true })
      } else {
        const st = dayStats.find((x) => x.day === d)
        row.push({ d: st, blank: false })
      }
    }
    rows.push(row)
    if (shiftDay(ws, w * 7 + 6) >= end) break
    w++
  }
  return rows
}

export function downloadReport(mode, dayStartHour = 4) {
  const range = reportRange(mode, dayStartHour)
  const html = buildReportHTML(mode, dayStartHour)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const name = mode === 'week' ? `today-周报-${range.end}.html` : `today-月报-${range.start.slice(0, 7)}.html`
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}