"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import {
  getCalendarDayDetail,
  getCalendarSummary,
  updateCalendarDayLog,
  uploadPlantPhoto,
  deletePlantPhoto,
  ApiError,
  type CalendarDayDetail,
} from "@/lib/calendar-api"
import { usePlantSelection } from "@/context/plant-selection"
import {
  ChevronLeft,
  ChevronRight,
  Thermometer,
  Droplets,
  Sun,
  Sprout,
  Flower2,
  Apple,
  FlowerIcon,
  Upload,
  RefreshCw,
  Trash2,
  ImageIcon,
  Plus,
  CalendarDays,
  StickyNote,
} from "lucide-react"

const milestones = [
  { id: "sprout", apiValue: "SPROUT", label: "萌芽", icon: Sprout, color: "text-green-500" },
  { id: "flower", apiValue: "FLOWER", label: "开花", icon: Flower2, color: "text-pink-500" },
  { id: "fruit", apiValue: "FRUIT", label: "结果", icon: Apple, color: "text-orange-500" },
  { id: "repot", apiValue: "REPOT", label: "换盆", icon: FlowerIcon, color: "text-amber-600" },
]

const weekDays = ["日", "一", "二", "三", "四", "五", "六"]
const ROWS = 6

type DayRecord = {
  hasPhoto: boolean
  photoUrl?: string
  originalPhotoUrl?: string
  milestone?: string
  note?: string
  temp?: number
  humidity?: number
  light?: number
  aiStatus?: "idle" | "processing" | "done" | "fallback" | "error"
}

type ViewMode = "calendar" | "board"

type NoteBoardItem = {
  day: number
  date: string
  photoUrl: string
  note: string
  milestone: string | undefined
}

function milestoneFromApi(value?: string | null) {
  return milestones.find((item) => item.apiValue === value)?.id
}

function milestoneToApi(value?: string | null) {
  return milestones.find((item) => item.id === value)?.apiValue
}

function getMilestoneLabel(milestoneId?: string) {
  return milestones.find((item) => item.id === milestoneId)?.label
}

function getMilestoneStyle(milestoneId?: string) {
  switch (milestoneId) {
    case "fruit":
      return {
        paper: "bg-[linear-gradient(180deg,#fff1df_0%,#ffe8c6_100%)]",
        tape: "bg-orange-200/80",
        accent: "text-orange-700",
        shadow: "shadow-[0_18px_34px_rgba(251,146,60,0.16)]",
        bgColor: "#ffe8c6",
      }
    case "flower":
      return {
        paper: "bg-[linear-gradient(180deg,#fff1f7_0%,#ffe4ef_100%)]",
        tape: "bg-pink-200/80",
        accent: "text-pink-700",
        shadow: "shadow-[0_18px_34px_rgba(236,72,153,0.14)]",
        bgColor: "#ffe4ef",
      }
    case "sprout":
      return {
        paper: "bg-[linear-gradient(180deg,#effbec_0%,#dcfce7_100%)]",
        tape: "bg-emerald-200/80",
        accent: "text-emerald-700",
        shadow: "shadow-[0_18px_34px_rgba(34,197,94,0.14)]",
        bgColor: "#dcfce7",
      }
    case "repot":
      return {
        paper: "bg-[linear-gradient(180deg,#f5ede3_0%,#e8ddd1_100%)]",
        tape: "bg-amber-200/80",
        accent: "text-amber-800",
        shadow: "shadow-[0_18px_34px_rgba(217,119,6,0.14)]",
        bgColor: "#e8ddd1",
      }
    default:
      return {
        paper: "bg-[linear-gradient(180deg,#fffaf0_0%,#fff4da_100%)]",
        tape: "bg-amber-200/75",
        accent: "text-amber-700",
        shadow: "shadow-[0_18px_34px_rgba(217,119,6,0.12)]",
        bgColor: "#fff4da",
      }
  }
}

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

function detailToDayRecord(detail: CalendarDayDetail | null): DayRecord {
  if (!detail) {
    return { hasPhoto: false }
  }
  return {
    hasPhoto: detail.hasPhoto,
    photoUrl: detail.photoUrl ?? undefined,
    originalPhotoUrl: detail.originPhotoUrl ?? undefined,
    milestone: milestoneFromApi(detail.milestone) ?? undefined,
    note: detail.note ?? "",
    temp: detail.temperature ?? undefined,
    humidity: detail.humidity ?? undefined,
    light: detail.light ?? undefined,
    aiStatus: "done",
  }
}

