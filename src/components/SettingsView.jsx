import { useEffect, useRef, useState } from 'react'
import {
  addCategory,
  exportJSON,
  importJSON,
  listCategories,
  renameCategory,
  toggleCategoryArchive
} from '../lib/db'
import { downloadReport } from '../lib/report'
import { isRemindOn, setRemindOn, requestNotifyPermission, notifyPermission } from '../lib/reminders'

export default function SettingsView({ dayStart, onChangeDayStart }) {
  const [cats, setCats] = useState([])
  const [newName, setNewName] = useState('')
  const [hint, setHint] = useState('')
  const fileRef = useRef(null)
  const [deadlineOn, setDeadlineOn] = useState(() => isRemindOn('deadline'))
  const [summaryOn, setSummaryOn] = useState(() => isRemindOn('summary'))
  const [notifyState, setNotifyState] = useState(notifyPermission)

  const toggleDeadline = () => {
    const v = !deadlineOn
    setDeadlineOn(v)
    setRemindOn('deadline', v)
  }
  const toggleSummary = () => {
    const v = !summaryOn
    setSummaryOn(v)
    setRemindOn('summary', v)
  }
  const handleNotify = async () => {
    if (notifyState === 'granted') return
    const p = await requestNotifyPermission()
    setNotifyState(p)
    setHint(
      p === 'granted'
        ? '已开启系统通知'
        : p === 'denied'
          ? '通知被浏览器拒绝，可在浏览器设置里放行'
          : '此浏览器暂不支持系统通知，改用页面内提醒'
    )
  }

  const load = () => setCats(listCategories())

  useEffect(() => {
    load()
  }, [])

  const rename = (id, name) => {
    const v = name.trim()
    if (!v) return load()
    renameCategory(id, v)
    load()
  }

  const add = (e) => {
    e.preventDefault()
    const v = newName.trim()
    if (!v) return
    addCategory(v)
    setNewName('')
    load()
  }

  const exportBackup = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `today-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
    setHint('已导出备份文件')
  }

  const exportReport = (mode) => {
    downloadReport(mode, dayStart)
    setHint(mode === 'week' ? '已导出周报' : '已导出月报')
  }

  const importBackup = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const result = importJSON(String(reader.result))
        load()
        setHint(`已导入 ${result.tasks} 个待办、${result.entries} 笔账`)
      } catch {
        setHint('文件格式不对，导入失败')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <>
      <section className="section first">
        <div className="section-head">
          <h2 className="section-title">记账分类</h2>
          <span className="section-meta">修改后自动保存</span>
        </div>

        <div className="card">
          {cats.map((c) => (
            <div className={`cat-edit${c.archived ? ' archived' : ''}`} key={c.id}>
              <input
                key={`${c.id}-${c.name}`}
                defaultValue={c.name}
                onBlur={(e) => rename(c.id, e.target.value)}
              />
              <button className="text-btn" onClick={() => { toggleCategoryArchive(c.id); load() }}>
                {c.archived ? '恢复' : '归档'}
              </button>
            </div>
          ))}

          <form className="add-row" onSubmit={add}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新增分类，比如 房租"
            />
            <button type="submit" aria-label="添加">+</button>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">一天的起点</h2>
        </div>
        <div className="card plain-row">
          <span>凌晨几点算新的一天</span>
          <select value={dayStart} onChange={(e) => onChangeDayStart(Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5, 6].map((h) => (
              <option key={h} value={h}>{h}:00</option>
            ))}
          </select>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">提醒</h2>
          <span className="section-meta">网页打开时到点提醒</span>
        </div>
        <div className="card">
          <p className="backup-text">
            纯前端没有服务器推送，需要网页 / 主屏幕 App 处于打开状态才会提醒。
          </p>
          <div className="set-row">
            <span>截止日期提醒</span>
            <button type="button" className={`switch${deadlineOn ? ' on' : ''}`} onClick={toggleDeadline} aria-label="截止日期提醒" aria-pressed={deadlineOn} />
          </div>
          <div className="set-row">
            <span>每日 23:00 总结</span>
            <button type="button" className={`switch${summaryOn ? ' on' : ''}`} onClick={toggleSummary} aria-label="每日总结" aria-pressed={summaryOn} />
          </div>
          <div className="set-row">
            <span>系统通知</span>
            <button className="ghost" onClick={handleNotify}>
              {notifyState === 'granted' ? '已开启' : notifyState === 'denied' ? '已拒绝' : notifyState === 'unsupported' ? '不支持' : '去开启'}
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">报告</h2>
          <span className="section-meta">可视化周报 / 月报</span>
        </div>
        <div className="card backup">
          <p className="backup-text">
            导出一个图文报告文件（HTML），手机 / 电脑浏览器点开就能看，还能打印存成 PDF。
          </p>
          <div className="backup-actions">
            <button className="ghost" onClick={() => exportReport('week')}>导出周报</button>
            <button className="ghost" onClick={() => exportReport('month')}>导出月报</button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">备份</h2>
          <span className="section-meta">数据只存在这台手机上</span>
        </div>
        <div className="card backup">
          <p className="backup-text">
            记录保存在本机浏览器里。清理浏览器缓存或换手机前，先导出一份。
          </p>
          <div className="backup-actions">
            <button className="ghost" onClick={exportBackup}>导出备份</button>
            <button className="ghost" onClick={() => fileRef.current?.click()}>导入备份</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={importBackup} hidden />
          {hint && <p className="backup-hint">{hint}</p>}
        </div>
      </section>
    </>
  )
}
