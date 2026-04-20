import { getHomeRealtime, type HomeRealtimeData } from "@/lib/home-api"
import { DEFAULT_PLANT_ID, getPlantApiId, getPlantOption, SELECTED_PLANT_STORAGE_KEY } from "@/lib/plants"
import { listStrategies, type StrategyItem } from "@/lib/strategy-api"

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8080"
export const SELECTED_PLANT_PROFILE_STORAGE_KEY = "plantcloud_selected_plant_profile"

type ApiResult<T> = {
  code?: number
  message?: string
  data?: T
}

type HistoryPoint = {
  time: string
  value: number
}

export type EnvironmentHistory = {
  plantId: number
  plantType: string | null
  startTime: string
  endTime: string
  granularity: string
  metrics: string[]
  temperature: HistoryPoint[]
  humidity: HistoryPoint[]
  light: HistoryPoint[]
}

export type SelectedPlantSnapshot = {
  id: string
  plantId: number
  name: string
  emoji: string
}

export type PlantContextPayload = {
  selectedPlant: SelectedPlantSnapshot
  realtime: HomeRealtimeData | null
  sevenDayHistory: EnvironmentHistory | null
  currentStrategies: StrategyItem[]
  contextText: string
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: ApiResult<T> | null = null

  try {
    payload = (await response.json()) as ApiResult<T>
  } catch {
    payload = null
  }

  if (!response.ok || (payload && typeof payload.code === "number" && payload.code !== 0)) {
    throw new Error(payload?.message || "Request failed")
  }

  return (payload?.data ?? payload) as T
}

function buildHeaders(token: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function formatDateTimeLocal(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function getSevenDayRange() {
  const end = new Date()
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
  return {
    start: formatDateTimeLocal(start),
    end: formatDateTimeLocal(end),
  }
}

export function readSelectedPlantSnapshot(): SelectedPlantSnapshot {
  if (typeof window === "undefined") {
    const fallback = getPlantOption(DEFAULT_PLANT_ID)
    return {
      id: fallback.id,
      plantId: fallback.apiId,
      name: fallback.name,
      emoji: fallback.emoji,
    }
  }

  const rawProfile = window.localStorage.getItem(SELECTED_PLANT_PROFILE_STORAGE_KEY)
  if (rawProfile) {
    try {
      const parsed = JSON.parse(rawProfile) as SelectedPlantSnapshot
      if (parsed.id && parsed.plantId && parsed.name) {
        return parsed
      }
    } catch {
      // Fallback below.
    }
  }

  const selectedPlantId = window.localStorage.getItem(SELECTED_PLANT_STORAGE_KEY) || DEFAULT_PLANT_ID
  const option = getPlantOption(selectedPlantId)
  return {
    id: option.id,
    plantId: getPlantApiId(option.id),
    name: option.name,
    emoji: option.emoji,
  }
}

export async function getSevenDayEnvironmentHistory(
  plant: SelectedPlantSnapshot,
  token: string,
) {
  const range = getSevenDayRange()
  const search = new URLSearchParams({
    start_time: range.start,
    end_time: range.end,
    granularity: "day",
    metrics: "temperature,humidity,light",
    plant_type: plant.name,
  })

  const response = await fetch(`${BACKEND_BASE_URL}/visualization/history?${search.toString()}`, {
    cache: "no-store",
    headers: buildHeaders(token),
  })

  return parseResponse<EnvironmentHistory>(response)
}

function summarizeSeries(label: string, unit: string, points: HistoryPoint[] | undefined) {
  if (!points || points.length === 0) {
    return `- ${label}: 近七日暂无数据`
  }

  const values = points.map((point) => point.value).filter((value) => Number.isFinite(value))
  if (values.length === 0) {
    return `- ${label}: 近七日暂无有效数据`
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  return `- ${label}: 平均 ${average.toFixed(1)}${unit}, 最低 ${min.toFixed(1)}${unit}, 最高 ${max.toFixed(1)}${unit}`
}

export function buildPlantContextText(payload: Omit<PlantContextPayload, "contextText">) {
  const realtime = payload.realtime
  const history = payload.sevenDayHistory
  const strategyLines =
    payload.currentStrategies.length > 0
      ? payload.currentStrategies.map((strategy) => {
          const enabledText = strategy.enabled ? "已启用" : "已停用"
          const threshold = strategy.thresholdMin ?? "-"
          const timeText =
            strategy.timeLimitEnabled && strategy.startTime && strategy.endTime
              ? `, 时间 ${strategy.startTime}-${strategy.endTime}`
              : ""
          return `- ${strategy.strategyName}: ${enabledText}, ${strategy.metricType} ${strategy.operatorType} ${threshold}, ${strategy.actionType} ${strategy.actionValue ?? ""}${timeText}`
        })
      : ["- 暂无已配置策略"]

  return [
    "当前主页所选植物数据：",
    `- 植物: ${payload.selectedPlant.emoji} ${payload.selectedPlant.name} (plantId=${payload.selectedPlant.plantId})`,
    realtime
      ? `- 当前温度: ${realtime.environment.temperature ?? "未知"}°C，状态: ${realtime.environment.temperatureStatus ?? "未知"}`
      : "- 当前温度: 未获取到",
    realtime
      ? `- 当前湿度: ${realtime.environment.humidity ?? "未知"}% RH，状态: ${realtime.environment.humidityStatus ?? "未知"}`
      : "- 当前湿度: 未获取到",
    realtime
      ? `- 当前光照: ${realtime.environment.lightLux ?? "未知"} lux，状态: ${realtime.environment.lightStatus ?? "未知"}`
      : "- 当前光照: 未获取到",
    realtime
      ? `- 人体红外: ${realtime.infrared.currentDetected ? "当前检测到靠近" : "当前未检测到靠近"}，今日靠近 ${realtime.infrared.approachCount} 次`
      : "- 人体红外: 未获取到",
    realtime
      ? `- 异常提醒: ${realtime.abnormal.hasAlert ? realtime.abnormal.latestTitle || realtime.abnormal.latestContent || "存在异常" : "暂无未处理异常"}`
      : "- 异常提醒: 未获取到",
    "近七日环境趋势：",
    summarizeSeries("温度", "°C", history?.temperature),
    summarizeSeries("湿度", "% RH", history?.humidity),
    summarizeSeries("光照", " lux", history?.light),
    "当前已有自动化策略：",
    ...strategyLines,
  ].join("\n")
}

export async function getPlantContextPayload(): Promise<PlantContextPayload> {
  const token = typeof window === "undefined" ? "" : window.localStorage.getItem("plantcloud_token") || ""
  const selectedPlant = readSelectedPlantSnapshot()
  const [realtimeResult, historyResult, strategiesResult] = await Promise.allSettled([
    getHomeRealtime(selectedPlant.plantId, token),
    getSevenDayEnvironmentHistory(selectedPlant, token),
    listStrategies({ plantId: selectedPlant.plantId }),
  ])

  const realtime = realtimeResult.status === "fulfilled" ? realtimeResult.value : null
  const sevenDayHistory = historyResult.status === "fulfilled" ? historyResult.value : null
  const currentStrategies = strategiesResult.status === "fulfilled" ? strategiesResult.value : []

  return {
    selectedPlant,
    realtime,
    sevenDayHistory,
    currentStrategies,
    contextText: buildPlantContextText({
      selectedPlant,
      realtime,
      sevenDayHistory,
      currentStrategies,
    }),
  }
}
