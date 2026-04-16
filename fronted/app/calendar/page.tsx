"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import { AuthGuard } from "@/components/auth-guard"

import { NavHeader } from "@/components/nav-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Leaf,
} from "lucide-react"

const milestones = [
  { id: "sprout", apiValue: "SPROUT", label: "萌芽", icon: Sprout, color: "text-green-500" },
  { id: "flower", apiValue: "FLOWER", label: "开花", icon: Flower2, color: "text-pink-500" },
  { id: "fruit", apiValue: "FRUIT", label: "结果", icon: Apple, color: "text-orange-500" },
  { id: "repot", apiValue: "REPOT", label: "换盆", icon: FlowerIcon, color: "text-amber-600" },
]

const plants = [
  { id: "p1", name: "薄荷", emoji: "🌿" },
  { id: "p2", name: "多肉植物", emoji: "🌵" },
  { id: "p3", name: "小雏菊", emoji: "🌼" },
  { id: "p4", name: "向日葵", emoji: "🌻" },
  { id: "p5", name: "绿萝", emoji: "🍀" },
  { id: "p6", name: "仙人掌", emoji: "🌵" },
]

const weekDays = ["日", "一", "二", "三", "四", "五", "六"]
const ROWS = 6
const plantApiIds: Record<string, number> = {
  p1: 1,
  p2: 2,
  p3: 3,
  p4: 4,
  p5: 5,
  p6: 6,
}

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

function milestoneFromApi(value?: string | null) {
  return milestones.find((item) => item.apiValue === value)?.id
}

function milestoneToApi(value?: string | null) {
  return milestones.find((item) => item.id === value)?.apiValue
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
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([])
  const [noteText, setNoteText] = useState("")
  const [selectedPlantId, setSelectedPlantId] = useState("p1")
  const [calendarData, setCalendarData] = useState<Record<number, DayRecord>>({})
  const [selectedDayDetail, setSelectedDayDetail] = useState<CalendarDayDetail | null>(null)
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
  const [isMonthLoading, setIsMonthLoading] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [photoProcessMessage, setPhotoProcessMessage] = useState("")

  const currentPlant = plants.find((p) => p.id === selectedPlantId) ?? plants[0]
  const currentPlantApiId = plantApiIds[selectedPlantId] ?? plantApiIds.p1

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
  const today = 10

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
  const handleToday = () => setCurrentDate(new Date(2026, 3, 1))

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

  return (
    <AuthGuard>
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <NavHeader
        rightSlot={
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">当前植物</span>
            <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <main className="flex-1 flex flex-col container mx-auto px-6 py-4 overflow-hidden min-h-0">
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-bold">
              {year}年{String(month + 1).padStart(2, "0")}月
            </h2>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {currentPlant.emoji} {currentPlant.name} 的成长记录
            </span>
            <Button variant="outline" size="sm" onClick={handleToday}>
              今天
            </Button>
          </div>
        </div>

        <Card className="flex-1 overflow-hidden min-h-0">
          <CardContent className="p-4 h-full flex flex-col">
            <div className="grid grid-cols-7 gap-2 mb-2 flex-shrink-0">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>

            <div ref={gridRef} className="grid grid-cols-7 gap-3 flex-1 min-h-0">
              {calendarCells.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} style={rowHeight ? { height: rowHeight } : {}} />
                }

                const data = calendarData[day]
                const isToday = day === today
                const hasMilestone = data?.milestone
                const hasPhoto = data?.hasPhoto

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    style={rowHeight ? { height: rowHeight } : {}}
                    className={`
                      rounded-2xl border-2 transition-all relative overflow-hidden group
                      bg-primary/10 hover:bg-primary/15
                      ${isToday ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/20"}
                    `}
                  >
                    <span className={`absolute top-2.5 left-3 text-sm font-semibold z-10 leading-none ${isToday ? "text-primary" : "text-foreground/75"}`}>
                      {day}
                    </span>

                    {hasMilestone && (
                      <span className="absolute top-2.5 right-3 z-10">
                        {getMilestoneIcon(hasMilestone)}
                      </span>
                    )}

                    {hasPhoto && data?.photoUrl ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="overflow-hidden flex-shrink-0 rounded-md shadow-sm" style={{ width: photoSize, height: photoSize }}>
                          <img src={data.photoUrl} alt={`Day ${day}`} className="w-full h-full object-cover" />
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Plus
                          className="text-muted-foreground/35 group-hover:text-muted-foreground/60 transition-colors"
                          style={{ width: 28, height: 28 }}
                          strokeWidth={1.5}
                        />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {currentPlant.emoji} {currentPlant.name} · {year}年{month + 1}月{selectedDay}日 - 详细记录
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-8 mt-4">
            <div className="flex flex-col gap-3">
              <div className="aspect-square rounded-2xl bg-muted flex items-center justify-center overflow-hidden">
                {selectedDayRecord.hasPhoto && selectedDayRecord.photoUrl ? (
                  <img
                    src={selectedDayRecord.photoUrl}
                    alt="Plant"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">暂无图片</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoFileChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={handlePhotoButtonClick}
                  disabled={isProcessingPhoto || isDetailLoading}
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  {isProcessingPhoto ? "处理中..." : "上传图片"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={handlePhotoButtonClick}
                  disabled={isProcessingPhoto || isDetailLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />更换图片
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={handleViewPhoto}
                  disabled={!selectedDayRecord.photoUrl}
                >
                  <ImageIcon className="h-4 w-4 mr-1.5" />查看图片
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-destructive hover:text-destructive"
                  onClick={() => void handleDeletePhoto()}
                  disabled={!selectedDayRecord.photoUrl || isProcessingPhoto || isDetailLoading}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />删除图片
                </Button>
              </div>
              {photoProcessMessage && (
                <p className="text-xs text-muted-foreground">{photoProcessMessage}</p>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <h4 className="text-sm font-medium mb-3">环境信息</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-orange-50 text-center">
                    <Thermometer className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-orange-700">
                      {selectedDayRecord.temp ?? "--"}°C
                    </p>
                    <p className="text-xs text-orange-600">温度</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 text-center">
                    <Droplets className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-blue-700">
                      {selectedDayRecord.humidity ?? "--"}%
                    </p>
                    <p className="text-xs text-blue-600">湿度</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 text-center">
                    <Sun className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-amber-700">
                      {selectedDayRecord.light ?? "--"}
                    </p>
                    <p className="text-xs text-amber-600">光照lux</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col flex-1">
                <h4 className="text-sm font-medium mb-3">里程碑</h4>
                <div className="grid grid-cols-2 gap-2 flex-1">
                  {milestones.map((milestone) => {
                    const Icon = milestone.icon
                    const isChecked = selectedMilestones.includes(milestone.id)
                    return (
                      <label
                        key={milestone.id}
                        className={`
                          flex flex-col items-center justify-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors
                          ${isChecked
                            ? "bg-primary/10 border-primary"
                            : "bg-muted/50 border-transparent hover:bg-muted"
                          }
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedMilestones([milestone.id])
                              } else {
                                setSelectedMilestones([])
                              }
                            }}
                          />
                          <Icon className={`h-5 w-5 ${milestone.color}`} />
                        </div>
                        <span className="text-xs font-medium whitespace-nowrap">{milestone.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="记录今天的成长变化..."
              className="resize-none w-full"
              rows={3}
            />
          </div>

          <div className="flex gap-3 mt-4">
            <Button className="flex-1" onClick={() => void handleSave()} disabled={isDetailLoading}>
              保存
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AuthGuard>
  )
}
