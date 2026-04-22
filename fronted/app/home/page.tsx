"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { PlantModelViewer } from "@/components/PlantModelViewer"
import { GpsBadge } from "@/components/gps-badge"
import { DeviceControl } from "@/components/device-control"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { controlHomeDevice, getHomeRealtime, type HomeRealtimeData, type HomeControlTarget } from "@/lib/home-api"
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

function getConnectionMeta(connected: boolean | null | undefined, statusUpdatedAt: string | null | undefined, onlineStatus: string | null | undefined) {
  if (connected === true) {
    return {
      title: "在线",
      detail: statusUpdatedAt ? `最近更新 ${formatLogTime(statusUpdatedAt)}` : `状态 ${onlineStatus || "ONLINE"}`,
      dotClass: "bg-emerald-500",
      cardClass: "border-emerald-200 bg-emerald-50/70",
      iconClass: "bg-emerald-100 ring-1 ring-emerald-200/70",
      badgeClass: "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    }
  }

  if (connected === false) {
    return {
      title: "离线",
      detail: statusUpdatedAt ? `最近更新 ${formatLogTime(statusUpdatedAt)}` : `状态 ${onlineStatus || "OFFLINE"}`,
      dotClass: "bg-red-500",
      cardClass: "border-red-200 bg-red-50/70",
      iconClass: "bg-red-100 ring-1 ring-red-200/70",
      badgeClass: "border-red-200 bg-red-100 text-red-700 hover:bg-red-100",
    }
  }

  return {
    title: "未知",
    detail: onlineStatus ? `状态 ${onlineStatus}` : "等待设备上报",
    dotClass: "bg-gray-400",
    cardClass: "border-border bg-card",
    iconClass: "bg-muted",
    badgeClass: "border-border bg-background text-muted-foreground hover:bg-background",
  }
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
        timeClass: "text-muted-foreground",
        badgeClass: "bg-red-500 text-white hover:bg-red-500",
      }
    case "HIGH":
      return {
        label: "\u4e25\u91cd",
        cardClass: "border-red-200 bg-red-50/70 hover:bg-red-50",
        iconClass: "bg-red-100 text-red-500",
        titleClass: "text-red-950",
        timeClass: "text-muted-foreground",
        badgeClass: "bg-red-100 text-red-700 hover:bg-red-100",
      }
    case "MEDIUM":
      return {
        label: "\u8b66\u544a",
        cardClass: "border-amber-200 bg-amber-50/80 hover:bg-amber-50",
        iconClass: "bg-amber-100 text-amber-600",
        titleClass: "text-amber-950",
        timeClass: "text-muted-foreground",
        badgeClass: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      }
    case "LOW":
      return {
        label: "\u63d0\u793a",
        cardClass: "border-sky-200 bg-sky-50/80 hover:bg-sky-50",
        iconClass: "bg-sky-100 text-sky-600",
        titleClass: "text-sky-950",
        timeClass: "text-muted-foreground",
        badgeClass: "bg-sky-100 text-sky-700 hover:bg-sky-100",
      }
    default:
      return {
        label: "\u672a\u77e5",
        cardClass: "border-border bg-muted/50 hover:bg-muted",
        iconClass: "bg-slate-100 text-slate-500",
        titleClass: "text-foreground",
        timeClass: "text-muted-foreground",
        badgeClass: "bg-slate-100 text-slate-600 hover:bg-slate-100",
      }
  }
}

function isResolvedLog(status: string | null | undefined) {
  return (status || "UNRESOLVED").toUpperCase() === "RESOLVED"
}

