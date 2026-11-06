import { fetchDay, fetchDeadlines } from './db'
import { logicalToday, shiftDay } from './date'

const PREFIX = 'today.remind.'

function get(key) {
  return localStorage.getItem(PREFIX + key)
}

function set(key, val) {
  localStorage.setItem(PREFIX + key, val)
}

export function isRemindOn(key, def = true) {
  const v = localStorage.getItem(PREFIX + key + '.on')
  return v === null ? def : v === '1'
}

export function setRemindOn(key, on) {
  localStorage.setItem(PREFIX + key + '.on', on ? '1' : '0')
}

/* ---------- 系统通知（安卓 / 桌面可用，iOS 走页面内 Toast） ---------- */

export function notifySupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notifyPermission() {
  return notifySupported() ? Notification.permission : 'unsupported'
}

export async function requestNotifyPermission() {
  if (!notifySupported()) return 'unsupported'
  if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    try {
      await Notification.requestPermission()
    } catch {
      /* ignore */
    }
  }
  return Notification.permission
}

export function systemNotify(title, body) {
  if (!notifySupported() || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, { body })
    window.setTimeout(() => n.close(), 9000)
  } catch {
    /* ignore */
  }
}

/* ---------- 每日总结 ---------- */

function buildSummaryFor(day) {
  const { tasks, entries } = fetchDay(day)
  const counted = tasks.filter((t) => t.status !== 'carried')
  const done = counted.filter((t) => t.status === 'done').length
  const total = counted.length
  const spent = entries.reduce((s, e) => s + e.amount, 0)

  const byCat = {}
  entries.forEach((e) => {
    const k = e.categories?.name || '未分类'
    byCat[k] = (byCat[k] || 0) + e.amount
  })
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]

  if (total === 0 && spent === 0) return null
  let line = total > 0 ? `完成 ${done}/${total} 个待办` : '今天没有待办'
  if (spent > 0) {
    line += ` · 支出 ¥${Math.round(spent)}`
    if (top) line += ` · 最多「${top[0]}」`
  }
  return line
}

/* ---------- 提醒检查 ---------- */

function humanizeLeft(ms) {
  const mins = Math.ceil(ms / 60000)
  if (mins < 60) return `${mins} 分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}

function fmtDue(d) {
  const [, m, day] = d.due_date.split('-').map(Number)
  return `${m}月${day}日${d.due_time ? ' ' + d.due_time : ''}`
}

function checkDeadlines() {
  if (!isRemindOn('deadline')) return []
  const now = new Date()
  const out = []
  for (const d of fetchDeadlines()) {
    if (d.done || !d.due_date) continue
    const t = d.due_time || '23:59'
    const due = new Date(`${d.due_date}T${t}:00`)
    const diff = due.getTime() - now.getTime()
    const baseKey = `dl:${d.id}:${d.due_date}-${t}`

    if (diff < 0) {
      const key = `${baseKey}:overdue`
      if (get(key)) continue
      set(key, '1')
      out.push({ title: '截止提醒 · 已逾期', body: `「${d.title}」已于 ${fmtDue(d)} 到期，记得处理` })
    } else if (diff <= 12 * 3600 * 1000) {
      const key = `${baseKey}:12h`
      if (get(key)) continue
      set(key, '1')
      out.push({ title: '截止提醒 · 即将截止', body: `「${d.title}」还有 ${humanizeLeft(diff)} 截止（${fmtDue(d)}）` })
    }
  }
  return out
}

function checkSummary(dayStart) {
  if (!isRemindOn('summary')) return null
  const today = logicalToday(dayStart)
  const h = new Date().getHours()

  if (h >= 23) {
    const key = `summary:${today}`
    if (get(key)) return null
    const body = buildSummaryFor(today)
    set(key, '1')
    if (!body) return null
    return { title: '今日总结', body }
  }

  // 白天补发昨天错过的
  const yesterday = shiftDay(today, -1)
  const key = `summary:${yesterday}`
  if (get(key)) return null
  const body = buildSummaryFor(yesterday)
  set(key, '1')
  if (!body) return null
  return { title: '昨日总结', body }
}

export function startReminderLoop(dayStart, onRemind) {
  const run = () => {
    checkDeadlines().forEach((m) => onRemind(m))
    const s = checkSummary(dayStart)
    if (s) onRemind(s)
  }
  run()
  const timer = window.setInterval(run, 60000)
  return () => window.clearInterval(timer)
}