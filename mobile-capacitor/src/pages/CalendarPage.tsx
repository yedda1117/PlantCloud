import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Loader2, Plus, Save, Sprout, Upload, X } from "lucide-react"
import { getCalendarDayDetail, getCalendarSummary, updateCalendarDayLog, uploadPlantPhoto } from "../api"
import type { CalendarDayDetail, CalendarSummary, Plant } from "../types"
import { impact } from "../mobile-utils"

const milestones = [
  { id: "", label: "日常", apiValue: null, tone: "sage" },
  { id: "SPROUT", label: "萌芽", apiValue: "SPROUT", tone: "sprout" },
  { id: "FLOWER", label: "开花", apiValue: "FLOWER", tone: "flower" },
  { id: "FRUIT", label: "结果", apiValue: "FRUIT", tone: "fruit" },
  { id: "REPOT", label: "换盆", apiValue: "REPOT", tone: "repot" },
] as const

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

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月`
}

function formatDayLabel(date: string) {
  const [, month, day] = date.match(/^\d{4}-(\d{2})-(\d{2})$/) || []
  return month && day ? `${Number(month)}月${Number(day)}日` : date
}

function getMilestone(id: string | null | undefined) {
  return milestones.find((item) => item.id === id) || milestones[0]
}

function NoteCard({ detail, summary, onOpen }: { detail: CalendarDayDetail; summary?: CalendarSummary; onOpen: () => void }) {
  const milestone = getMilestone(detail.milestone || summary?.milestone)
  const imageUrl = detail.photoUrl || detail.originPhotoUrl || summary?.thumbnailUrl || ""
  const note = detail.note?.trim()

  return (
    <motion.button className="note-card" whileTap={{ scale: 0.985 }} onClick={onOpen}>
      <div className="note-card-head">
        <div>
          <p>{formatDayLabel(detail.date)}</p>
          <strong>{note || "植物小记"}</strong>
        </div>
        {milestone.id ? <span className={`milestone-badge ${milestone.tone}`}>{milestone.label}</span> : null}
      </div>

      {imageUrl ? (
        <img className="note-photo" src={imageUrl} alt={`${formatDayLabel(detail.date)}植物照片`} />
      ) : (
        <div className="note-photo-placeholder">
          <Camera size={20} />
          <span>暂无照片</span>
        </div>
      )}

      <p className="note-excerpt">{note || "暂无记录"}</p>
    </motion.button>
  )
}

export function CalendarPage({ plant }: { plant: Plant }) {
  const today = useMemo(() => new Date(), [])
  const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [summary, setSummary] = useState<Record<number, CalendarSummary>>({})
  const [detailsByDay, setDetailsByDay] = useState<Record<number, CalendarDayDetail>>({})
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [formDate, setFormDate] = useState(() => formatDate(today.getFullYear(), today.getMonth(), today.getDate()))
  const [formDetail, setFormDetail] = useState<CalendarDayDetail | null>(null)
  const [note, setNote] = useState("")
  const [milestone, setMilestone] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthValue = `${year}-${String(month + 1).padStart(2, "0")}`
  const records = useMemo(
    () =>
      Object.values(detailsByDay)
        .filter((item) => item.hasPhoto || item.note?.trim() || item.milestone)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [detailsByDay],
  )

  const loadMonth = useCallback(async () => {
    setLoadingMonth(true)
    try {
      const monthSummary = await getCalendarSummary(plant.plantId, year, month + 1)
      const summaryMap = Object.fromEntries(monthSummary.map((record) => [dayFromDate(record.date), record]))
      setSummary(summaryMap)

      const monthDetails = await Promise.all(
        monthSummary.map(async (record) => {
          try {
            return await getCalendarDayDetail(plant.plantId, record.date)
          } catch {
            return createEmptyDetail(plant.plantId, record.date)
          }
        }),
      )
      setDetailsByDay(Object.fromEntries(monthDetails.map((record) => [dayFromDate(record.date), record])))
    } catch {
      setSummary({})
      setDetailsByDay({})
    } finally {
      setLoadingMonth(false)
    }
  }, [month, plant.plantId, year])

  useEffect(() => {
    void loadMonth()
  }, [loadMonth])

  useEffect(() => {
    if (!sheetOpen) return
    let active = true
    setMessage("")
    getCalendarDayDetail(plant.plantId, formDate)
      .then((data) => {
        if (!active) return
        setFormDetail(data)
        setNote(data.note ?? "")
        setMilestone(data.milestone ?? "")
      })
      .catch(() => {
        if (!active) return
        const empty = createEmptyDetail(plant.plantId, formDate)
        setFormDetail(empty)
        setNote("")
        setMilestone("")
      })
    return () => {
      active = false
    }
  }, [formDate, plant.plantId, sheetOpen])

  const shiftMonth = (offset: number) => {
    impact()
    setCurrentDate(new Date(year, month + offset, 1))
  }

  const openSheet = (date = formatDate(year, month, Math.min(today.getDate(), new Date(year, month + 1, 0).getDate()))) => {
    impact()
    setFormDate(date)
    setSheetOpen(true)
  }

  const closeSheet = () => {
    impact()
    setSheetOpen(false)
  }

  const saveLog = async () => {
    setSaving(true)
    setMessage("")
    try {
      const updated = await updateCalendarDayLog(plant.plantId, formDate, { note: note.trim(), milestone: milestone || null })
      setFormDetail(updated)
      setMessage("记录已保存")
      await loadMonth()
      setSheetOpen(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const uploadPhoto = async (files: FileList | null) => {
    if (!files?.length || uploading) return
    setUploading(true)
    setMessage("正在上传照片...")
    try {
      const form = new FormData()
      form.append("plant_id", String(plant.plantId))
      form.append("date", formDate)
      form.append("photo", files[0])
      if (note.trim()) form.append("note", note.trim())
      if (milestone) form.append("milestone", milestone)
      await uploadPlantPhoto(form)
      const detail = await getCalendarDayDetail(plant.plantId, formDate)
      setFormDetail(detail)
      setMessage("照片已加入记录")
      await loadMonth()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败")
    } finally {
      setUploading(false)
      if (photoInputRef.current) photoInputRef.current.value = ""
    }
  }

  return (
    <main className="screen calendar-screen">
      <div className="calendar-fixed-head">
        <header className="calendar-top-bar">
          <div className="month-switcher">
            <button onClick={() => shiftMonth(-1)} aria-label="上个月">
              <ChevronLeft size={18} />
            </button>
            <label>
              <span>{formatMonthLabel(currentDate)}</span>
              <input
                type="month"
                value={monthValue}
                onChange={(event) => {
                  const [nextYear, nextMonth] = event.target.value.split("-").map(Number)
                  if (nextYear && nextMonth) setCurrentDate(new Date(nextYear, nextMonth - 1, 1))
                }}
                aria-label="选择年月"
              />
            </label>
            <button onClick={() => shiftMonth(1)} aria-label="下个月">
              <ChevronRight size={18} />
            </button>
          </div>

          <button className="new-record-button" onClick={() => openSheet()} aria-label="新建记录">
            <Plus size={18} />
          </button>
        </header>

        <section className="calendar-summary-card">
          <div>
            <p>Plant Calendar</p>
            <h1>{plant.plantName} 的养护记录</h1>
          </div>
          <span>{loadingMonth ? "同步中" : `${records.length} 条记录`}</span>
        </section>
      </div>

      <section className="note-feed">
        {loadingMonth ? (
          <div className="calendar-loading">
            <Loader2 size={15} className="spin" />
            正在整理这个月的记录
          </div>
        ) : null}

        {!loadingMonth && records.length === 0 ? (
          <button className="empty-note-card" onClick={() => openSheet()}>
            <Sprout size={24} />
            <strong>这个月还没有记录</strong>
            <span>写下第一条变化，给植物留一点时间的证据。</span>
          </button>
        ) : null}

        {records.map((record) => (
          <NoteCard key={record.date} detail={record} summary={summary[dayFromDate(record.date)]} onOpen={() => openSheet(record.date)} />
        ))}
      </section>

      <AnimatePresence>
        {sheetOpen ? (
          <motion.div className="calendar-sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeSheet}>
            <motion.section
              className="calendar-sheet"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", damping: 24, stiffness: 260 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sheet-handle" />
              <div className="sheet-head">
                <div>
                  <p>Plant Note</p>
                  <h2>新建记录</h2>
                </div>
                <button className="modal-close" onClick={closeSheet} aria-label="关闭">
                  <X size={17} />
                </button>
              </div>

              <label className="field-label">
                日期
                <input type="date" value={formDate} onChange={(event) => setFormDate(event.target.value)} />
              </label>

              <div className="field-label">
                里程碑
                <div className="milestone-row mobile">
                  {milestones.map((item) => (
                    <button key={item.id || "none"} className={milestone === item.id ? "active" : ""} onClick={() => setMilestone(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className="photo-upload-box" onClick={() => photoInputRef.current?.click()} disabled={uploading}>
                {formDetail?.hasPhoto && (formDetail.photoUrl || formDetail.originPhotoUrl) ? (
                  <img src={formDetail.photoUrl || formDetail.originPhotoUrl || ""} alt="已上传的植物照片" />
                ) : (
                  <span>
                    {uploading ? <Loader2 size={20} className="spin" /> : <ImagePlus size={20} />}
                    {uploading ? "上传中..." : "添加植物照片"}
                  </span>
                )}
              </button>

              <label className="field-label">
                备注
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录今天的变化..." />
              </label>

              {message ? <p className="calendar-message">{message}</p> : null}

              <div className="sheet-actions">
                <button onClick={closeSheet}>取消</button>
                <button onClick={() => void saveLog()} disabled={saving}>
                  {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                  保存
                </button>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={(event) => void uploadPhoto(event.target.files)} />
    </main>
  )
}
