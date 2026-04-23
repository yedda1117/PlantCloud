"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { AuthGuard } from "@/components/auth-guard"
import { PlantModelViewer } from "@/components/PlantModelViewer"
import { controlHomeDevice, getHomeRealtime, type HomeControlTarget, type HomeRealtimeData } from "@/lib/home-api"
import { usePlantSelection } from "@/context/plant-selection"
import {
  AlertTriangle,
  Droplets,
  Fan,
  Lightbulb,
  MapPin,
  Thermometer,
  Trees,
  Wind,
} from "lucide-react"

const GpsMap = dynamic(() => import("@/components/gps-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-black/5" />,
})

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8080"
const POLL_INTERVAL_MS = 5000

type ApiResult<T> = {
  code?: number
  message?: string
  data?: T
}

type GpsLocation = {
  id: number | string
  plantId: number | string
  deviceId: number | string | null
  longitude: number | string | null
  latitude: number | string | null
  createdAt: string | null
}

type GpsState = {
  latest: GpsLocation | null
  loading: boolean
  error: boolean
}

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

function formatLocationTime(value: string | null | undefined) {
  if (!value) return "--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatCoordinate(value: number | string | null | undefined) {
  const parsed = toNumber(value)
  return parsed === null ? "--" : parsed.toFixed(6)
}

function isResolvedLog(status: string | null | undefined) {
  return (status || "UNRESOLVED").toUpperCase() === "RESOLVED"
}

function getLogCreatedTime(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function getLatestLocation(locations: GpsLocation[]) {
  if (!locations.length) return null
  return [...locations].sort((a, b) => {
    const left = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const right = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return right - left
  })[0] ?? null
}

async function fetchGpsLocations(plantId: number, token: string) {
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

  const response = await fetch(`${BACKEND_BASE_URL}/gps/locations?plantId=${encodeURIComponent(String(plantId))}`, {
    cache: "no-store",
    headers,
  })

  let payload: ApiResult<GpsLocation[]> | null = null
  try {
    payload = (await response.json()) as ApiResult<GpsLocation[]>
  } catch {
    payload = null
  }

  if (!response.ok || (payload && typeof payload.code === "number" && payload.code !== 0)) {
    throw new Error(payload?.message || "\u5b9a\u4f4d\u83b7\u53d6\u5931\u8d25")
  }

  return Array.isArray(payload?.data) ? payload.data : []
}

function getLogText(title: string | null | undefined) {
  return title || "\u544a\u8b66\u65e5\u5fd7"
}

function getSeverityLabel(severity: string | null | undefined) {
  switch ((severity || "").toUpperCase()) {
    case "CRITICAL":
      return "\u7d27\u6025"
    case "HIGH":
      return "\u4e25\u91cd"
    case "MEDIUM":
      return "\u8b66\u544a"
    case "LOW":
      return "\u63d0\u793a"
    default:
      return "\u672a\u77e5"
  }
}

function getSeverityTone(severity: string | null | undefined, resolved: boolean) {
  if (resolved) return "text-stone-400"
  switch ((severity || "").toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return "text-red-600"
    case "MEDIUM":
      return "text-amber-600"
    case "LOW":
      return "text-sky-600"
    default:
      return "text-stone-500"
  }
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

function StatusMetric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Thermometer
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="aspect-[1.08] rounded-[1.8rem] border border-white/35 bg-[linear-gradient(180deg,color(display-p3_0.62_0.92_0.76/0.82),oklch(0.696_0.17_162.48/0.68))] p-4 shadow-[0_18px_40px_rgba(70,120,100,0.12),0_0_26px_color(display-p3_0.42_0.86_0.62/0.24)] backdrop-blur-md">
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-emerald-900/70">
          <Icon className="h-4 w-4 text-emerald-700 drop-shadow-[0_0_8px_rgba(16,185,129,0.28)]" />
          <span>{label}</span>
        </div>
        <div>
          <p className="text-2xl font-light tracking-tight text-emerald-950">{value}</p>
          <p className="mt-2 text-xs leading-5 text-emerald-900/68">{hint}</p>
        </div>
      </div>
    </div>
  )
}

