"use client"

import { useState, useRef, useEffect, type ChangeEvent } from "react"
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
  { id: "sprout", label: "发芽", icon: Sprout, color: "text-green-500" },
  { id: "flower", label: "开花", icon: Flower2, color: "text-pink-500" },
  { id: "fruit", label: "结果", icon: Apple, color: "text-orange-500" },
  { id: "repot", label: "换盆", icon: FlowerIcon, color: "text-amber-600" },
]

const plantPhotos = [
  "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1459156212016-c812468e2115?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=300&h=300&fit=crop",
]

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

const allPlantCalendarData: Record<string, Record<number, DayRecord>> = {
  p1: {
    3:  { hasPhoto: true, photoUrl: plantPhotos[0], milestone: "sprout", note: "今天发现小芽冒出来了！", temp: 24, humidity: 65, light: 3200 },
    7:  { hasPhoto: true, photoUrl: plantPhotos[1], note: "叶子长大了一些", temp: 25, humidity: 62, light: 3500 },
    10: { hasPhoto: true, photoUrl: plantPhotos[2], milestone: "flower", note: "第一朵花开了，太开心了！", temp: 26, humidity: 58, light: 4000 },
    15: { hasPhoto: true, photoUrl: plantPhotos[3], note: "花朵越来越多", temp: 24, humidity: 60, light: 3800 },
    18: { hasPhoto: true, photoUrl: plantPhotos[4], milestone: "repot", note: "换了一个更大的花盆", temp: 23, humidity: 65, light: 3200 },
  },
  p2: {
    2:  { hasPhoto: true, photoUrl: plantPhotos[2], note: "多肉状态良好，叶片饱满", temp: 28, humidity: 38, light: 12000 },
    9:  { hasPhoto: true, photoUrl: plantPhotos[3], milestone: "repot", note: "换了透气性更好的颗粒土", temp: 27, humidity: 35, light: 11000 },
    14: { hasPhoto: true, photoUrl: plantPhotos[0], note: "发现新的侧芽", temp: 29, humidity: 40, light: 13000 },
  },
  p3: {
    1:  { hasPhoto: true, photoUrl: plantPhotos[1], milestone: "sprout", note: "薰衣草发芽了！", temp: 22, humidity: 72, light: 8000 },
    6:  { hasPhoto: true, photoUrl: plantPhotos[4], note: "长势喜人，香气浓郁", temp: 21, humidity: 70, light: 7500 },
    12: { hasPhoto: true, photoUrl: plantPhotos[0], milestone: "flower", note: "第一串花穗开放，紫色很美", temp: 23, humidity: 68, light: 8500 },
    20: { hasPhoto: true, photoUrl: plantPhotos[2], note: "修剪了部分枝条", temp: 22, humidity: 71, light: 8000 },
  },
  p4: {
    4:  { hasPhoto: true, photoUrl: plantPhotos[3], milestone: "sprout", note: "番茄苗破土而出", temp: 30, humidity: 55, light: 15000 },
    8:  { hasPhoto: true, photoUrl: plantPhotos[1], note: "茎干变粗，生长旺盛", temp: 32, humidity: 52, light: 14000 },
    13: { hasPhoto: true, photoUrl: plantPhotos[4], milestone: "flower", note: "开出了第一朵黄花", temp: 31, humidity: 54, light: 15500 },
    19: { hasPhoto: true, photoUrl: plantPhotos[0], milestone: "fruit", note: "结出了第一颗小番茄！", temp: 33, humidity: 50, light: 16000 },
  },
  p5: {
    5:  { hasPhoto: true, photoUrl: plantPhotos[2], note: "薄荷叶片翠绿，香气清新", temp: 20, humidity: 80, light: 3000 },
    11: { hasPhoto: true, photoUrl: plantPhotos[0], milestone: "repot", note: "换了更大的花盆，施了有机肥", temp: 19, humidity: 78, light: 2800 },
    17: { hasPhoto: true, photoUrl: plantPhotos[3], note: "采摘了一些叶片泡茶", temp: 21, humidity: 82, light: 3200 },
  },
  p6: {
    3:  { hasPhoto: true, photoUrl: plantPhotos[4], note: "仙人掌状态稳定", temp: 30, humidity: 25, light: 22000 },
    10: { hasPhoto: true, photoUrl: plantPhotos[1], note: "顶部出现新刺", temp: 31, humidity: 23, light: 23000 },
    22: { hasPhoto: true, photoUrl: plantPhotos[2], milestone: "flower", note: "开出了一朵白色小花，难得一见！", temp: 29, humidity: 26, light: 21000 },
  },
}