export default function CalendarPage() {
  const { currentPlant } = usePlantSelection()
  const currentPlantApiId = currentPlant.plantId

  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<ViewMode>("board")
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([])
  const [noteText, setNoteText] = useState("")
  const [calendarData, setCalendarData] = useState<Record<number, DayRecord>>({})
  const [boardDetails, setBoardDetails] = useState<Record<number, CalendarDayDetail>>({})
  const [selectedDayDetail, setSelectedDayDetail] = useState<CalendarDayDetail | null>(null)
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
  const [isMonthLoading, setIsMonthLoading] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isBoardLoading, setIsBoardLoading] = useState(false)
  const [photoProcessMessage, setPhotoProcessMessage] = useState("")

  const gridRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rowHeight, setRowHeight] = useState(0)

  useEffect(() => {
    const update = () => {
      if (gridRef.current) {
        const totalHeight = gridRef.current.clientHeight
        setRowHeight(Math.floor((totalHeight - 8 * 5) / ROWS))
      }
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const realToday = new Date()
  const today = realToday.getFullYear() === year && realToday.getMonth() === month ? realToday.getDate() : null

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const calendarCells: (number | null)[] = []
  for (let i = 0; i < firstDayOfMonth; i++) calendarCells.push(null)
  for (let day = 1; day <= daysInMonth; day++) calendarCells.push(day)
  while (calendarCells.length < 42) calendarCells.push(null)

  const syncDetailState = useCallback((detail: CalendarDayDetail | null) => {
    setSelectedDayDetail(detail)
    setNoteText(detail?.note ?? "")
    const milestone = milestoneFromApi(detail?.milestone)
    setSelectedMilestones(milestone ? [milestone] : [])
  }, [])

  const loadMonthSummary = useCallback(async () => {
    setIsMonthLoading(true)
    try {
      const records = await getCalendarSummary(currentPlantApiId, year, month + 1)
      const nextData: Record<number, DayRecord> = {}
      records.forEach((record) => {
        const day = new Date(record.date).getDate()
        nextData[day] = {
          hasPhoto: record.hasPhoto,
          photoUrl: record.thumbnailUrl ?? undefined,
          milestone: milestoneFromApi(record.milestone) ?? undefined,
        }
      })
      setCalendarData(nextData)
    } catch (error) {
      setCalendarData({})
      toast({
        title: "加载失败",
        description: error instanceof Error ? error.message : "月历数据加载失败",
        variant: "destructive",
      })
    } finally {
      setIsMonthLoading(false)
    }
  }, [currentPlantApiId, year, month])

  useEffect(() => {
    void loadMonthSummary()
  }, [loadMonthSummary])

  useEffect(() => {
    setBoardDetails({})
  }, [currentPlantApiId, year, month])

  const loadDayDetail = useCallback(async (day: number) => {
    const date = formatDate(year, month, day)
    setIsDetailLoading(true)
    try {
      const detail = await getCalendarDayDetail(currentPlantApiId, date)
      syncDetailState(detail)
      return detail
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        const emptyDetail = createEmptyDetail(currentPlantApiId, date)
        syncDetailState(emptyDetail)
        return emptyDetail
      }
      syncDetailState(null)
      toast({
        title: "加载失败",
        description: error instanceof Error ? error.message : "详情数据加载失败",
        variant: "destructive",
      })
      return null
    } finally {
      setIsDetailLoading(false)
    }
  }, [currentPlantApiId, year, month, syncDetailState])

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const handleToday = () => setCurrentDate(new Date())

  const handleDayClick = (day: number) => {
    setSelectedDay(day)
    const summary = calendarData[day]
    setNoteText(summary?.note ?? "")
    setSelectedMilestones(summary?.milestone ? [summary.milestone] : [])
    setSelectedDayDetail(null)
    setPhotoProcessMessage("")
    setDialogOpen(true)
    void loadDayDetail(day)
  }

  const selectedDayRecord =
    selectedDayDetail && selectedDay === Number.parseInt(selectedDayDetail.date.slice(-2), 10)
      ? detailToDayRecord(selectedDayDetail)
      : (selectedDay ? calendarData[selectedDay] : undefined) ?? { hasPhoto: false }

  const handlePhotoButtonClick = () => {
    if (!selectedDay || isProcessingPhoto) return
    fileInputRef.current?.click()
  }

  const refreshCurrentViews = useCallback(async () => {
    await loadMonthSummary()
    if (selectedDay) {
      await loadDayDetail(selectedDay)
    }
  }, [loadDayDetail, loadMonthSummary, selectedDay])

  const photoDays = useMemo(
    () =>
      Object.entries(calendarData)
        .map(([day, value]) => ({ day: Number(day), value }))
        .filter(({ value }) => value.hasPhoto && Boolean(value.photoUrl))
        .sort((a, b) => a.day - b.day),
    [calendarData],
  )

  useEffect(() => {
    if (viewMode !== "board") {
      return
    }

    let cancelled = false
    const loadBoardDetails = async () => {
      setIsBoardLoading(true)
      try {
        const dates = photoDays.map(({ day }) => ({
          day,
          date: formatDate(year, month, day),
        }))
        const details = await Promise.all(
          dates.map(async ({ day, date }) => {
            try {
              const detail = await getCalendarDayDetail(currentPlantApiId, date)
              return [day, detail] as const
            } catch (error) {
              if (error instanceof ApiError && error.status === 404) {
                return [day, createEmptyDetail(currentPlantApiId, date)] as const
              }
              throw error
            }
          }),
        )

        if (cancelled) {
          return
        }

        setBoardDetails(Object.fromEntries(details))
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "记录视图加载失败",
            description: error instanceof Error ? error.message : "便利贴记录加载失败",
            variant: "destructive",
          })
        }
      } finally {
        if (!cancelled) {
          setIsBoardLoading(false)
        }
      }
    }

    void loadBoardDetails()

    return () => {
      cancelled = true
    }
  }, [viewMode, photoDays, currentPlantApiId, year, month])

  const handlePhotoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !selectedDay) return

    setIsProcessingPhoto(true)
    setPhotoProcessMessage("正在上传图片并调用 SmartJavaAI 处理...")

    try {
      const form = new FormData()
      form.append("plant_id", String(currentPlantApiId))
      form.append("date", formatDate(year, month, selectedDay))
      form.append("photo", file)
      form.append("note", noteText)
      const milestone = milestoneToApi(selectedMilestones[0])
      if (milestone) {
        form.append("milestone", milestone)
      }

      const result = await uploadPlantPhoto(form)
      await refreshCurrentViews()

      setPhotoProcessMessage(
        result.aiStatus === "DONE"
          ? "SmartJavaAI 处理完成，图片已更新"
          : "图片已上传，后端已返回最新结果",
      )
    } catch (error) {
      setPhotoProcessMessage(error instanceof Error ? error.message : "图片上传失败")
      toast({
        title: "上传失败",
        description: error instanceof Error ? error.message : "图片上传失败",
        variant: "destructive",
      })
    } finally {
      setIsProcessingPhoto(false)
    }
  }

  const handleDeletePhoto = async () => {
    if (!selectedDay) return
    try {
      await deletePlantPhoto(currentPlantApiId, formatDate(year, month, selectedDay))
      setPhotoProcessMessage("")
      await refreshCurrentViews()
    } catch (error) {
      toast({
        title: "删除失败",
        description: error instanceof Error ? error.message : "图片删除失败",
        variant: "destructive",
      })
    }
  }

  const handleViewPhoto = () => {
    const photoUrl = selectedDayRecord.photoUrl
    if (photoUrl) {
      window.open(photoUrl, "_blank", "noopener,noreferrer")
    }
  }

  const handleSave = async () => {
    if (!selectedDay) return

    try {
      const updatedDetail = await updateCalendarDayLog(
        currentPlantApiId,
        formatDate(year, month, selectedDay),
        {
          note: noteText,
          milestone: milestoneToApi(selectedMilestones[0]) ?? null,
        },
      )
      syncDetailState(updatedDetail)
      await loadMonthSummary()
      setDialogOpen(false)
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "备注或里程碑保存失败",
        variant: "destructive",
      })
    }
  }

  const getMilestoneIcon = (milestoneId: string) => {
    const milestone = milestones.find((m) => m.id === milestoneId)
    if (!milestone) return null
    const Icon = milestone.icon
    return <Icon className={`h-4 w-4 ${milestone.color}`} />
  }

  const photoSize = rowHeight > 0 ? Math.floor(rowHeight * 0.7) : 60
  const noteBoardItems = useMemo<NoteBoardItem[]>(
    () =>
      photoDays
        .map(({ day, value }) => {
          const detail = boardDetails[day]
          const date = formatDate(year, month, day)
          const photoUrl = detail?.photoUrl || value.photoUrl
          if (!photoUrl) {
            return null
          }

          return {
            day,
            date,
            photoUrl,
            note: detail?.note ?? "",
            milestone: milestoneFromApi(detail?.milestone ?? value.milestone) ?? value.milestone,
          }
        })
        .filter((item): item is NoteBoardItem => item !== null),
    [photoDays, boardDetails, year, month],
  )

  return (
    <AuthGuard>
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at top, rgba(208,232,222,0.55), transparent 38%), linear-gradient(135deg, #d0e8de 0%, #eaf6f0 100%)",
      }}
    >

      <main className="flex-1 flex gap-0 overflow-hidden min-h-0">
        <div className="flex-[7] flex flex-col overflow-hidden border-r border-border/50">
          {/* 左侧：记录视角 */}
          <div className="flex flex-col p-6 pb-3 flex-shrink-0">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">Growth Notes</p>
            <h3 className="mt-2 text-lg font-semibold">{year}年{String(month + 1).padStart(2, "0")}月</h3>
          </div>

          <div className="flex-1 overflow-y-auto px-12 pb-6 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {isBoardLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">正在整理本月便利贴记录...</div>
            ) : noteBoardItems.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
                本月还没有照片记录
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-10 gap-y-12 w-full">
                {noteBoardItems.map((item, index) => {
                  const style = getMilestoneStyle(item.milestone)
                  const milestoneLabel = getMilestoneLabel(item.milestone)
                  const colIndex = index % 2 // 0:left,1:right
                  const rowIndex = Math.floor(index / 2)
                  const topOffsetClass = colIndex === 1 ? 'mt-10' : ''

                  return (
                    <button
                      key={item.date}
                      type="button"
                      onClick={() => {
                        const dayNum = Number(item.date.slice(-2))
                        setSelectedDay(dayNum)
                        setDialogOpen(true)
                        void loadDayDetail(dayNum)
                      }}
                      className={`block w-full transition-all duration-300 hover:-translate-y-2 ${topOffsetClass}`}
                    >
                      <div className={`relative overflow-visible flex flex-col border border-black/5 p-4 text-left ${style.paper} ${style.shadow} w-full`}>
                        
                        <div aria-hidden className="pointer-events-none absolute -top-4 left-1/2 transform -translate-x-1/2 w-24 h-8 bg-white/40 backdrop-blur-[1px] rounded-sm border border-black/[0.03] shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_1px_4px_rgba(0,0,0,0.05)] z-20" >
                          {/* 胶带中间的小撕裂感 */}
                          <div className="absolute inset-x-0 top-1/2 h-px bg-black/5" />
                        </div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Growth Log</p>
                            <p className="mt-1 text-base font-semibold text-zinc-900">{month + 1}月{item.day}日</p>
                          </div>
                          {milestoneLabel ? (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${style.accent} bg-white/55`}>
                              {milestoneLabel}
                            </span>
                          ) : null}
                        </div>

                        <div className="mb-3 overflow-hidden border border-black/5 bg-white/50 shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
                          <img src={item.photoUrl} alt={`${month + 1}月${item.day}日植物记录`} className="h-48 w-full object-cover" />
                        </div>

                        <p className="line-clamp-2 text-sm leading-5 text-zinc-700">
                          {item.note?.trim() ? item.note : "这一天没有留下文字记录"}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：工具栏 */}
        <div className="flex-[3] flex flex-col bg-slate-50/50 overflow-hidden">
          {/* 上部：极简日历 */}
          <div className="flex flex-col p-4 flex-shrink-0 border-b border-border/30 overflow-y-auto" style={{ height: "40%" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <select
                    value={year}
                    onChange={(e) => setCurrentDate(new Date(Number(e.target.value), month, 1))}
                    className="text-sm bg-transparent outline-none"
                  >
                    {Array.from({ length: 10 }).map((_, i) => {
                      const y = realToday.getFullYear() - 5 + i
                      return (
                        <option key={y} value={y}>
                          {y}年
                        </option>
                      )
                    })}
                  </select>
                  <select
                    value={month}
                    onChange={(e) => setCurrentDate(new Date(year, Number(e.target.value), 1))}
                    className="text-sm bg-transparent outline-none"
                  >
                    {Array.from({ length: 12 }).map((_, m) => (
                      <option key={m} value={m}>
                        {String(m + 1).padStart(2, "0")}月
                      </option>
                    ))}
                  </select>
                </div>

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleToday}>
                今天
              </Button>
            </div>

            {/* 日期网格 - 极简版 */}
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
              {calendarCells.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} />
                }

                const data = calendarData[day]
                const isToday = day === today
                const hasMilestone = data?.milestone
                const style = getMilestoneStyle(hasMilestone)
                const dayTextClass = isToday ? "text-emerald-700" : "text-foreground"

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${dayTextClass}`}
                    style={isToday ? { color: "#b42323" } : hasMilestone ? { backgroundColor: style.bgColor } : undefined}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 下部：新建记录区 */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto" style={{ height: "60%" }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">新建记录</h4>
              <div className="text-xs text-muted-foreground">
                {selectedDay ? `${month + 1}月${selectedDay}日` : "未选择日期"}
              </div>
            </div>

            {selectedDay ? (
              <div className="flex flex-col gap-3 flex-1">
                {/* 里程碑选择 */}
                <div>
                  <p className="text-xs font-medium mb-2">里程碑</p>
                  <div className="grid grid-cols-2 gap-2">
                    {milestones.map((milestone) => {
                      const Icon = milestone.icon
                      const isChecked = selectedMilestones.includes(milestone.id)
                      return (
                        <label
                          key={milestone.id}
                          className={`
                            flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs
                            ${isChecked
                              ? "bg-primary/10 border-primary"
                              : "bg-white border-border hover:bg-muted"
                            }
                          `}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedMilestones([milestone.id])
                              } else {
                                setSelectedMilestones([])
                              }
                            }}
                            className="h-3 w-3"
                          />
                          <Icon className={`h-3.5 w-3.5 ${milestone.color}`} />
                          <span className="leading-none">{milestone.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* 图片区域（置于备注上方） */}
                <div>
                  <p className="text-xs font-medium mb-2">照片</p>
                  <div className="flex items-center gap-3">
                    <div className="w-28 h-28 bg-white/60 border border-border rounded-md overflow-hidden flex items-center justify-center">
                      {selectedDayRecord?.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selectedDayRecord.photoUrl} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xs text-muted-foreground">暂无照片</div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handlePhotoButtonClick} disabled={isProcessingPhoto}>
                          <Upload className="mr-2 h-4 w-4" /> 上传
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleViewPhoto} disabled={!selectedDayRecord?.photoUrl}>
                          <ImageIcon className="mr-2 h-4 w-4" /> 查看
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleDeletePhoto} disabled={!selectedDayRecord?.photoUrl}>
                          <Trash2 className="mr-2 h-4 w-4" /> 删除
                        </Button>
                      </div>
                      {isProcessingPhoto ? (
                        <p className="text-xs text-muted-foreground">{photoProcessMessage || "上传中..."}</p>
                      ) : photoProcessMessage ? (
                        <p className="text-xs text-muted-foreground">{photoProcessMessage}</p>
                      ) : null}
                    </div>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoFileChange} className="hidden" />
                </div>

                {/* 备注 */}
                <div className="flex-1 flex flex-col">
                  <p className="text-xs font-medium mb-2">备注</p>
                  <Textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="记录今天的变化..."
                    className="resize-none text-xs flex-1"
                  />
                </div>

                {/* 保存按钮 */}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => void handleSave()}
                  disabled={isDetailLoading}
                >
                  保存
                </Button>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-center text-xs text-muted-foreground">
                左侧或日历<br />选择日期
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
    </AuthGuard>
  )
}
