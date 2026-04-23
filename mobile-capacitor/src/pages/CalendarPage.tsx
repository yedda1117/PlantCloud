import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Camera, ChevronLeft, ChevronRight, Droplets, Flower2, Loader2, Save, Sprout, Sun, Thermometer, Upload } from "lucide-react"
import { getCalendarDayDetail, getCalendarSummary, updateCalendarDayLog, uploadPlantPhoto } from "../api"
import type { CalendarDayDetail, CalendarSummary, Plant } from "../types"
import { formatLight, formatNumber, impact } from "../mobile-utils"

const weekDays = ["日", "一", "二", "三", "四", "五", "六"]

const milestones = [
  { id: "", label: "无阶段", apiValue: null, icon: Sprout },
  { id: "SPROUT", label: "发芽", apiValue: "SPROUT", icon: Sprout },
  { id: "FLOWER", label: "开花", apiValue: "FLOWER", icon: Flower2 },
  { id: "FRUIT", label: "结果", apiValue: "FRUIT", icon: Sun },
]

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function createEmptyDetail(plantId: number, date: string): CalendarDayDetail {
  return {
    plantId,
    date,
    photoUrl: null,
    originPhotoUrl: null,
    note: null,
    milestone: null,
    temperature: null,
    humidity: null,
    light: null,
    hasPhoto: false,
  }
}

function dayFromDate(date: string) {
  const matched = date.match(/-(\d{2})$/)
  return matched ? Number(matched[1]) : new Date(date).getDate()
}

export function CalendarPage({ plant }: { plant: Plant }) {
  const today = useMemo(() => new Date(), [])
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [summary, setSummary] = useState<Record<number, CalendarSummary>>({})
  const [detail, setDetail] = useState<CalendarDayDetail | null>(null)
  const [note, setNote] = useState("")
  const [milestone, setMilestone] = useState<string>("")
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const selectedDate = formatDate(year, month, selectedDay)

  const calendarCells = useMemo(() => {
    const cells: Array<number | null> = Array.from({ length: firstDay }, () => null)
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [daysInMonth, firstDay])

  const loadMonth = useCallback(async () => {
    setLoadingMonth(true)
    try {
      const records = await getCalendarSummary(plant.plantId, year, month + 1)
      setSummary(Object.fromEntries(records.map((record) => [dayFromDate(record.date), record])))
    } catch {
      setSummary({})
    } finally {
      setLoadingMonth(false)
    }
  }, [month, plant.plantId, year])

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true)
    try {
      const data = await getCalendarDayDetail(plant.plantId, selectedDate)
      setDetail(data)
      setNote(data.note ?? "")
      setMilestone(data.milestone ?? "")
    } catch {
      const emptyDetail = createEmptyDetail(plant.plantId, selectedDate)
      setDetail(emptyDetail)
      setNote("")
      setMilestone("")
    } finally {
      setLoadingDetail(false)
    }
  }, [plant.plantId, selectedDate])

  useEffect(() => {
    void loadMonth()
  }, [loadMonth])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const shiftMonth = (offset: number) => {
    impact()
    const next = new Date(year, month + offset, 1)
    setCurrentDate(next)
    setSelectedDay(1)
  }

  const saveLog = async () => {
    setSaving(true)
    setMessage("")
    try {
      const updated = await updateCalendarDayLog(plant.plantId, selectedDate, { note, milestone: milestone || null })
      setDetail(updated)
      setMessage("记录已保存")
      await loadMonth()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const uploadPhoto = async (files: FileList | null) => {
    if (!files?.length || uploading) return
    setUploading(true)
    setMessage("正在上传图片并调用 SmartJavaAI 处理...")
    try {
      const form = new FormData()
      form.append("plant_id", String(plant.plantId))
      form.append("date", selectedDate)
      form.append("photo", files[0])
      if (note.trim()) form.append("note", note.trim())
      if (milestone) form.append("milestone", milestone)
      await uploadPlantPhoto(form)
      setMessage("图片已上传，记录已更新")
      await loadMonth()
      await loadDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片上传失败")
    } finally {
      setUploading(false)
      if (photoInputRef.current) photoInputRef.current.value = ""
    }
  }

  const selectedMilestone = milestones.find((item) => item.id === milestone) || milestones[0]

  return (
    <main className="screen calendar-screen">
      <section className="calendar-hero">
        <div>
          <p>Plant Calendar</p>
          <h1>{plant.plantName} 生长日历</h1>
          <span>{year} 年 {month + 1} 月</span>
        </div>
        <div className="calendar-month-actions">
          <button onClick={() => shiftMonth(-1)} aria-label="上个月">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => shiftMonth(1)} aria-label="下个月">
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      <section className="calendar-card">
        <div className="calendar-week-row">
          {weekDays.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid">
          {calendarCells.map((day, index) => {
            const record = day ? summary[day] : null
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            const isSelected = day === selectedDay
            return (
              <button
                key={`${day ?? "blank"}-${index}`}
                disabled={!day}
                className={`${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${record?.hasPhoto ? "has-photo" : ""}`}
                onClick={() => {
                  if (!day) return
                  impact()
                  setSelectedDay(day)
                }}
              >
                {day ? <strong>{day}</strong> : null}
                {record?.milestone ? <i /> : null}
                {record?.hasPhoto ? <Camera size={12} /> : null}
              </button>
            )
          })}
        </div>
        {loadingMonth ? <div className="calendar-loading"><Loader2 size={15} className="spin" /> 同步月视图</div> : null}
      </section>

      <section className="day-detail-card">
        <div className="day-detail-head">
          <div>
            <p>{selectedDate}</p>
            <h2>{loadingDetail ? "正在加载..." : selectedMilestone.label}</h2>
          </div>
          <button onClick={() => photoInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
            上传
          </button>
        </div>

        {detail?.hasPhoto && (detail.photoUrl || detail.originPhotoUrl) ? (
          <img className="calendar-photo" src={detail.photoUrl || detail.originPhotoUrl || ""} alt={`${selectedDate} 植物照片`} />
        ) : (
          <div className="photo-placeholder">
            <Camera size={22} />
            <span>这一天还没有照片</span>
          </div>
        )}

        <div className="calendar-env-grid">
          <span><Thermometer size={14} />{formatNumber(detail?.temperature, "°C")}</span>
          <span><Droplets size={14} />{formatNumber(detail?.humidity, "%")}</span>
          <span><Sun size={14} />{formatLight(detail?.light)}</span>
        </div>

        <div className="milestone-row">
          {milestones.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id || "none"} className={milestone === item.id ? "active" : ""} onClick={() => setMilestone(item.id)}>
                <Icon size={14} />
                {item.label}
              </button>
            )
          })}
        </div>

        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录今天的生长变化、叶片状态或养护操作..." />

        <button className="save-log-button" onClick={() => void saveLog()} disabled={saving}>
          {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
          {saving ? "保存中..." : "保存记录"}
        </button>
        {message ? <p className="calendar-message">{message}</p> : null}
      </section>

      <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={(event) => void uploadPhoto(event.target.files)} />
    </main>
  )
}

