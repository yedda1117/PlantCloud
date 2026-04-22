"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { PlantModelViewer } from "@/components/PlantModelViewer"
import { GpsBadge } from "@/components/gps-badge"
import { DeviceControl } from "@/components/device-control"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getHomeRealtime, type HomeRealtimeData } from "@/lib/home-api"
import { usePlantSelection } from "@/context/plant-selection"
import {
  Thermometer,
  Droplets,
  Sun,
  User,
  AlertTriangle,
  Activity,
} from "lucide-react"

const POLL_INTERVAL_MS = 30000

function formatNumericValue(value: number | null | undefined, unit: string, digits = 1) {
  if (value === null || value === undefined) return "--"
  return `${value.toFixed(digits)}${unit}`
}

function formatLightValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "--"
  return `${value.toLocaleString()} lux`
}

function formatLogTime(value: string | null | undefined) {
  if (!value) return "--:--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--:--"
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
}

function getLogText(title: string | null | undefined) {
  return title || "\u544a\u8b66\u65e5\u5fd7"
}

function getSeverityMeta(severity: string | null | undefined) {
  switch ((severity || "").toUpperCase()) {
    case "CRITICAL":
      return {
        label: "\u7d27\u6025",
        cardClass: "border-red-200 bg-red-50/80 hover:bg-red-50",
        iconClass: "bg-red-100 text-red-500",
        titleClass: "text-red-950",
        badgeClass: "bg-red-500 text-white hover:bg-red-500",
      }
    case "HIGH":
      return {
        label: "\u4e25\u91cd",
        cardClass: "border-red-200 bg-red-50/70 hover:bg-red-50",
        iconClass: "bg-red-100 text-red-500",
        titleClass: "text-red-950",
        badgeClass: "bg-red-100 text-red-700 hover:bg-red-100",
      }
    case "MEDIUM":
      return {
        label: "\u8b66\u544a",
        cardClass: "border-amber-200 bg-amber-50/80 hover:bg-amber-50",
        iconClass: "bg-amber-100 text-amber-600",
        titleClass: "text-amber-950",
        badgeClass: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      }
    case "LOW":
      return {
        label: "\u63d0\u793a",
        cardClass: "border-sky-200 bg-sky-50/80 hover:bg-sky-50",
        iconClass: "bg-sky-100 text-sky-600",
        titleClass: "text-sky-950",
        badgeClass: "bg-sky-100 text-sky-700 hover:bg-sky-100",
      }
    default:
      return {
        label: "\u672a\u77e5",
        cardClass: "border-border bg-muted/50 hover:bg-muted",
        iconClass: "bg-slate-100 text-slate-500",
        titleClass: "text-foreground",
        badgeClass: "bg-slate-100 text-slate-600 hover:bg-slate-100",
      }
  }
}

