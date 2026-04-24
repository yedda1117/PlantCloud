const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8080"
const IA1_DEVICE_CODE = "E53IA1"

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

type DeviceStatusItem = {
  deviceId: number | string | null
  deviceCode: string | null
  deviceName: string | null
  deviceType: string | null
  onlineStatus: string | null
  currentStatus: string | null
}

type DeviceStatusOverview = {
  plantId: number
  devices: DeviceStatusItem[]
}

type HomeDeviceStatus = {
  deviceId: number | string | null
  deviceCode: string | null
  deviceName: string | null
  onlineStatus: string | null
  connected: boolean | null
  fanStatus: string | null
  fanOn: boolean | null
  lightStatus: string | null
  lightOn: boolean | null
  statusUpdatedAt: string | null
  rawStatus: string | null
}

type ControlCommandResult = {
  commandLogId: number | string | null
  commandName: string | null
  commandValue: string | null
  executeStatus: string | null
  message: string | null
}

export type HomeControlTarget = "light" | "fan"

export type HomeRealtimeData = {
  environment: EnvironmentData
  infrared: InfraredData
  device: HomeDeviceStatus
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

function parseStatusJson(rawStatus: string | null | undefined) {
  if (!rawStatus) return {}
  try {
    const parsed = JSON.parse(rawStatus)
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function getStringField(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" || typeof value === "boolean") return String(value)
  }
  return null
}

function parseSwitchState(value: string | null | undefined) {
  if (!value) return null
  switch (value.trim().toUpperCase()) {
    case "ON":
    case "TURN_ON":
    case "OPEN":
    case "RUNNING":
    case "TRUE":
    case "1":
      return true
    case "OFF":
    case "TURN_OFF":
    case "CLOSE":
    case "CLOSED":
    case "STOPPED":
    case "FALSE":
    case "0":
      return false
    default:
      return null
  }
}

function parseOnlineState(value: string | null | undefined) {
  if (!value) return null
  switch (value.trim().toUpperCase()) {
    case "ONLINE":
      return true
    case "OFFLINE":
      return false
    default:
      return null
  }
}

function findIa1Device(devices: DeviceStatusItem[]) {
  return devices.find((device) => (device.deviceCode || "").toUpperCase() === IA1_DEVICE_CODE)
    || devices.find((device) => (device.deviceType || "").toUpperCase() === "IA1")
    || devices.find((device) => {
      const status = parseStatusJson(device.currentStatus)
      return "fanStatus" in status || "lightStatus" in status || "mqttStatus" in status
    })
    || null
}

function buildHomeDeviceStatus(overview: DeviceStatusOverview): HomeDeviceStatus {
  const device = findIa1Device(overview.devices || [])
  const status = parseStatusJson(device?.currentStatus)
  const mqttStatus = getStringField(status, "mqttStatus", "onlineStatus", "status")
  const statusUpdatedAt = getStringField(status, "statusUpdatedAt", "commandUpdatedAt", "telemetryUpdatedAt")
  const fanStatus = getStringField(status, "fanStatus", "fan_status", "fan")
  const lightStatus = getStringField(status, "lightStatus", "light_status", "light")
  const onlineStatus = device?.onlineStatus || mqttStatus

  return {
    deviceId: device?.deviceId ?? null,
    deviceCode: device?.deviceCode ?? null,
    deviceName: device?.deviceName ?? null,
    onlineStatus: onlineStatus ?? null,
    connected: parseOnlineState(onlineStatus),
    fanStatus,
    fanOn: parseSwitchState(fanStatus),
    lightStatus,
    lightOn: parseSwitchState(lightStatus),
    statusUpdatedAt,
    rawStatus: device?.currentStatus ?? null,
  }
}

export async function getHomeRealtime(plantId: number, token: string) {
  const headers: HeadersInit = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {}

  const [environmentResponse, infraredResponse, deviceStatusResponse, alertsResponse, alertLogsResponse] = await Promise.all([
    fetch(`${BACKEND_BASE_URL}/monitoring/environment/current?plantId=${plantId}`, {
      cache: "no-store",
      headers,
    }),
    fetch(`${BACKEND_BASE_URL}/devices/infrared`, {
      cache: "no-store",
      headers,
    }),
    fetch(`${BACKEND_BASE_URL}/monitoring/devices/status?plantId=${plantId}`, {
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

  const [environment, infrared, deviceStatus, alerts, alertLogs] = await Promise.all([
    parseResponse<EnvironmentData>(environmentResponse),
    parseResponse<InfraredData>(infraredResponse),
    parseResponse<DeviceStatusOverview>(deviceStatusResponse),
    parseResponse<AlertItem[]>(alertsResponse),
    parseResponse<PageResult<AlertItem>>(alertLogsResponse),
  ])

  const effectiveAlerts = alerts.filter((alert) => alert.plantId === plantId)
  const allLogs = alertLogs.records || []
  const effectiveLogs = allLogs.filter((log) => log.plantId === plantId)
  const effectiveInfrared =
    infrared.plantId === plantId
      ? infrared
      : {
          plantId,
          currentDetected: false,
          latestEventTitle: null,
          latestEventContent: null,
          latestDetectedAt: null,
          approachCount: 0,
          leaveCount: 0,
        }
  const tiltAlerts = effectiveAlerts.filter((alert) => (alert.alertType || "").toUpperCase() === "TILT_ABNORMAL")
  const visibleAlerts = effectiveAlerts.filter((alert) => (alert.alertType || "").toUpperCase() !== "TILT_ABNORMAL")
  const latestTiltAlert = tiltAlerts[0] || null
  const latestVisibleAlert = visibleAlerts[0] || null

  return {
    environment,
    infrared: effectiveInfrared,
    device: buildHomeDeviceStatus(deviceStatus),
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

export async function controlHomeDevice(
  plantId: number,
  deviceId: number | string,
  target: HomeControlTarget,
  turnOn: boolean,
  token: string,
) {
  const endpoint = target === "light" ? "/control/light" : "/control/fan"
  const url = `${BACKEND_BASE_URL}${endpoint}`
  const body = {
    plantId,
    deviceId,
    commandValue: turnOn ? "ON" : "OFF",
  }
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  console.info("[CTRL][FRONTEND] request", {
    path: endpoint,
    url,
    method: "POST",
    body,
  })

  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify(body),
  })

  const responseText = await response.clone().text().catch(() => "")
  console.info("[CTRL][FRONTEND] response", {
    path: endpoint,
    status: response.status,
    ok: response.ok,
    body: responseText,
  })

  const result = await parseResponse<ControlCommandResult>(response)
  if ((result.executeStatus || "").toUpperCase() === "FAILED") {
    throw new ApiError(result.message || "设备控制失败", response.status)
  }

  return result
}
