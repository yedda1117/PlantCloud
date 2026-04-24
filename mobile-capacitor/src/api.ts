import type {
  AlertItem,
  EnvironmentData,
  HomeDeviceStatus,
  HomeRealtimeData,
  InfraredData,
  Plant,
  PlantAiAnalysis,
  CalendarDayDetail,
  CalendarSummary,
  PhotoUploadResult,
  StrategyAgentProposal,
  UploadedFileItem,
  DevicesStatus,
  LoginResult,
} from "./types"

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:8080"
const WEB_API_BASE_URL = import.meta.env.VITE_WEB_API_BASE_URL || "http://localhost:3000"
const IA1_DEVICE_CODE = "E53IA1"
const LONG_ID_FIELDS = ["id", "userId", "plantId", "createdBy", "targetDeviceId", "deviceId", "strategyId", "commandLogId"] as const

console.log("BACKEND_BASE_URL =", BACKEND_BASE_URL)
console.log("WEB_API_BASE_URL =", WEB_API_BASE_URL)

type ApiResult<T> = {
  code?: number
  message?: string
  data?: T
}

type PageResult<T> = {
  records: T[]
}

function logApiRequest(label: string, url: string, baseURL: string) {
  console.log(`[PlantCloud API] ${label}`, {
    url,
    baseURL,
  })
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


function stringifyLongIdFields(responseText: string) {
  return LONG_ID_FIELDS.reduce((text, field) => {
    const pattern = new RegExp(`("${field}"\\s*:\\s*)(-?\\d{16,})`, "g")
    return text.replace(pattern, '$1"$2"')
  }, responseText)
}

function getUserIdFromToken(token: string | null | undefined) {
  if (!token) return null
  const payload = token.split(".")[1]
  if (!payload) return null
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const decoded = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))
    const matched = decoded.match(/"userId"\s*:\s*("?)(-?\d+)\1/)
    return matched?.[2] ?? null
  } catch {
    return null
  }
}

function authHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra)
  const token = window.localStorage.getItem("plantcloud_token")
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  return headers
}

export function saveAuthSession(data: LoginResult) {
  const exactUserId = getUserIdFromToken(data.accessToken) ?? String(data.userId)
  window.localStorage.setItem("plantcloud_token", data.accessToken)
  window.localStorage.setItem(
    "plantcloud_user",
    JSON.stringify({
      userId: exactUserId,
      username: data.username,
      role: data.role,
    }),
  )
}

export function hasAuthSession() {
  return Boolean(window.localStorage.getItem("plantcloud_token"))
}