export default function HomePage() {
  const { currentPlant } = usePlantSelection()

  const [lightOn, setLightOn] = useState(true)
  const [fanOn, setFanOn] = useState(true)
  const [realtimeData, setRealtimeData] = useState<HomeRealtimeData | null>(null)
  const [realtimeError, setRealtimeError] = useState<string | null>(null)

  // currentPlant.plantId 对应后端 plantId
  const plantApiId = currentPlant.plantId

  const previewSensorData = realtimeData
    ? {
        temperature: realtimeData.environment.temperature ?? 24,
        humidity:    realtimeData.environment.humidity    ?? 60,
        light:       realtimeData.environment.lightLux    ?? 500,
        hasHuman:    realtimeData.infrared.currentDetected,
        isFallen:    realtimeData.tilt.hasAlert,
      }
    : { temperature: 24, humidity: 60, light: 500, hasHuman: false, isFallen: false }

  // 切换植物时重置实时数据
  useEffect(() => {
    setRealtimeData(null)
    setRealtimeError(null)
  }, [plantApiId])

  // 轮询实时数据
  useEffect(() => {
    let cancelled = false

    const loadRealtime = async () => {
      const token = window.localStorage.getItem("plantcloud_token") || ""
      if (!token) return
      try {
        const nextData = await getHomeRealtime(plantApiId, token)
        if (!cancelled) { setRealtimeData(nextData); setRealtimeError(null) }
      } catch (error) {
        if (!cancelled) setRealtimeError(error instanceof Error ? error.message : "实时数据加载失败")
      }
    }

    void loadRealtime()
    const timer = window.setInterval(() => void loadRealtime(), POLL_INTERVAL_MS)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [plantApiId])

  const getTempStatus = () => {
    switch (realtimeData?.environment.temperatureStatus) {
      case "HIGH":   return { label: "偏高", cls: "bg-amber-100 text-amber-700" }
      case "LOW":    return { label: "偏低", cls: "bg-sky-100 text-sky-700" }
      case "NORMAL": return { label: "正常", cls: "bg-green-100 text-green-700" }
      default:       return { label: "未知", cls: "bg-gray-100 text-gray-600" }
    }
  }

  const getHumidStatus = () => {
    switch (realtimeData?.environment.humidityStatus) {
      case "HIGH":   return { label: "偏高", cls: "bg-amber-100 text-amber-700" }
      case "LOW":    return { label: "偏低", cls: "bg-sky-100 text-sky-700" }
      case "NORMAL": return { label: "正常", cls: "bg-green-100 text-green-700" }
      default:       return { label: "未知", cls: "bg-gray-100 text-gray-600" }
    }
  }

  const getLuxStatus = () => {
    switch (realtimeData?.environment.lightStatus) {
      case "HIGH":   return { label: "过强", cls: "bg-red-100 text-red-700" }
      case "LOW":    return { label: "不足", cls: "bg-amber-100 text-amber-700" }
      case "NORMAL": return { label: "适宜", cls: "bg-green-100 text-green-700" }
      default:       return { label: "未知", cls: "bg-gray-100 text-gray-600" }
    }
  }

  const getAlertStatus = () => {
    const severity = (realtimeData?.abnormal.latestSeverity || "").toUpperCase()
    if (!realtimeData?.abnormal.hasAlert) return { label: "正常", cls: "bg-green-100 text-green-700" }
    if (severity === "HIGH" || severity === "DANGER")     return { label: "严重", cls: "bg-red-100 text-red-700" }
    if (severity === "MEDIUM" || severity === "WARNING")  return { label: "警告", cls: "bg-amber-100 text-amber-700" }
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
                      activityLogs.map((log, index) => {
                        const severityMeta = getSeverityMeta(log.severity)
                        return (
                          <div
                            key={`${log.id}-${index}`}
                            className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${severityMeta.cardClass}`}
                          >
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${severityMeta.iconClass}`}>
                              <AlertTriangle className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-sm font-medium ${severityMeta.titleClass}`}>
                                {getLogText(log.title)}
                              </p>
                              <p className="mt-1 text-xs font-mono text-muted-foreground">
                                {formatLogTime(log.createdAt)}
                              </p>
                            </div>
                            <Badge className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${severityMeta.badgeClass}`}>
                              {severityMeta.label}
                            </Badge>
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
                <CardHeader className="pb-2 pt-4 px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{currentPlant.emoji} {currentPlant.name}</span>
                      <span className="text-xs text-muted-foreground">当前绑定植物</span>
                    </div>
                    <GpsBadge />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center flex-1 min-h-0 py-3">
                  <div className="relative mb-3 w-full flex justify-center flex-1 min-h-0">
                    <div className="relative border-2 border-primary/20 rounded-3xl p-4 bg-gradient-to-br from-primary/5 to-transparent w-full max-w-md flex items-center justify-center">
                      <div className="pointer-events-none absolute inset-0 bg-primary/5 rounded-full blur-3xl scale-150" />
                      <div className="relative z-10 h-full min-h-[24rem] w-full">
                        <PlantModelViewer modelPath="/models/zhizihua.glb" />
                      </div>
                    </div>
                  </div>

                  {/* 控制面板 */}
                  <div className="pointer-events-auto relative z-20 flex shrink-0 items-center justify-between w-full max-w-xl bg-muted/30 rounded-2xl p-4 border">
                    <DeviceControl type="light" isOn={lightOn} onToggle={setLightOn} />
                    <div className="w-px h-8 bg-border mx-2" />
                    <DeviceControl type="fan" isOn={fanOn} onToggle={setFanOn} />
                    <div className="w-px h-8 bg-border mx-2" />
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
