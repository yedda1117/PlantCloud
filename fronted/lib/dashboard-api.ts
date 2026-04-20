const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8080"

type ApiResult<T> = {
  code?: number
  message?: string
  data?: T
}

type HistoryPoint = {
  time: string
  value: number
}

type EnvironmentHistory = {
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

export type CurrentEnvironment = {
  plantId: number
  temperature: number | null
  humidity: number | null
  lightLux: number | null
  temperatureStatus: string | null
  humidityStatus: string | null
  lightStatus: string | null
  collectedAt: string | null
}

type AlertLogItem = {
  id: number
  plantId: number | null
  alertType: string | null
  severity: string | null
  title: string | null
  content: string | null
  metricName: string | null
  metricValue: number | null
  thresholdValue: number | null
  status: string | null
  createdAt: string | null
}

type PageResult<T> = {
  current: number
  pageSize: number
  total: number
  records: T[]
}

export type DashboardData = {
  current: CurrentEnvironment
  monthHistory: EnvironmentHistory
  dayHistory: EnvironmentHistory
  airLogs: AlertLogItem[]
  activityLogs: AlertLogItem[]
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: ApiResult<T> | null = null

  try {
    payload = (await response.json()) as ApiResult<T>
  } catch {
    payload = null
  }

  if (!response.ok || (payload && typeof payload.code === "number" && payload.code !== 0)) {
    throw new ApiError(payload?.message || "Request failed", response.status)
  }

  return (payload?.data ?? payload) as T
}

function buildHeaders(token: string): HeadersInit {
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {}
}

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return {
    start: formatDateTimeLocal(start),
    end: formatDateTimeLocal(end),
  }
}

function getLast24HoursRange() {
  const end = new Date()
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  return {
    start: formatDateTimeLocal(start),
    end: formatDateTimeLocal(end),
  }
}

export async function getDashboardData(plantId: number, token: string): Promise<DashboardData> {
  const headers = buildHeaders(token)
  const monthRange = getMonthRange()
  const dayRange = getLast24HoursRange()

  const [currentResponse, monthHistoryResponse, dayHistoryResponse, alertLogsResponse] = await Promise.all([
    fetch(`${BACKEND_BASE_URL}/monitoring/environment/current?plantId=${plantId}`, {
      cache: "no-store",
      headers,
    }),
    fetch(
      `${BACKEND_BASE_URL}/visualization/history?start_time=${encodeURIComponent(monthRange.start)}&end_time=${encodeURIComponent(monthRange.end)}&granularity=day&metrics=temperature,humidity,light`,
      {
        cache: "no-store",
        headers,
      },
    ),
    fetch(
      `${BACKEND_BASE_URL}/visualization/history?start_time=${encodeURIComponent(dayRange.start)}&end_time=${encodeURIComponent(dayRange.end)}&granularity=hour&metrics=temperature,humidity,light`,
      {
        cache: "no-store",
        headers,
      },
    ),
    fetch(`${BACKEND_BASE_URL}/alerts/logs?current=1&pageSize=100`, {
      cache: "no-store",
      headers,
    }),
  ])

  const [current, monthHistory, dayHistory, alertLogs] = await Promise.all([
    parseResponse<CurrentEnvironment>(currentResponse),
    parseResponse<EnvironmentHistory>(monthHistoryResponse),
    parseResponse<EnvironmentHistory>(dayHistoryResponse),
    parseResponse<PageResult<AlertLogItem>>(alertLogsResponse),
  ])

  const records = alertLogs.records || []
  const selectedPlantLogs = records.filter((item) => item.plantId === plantId)
  const effectiveLogs = selectedPlantLogs.length > 0 ? selectedPlantLogs : records
  const airLogs = effectiveLogs.filter((item) => {
    const alertType = (item.alertType || "").toUpperCase()
    return alertType === "SMOKE_ABNORMAL" || alertType === "AIR_ABNORMAL"
  })

  return {
    current,
    monthHistory,
    dayHistory,
    airLogs,
    activityLogs: effectiveLogs,
  }
}

export async function getCurrentEnvironment(plantId: number, token: string): Promise<CurrentEnvironment> {
  const response = await fetch(`${BACKEND_BASE_URL}/monitoring/environment/current?plantId=${plantId}`, {
    cache: "no-store",
    headers: buildHeaders(token),
  })

  return parseResponse<CurrentEnvironment>(response)
}