const plants = [
  { id: "p1", name: "绿萝", emoji: "🌿" },
  { id: "p2", name: "多肉植物", emoji: "🌵" },
  { id: "p3", name: "薰衣草", emoji: "💜" },
  { id: "p4", name: "番茄苗", emoji: "🍅" },
  { id: "p5", name: "薄荷", emoji: "🌱" },
  { id: "p6", name: "仙人掌", emoji: "🌴" },
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

const cloneCalendarData = () =>
  Object.fromEntries(
    Object.entries(allPlantCalendarData).map(([plantId, records]) => [
      plantId,
      Object.fromEntries(
        Object.entries(records).map(([day, record]) => [day, { ...record }])
      ),
    ])
  ) as Record<string, Record<number, DayRecord>>

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([])
  const [noteText, setNoteText] = useState("")
  const [selectedPlantId, setSelectedPlantId] = useState("p1")
  const [calendarRecords, setCalendarRecords] = useState(cloneCalendarData)
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
  const [photoProcessMessage, setPhotoProcessMessage] = useState("")

  const currentPlant = plants.find((p) => p.id === selectedPlantId) ?? plants[0]
  const calendarData = calendarRecords[selectedPlantId] ?? {}

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

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const handleToday = () => setCurrentDate(new Date(2026, 3, 1))

  const handleDayClick = (day: number) => {
    setSelectedDay(day)
    const data = calendarData[day]
    setSelectedMilestones(data?.milestone ? [data.milestone] : [])
    setNoteText(data?.note || "")
    setPhotoProcessMessage("")
    setDialogOpen(true)
  }

  const updateSelectedDayRecord = (updater: (record: DayRecord) => DayRecord) => {
    if (!selectedDay) return

    setCalendarRecords((prev) => {
      const plantRecords = prev[selectedPlantId] ?? {}
      const currentRecord = plantRecords[selectedDay] ?? { hasPhoto: false }

      return {
        ...prev,
        [selectedPlantId]: {
          ...plantRecords,
          [selectedDay]: updater(currentRecord),
        },
      }
    })
  }

  const handlePhotoButtonClick = () => {
    if (!selectedDay || isProcessingPhoto) return
    fileInputRef.current?.click()
  }

  const handlePhotoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !selectedDay) return

    setIsProcessingPhoto(true)
    setPhotoProcessMessage("正在上传图片并调用 SmartJavaAI 处理...")

    const originalPhotoUrl = await readFileAsDataUrl(file)

    try {
      const form = new FormData()
      form.append("file", file)

      const response = await fetch(`/api/photos/upload?plantId=${plantApiIds[selectedPlantId]}&userId=1`, {
        method: "POST",
        body: form,
      })
      const data = await response.json()
      const photoLog = data?.data ?? data

      if (!response.ok || data?.code > 0) {
        throw new Error(data?.message || "图片上传失败")
      }

      const processedPhotoUrl =
        photoLog?.processedImageUrl ||
        photoLog?.thumbnailUrl ||
        photoLog?.originalImageUrl ||
        originalPhotoUrl

      const nextAiStatus =
        photoLog?.aiStatus === "PENDING"
          ? "processing"
          : photoLog?.aiStatus === "FAILED"
            ? "error"
            : "done"

      updateSelectedDayRecord((record) => ({
        ...record,
        hasPhoto: true,
        photoUrl: processedPhotoUrl,
        originalPhotoUrl: photoLog?.originalImageUrl || originalPhotoUrl,
        aiStatus: nextAiStatus,
        note: record.note ?? noteText,
      }))
      setPhotoProcessMessage(
        photoLog?.processedImageUrl
          ? "SmartJavaAI 已完成主体识别和背景替换"
          : photoLog?.aiStatus === "FAILED"
            ? `SmartJavaAI 处理失败：${photoLog?.note || "请检查 ONNX Runtime 本机依赖"}`
          : "图片已上传，等待后端返回 SmartJavaAI 处理结果"
      )
    } catch (error) {
      updateSelectedDayRecord((record) => ({
        ...record,
        hasPhoto: true,
        photoUrl: originalPhotoUrl,
        originalPhotoUrl,
        aiStatus: "error",
        note: record.note ?? noteText,
      }))
      setPhotoProcessMessage(error instanceof Error ? error.message : "图片上传失败")
    } finally {
      setIsProcessingPhoto(false)
    }
  }

  const handleDeletePhoto = () => {
    updateSelectedDayRecord((record) => ({
      ...record,
      hasPhoto: false,
      photoUrl: undefined,
      originalPhotoUrl: undefined,
      aiStatus: "idle",
    }))
    setPhotoProcessMessage("")
  }

  const handleViewPhoto = () => {
    const photoUrl = calendarData[selectedDay || 0]?.photoUrl
    if (photoUrl) window.open(photoUrl, "_blank", "noopener,noreferrer")
  }

  const handleSave = () => {
    updateSelectedDayRecord((record) => ({
      ...record,
      note: noteText,
      milestone: selectedMilestones[0],
    }))
    setDialogOpen(false)
  }

  const getMilestoneIcon = (milestoneId: string) => {
    const milestone = milestones.find((m) => m.id === milestoneId)
    if (!milestone) return null
    const Icon = milestone.icon
    return <Icon className={`h-4 w-4 ${milestone.color}`} />
  }

  const photoSize = rowHeight > 0 ? Math.floor(rowHeight * 0.70) : 60

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <NavHeader
        rightSlot={
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">绑定植物：</span>
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
              {year}年 {String(month + 1).padStart(2, "0")}月
            </h2>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {currentPlant.emoji} {currentPlant.name} 的生长日志
            </span>
            <Button variant="outline" size="sm" onClick={handleToday}>
              回到今天
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

      {/* 弹窗：加宽至 max-w-3xl，内部布局优化 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {currentPlant.emoji} {currentPlant.name} · {year}年{month + 1}月{selectedDay}日 - 详细记录
            </DialogTitle>
          </DialogHeader>

          {/* 上半区：照片列 + 数据列 */}
          <div className="grid grid-cols-2 gap-8 mt-4">

            {/* 左列：照片预览 + 2×2 按钮 */}
            <div className="flex flex-col gap-3">
              <div className="aspect-square rounded-2xl bg-muted flex items-center justify-center overflow-hidden">
                {calendarData[selectedDay || 0]?.hasPhoto && calendarData[selectedDay || 0]?.photoUrl ? (
                  <img
                    src={calendarData[selectedDay || 0].photoUrl}
                    alt="Plant"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">暂无照片</p>
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
                  disabled={isProcessingPhoto}
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  {isProcessingPhoto ? "处理中..." : "上传照片"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={handlePhotoButtonClick}
                  disabled={isProcessingPhoto}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />更换照片
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={handleViewPhoto}
                  disabled={!calendarData[selectedDay || 0]?.photoUrl}
                >
                  <ImageIcon className="h-4 w-4 mr-1.5" />查看照片
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-destructive hover:text-destructive"
                  onClick={handleDeletePhoto}
                  disabled={!calendarData[selectedDay || 0]?.photoUrl || isProcessingPhoto}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />删除照片
                </Button>
              </div>
              {photoProcessMessage && (
                <p className="text-xs text-muted-foreground">{photoProcessMessage}</p>
              )}
            </div>

            {/* 右列：环境数据 + 里程碑（撑满高度） */}
            <div className="flex flex-col gap-4">
              {/* 环境数据 */}
              <div>
                <h4 className="text-sm font-medium mb-3">当日环境数据</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-orange-50 text-center">
                    <Thermometer className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-orange-700">
                      {calendarData[selectedDay || 0]?.temp || "--"}°C
                    </p>
                    <p className="text-xs text-orange-600">温度</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 text-center">
                    <Droplets className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-blue-700">
                      {calendarData[selectedDay || 0]?.humidity || "--"}%
                    </p>
                    <p className="text-xs text-blue-600">湿度</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 text-center">
                    <Sun className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-amber-700">
                      {calendarData[selectedDay || 0]?.light || "--"}
                    </p>
                    <p className="text-xs text-amber-600">光照lux</p>
                  </div>
                </div>
              </div>

              {/* 里程碑：flex-1 撑满剩余高度，选项均分 */}
              <div className="flex flex-col flex-1">
                <h4 className="text-sm font-medium mb-3">里程碑标记</h4>
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
                                setSelectedMilestones([...selectedMilestones, milestone.id])
                              } else {
                                setSelectedMilestones(selectedMilestones.filter((m) => m !== milestone.id))
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

          {/* 备注：独占一行，占满宽度 */}
          <div className="mt-5">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="记录今天的植物状态..."
              className="resize-none w-full"
              rows={3}
            />
          </div>

          <div className="flex gap-3 mt-4">
            <Button className="flex-1" onClick={handleSave}>保存</Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
