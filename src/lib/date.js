const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']

const pad = (n) => String(n).padStart(2, '0')

export function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 逻辑上“今天”的日期：凌晨 dayStartHour 点之前算前一天 */
export function logicalToday(dayStartHour = 4) {
  const now = new Date()
  if (now.getHours() < dayStartHour) now.setDate(now.getDate() - 1)
  return dateKey(now)
}

export function shiftDay(key, delta) {
  const d = parseKey(key)
  d.setDate(d.getDate() + delta)
  return dateKey(d)
}

export function dayLabel(key) {
  const d = parseKey(key)
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK_CN[d.getDay()]}`
}

export function shortLabel(key) {
  const d = parseKey(key)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 周一为一周起点 */
export function weekStart(key) {
  const d = parseKey(key)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return dateKey(d)
}

export function weekEnd(startKey) {
  return shiftDay(startKey, 6)
}

export function weekDays(startKey) {
  return Array.from({ length: 7 }, (_, i) => shiftDay(startKey, i))
}

export function weekdayCN(key) {
  return `周${WEEK_CN[parseKey(key).getDay()]}`
}
