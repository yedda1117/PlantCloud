"use client"

import { useState, useEffect } from "react"
import { NavHeader } from "@/components/nav-header"
import { PixelPlant, PlantState } from "@/components/pixel-plant"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Thermometer,
  Droplets,
  Sun,
  User,
  AlertTriangle,
  Fan,
  Lightbulb,
  Activity,
  Leaf,
} from "lucide-react"

// ─── 植物数据 ──────────────────────────────────────────────────────────────────
interface PlantProfile {
  id: string
  name: string
  emoji: string
  sensorData: {
    temperature: number
    humidity: number
    light: number
    hasHuman: boolean
    isFallen: boolean
  }
  logs: { time: string; event: string; type: "info" | "success" | "error" }[]
}

const plantProfiles: PlantProfile[] = [
  {
    id: "p1",
    name: "绿萝",
    emoji: "🌿",
    sensorData: { temperature: 24.5, humidity: 65, light: 320, hasHuman: true, isFallen: false },
    logs: [
      { time: "10:30", event: "E53_IS1 陪伴记录：主人来访，植物状态良好", type: "info" },
      { time: "10:05", event: "光照已达到设定值（320 lux）", type: "success" },
      { time: "10:00", event: "补光灯开启（光照<300 lux）", type: "info" },
      { time: "09:15", event: "E53_IS1 陪伴记录：人体红外检测到有人", type: "info" },
      { time: "08:45", event: "自动浇水完成", type: "success" },
      { time: "08:00", event: "系统启动，开始监测绿萝", type: "info" },
    ],
  },
  {
    id: "p2",
    name: "多肉植物",
    emoji: "🌵",
    sensorData: { temperature: 28, humidity: 38, light: 12000, hasHuman: false, isFallen: true },
    logs: [
      { time: "11:20", event: "E53_SC2 倾斜警报：花盆检测到倾斜，请检查！", type: "error" },
      { time: "11:00", event: "E53_SC2 倾斜警报：角度超过阈值 15°", type: "error" },
      { time: "10:30", event: "湿度偏低（38% RH），建议适量补水", type: "info" },
      { time: "09:50", event: "光照强度正常（12000 lux）", type: "success" },
      { time: "09:00", event: "系统启动，开始监测多肉植物", type: "info" },
    ],
  },
  {
    id: "p3",
    name: "薰衣草",
    emoji: "💜",
    sensorData: { temperature: 22, humidity: 72, light: 8000, hasHuman: false, isFallen: false },
    logs: [
      { time: "10:45", event: "环境指标正常，薰衣草生长良好", type: "success" },
      { time: "10:00", event: "湿度适宜（72% RH）", type: "success" },
      { time: "09:30", event: "温度正常（22°C）", type: "success" },
      { time: "08:00", event: "系统启动，开始监测薰衣草", type: "info" },
    ],
  },
  {
    id: "p4",
    name: "番茄苗",
    emoji: "🍅",
    sensorData: { temperature: 34, humidity: 55, light: 15000, hasHuman: false, isFallen: false },
    logs: [
      { time: "11:30", event: "温度过高（34°C），已自动开启风扇降温", type: "error" },
      { time: "11:00", event: "E53_IA1 风扇启动：温度>28°C 触发自动通风", type: "info" },
      { time: "10:30", event: "烟雾传感器 E53_SF1 警报：检测到异常烟雾", type: "error" },
      { time: "09:00", event: "系统启动，开始监测番茄苗", type: "info" },
    ],
  },
  {
    id: "p5",
    name: "薄荷",
    emoji: "🌱",
    sensorData: { temperature: 20, humidity: 80, light: 3000, hasHuman: true, isFallen: false },
    logs: [
      { time: "10:50", event: "E53_IS1 陪伴记录：检测到主人靠近", type: "info" },
      { time: "10:20", event: "湿度偏高（80% RH），建议通风", type: "info" },
      { time: "09:45", event: "光照不足（3000 lux），补光灯已开启", type: "info" },
      { time: "08:00", event: "系统启动，开始监测薄荷", type: "info" },
    ],
  },
  {
    id: "p6",
    name: "仙人掌",
    emoji: "🌴",
    sensorData: { temperature: 30, humidity: 25, light: 22000, hasHuman: false, isFallen: false },
    logs: [
      { time: "11:00", event: "湿度极低（25% RH），仙人掌正常状态", type: "success" },
      { time: "10:00", event: "光照充足（22000 lux）", type: "success" },
      { time: "09:00", event: "系统启动，开始监测仙人掌", type: "info" },
    ],
  },
]