export function clearAuthSession() {
  window.localStorage.removeItem("plantcloud_token")
  window.localStorage.removeItem("plantcloud_user")
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: ApiResult<T> | null = null
  try {
    const responseText = await response.text()
    payload = (responseText ? JSON.parse(stringifyLongIdFields(responseText)) : null) as ApiResult<T>
  } catch {
    payload = null
  }

  if (!response.ok || (typeof payload?.code === "number" && payload.code !== 0)) {
    console.warn("[PlantCloud API] response error", {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      payload,
    })
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
  const connected = parseOnlineState(onlineStatus)

  return {
    deviceId: device?.deviceId ?? null,
    deviceCode: device?.deviceCode ?? null,
    deviceName: device?.deviceName ?? null,
    onlineStatus: onlineStatus ?? null,
    connected,
    fanConnected: connected,
    fanStatus,
    fanOn: parseSwitchState(fanStatus),
    lightConnected: connected,
    lightStatus,
    lightOn: parseSwitchState(lightStatus),
    infraredDeviceId: null,
    infraredConnected: null,
    infraredDetected: null,
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

export async function loginWithPassword(username: string, password: string) {
  return parseResponse<LoginResult>(
    await fetch(`${BACKEND_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify({ username, password }),
    }),
  )
}

export async function loginWithFace(faceImage: string) {
  return parseResponse<LoginResult>(
    await fetch(`${BACKEND_BASE_URL}/auth/face-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify({ faceImage }),
    }),
  )
}

export async function registerWithFace(username: string, password: string, faceImage: string) {
  return parseResponse<string | null>(
    await fetch(`${BACKEND_BASE_URL}/auth/face-register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify({ username, password, faceImage }),
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

function resolveCalendarAssetUrl(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  if (trimmed.startsWith("/")) return `${BACKEND_BASE_URL}${trimmed}`
  return trimmed
}

function normalizeCalendarSummary(record: CalendarSummary): CalendarSummary {
  return {
    ...record,
    thumbnailUrl: resolveCalendarAssetUrl(record.thumbnailUrl),
  }
}

function normalizeCalendarDayDetail(detail: CalendarDayDetail): CalendarDayDetail {
  return {
    ...detail,
    photoUrl: resolveCalendarAssetUrl(detail.photoUrl),
    originPhotoUrl: resolveCalendarAssetUrl(detail.originPhotoUrl),
  }
}

function normalizePhotoUploadResult(result: PhotoUploadResult): PhotoUploadResult {
  return {
    ...result,
    photoUrl: resolveCalendarAssetUrl(result.photoUrl),
    originPhotoUrl: resolveCalendarAssetUrl(result.originPhotoUrl),
    thumbnailUrl: resolveCalendarAssetUrl(result.thumbnailUrl),
  }
}

const PREDICTION_PLANT_IDS = [1, 2, 6]

export async function getPlantAiAnalysis(plantId: number): Promise<PlantAiAnalysis> {
  const riskResult = await fetchPlantAiAnalysis(`/plants/${plantId}/analyze-risk`)
  if (riskResult) {
    return {
      summary: riskResult.aiSummary?.trim() || "",
      advice: normalizeTextList(riskResult.aiAdvice),
      riskWarnings: normalizeTextList(riskResult.aiWarning),
      riskLevel: riskResult.riskLevel,
      riskScore: riskResult.riskScore,
      riskType: Array.isArray(riskResult.riskType) ? riskResult.riskType : [],
    }
  }

  const predictionResult = await fetchPlantAiAnalysis(`/plant/${plantId}/analysis`)
  if (predictionResult) {
    return {
      summary: predictionResult.summary?.trim() || "",
      advice: normalizeTextList(predictionResult.advice),
      riskWarnings: normalizeTextList(predictionResult.riskWarnings),
    }
  }

  throw new Error("养护洞察接口暂时不可用")
}

async function fetchPlantAiAnalysis(endpoint: string) {
  try {
    return await parseResponse<any>(
      await fetch(`${BACKEND_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: authHeaders({ accept: "application/json" }),
        cache: "no-store",
      }),
    )
  } catch {
    return null
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

export async function getKnowledgeFiles() {
  const response = await fetch(`${WEB_API_BASE_URL}/api/ragflow/files`, {
    method: "GET",
    headers: authHeaders({ accept: "application/json" }),
    cache: "no-store",
  })
  const data = await response.json()
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "获取文件列表失败")
  }
  return Array.isArray(data.files) ? (data.files as UploadedFileItem[]) : []
}

export async function uploadKnowledgeFiles(files: FileList | File[]) {
  const formData = new FormData()
  Array.from(files).forEach((file) => {
    formData.append("files", file)
  })

  const response = await fetch(`${WEB_API_BASE_URL}/api/ragflow/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  })
  const data = await response.json()
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "上传失败")
  }
  return data
}

export async function getStrategyProposal(message: string, chatAnswer: string, plantContext: unknown, plantContextText: string) {
  const response = await fetch(`${WEB_API_BASE_URL}/api/ragflow/strategy-agent`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json", accept: "application/json" }),
    cache: "no-store",
    body: JSON.stringify({ message, chatAnswer, plantContext, plantContextText }),
  })
  const data = await response.json()
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "策略建议生成失败")
  }
  return (data.proposal ?? null) as StrategyAgentProposal | null
}

export async function createStrategyFromProposal(payload: Record<string, unknown>) {
  const response = await fetch(`${WEB_API_BASE_URL}/api/strategies`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json", accept: "application/json" }),
    cache: "no-store",
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  const businessCode = typeof data?.code === "number" ? data.code : undefined
  if (!response.ok || data?.success === false || (businessCode !== undefined && businessCode !== 0)) {
    throw new Error(data?.message || data?.error || "新增策略失败")
  }
  return data
}

export async function getDevicesStatus(plantId: number | string) {
  const response = await fetch(`${WEB_API_BASE_URL}/api/devices/status?plantId=${encodeURIComponent(String(plantId))}`, {
    method: "GET",
    headers: authHeaders({ accept: "application/json" }),
    cache: "no-store",
  })
  const data = await response.json().catch(() => ({}))
  const businessCode = typeof data?.code === "number" ? data.code : undefined
  if (!response.ok || data?.success === false || (businessCode !== undefined && businessCode !== 0)) {
    throw new Error(data?.message || data?.error || "获取设备状态失败")
  }
  return (data?.data ?? data) as DevicesStatus
}

export async function getCalendarSummary(plantId: number, year: number, month: number) {
  const result = await parseResponse<CalendarSummary[]>(
    await fetch(`${BACKEND_BASE_URL}/calendar?plant_id=${plantId}&year=${year}&month=${month}`, {
      headers: authHeaders({ accept: "application/json" }),
      cache: "no-store",
    }),
  )
  return result.map(normalizeCalendarSummary)
}

export async function getCalendarDayDetail(plantId: number, date: string) {
  const result = await parseResponse<CalendarDayDetail>(
    await fetch(`${BACKEND_BASE_URL}/calendar/${date}?plant_id=${plantId}`, {
      headers: authHeaders({ accept: "application/json" }),
      cache: "no-store",
    }),
  )
  return normalizeCalendarDayDetail(result)
}

export async function updateCalendarDayLog(plantId: number, date: string, payload: { note?: string; milestone?: string | null }) {
  const url = `${BACKEND_BASE_URL}/calendar/${date}?plant_id=${plantId}`
  logApiRequest("updateCalendarDayLog", url, BACKEND_BASE_URL)
  const result = await parseResponse<CalendarDayDetail>(
    await fetch(url, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json", accept: "application/json" }),
      cache: "no-store",
      body: JSON.stringify(payload),
    }),
  )
  return normalizeCalendarDayDetail(result)
}

export async function uploadPlantPhoto(formData: FormData) {
  const url = `${BACKEND_BASE_URL}/photos/upload`
  logApiRequest("uploadPlantPhoto", url, BACKEND_BASE_URL)
  const result = await parseResponse<PhotoUploadResult>(
    await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      cache: "no-store",
      body: formData,
    }),
  )
  return normalizePhotoUploadResult(result)
}
