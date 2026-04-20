const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8080"

type ApiResult<T> = {
  code?: number
  message?: string
  data?: T
}

type EnvironmentData = {
  plantId: number
  temperature: number | null
  humidity: number | null
  lightLux: number | null
  temperatureStatus: string | null
  humidityStatus: string | null
  lightStatus: string | null
  collectedAt: string | null
}

type InfraredData = {
  plantId: number | null
  currentDetected: boolean
  latestEventTitle: string | null
  latestEventContent: string | null
  latestDetectedAt: string | null
  approachCount: number
  leaveCount: number
}

type AlertItem = {
  id: string
  plantId: number | null
  alertType: string | null
  severity: string | null
  title: string | null
  content: string | null
  status: string | null
  createdAt: string | null
}

type PageResult<T> = {
  current: number
  pageSize: number
  total: number
  records: T[]
}

export type HomeRealtimeData = {
  environment: EnvironmentData
  infrared: InfraredData
  activityLogs: AlertItem[]
  tilt: {
    hasAlert: boolean
    count: number
    latestTitle: string | null
    latestContent: string | null
    latestCreatedAt: string | null
  }
  abnormal: {
    count: number
    hasAlert: boolean
    latestType: string | null
    latestTitle: string | null
    latestContent: string | null
    latestSeverity: string | null
    latestCreatedAt: string | null
  }
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

export async function getHomeRealtime(plantId: number, token: string) {
  const headers: HeadersInit = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {}

  const [environmentResponse, infraredResponse, alertsResponse, alertLogsResponse] = await Promise.all([
    fetch(`${BACKEND_BASE_URL}/monitoring/environment/current?plantId=${plantId}`, {
      cache: "no-store",
      headers,
    }),
    fetch(`${BACKEND_BASE_URL}/devices/infrared`, {
      cache: "no-store",
      headers,
    }),
    fetch(`${BACKEND_BASE_URL}/alerts?status=UNRESOLVED`, {
      cache: "no-store",
      headers,
    }),
    fetch(`${BACKEND_BASE_URL}/alerts/logs?current=1&pageSize=50`, {
      cache: "no-store",
      headers,
    }),
  ])

  const [environment, infrared, alerts, alertLogs] = await Promise.all([
    parseResponse<EnvironmentData>(environmentResponse),
    parseResponse<InfraredData>(infraredResponse),
    parseResponse<AlertItem[]>(alertsResponse),
    parseResponse<PageResult<AlertItem>>(alertLogsResponse),
  ])

  const selectedPlantAlerts = alerts.filter((alert) => alert.plantId === plantId)
  const effectiveAlerts = selectedPlantAlerts.length > 0 ? selectedPlantAlerts : alerts
  const allLogs = alertLogs.records || []
  const selectedPlantLogs = allLogs.filter((log) => log.plantId === plantId)
  const effectiveLogs = selectedPlantLogs.length > 0 ? selectedPlantLogs : allLogs
  const tiltAlerts = effectiveAlerts.filter((alert) => (alert.alertType || "").toUpperCase() === "TILT_ABNORMAL")
  const visibleAlerts = effectiveAlerts.filter((alert) => (alert.alertType || "").toUpperCase() !== "TILT_ABNORMAL")
  const latestTiltAlert = tiltAlerts[0] || null
  const latestVisibleAlert = visibleAlerts[0] || null

  return {
    environment,
    infrared,
    activityLogs: effectiveLogs,
    tilt: {
      count: tiltAlerts.length,
      hasAlert: Boolean(latestTiltAlert),
      latestTitle: latestTiltAlert?.title || null,
      latestContent: latestTiltAlert?.content || null,
      latestCreatedAt: latestTiltAlert?.createdAt || null,
    },
    abnormal: {
      count: visibleAlerts.length,
      hasAlert: Boolean(latestVisibleAlert),
      latestType: latestVisibleAlert?.alertType || null,
      latestTitle: latestVisibleAlert?.title || null,
      latestContent: latestVisibleAlert?.content || null,
      latestSeverity: latestVisibleAlert?.severity || null,
      latestCreatedAt: latestVisibleAlert?.createdAt || null,
    },
  } satisfies HomeRealtimeData
}
