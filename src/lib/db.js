/**
 * 数据全部存在手机浏览器的 localStorage 里，不依赖任何服务器。
 * 结构：tasks（待办）/ notes（收获分点）/ entries（记账）/ categories（分类）
 *      finishes（完成，即“实际完成”）/ ideas（灵感，计划之外做的事）
 *      taskHistory（常用计划，便于一键加入）
 */

const STORAGE_KEY = 'today.data.v1'

const DEFAULT_CATEGORIES = ['饮食', '交通', '生活用品', '学习', '娱乐', '其他']

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function nowISO() {
  return new Date().toISOString()
}

function initial() {
  return {
    tasks: [],
    notes: [],
    entries: [],
    categories: DEFAULT_CATEGORIES.map((name, i) => ({
      id: uid(),
      name,
      archived: false,
      sort_order: i,
      last_used_at: null
    })),
    finishes: [],
    ideas: [],
    deadlines: [],
    inbox: [],
    taskHistory: []
  }
}

let state = load()

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const fresh = initial()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
      return fresh
    }
    const parsed = JSON.parse(raw)
    return {
      tasks: parsed.tasks || [],
      notes: parsed.notes || [],
      entries: parsed.entries || [],
      categories: parsed.categories || [],
      finishes: parsed.finishes || [],
      ideas: parsed.ideas || [],
      deadlines: parsed.deadlines || [],
      inbox: parsed.inbox || [],
      taskHistory: parsed.taskHistory || []
    }
  } catch {
    return initial()
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function taskNotes(task) {
  return state.notes
    .filter((n) => n.task_id === task.id)
    .sort((a, b) => a.sort_order - b.sort_order)
}

function categoryOf(id) {
  const c = state.categories.find((x) => x.id === id)
  return c ? { name: c.name } : null
}

function sortedCategories() {
  return [...state.categories].sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1
    const ua = a.last_used_at || ''
    const ub = b.last_used_at || ''
    if (ua !== ub) return ub.localeCompare(ua)
    return a.sort_order - b.sort_order
  })
}

function sortList(list) {
  return [...list].sort(
    (a, b) => a.created_at.localeCompare(b.created_at)
  )
}

export function fetchDay(day) {
  const tasks = state.tasks
    .filter((t) => t.day === day)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .map((t) => ({ ...t, notes: taskNotes(t) }))

  const entries = state.entries
    .filter((e) => e.day === day)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((e) => ({ ...e, categories: categoryOf(e.category_id) }))

  return {
    tasks,
    entries,
    categories: sortedCategories(),
    finishes: sortList(state.finishes.filter((f) => f.day === day)),
    ideas: sortList(state.ideas.filter((i) => i.day === day)),
    taskHistory: state.taskHistory
  }
}

export function fetchRange(start, end) {
  return {
    tasks: state.tasks.filter((t) => t.day >= start && t.day <= end),
    entries: state.entries
      .filter((e) => e.day >= start && e.day <= end)
      .map((e) => ({ ...e, categories: categoryOf(e.category_id) }))
  }
}

/* ---------- 待办 ---------- */

export function addTask(day, title) {
  const count = state.tasks.filter((t) => t.day === day).length
  state.tasks.push({
    id: uid(),
    day,
    title,
    status: 'planned',
    carried_from_id: null,
    sort_order: count,
    created_at: nowISO()
  })
  rememberTask(title)
  save()
}

export function setTaskStatus(id, status) {
  const t = state.tasks.find((x) => x.id === id)
  if (t) t.status = status
  save()
}

export function renameTask(id, title) {
  const t = state.tasks.find((x) => x.id === id)
  if (t) t.title = title
  save()
}

export function deleteTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id)
  state.notes = state.notes.filter((n) => n.task_id !== id)
  save()
}

/* ---------- 常用计划 ---------- */

function rememberTask(title) {
  if (!state.taskHistory) state.taskHistory = []
  if (state.taskHistory.some((h) => h.title === title)) return
  state.taskHistory.unshift({ id: uid(), title })
  if (state.taskHistory.length > 20) state.taskHistory = state.taskHistory.slice(0, 20)
}

export function clearTaskHistory() {
  state.taskHistory = []
  save()
}

export function removeTaskHistory(id) {
  state.taskHistory = state.taskHistory.filter((h) => h.id !== id)
  save()
}

/* ---------- 收获分点 ---------- */

export function addNote(taskId, kind, content) {
  const order = state.notes.filter((n) => n.task_id === taskId).length
  state.notes.push({
    id: uid(),
    task_id: taskId,
    kind,
    content,
    done: false,
    sort_order: order,
    created_at: nowISO()
  })
  if (kind === 'step') syncTaskFromSteps(taskId)
  save()
}

export function deleteNote(id) {
  const n = state.notes.find((x) => x.id === id)
  state.notes = state.notes.filter((x) => x.id !== id)
  if (n && n.kind === 'step') syncTaskFromSteps(n.task_id)
  save()
}

export function setNoteDone(id, done) {
  const n = state.notes.find((x) => x.id === id)
  if (n) {
    n.done = !!done
    if (n.kind === 'step') syncTaskFromSteps(n.task_id)
  }
  save()
}

function syncTaskFromSteps(taskId) {
  const t = state.tasks.find((x) => x.id === taskId)
  if (!t) return
  const steps = state.notes.filter((n) => n.task_id === taskId && n.kind === 'step')
  if (!steps.length) return
  t.status = steps.every((s) => s.done) ? 'done' : 'planned'
}

