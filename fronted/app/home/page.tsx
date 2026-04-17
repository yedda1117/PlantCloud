"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { NavHeader } from "@/components/nav-header"
import { PixelPlant, PlantState } from "@/components/pixel-plant"
import { GpsBadge } from "@/components/gps-badge"
import { DeviceControl } from "@/components/device-control"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getHomeRealtime, type HomeRealtimeData } from "@/lib/home-api"
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
  Activity,
  Leaf,
} from "lucide-react"

// ─── 植物数据 ──────────────────────────────────────────────────────────────────
interface PlantProfile {
  id: string
  plantId: number
  name: string
  emoji: string
  sensorData: {
    temperature: number
    humidity: number
    light: number
    hasHuman: boolean
    isFallen: boolean
  }
}

const plantProfiles: PlantProfile[] = [
  {
    id: "p1",
    plantId: 1,
    name: "绿萝",
    emoji: "🌿",
    sensorData: { temperature: 24.5, humidity: 65, light: 320, hasHuman: true, isFallen: false },
  },
  {
    id: "p2",
    plantId: 2,
    name: "多肉植物",
    emoji: "🌵",
    sensorData: { temperature: 28, humidity: 38, light: 12000, hasHuman: false, isFallen: true },
  },
  {
    id: "p3",
    plantId: 3,
    name: "薰衣草",
    emoji: "💜",
    sensorData: { temperature: 22, humidity: 72, light: 8000, hasHuman: false, isFallen: false },
  },
  {
    id: "p4",
    plantId: 4,
    name: "番茄苗",
    emoji: "🍅",
    sensorData: { temperature: 34, humidity: 55, light: 15000, hasHuman: false, isFallen: false },
  },
  {
    id: "p5",
    plantId: 5,
    name: "薄荷",
    emoji: "🌱",
    sensorData: { temperature: 20, humidity: 80, light: 3000, hasHuman: true, isFallen: false },
  },
  {
    id: "p6",
    plantId: 6,
    name: "仙人掌",
    emoji: "🌴",
    sensorData: { temperature: 30, humidity: 25, light: 22000, hasHuman: false, isFallen: false },
  },
]

const POLL_INTERVAL_MS = 30000

function formatNumericValue(value: number | null | undefined, unit: string, digits = 1) {
  if (value === null || value === undefined) {
    return "--"
  }
  return `${value.toFixed(digits)}${unit}`
}

function formatLightValue(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "--"
  }
  return `${value.toLocaleString()} lux`
}