export default function HomePage() {
  const [lightOn, setLightOn] = useState(true)
  const [fanOn, setFanOn] = useState(false)
  const [plantState, setPlantState] = useState<PlantState>("healthy")
  const [selectedPlantId, setSelectedPlantId] = useState("p1")

  const currentPlant = plantProfiles.find((p) => p.id === selectedPlantId) ?? plantProfiles[0]
  const sensorData = currentPlant.sensorData

  // 根据环境数据计算植物状态
  useEffect(() => {
    if (sensorData.isFallen) {
      setPlantState("fallen")
    } else if (sensorData.temperature > 30) {
      setPlantState("hot")
    } else if (sensorData.temperature < 15) {
      setPlantState("cold")
    } else if (sensorData.humidity < 40) {
      setPlantState("thirsty")
    } else if (sensorData.light < 200) {
      setPlantState("dark")
    } else if (sensorData.hasHuman) {
      setPlantState("happy")
    } else {
      setPlantState("healthy")
    }
  }, [sensorData])

  const getTempStatus = () => {
    if (sensorData.temperature > 30 || sensorData.temperature < 15) return { label: "异常", cls: "bg-red-100 text-red-700" }
    if (sensorData.temperature > 28) return { label: "偏高", cls: "bg-yellow-100 text-yellow-700" }
    return { label: "正常", cls: "bg-green-100 text-green-700" }
  }
  const getHumidStatus = () => {
    if (sensorData.humidity < 30 || sensorData.humidity > 85) return { label: "异常", cls: "bg-red-100 text-red-700" }
    if (sensorData.humidity < 40 || sensorData.humidity > 80) return { label: "偏高", cls: "bg-yellow-100 text-yellow-700" }
    return { label: "正常", cls: "bg-green-100 text-green-700" }
  }
  const getLuxStatus = () => {
    if (sensorData.light > 30000) return { label: "过强", cls: "bg-red-100 text-red-700" }
    if (sensorData.light < 300) return { label: "不足", cls: "bg-yellow-100 text-yellow-700" }
    return { label: "适宜", cls: "bg-green-100 text-green-700" }
  }

  return (
    <div className="min-h-screen bg-background">
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
                {plantProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* 左侧栏：植物动态日志 */}
          <div className="lg:col-span-3">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  植物动态日志
                  <Badge variant="outline" className="ml-auto text-xs font-normal">
                    {currentPlant.emoji} {currentPlant.name}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {currentPlant.logs.map((log, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                          [{log.time}]
                        </span>
                        <span className={`text-sm flex-1 ${
                          log.type === "error" ? "text-destructive" :
                          log.type === "success" ? "text-primary" :
                          "text-foreground"
                        }`}>
                          {log.event}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* 中间区域：植物主体 */}
          <div className="lg:col-span-6">
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center py-8">
                {/* 植物名称 */}
                <div className="mb-4 text-center">
                  <p className="text-lg font-semibold">{currentPlant.emoji} {currentPlant.name}</p>
                  <p className="text-xs text-muted-foreground">当前绑定植物</p>
                </div>

                {/* 植物像素主体 */}
                <div className="relative mb-8 w-full flex justify-center">
                  <div className="border-2 border-primary/20 rounded-3xl p-6 bg-gradient-to-br from-primary/5 to-transparent w-full max-w-md aspect-square flex items-center justify-center">
                    <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl scale-150" />
                    <div className="scale-125">
                      <PixelPlant state={plantState} size="xl" />
                    </div>
                  </div>
                </div>

                {/* 控制面板 */}
                <div className="flex items-center justify-between w-full max-w-xl bg-muted/30 rounded-2xl p-4 border">
                  {/* 补光灯控制 */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-xl ${lightOn ? "bg-amber-100" : "bg-gray-100"}`}>
                      <Lightbulb className={`h-5 w-5 ${lightOn ? "text-amber-600" : "text-gray-400"}`} />
                    </div>
                    <div className="flex-1 min-w-[80px]">
                      <p className="font-medium text-sm">补光灯</p>
                      <p className="text-xs text-muted-foreground">{lightOn ? "开启中" : "已关闭"}</p>
                    </div>
                    <Switch checked={lightOn} onCheckedChange={setLightOn} />
                  </div>

                  <div className="w-px h-8 bg-border mx-2" />

                  {/* 风扇控制 */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-xl ${fanOn ? "bg-blue-100" : "bg-gray-100"}`}>
                      <Fan className={`h-5 w-5 ${fanOn ? "text-blue-600 animate-spin" : "text-gray-400"}`} style={{ animationDuration: "1s" }} />
                    </div>
                    <div className="flex-1 min-w-[80px]">
                      <p className="font-medium text-sm">风扇</p>
                      <p className="text-xs text-muted-foreground">{fanOn ? "运转中" : "已关闭"}</p>
                    </div>
                    <Switch checked={fanOn} onCheckedChange={setFanOn} />
                  </div>

                  <div className="w-px h-8 bg-border mx-2" />

                  {/* 设备状态 */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <div className="h-5 w-5 flex items-center justify-center">
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <p className="font-medium text-sm">小熊派已连接</p>
                      <p className="text-xs text-muted-foreground">延时: 23ms</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧区域：监测与控制 */}
          <div className="lg:col-span-3 space-y-4">
            {/* 温度监测 */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-orange-100">
                      <Thermometer className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">温度监测</p>
                      <p className="text-xl font-bold">{sensorData.temperature}°C</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={getTempStatus().cls}>{getTempStatus().label}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* 湿度监测 */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-100">
                      <Droplets className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">湿度监测</p>
                      <p className="text-xl font-bold">{sensorData.humidity}% RH</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={getHumidStatus().cls}>{getHumidStatus().label}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* 光照强度 */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-100">
                      <Sun className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">光照强度</p>
                      <p className="text-xl font-bold">{sensorData.light.toLocaleString()} lux</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={getLuxStatus().cls}>{getLuxStatus().label}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* 人体红外状态 */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-100">
                      <User className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">人体红外状态</p>
                      <p className="text-sm font-medium">
                        {sensorData.hasHuman ? "有人来查看植物" : "无人检测到"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={sensorData.hasHuman ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}>
                    {sensorData.hasHuman ? "检测到" : "无"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* 异常提醒 */}
            <Card className={sensorData.isFallen ? "border-destructive/50 bg-destructive/5" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${sensorData.isFallen ? "bg-red-100" : "bg-gray-100"}`}>
                      <AlertTriangle className={`h-5 w-5 ${sensorData.isFallen ? "text-red-600" : "text-gray-500"}`} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">异常提醒</p>
                      <p className="text-sm font-medium">
                        {sensorData.isFallen ? "植物倒下，请检查！" : "一切正常"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={sensorData.isFallen ? "destructive" : "secondary"}>
                    {sensorData.isFallen ? "警告" : "正常"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