export function setTaskAllSteps(id, done) {
  const steps = state.notes.filter((n) => n.task_id === id && n.kind === 'step')
  steps.forEach((s) => {
    s.done = !!done
  })
  syncTaskFromSteps(id)
  save()
}

export function renameNote(id, content) {
  const n = state.notes.find((x) => x.id === id)
  if (n) n.content = content
  save()
}

/* ---------- 完成 / 灵感（结构相同的两种记录） ---------- */

function addJournal(listName, day, text) {
  state[listName].push({
    id: uid(),
    day,
    text,
    created_at: nowISO()
  })
  save()
}

function renameJournal(listName, id, text) {
  const it = state[listName].find((x) => x.id === id)
  if (it) it.text = text
  save()
}

function deleteJournal(listName, id) {
  state[listName] = state[listName].filter((x) => x.id !== id)
  save()
}

export function addFinish(day, text) {
  addJournal('finishes', day, text)
}
export function renameFinish(id, text) {
  renameJournal('finishes', id, text)
}
export function deleteFinish(id) {
  deleteJournal('finishes', id)
}

export function addIdea(day, text) {
  addJournal('ideas', day, text)
}
export function renameIdea(id, text) {
  renameJournal('ideas', id, text)
}
export function deleteIdea(id) {
  deleteJournal('ideas', id)
}

/* ---------- Deadline（中期任务） ---------- */

export function fetchDeadlines() {
  return [...state.deadlines].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const da = a.due_date || '9999-12-31'
    const db = b.due_date || '9999-12-31'
    return da.localeCompare(db)
  })
}

export function addDeadline(title, dueDate, dueTime) {
  state.deadlines.push({
    id: uid(),
    title,
    due_date: dueDate || null,
    due_time: dueTime || null,
    done: false,
    created_at: nowISO()
  })
  save()
}

export function renameDeadline(id, title) {
  const d = state.deadlines.find((x) => x.id === id)
  if (d) d.title = title
  save()
}

export function setDeadlineDone(id, done) {
  const d = state.deadlines.find((x) => x.id === id)
  if (d) d.done = !!done
  save()
}

export function setDeadlineDue(id, dueDate) {
  const d = state.deadlines.find((x) => x.id === id)
  if (d) d.due_date = dueDate || null
  save()
}

export function setDeadlineTime(id, dueTime) {
  const d = state.deadlines.find((x) => x.id === id)
  if (d) d.due_time = dueTime || null
  save()
}

export function deleteDeadline(id) {
  state.deadlines = state.deadlines.filter((x) => x.id !== id)
  save()
}

/* ---------- Inbox（随手记 / 心愿，跨天延续） ---------- */

export function fetchInbox() {
  return [...state.inbox].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return (a.created_at || '').localeCompare(b.created_at || '')
  })
}

export function addInbox(content) {
  state.inbox.push({
    id: uid(),
    content,
    done: false,
    created_at: nowISO()
  })
  save()
}

export function renameInbox(id, content) {
  const it = state.inbox.find((x) => x.id === id)
  if (it) it.content = content
  save()
}

export function setInboxDone(id, done) {
  const it = state.inbox.find((x) => x.id === id)
  if (it) it.done = !!done
  save()
}

export function deleteInbox(id) {
  state.inbox = state.inbox.filter((x) => x.id !== id)
  save()
}

/* ---------- 记账 ---------- */

export function addEntry(day, amount, categoryId, note) {
  state.entries.push({
    id: uid(),
    day,
    amount: Number(amount),
    category_id: categoryId || null,
    note: note || null,
    created_at: nowISO()
  })
  if (categoryId) {
    const c = state.categories.find((x) => x.id === categoryId)
    if (c) c.last_used_at = nowISO()
  }
  save()
}

export function deleteEntry(id) {
  const entry = state.entries.find((e) => e.id === id)
  state.entries = state.entries.filter((e) => e.id !== id)
  save()
  return entry
}

export function restoreEntry(entry) {
  if (!entry) return
  state.entries.push(entry)
  save()
}

/* ---------- 分类 ---------- */

export function listCategories() {
  return sortedCategories()
}

export function addCategory(name) {
  state.categories.push({
    id: uid(),
    name,
    archived: false,
    sort_order: state.categories.length,
    last_used_at: null
  })
  save()
}

export function renameCategory(id, name) {
  const c = state.categories.find((x) => x.id === id)
  if (c) c.name = name
  save()
}

export function toggleCategoryArchive(id) {
  const c = state.categories.find((x) => x.id === id)
  if (c) c.archived = !c.archived
  save()
}

/* ---------- 备份 ---------- */

export function exportJSON() {
  return JSON.stringify({ app: 'today', version: 3, exported_at: nowISO(), data: state }, null, 2)
}

export function importJSON(text) {
  const parsed = JSON.parse(text)
  const d = parsed.data || parsed
  state = {
    tasks: d.tasks || [],
    notes: d.notes || [],
    entries: d.entries || [],
    categories: d.categories && d.categories.length ? d.categories : initial().categories,
    finishes: d.finishes || [],
    ideas: d.ideas || [],
    deadlines: d.deadlines || [],
    inbox: d.inbox || [],
    taskHistory: d.taskHistory || []
  }
  save()
  return {
    tasks: state.tasks.length,
    entries: state.entries.length
  }
}