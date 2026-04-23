import type { AlertItem, EnvironmentData, HomeDeviceStatus, HomeRealtimeData, InfraredData, Plant, PlantAiAnalysis } from "./types"

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:8080"
const WEB_API_BASE_URL = import.meta.env.VITE_WEB_API_BASE_URL || "http://localhost:3000"
const IA1_DEVICE_CODE = "E53IA1"

type ApiResult<T> = {
  code?: number
  message?: string
  data?: T
}

type PageResult<T> = {
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

function authHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra)
  const token = window.localStorage.getItem("plantcloud_token")
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  return headers
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: ApiResult<T> | null = null
  try {
    payload = (await response.json()) as ApiResult<T>
  } catch {
    payload = null
  }

  if (!response.ok || (typeof payload?.code === "number" && payload.code !== 0)) {
    throw new Error(payload?.message || response.statusText || "请求失败")
  }

  return (payload?.data ?? payload) as T
}

function parseStatusJson(rawStatus: string | null | undefined) {
  if (!rawStatus) return {}
  try {
    const parsed = JSON.parse(rawStatus)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
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
    case "OPEN":
    case "RUNNING":
    case "TRUE":
    case "1":
      return true
    case "OFF":
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
  return value.trim().toUpperCase() === "ONLINE" ? true : value.trim().toUpperCase() === "OFFLINE" ? false : null
}

function buildHomeDeviceStatus(overview: DeviceStatusOverview): HomeDeviceStatus {
  const devices = overview.devices || []
  const device =
    devices.find((item) => (item.deviceCode || "").toUpperCase() === IA1_DEVICE_CODE) ||
    devices.find((item) => (item.deviceType || "").toUpperCase() === "IA1") ||
    devices.find((item) => {
      const status = parseStatusJson(item.currentStatus)
      return "fanStatus" in status || "lightStatus" in status || "mqttStatus" in status
    }) ||
    null
  const status = parseStatusJson(device?.currentStatus)
  const mqttStatus = getStringField(status, "mqttStatus", "onlineStatus", "status")
  const fanStatus = getStringField(status, "fanStatus", "fan_status", "fan")
  const lightStatus = getStringField(status, "lightStatus", "light_status", "light")
  const statusUpdatedAt = getStringField(status, "statusUpdatedAt", "commandUpdatedAt", "telemetryUpdatedAt")
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

export async function getPlants() {
  return parseResponse<Plant[]>(
    await fetch(`${BACKEND_BASE_URL}/plants`, {
      headers: authHeaders({ accept: "application/json" }),
      cache: "no-store",
    }),
  )
}

export async function getHomeRealtime(plantId: number): Promise<HomeRealtimeData> {
  const headers = authHeaders({ accept: "application/json" })
  const [environmentResponse, infraredResponse, deviceStatusResponse, alertsResponse, alertLogsResponse] = await Promise.all([
    fetch(`${BACKEND_BASE_URL}/monitoring/environment/current?plantId=${plantId}`, { headers, cache: "no-store" }),
    fetch(`${BACKEND_BASE_URL}/devices/infrared`, { headers, cache: "no-store" }),
    fetch(`${BACKEND_BASE_URL}/monitoring/devices/status?plantId=${plantId}`, { headers, cache: "no-store" }),
    fetch(`${BACKEND_BASE_URL}/alerts?status=UNRESOLVED`, { headers, cache: "no-store" }),
    fetch(`${BACKEND_BASE_URL}/alerts/logs?current=1&pageSize=50`, { headers, cache: "no-store" }),
  ])

  const [environment, infrared, deviceStatus, alerts, alertLogs] = await Promise.all([
    parseResponse<EnvironmentData>(environmentResponse),
    parseResponse<InfraredData>(infraredResponse),
    parseResponse<DeviceStatusOverview>(deviceStatusResponse),
    parseResponse<AlertItem[]>(alertsResponse),
    parseResponse<PageResult<AlertItem>>(alertLogsResponse),
  ])

  const effectiveAlerts = alerts.filter((alert) => alert.plantId === plantId)
  const effectiveLogs = (alertLogs.records || []).filter((log) => log.plantId === plantId)
  const visibleAlerts = effectiveAlerts.filter((alert) => (alert.alertType || "").toUpperCase() !== "TILT_ABNORMAL")
  const tiltAlerts = effectiveAlerts.filter((alert) => (alert.alertType || "").toUpperCase() === "TILT_ABNORMAL")
  const latestTiltAlert = tiltAlerts[0] || null
  const latestVisibleAlert = visibleAlerts[0] || null

  return {
    environment,
    infrared:
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
          },
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
  }
}

export async function controlHomeDevice(plantId: number, deviceId: number | string, target: "light" | "fan", turnOn: boolean) {
  const endpoint = target === "light" ? "/control/light" : "/control/fan"
  return parseResponse(
    await fetch(`${BACKEND_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json", accept: "application/json" }),
      cache: "no-store",
      body: JSON.stringify({ plantId, deviceId, commandValue: turnOn ? "ON" : "OFF" }),
    }),
  )
}

function normalizeTextList(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean)
  if (typeof value === "string") return value.trim() ? [value.trim()] : []
  return []
}

export async function getPlantAiAnalysis(plantId: number): Promise<PlantAiAnalysis> {
  const endpoint = plantId === 1 || plantId === 2 ? `/plant/${plantId}/analysis` : `/plants/${plantId}/analyze-risk`
  const result = await parseResponse<any>(
    await fetch(`${BACKEND_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: authHeaders({ accept: "application/json" }),
      cache: "no-store",
    }),
  )

  if (plantId === 1 || plantId === 2) {
    return {
      summary: result.summary?.trim() || "",
      advice: normalizeTextList(result.advice),
      riskWarnings: normalizeTextList(result.riskWarnings),
    }
  }

  return {
    summary: result.aiSummary?.trim() || "",
    advice: normalizeTextList(result.aiAdvice),
    riskWarnings: normalizeTextList(result.aiWarning),
    riskLevel: result.riskLevel,
    riskScore: result.riskScore,
    riskType: Array.isArray(result.riskType) ? result.riskType : [],
  }
}

export async function askPlantAi(message: string, plantContextText: string, history: Array<{ role: string; content: string }>) {
  const response = await fetch(`${WEB_API_BASE_URL}/api/ragflow/chat`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json", accept: "application/json" }),
    cache: "no-store",
    body: JSON.stringify({ message, plantContextText, history }),
  })
  const data = await response.json()
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error?.message || data?.error || "AI 问答服务暂时不可用")
  }
  return {
    answer: data.answer || "暂时没有获得回答",
    sources: Array.isArray(data.sources) ? data.sources : [],
  }
}