function formatLogTime(value: string | null | undefined) {
  if (!value) {
    return "--:--"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "--:--"
  }
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function getLogVisualType(status: string | null | undefined) {
  switch ((status || "").toUpperCase()) {
    case "UNRESOLVED":
      return "error"
    case "RESOLVED":
      return "success"
    default:
      return "info"
  }
}

function getLogText(title: string | null | undefined) {
  return title || "告警日志"
}

export default function HomePage() {
  const [lightOn, setLightOn] = useState(true)
  const [fanOn, setFanOn] = useState(true)
  const [plantState, setPlantState] = useState<PlantState>("healthy")
  const [selectedPlantId, setSelectedPlantId] = useState("p1")
  const [realtimeData, setRealtimeData] = useState<HomeRealtimeData | null>(null)
  const [realtimeError, setRealtimeError] = useState<string | null>(null)

  const currentPlant = plantProfiles.find((p) => p.id === selectedPlantId) ?? plantProfiles[0]
  const previewSensorData = realtimeData
    ? {
        temperature: realtimeData.environment.temperature ?? currentPlant.sensorData.temperature,
        humidity: realtimeData.environment.humidity ?? currentPlant.sensorData.humidity,
        light: realtimeData.environment.lightLux ?? currentPlant.sensorData.light,
        hasHuman: realtimeData.infrared.currentDetected,
        isFallen: realtimeData.tilt.hasAlert,
      }
    : currentPlant.sensorData

  useEffect(() => {
    let cancelled = false
    let firstLoad = true

    const loadRealtime = async () => {
      const token = window.localStorage.getItem("plantcloud_token") || ""
      if (!token) {
        return
      }

      try {
        const nextData = await getHomeRealtime(currentPlant.plantId, token)
        if (cancelled) {
          return
        }
        setRealtimeData(nextData)
        setRealtimeError(null)
      } catch (error) {
        if (cancelled) {
          return
        }
        setRealtimeError(error instanceof Error ? error.message : "实时数据加载失败")
      } finally {
        firstLoad = false
      }
    }

    void loadRealtime()
    const timer = window.setInterval(() => {
      void loadRealtime()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [currentPlant.plantId])

  useEffect(() => {
    if (previewSensorData.isFallen) {
      setPlantState("fallen")
    } else if (previewSensorData.temperature > 30) {
      setPlantState("hot")
    } else if (previewSensorData.temperature < 15) {
      setPlantState("cold")
    } else if (previewSensorData.humidity < 40) {
      setPlantState("thirsty")
    } else if (previewSensorData.light < 200) {
      setPlantState("dark")
    } else if (previewSensorData.hasHuman) {
      setPlantState("happy")
    } else {
      setPlantState("healthy")
    }
  }, [previewSensorData])

  const getTempStatus = () => {
    switch (realtimeData?.environment.temperatureStatus) {
      case "HIGH":
        return { label: "偏高", cls: "bg-amber-100 text-amber-700" }
      case "LOW":
        return { label: "偏低", cls: "bg-sky-100 text-sky-700" }
      case "NORMAL":
        return { label: "正常", cls: "bg-green-100 text-green-700" }
      default:
        return { label: "未知", cls: "bg-gray-100 text-gray-600" }
    }
  }

  const getHumidStatus = () => {
    switch (realtimeData?.environment.humidityStatus) {
      case "HIGH":
        return { label: "偏高", cls: "bg-amber-100 text-amber-700" }
      case "LOW":
        return { label: "偏低", cls: "bg-sky-100 text-sky-700" }
      case "NORMAL":
        return { label: "正常", cls: "bg-green-100 text-green-700" }
      default:
        return { label: "未知", cls: "bg-gray-100 text-gray-600" }
    }
  }

  const getLuxStatus = () => {
    switch (realtimeData?.environment.lightStatus) {
      case "HIGH":
        return { label: "过强", cls: "bg-red-100 text-red-700" }
      case "LOW":
        return { label: "不足", cls: "bg-amber-100 text-amber-700" }
      case "NORMAL":
        return { label: "适宜", cls: "bg-green-100 text-green-700" }
      default:
        return { label: "未知", cls: "bg-gray-100 text-gray-600" }
    }
  }

  const getAlertStatus = () => {
    const severity = (realtimeData?.abnormal.latestSeverity || "").toUpperCase()
    if (!realtimeData?.abnormal.hasAlert) {
      return { label: "正常", cls: "bg-green-100 text-green-700" }
    }
    if (severity === "HIGH" || severity === "DANGER") {
      return { label: "严重", cls: "bg-red-100 text-red-700" }
    }
    if (severity === "MEDIUM" || severity === "WARNING") {
      return { label: "警告", cls: "bg-amber-100 text-amber-700" }
    }
    return { label: "提示", cls: "bg-sky-100 text-sky-700" }
  }

  const infraredText = realtimeData?.infrared.currentDetected
    ? realtimeData.infrared.latestEventTitle || "有人来查看植物"
    : realtimeData?.infrared.latestEventTitle || "无人检测到"

  const abnormalText = realtimeData?.abnormal.hasAlert
    ? realtimeData.abnormal.latestTitle || realtimeData.abnormal.latestContent || "检测到异常，请及时处理"
    : "一切正常"

  const activityLogs = realtimeData?.activityLogs ?? []

  return (
    <AuthGuard>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start">

          {/* 左侧栏：植物动态日志 */}
          <div className="lg:col-span-3">
            <Card className="flex flex-col h-[730px]">
              <CardHeader className="pb-3 shrink-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  植物动态日志
                  <Badge variant="outline" className="ml-auto text-xs font-normal">
                    {currentPlant.emoji} {currentPlant.name}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 pb-4">
                {/* 日志列表：固定高度 + 自定义滚动条 */}
                <div
                  className="h-full overflow-y-auto pr-1 space-y-3
                    [&::-webkit-scrollbar]:w-1.5
                    [&::-webkit-scrollbar-track]:rounded-full
                    [&::-webkit-scrollbar-track]:bg-muted/30
                    [&::-webkit-scrollbar-thumb]:rounded-full
                    [&::-webkit-scrollbar-thumb]:bg-primary/25
                    [&::-webkit-scrollbar-thumb:hover]:bg-primary/50"
                >
                  {activityLogs.length > 0 ? (
                    activityLogs.map((log) => {
                      const visualType = getLogVisualType(log.status)
                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 transition-colors hover:bg-muted"
                        >
                          <span className="whitespace-nowrap text-xs font-mono text-muted-foreground">
                            [{formatLogTime(log.createdAt)}]
                          </span>
                          <span
                            className={`flex-1 text-sm ${
                              visualType === "error"
                                ? "text-destructive"
                                : visualType === "success"
                                  ? "text-primary"
                                  : "text-foreground"
                            }`}
                          >
                            {getLogText(log.title)}
                          </span>
                        </div>
                      )
                    })
                  ) : (
                    <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                      暂无植物动态日志
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 中间区域：植物主体 */}
          <div className="lg:col-span-6">
            <Card className="flex flex-col h-[730px]">
              {/* 面板标题行：植物名称（左）+ GPS 徽章（右） */}
              <CardHeader className="pb-2 pt-4 px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{currentPlant.emoji} {currentPlant.name}</span>
                    <span className="text-xs text-muted-foreground">当前绑定植物</span>
                  </div>
                  {/* GPS 定位徽章 —— 悬停展开地图 */}
                  <GpsBadge />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center flex-1 min-h-0 py-3">

                {/* 植物像素主体 */}
                <div className="relative mb-3 w-full flex justify-center flex-1 min-h-0">
                  <div className="border-2 border-primary/20 rounded-3xl p-4 bg-gradient-to-br from-primary/5 to-transparent w-full max-w-xs flex items-center justify-center">
                    <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl scale-150" />
                    <div className="scale-110">
                      <PixelPlant state={plantState} size="xl" />
                    </div>
                  </div>
                </div>

                {/* 控制面板 */}
                <div className="flex items-center justify-between w-full max-w-xl bg-muted/30 rounded-2xl p-4 border">
                  {/* 补光灯控制 */}
                  <DeviceControl type="light" isOn={lightOn} onToggle={setLightOn} />

                  <div className="w-px h-8 bg-border mx-2" />

                  {/* 风扇控制 */}
                  <DeviceControl type="fan" isOn={fanOn} onToggle={setFanOn} />

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
          <div className="lg:col-span-3 flex flex-col gap-4">
            {realtimeError ? (
              <p className="px-1 text-xs text-destructive">{realtimeError}</p>
            ) : null}

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
                      <p className="text-xl font-bold">
                        {formatNumericValue(realtimeData?.environment.temperature, "°C")}
                      </p>
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
                      <p className="text-xl font-bold">
                        {formatNumericValue(realtimeData?.environment.humidity, "% RH")}
                      </p>
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
                      <p className="text-xl font-bold">{formatLightValue(realtimeData?.environment.lightLux)}</p>
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
                      <p className="text-sm font-medium">{infraredText}</p>
                      <p className="text-xs text-muted-foreground">
                        今日靠近 {realtimeData?.infrared.approachCount ?? 0} 次
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={realtimeData?.infrared.currentDetected ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}
                  >
                    {realtimeData?.infrared.currentDetected ? "检测到" : "未检测"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* 异常提醒 */}
            <Card className={realtimeData?.abnormal.hasAlert ? "border-destructive/50 bg-destructive/5" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${realtimeData?.abnormal.hasAlert ? "bg-red-100" : "bg-gray-100"}`}>
                      <AlertTriangle className={`h-5 w-5 ${realtimeData?.abnormal.hasAlert ? "text-red-600" : "text-gray-500"}`} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">异常提醒</p>
                      <p className="text-sm font-medium">{abnormalText}</p>
                      <p className="text-xs text-muted-foreground">
                        未处理告警 {realtimeData?.abnormal.count ?? 0} 条
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={getAlertStatus().cls}>
                    {getAlertStatus().label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
    </AuthGuard>
  )
}