function getLogCreatedTime(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function sortActivityLogs(logs: HomeRealtimeData["activityLogs"]) {
  return [...logs].sort((left, right) => {
    const leftResolved = isResolvedLog(left.status)
    const rightResolved = isResolvedLog(right.status)

    if (leftResolved !== rightResolved) {
      return leftResolved ? 1 : -1
    }

    return getLogCreatedTime(right.createdAt) - getLogCreatedTime(left.createdAt)
  })
}

function getActivityLogMeta(log: HomeRealtimeData["activityLogs"][number]) {
  if (!isResolvedLog(log.status)) {
    return getSeverityMeta(log.severity)
  }

  return {
    label: "已解决",
    cardClass: "border-slate-200 bg-slate-50/80 hover:bg-slate-50",
    iconClass: "bg-slate-100 text-slate-400",
    titleClass: "text-slate-500",
    timeClass: "text-slate-400",
    badgeClass: "bg-slate-100 text-slate-500 hover:bg-slate-100",
  }
}

export default function HomePage() {
  const { currentPlant } = usePlantSelection()

  const [realtimeData, setRealtimeData] = useState<HomeRealtimeData | null>(null)
  const [realtimeError, setRealtimeError] = useState<string | null>(null)
  const [controlPending, setControlPending] = useState<HomeControlTarget | null>(null)
  const [, setPlantState] = useState<"healthy" | "happy" | "dark" | "thirsty" | "hot" | "cold" | "fallen">("healthy")

  // currentPlant.plantId 对应后端 plantId
  const plantApiId = currentPlant.plantId

  const previewSensorData = {
    temperature: realtimeData?.environment.temperature ?? null,
    humidity:    realtimeData?.environment.humidity    ?? null,
    light:       realtimeData?.environment.lightLux    ?? null,
    hasHuman:    realtimeData?.infrared.currentDetected ?? false,
    isFallen:    realtimeData?.tilt.hasAlert ?? false,
  }

  // 切换植物时重置实时数据
  useEffect(() => {
    setRealtimeData(null)
    setRealtimeError(null)
  }, [plantApiId])

  useEffect(() => {
    console.info("[CTRL][HOME] home control bundle active", {
      plantId: plantApiId,
      marker: "home-control-click-debug-20260422",
    })
  }, [plantApiId])

  // 轮询实时数据
  useEffect(() => {
    let cancelled = false

    const loadRealtime = async () => {
      const token = window.localStorage.getItem("plantcloud_token") || ""
      if (!token) return
      try {
        const nextData = await getHomeRealtime(plantApiId, token)
        if (!cancelled) {
          console.info("[CTRL][HOME] realtime loaded", {
            plantId: plantApiId,
            deviceId: nextData.device.deviceId,
            deviceCode: nextData.device.deviceCode,
            onlineStatus: nextData.device.onlineStatus,
            fanStatus: nextData.device.fanStatus,
            lightStatus: nextData.device.lightStatus,
          })
          setRealtimeData(nextData)
          setRealtimeError(null)
        }
      } catch (error) {
        if (!cancelled) setRealtimeError(error instanceof Error ? error.message : "实时数据加载失败")
      }
    }

    void loadRealtime()
    const timer = window.setInterval(() => void loadRealtime(), POLL_INTERVAL_MS)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [plantApiId])

  // 根据传感器数据推断植物状态
  useEffect(() => {
    if      (previewSensorData.isFallen)                                            setPlantState("fallen")
    else if (previewSensorData.temperature !== null && previewSensorData.temperature > 30) setPlantState("hot")
    else if (previewSensorData.temperature !== null && previewSensorData.temperature < 15) setPlantState("cold")
    else if (previewSensorData.humidity !== null && previewSensorData.humidity < 40)       setPlantState("thirsty")
    else if (previewSensorData.light !== null && previewSensorData.light < 200)            setPlantState("dark")
    else if (previewSensorData.hasHuman)                                            setPlantState("happy")
    else                                                                            setPlantState("healthy")
  }, [previewSensorData])

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

  const activityLogs = sortActivityLogs(realtimeData?.activityLogs ?? [])
  const connectionMeta = getConnectionMeta(
    realtimeData?.device.connected,
    realtimeData?.device.statusUpdatedAt,
    realtimeData?.device.onlineStatus,
  )

  const lightOn = realtimeData?.device.lightOn ?? null
  const fanOn = realtimeData?.device.fanOn ?? null

  const refreshRealtimeData = async (token: string) => {
    const nextData = await getHomeRealtime(plantApiId, token)
    setRealtimeData(nextData)
    setRealtimeError(null)
    return nextData
  }

  const handleDeviceToggle = async (target: HomeControlTarget, nextValue: boolean) => {
    const device = realtimeData?.device
    const deviceId = device?.deviceId
    console.info("[CTRL][HOME] handleDeviceToggle entered", {
      target,
      nextValue,
      plantId: plantApiId,
      deviceId,
      controlPending,
      deviceCode: device?.deviceCode,
      onlineStatus: device?.onlineStatus,
      fanStatus: device?.fanStatus,
      lightStatus: device?.lightStatus,
    })

    if (controlPending) {
      console.warn("[CTRL][HOME] toggle ignored because another command is pending", {
        target,
        controlPending,
      })
      return
    }

    const token = window.localStorage.getItem("plantcloud_token") || ""
    if (!token) {
      console.warn("[CTRL][HOME] toggle blocked because token is missing", { target })
      setRealtimeError("请先登录后再控制设备")
      return
    }

    if (deviceId === null || deviceId === undefined) {
      console.warn("[CTRL][HOME] toggle blocked because E53IA1 deviceId is missing", {
        target,
        plantId: plantApiId,
        device,
      })
      setRealtimeError("未获取到 E53IA1 设备，无法下发控制指令")
      return
    }

    try {
      setControlPending(target)
      setRealtimeError(null)
      console.info("[CTRL][HOME] calling controlHomeDevice", {
        target,
        plantId: plantApiId,
        deviceId,
        commandValue: nextValue ? "ON" : "OFF",
      })
      await controlHomeDevice(plantApiId, deviceId, target, nextValue, token)
      console.info("[CTRL][HOME] controlHomeDevice success", {
        target,
        plantId: plantApiId,
        deviceId,
        commandValue: nextValue ? "ON" : "OFF",
      })
      try {
        await refreshRealtimeData(token)
        ;[800, 1800, 3200].forEach((delay) => window.setTimeout(() => {
          void refreshRealtimeData(token).catch(() => undefined)
        }, delay))
      } catch (error) {
        console.warn("[CTRL][HOME] refresh after control failed", error)
        setRealtimeError(error instanceof Error ? error.message : "实时状态刷新失败")
      }
    } catch (error) {
      console.error("[CTRL][HOME] controlHomeDevice failed", error)
      setRealtimeError(error instanceof Error ? error.message : "设备控制失败")
    } finally {
      setControlPending(null)
    }
  }

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
                        const severityMeta = getActivityLogMeta(log)
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
                              <p className={`mt-1 text-xs font-mono ${severityMeta.timeClass}`}>
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
                    <div className="pointer-events-none relative border-2 border-primary/20 rounded-3xl p-4 bg-gradient-to-br from-primary/5 to-transparent w-full max-w-xs flex items-center justify-center">
                      <div className="pointer-events-none absolute inset-0 bg-primary/5 rounded-full blur-3xl scale-150" />
                      <div className="relative z-10 h-full min-h-[24rem] w-full">
                        <PlantModelViewer modelPath="/models/zhizihua.glb" />
                      </div>
                    </div>
                  </div>

                  {/* 控制面板 */}
                  <div className="pointer-events-auto relative z-50 grid w-full max-w-[640px] shrink-0 grid-cols-1 gap-2.5 rounded-2xl border bg-muted/25 p-3 shadow-sm sm:grid-cols-3">
                    <DeviceControl
                      type="light"
                      isOn={lightOn}
                      disabled={controlPending !== null || lightOn === null}
                      onToggle={(value) => void handleDeviceToggle("light", value)}
                    />
                    <DeviceControl
                      type="fan"
                      isOn={fanOn}
                      disabled={controlPending !== null || fanOn === null}
                      onToggle={(value) => void handleDeviceToggle("fan", value)}
                    />
                    <div className={`flex h-[72px] min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 shadow-sm ${connectionMeta.cardClass}`}>
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${connectionMeta.iconClass}`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${connectionMeta.dotClass}`} />
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="whitespace-nowrap text-sm font-semibold text-foreground">小熊派</p>
                        <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">{connectionMeta.detail}</p>
                      </div>
                      <Badge variant="outline" className={`flex h-7 w-11 shrink-0 items-center justify-center rounded-full px-0 text-[11px] font-semibold tracking-normal ${connectionMeta.badgeClass}`}>
                        {connectionMeta.title}
                      </Badge>
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