function ControlLine({
  icon: Icon,
  label,
  isOn,
  disabled,
  onToggle,
}: {
  icon: typeof Fan
  label: string
  isOn: boolean | null
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || isOn === null}
      className="group flex w-full items-center justify-between gap-4 py-2 text-left transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${isOn ? "text-emerald-700" : "text-stone-500"} ${label === "风扇" && isOn ? "animate-spin" : ""}`} />
        <span>
          <span className="block text-sm uppercase tracking-[0.18em] text-stone-500">{label}</span>
          <span className="mt-1 block text-lg font-light text-stone-800">
            {isOn === null ? "\u540c\u6b65\u4e2d" : isOn ? "\u5df2\u5f00\u542f" : "\u5df2\u5173\u95ed"}
          </span>
        </span>
      </span>
      <span className={`text-xs uppercase tracking-[0.22em] ${isOn ? "text-emerald-700" : "text-stone-500"} group-hover:text-stone-900`}>
        {isOn === null ? "--" : isOn ? "Turn Off" : "Turn On"}
      </span>
    </button>
  )
}

export default function HomePage() {
  const { currentPlant } = usePlantSelection()

  const [realtimeData, setRealtimeData] = useState<HomeRealtimeData | null>(null)
  const [realtimeError, setRealtimeError] = useState<string | null>(null)
  const [controlPending, setControlPending] = useState<HomeControlTarget | null>(null)
  const [gpsState, setGpsState] = useState<GpsState>({
    latest: null,
    loading: true,
    error: false,
  })
  const [, setPlantState] = useState<"healthy" | "happy" | "dark" | "thirsty" | "hot" | "cold" | "fallen">("healthy")

  const plantApiId = currentPlant.plantId

  const previewSensorData = {
    temperature: realtimeData?.environment.temperature ?? null,
    humidity: realtimeData?.environment.humidity ?? null,
    light: realtimeData?.environment.lightLux ?? null,
    hasHuman: realtimeData?.infrared.currentDetected ?? false,
    isFallen: realtimeData?.tilt.hasAlert ?? false,
  }

  useEffect(() => {
    setRealtimeData(null)
    setRealtimeError(null)
    setGpsState({
      latest: null,
      loading: true,
      error: false,
    })
  }, [plantApiId])

  useEffect(() => {
    let cancelled = false

    const loadRealtime = async () => {
      const token = window.localStorage.getItem("plantcloud_token") || ""
      if (!token) return
      try {
        const nextData = await getHomeRealtime(plantApiId, token)
        if (!cancelled) {
          setRealtimeData(nextData)
          setRealtimeError(null)
        }
      } catch (error) {
        if (!cancelled) setRealtimeError(error instanceof Error ? error.message : "实时数据加载失败")
      }
    }

    void loadRealtime()
    const timer = window.setInterval(() => void loadRealtime(), POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [plantApiId])

  useEffect(() => {
    let cancelled = false

    const loadGpsData = async () => {
      try {
        const token = window.localStorage.getItem("plantcloud_token") || ""
        const locations = await fetchGpsLocations(plantApiId, token)
        if (!cancelled) {
          setGpsState({
            latest: getLatestLocation(locations),
            loading: false,
            error: false,
          })
        }
      } catch {
        if (!cancelled) {
          setGpsState({
            latest: null,
            loading: false,
            error: true,
          })
        }
      }
    }

    void loadGpsData()
    return () => {
      cancelled = true
    }
  }, [plantApiId])

  useEffect(() => {
    if (previewSensorData.isFallen) setPlantState("fallen")
    else if (previewSensorData.temperature !== null && previewSensorData.temperature > 30) setPlantState("hot")
    else if (previewSensorData.temperature !== null && previewSensorData.temperature < 15) setPlantState("cold")
    else if (previewSensorData.humidity !== null && previewSensorData.humidity < 40) setPlantState("thirsty")
    else if (previewSensorData.light !== null && previewSensorData.light < 200) setPlantState("dark")
    else if (previewSensorData.hasHuman) setPlantState("happy")
    else setPlantState("healthy")
  }, [previewSensorData])

  const refreshRealtimeData = async (token: string) => {
    const nextData = await getHomeRealtime(plantApiId, token)
    setRealtimeData(nextData)
    setRealtimeError(null)
    return nextData
  }

  const handleDeviceToggle = async (target: HomeControlTarget, nextValue: boolean) => {
    const deviceId = realtimeData?.device.deviceId

    if (controlPending) return

    const token = window.localStorage.getItem("plantcloud_token") || ""
    if (!token) {
      setRealtimeError("请先登录后再控制设备")
      return
    }

    if (deviceId === null || deviceId === undefined) {
      setRealtimeError("未获取到 E53IA1 设备，无法下发控制指令")
      return
    }

    try {
      setControlPending(target)
      setRealtimeError(null)
      await controlHomeDevice(plantApiId, deviceId, target, nextValue, token)
      try {
        await refreshRealtimeData(token)
        ;[800, 1800, 3200].forEach((delay) => window.setTimeout(() => {
          void refreshRealtimeData(token).catch(() => undefined)
        }, delay))
      } catch (error) {
        setRealtimeError(error instanceof Error ? error.message : "实时状态刷新失败")
      }
    } catch (error) {
      setRealtimeError(error instanceof Error ? error.message : "设备控制失败")
    } finally {
      setControlPending(null)
    }
  }

  const activityLogs = useMemo(() => sortActivityLogs(realtimeData?.activityLogs ?? []), [realtimeData?.activityLogs])
  const unresolvedCount = (realtimeData?.abnormal.count ?? 0) + (realtimeData?.tilt.count ?? 0)
  const resolvedCount = activityLogs.filter((log) => isResolvedLog(log.status)).length
  const totalAlertCount = Math.max(unresolvedCount + resolvedCount, 1)
  const unresolvedRatio = Math.min(Math.max(unresolvedCount / totalAlertCount, 0), 1)
  const resolvedRatio = Math.min(Math.max(resolvedCount / totalAlertCount, 0), 1)
  const latestLocation = gpsState.latest
  const latitude = toNumber(latestLocation?.latitude)
  const longitude = toNumber(latestLocation?.longitude)
  const hasLocation = latestLocation !== null && latitude !== null && longitude !== null
  const lightOn = realtimeData?.device.lightOn ?? null
  const fanOn = realtimeData?.device.fanOn ?? null
  const abnormalText = realtimeData?.abnormal.hasAlert
    ? realtimeData.abnormal.latestTitle || realtimeData.abnormal.latestContent || "检测到异常，请及时处理"
    : "当前未发现待处理异常"
  const infraredText = realtimeData?.infrared.currentDetected
    ? realtimeData.infrared.latestEventTitle || "检测到有人靠近植物"
    : realtimeData?.infrared.latestEventTitle || "当前未检测到红外活动"

  function toDMS(value: number | null | undefined, isLat = true) {
    if (value === null || value === undefined) return "--"
    const abs = Math.abs(value)
    const integer = Math.floor(abs)
    const decimals = Math.floor((abs - integer) * 1000) // 三位作为分'
    const decimals2 = Math.floor((abs - integer) * 1000000) % 1000 // 后三位作为分''
    const degree = integer
    const minute = decimals
    const second = decimals2
    const hemi = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W"
    return `${degree}°${String(minute).padStart(3, "0")}' ${String(second).padStart(3, "0")}" ${hemi}`
  }

  return (
    <AuthGuard>
      <div className="h-screen overflow-hidden text-stone-900" style={{ backgroundColor: '#d0e8de' }}>
        <div className="h-full overflow-hidden" style={{ background: 'radial-gradient(circle at top, rgba(208,232,222,0.55), transparent 38%), linear-gradient(135deg, #d0e8de 0%, #eaf6f0 100%)' }}>
          <main className="mx-auto flex h-full max-w-[1600px] items-center overflow-hidden px-6 py-[4vh] xl:px-10">
            <div className="grid h-full max-h-[92vh] w-full grid-cols-1 items-center gap-8 overflow-hidden xl:grid-cols-[320px_minmax(560px,1fr)_360px] xl:gap-10 2xl:grid-cols-[360px_minmax(680px,1fr)_400px]">
              <section className="flex h-full min-h-0 flex-col justify-center gap-6">
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-light uppercase tracking-[0.38em] text-stone-500">GPS Location</p>
                  <div className="aspect-square overflow-hidden rounded-[2rem]">
                    <div className="grid h-full grid-rows-[1fr_auto]">
                      <div className="min-h-0 overflow-hidden rounded-[2rem] bg-black/5">
                        {hasLocation ? (
                          <GpsMap lat={latitude} lng={longitude} plantName={currentPlant.name} />
                        ) : (
                          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-stone-500">
                            {gpsState.error ? "定位获取失败" : gpsState.loading ? "定位加载中" : "暂无定位数据"}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 px-1 pb-1 pt-4">
                        <div className="flex items-center gap-2 text-sm text-stone-700">
                          <MapPin className="h-4 w-4 text-stone-500" />
                          <span>{hasLocation ? `${toDMS(latitude, true)}, ${toDMS(longitude, false)}` : "--"}</span>
                        </div>
                        <p className="text-sm leading-6 text-stone-600">
                          {hasLocation ? `植物 ${currentPlant.name} 最近一次定位更新时间 ${formatLocationTime(latestLocation?.createdAt)}` : "暂未同步到本植物的 GPS 位置记录。"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative w-[calc(100%+2.2rem)] rounded-[2.2rem] border border-stone-400/45 p-6" style={{ marginTop: '15px' }}>
                  <div className="grid grid-cols-2 gap-4">
                    <StatusMetric
                      icon={Thermometer}
                      label="温度"
                      value={formatNumericValue(realtimeData?.environment.temperature, "°C")}
                      hint={realtimeData?.environment.temperatureStatus || "暂无状态"}
                    />
                    <StatusMetric
                      icon={Droplets}
                      label="湿度"
                      value={formatNumericValue(realtimeData?.environment.humidity, "%")}
                      hint={realtimeData?.environment.humidityStatus || "暂无状态"}
                    />
                    <StatusMetric
                      icon={Wind}
                      label="空气质量"
                      value={formatLightValue(realtimeData?.environment.lightLux)}
                      hint={abnormalText}
                    />
                    <StatusMetric
                      icon={Trees}
                      label="红外"
                      value={realtimeData?.infrared.currentDetected ? "Detected" : "Clear"}
                      hint={`${infraredText} · 今日靠近 ${realtimeData?.infrared.approachCount ?? 0} 次`}
                    />
                  </div>
                </div>
              </section>

              <section className="flex h-full min-h-0 flex-col items-center justify-center">
                <div className="mb-4 text-center" style={{ marginTop: '10px' }}>
                  <p className="text-xs font-light uppercase tracking-[0.36em] text-stone-500">Current Plant</p>
                  <div className="relative inline-block">
                    <h1 className="mt-3 text-4xl font-light tracking-[0.08em] text-stone-800">
                      {currentPlant.emoji} {currentPlant.name}
                    </h1>
                    <div aria-hidden className="mt-2 text-4xl font-light tracking-[0.08em] text-stone-800 transform scale-y-[-1] opacity-30">
                      {currentPlant.emoji} {currentPlant.name}
                    </div>
                  </div>
                </div>
                <div className="relative flex h-full min-h-0 w-full items-center justify-center">
                  <div className="pointer-events-none absolute inset-x-[18%] top-[16%] h-28 rounded-full bg-white/45 blur-3xl" />
                  <div className="pointer-events-none absolute inset-x-[22%] bottom-[12%] h-24 rounded-full bg-emerald-100/35 blur-3xl" />
                  <div className="relative h-full min-h-0 w-full">
                    <PlantModelViewer modelPath="/models/zhizihua.glb" className="rounded-none" minimal />
                  </div>
                </div>
              </section>

              <section className="flex h-full min-h-0 flex-col justify-center gap-6 overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="mb-8 flex items-end justify-between gap-6">
                    <div>
                      <p className="text-xs font-light uppercase tracking-[0.36em] text-stone-500">Pending Issues</p>
                      <p className="mt-3 text-5xl font-extralight tracking-tight text-stone-900">{unresolvedCount}</p>
                      <p className="mt-2 text-sm leading-6 text-stone-600">还剩 {unresolvedCount} 条异常未解决，已处理 {resolvedCount} 条。</p>
                    </div>
                    <div className="flex flex-col items-center gap-3 pt-1">
                      <div
                        className="relative h-28 w-28 rounded-full"
                        style={{
                          background: `conic-gradient(rgba(120,120,120,0.28) 0deg ${unresolvedRatio * 360}deg, oklch(0.696 0.17 162.48) ${unresolvedRatio * 360}deg 360deg)`,
                        }}
                      >
                        <div className="absolute inset-[18px] rounded-full bg-[#d0e8de]" />
                        <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.22em] text-emerald-800 drop-shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                          {Math.round(resolvedRatio * 100)}%
                        </div>
                      </div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-800/85 drop-shadow-[0_0_8px_rgba(16,185,129,0.14)]">Resolved</p>
                    </div>
                  </div>

                  <div className="home-log-scroll min-h-0 flex-1 overflow-y-auto pr-2">
                    <div className="space-y-5">
                      {activityLogs.length > 0 ? (
                        activityLogs.map((log, index) => {
                          const resolved = isResolvedLog(log.status)
                          const toneClass = getSeverityTone(log.severity, resolved)
                          return (
                            <div key={`${log.id}-${index}`} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${resolved ? "bg-stone-300" : "bg-stone-700"}`} />
                                {index < activityLogs.length - 1 ? <span className="mt-2 h-full w-px bg-stone-300/55" /> : null}
                              </div>
                              <div className="min-w-0 pb-4">
                                <div className="flex items-center gap-3">
                                  <p className={`text-sm uppercase tracking-[0.22em] ${toneClass}`}>
                                    {resolved ? "已解决" : getSeverityLabel(log.severity)}
                                  </p>
                                  <p className="text-xs text-stone-400">{formatLogTime(log.createdAt)}</p>
                                </div>
                                <p className={`mt-2 text-base leading-7 ${resolved ? "text-stone-400" : "text-stone-800"}`}>
                                  {getLogText(log.title)}
                                </p>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-sm leading-7 text-stone-500">暂无植物动态日志。</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-light uppercase tracking-[0.36em] text-stone-500">Controls</p>
                    </div>
                    {realtimeError ? (
                      <div className="flex items-center gap-2 text-xs text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{realtimeError}</span>
                      </div>
                    ) : null}
                  </div>
                  <ControlLine
                    icon={Lightbulb}
                    label="补光灯"
                    isOn={lightOn}
                    disabled={controlPending !== null}
                    onToggle={() => void handleDeviceToggle("light", !(lightOn ?? false))}
                  />
                  <ControlLine
                    icon={Fan}
                    label="风扇"
                    isOn={fanOn}
                    disabled={controlPending !== null}
                    onToggle={() => void handleDeviceToggle("fan", !(fanOn ?? false))}
                  />
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
