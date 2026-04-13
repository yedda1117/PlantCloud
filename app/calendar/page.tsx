"use client"

import { useState, useRef, useEffect } from "react"
import { NavHeader } from "@/components/nav-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

const calendarData: Record<number, {
  hasPhoto: boolean
  photoUrl?: string
  milestone?: string
  note?: string
  temp?: number
  humidity?: number
  light?: number
}> = {
  3:  { hasPhoto: true, photoUrl: plantPhotos[0], milestone: "sprout", note: "今天发现小芽冒出来了！", temp: 24, humidity: 65, light: 3200 },
  7:  { hasPhoto: true, photoUrl: plantPhotos[1], note: "叶子长大了一些", temp: 25, humidity: 62, light: 3500 },
  10: { hasPhoto: true, photoUrl: plantPhotos[2], milestone: "flower", note: "第一朵花开了，太开心了！", temp: 26, humidity: 58, light: 4000 },
  15: { hasPhoto: true, photoUrl: plantPhotos[3], note: "花朵越来越多", temp: 24, humidity: 60, light: 3800 },
  18: { hasPhoto: true, photoUrl: plantPhotos[4], milestone: "repot", note: "换了一个更大的花盆", temp: 23, humidity: 65, light: 3200 },
}

const weekDays = ["日", "一", "二", "三", "四", "五", "六"]
const ROWS = 6

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([])
  const [noteText, setNoteText] = useState("")

  const gridRef = useRef<HTMLDivElement>(null)
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
    setDialogOpen(true)
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
      <NavHeader />

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
          <Button variant="outline" size="sm" onClick={handleToday}>
            回到今天
          </Button>
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
              {year}年{month + 1}月{selectedDay}日 - 详细记录
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
                <Button variant="outline" size="sm" className="h-10">
                  <Upload className="h-4 w-4 mr-1.5" />上传照片
                </Button>
                <Button variant="outline" size="sm" className="h-10">
                  <RefreshCw className="h-4 w-4 mr-1.5" />更换照片
                </Button>
                <Button variant="outline" size="sm" className="h-10">
                  <ImageIcon className="h-4 w-4 mr-1.5" />查看照片
                </Button>
                <Button variant="outline" size="sm" className="h-10 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1.5" />删除照片
                </Button>
              </div>
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
            <Button className="flex-1">保存</Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}