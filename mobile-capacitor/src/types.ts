export type Plant = {
  plantId: number
  plantName: string
  status?: string | null
  species?: string | null
}

export type EnvironmentData = {
  plantId: number
  temperature: number | null
  humidity: number | null
  lightLux: number | null
  temperatureStatus: string | null
  humidityStatus: string | null
  lightStatus: string | null
  collectedAt: string | null
}

export type InfraredData = {
  plantId: number | null
  currentDetected: boolean
  latestEventTitle: string | null
  latestEventContent: string | null
  latestDetectedAt: string | null
  approachCount: number
  leaveCount: number
}

export type AlertItem = {
  id: string | number
  plantId: number | null
  alertType: string | null
  severity: string | null
  title: string | null
  content: string | null
  status: string | null
  createdAt: string | null
}

export type HomeDeviceStatus = {
  deviceId: number | string | null
  deviceCode: string | null
  deviceName: string | null
  onlineStatus: string | null
  connected: boolean | null
  fanConnected: boolean | null
  fanStatus: string | null
  fanOn: boolean | null
  lightConnected: boolean | null
  lightStatus: string | null
  lightOn: boolean | null
  infraredDeviceId: number | string | null
  infraredConnected: boolean | null
  infraredDetected: boolean | null
  statusUpdatedAt: string | null
  rawStatus: string | null
}

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

export type PlantAiAnalysis = {
  summary: string
  advice: string[]
  riskWarnings: string[]
  riskLevel?: string
  riskScore?: number
  riskType?: string[]
}

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  time: string
  sources?: Array<{ file: string; section?: string }>
}

export type UploadedFileItem = {
  id?: string
  name: string
  time: string
  status: "已入库" | "解析中" | "失败" | string
}

export type StrategyAgentProposal = {
  shouldSuggest: boolean
  detected: string
  strategyName: string
  metricType: "LIGHT" | "TEMPERATURE" | "HUMIDITY"
  operatorType: "LT" | "GT" | "EQ"
  thresholdMin: number
  actionType: "AUTO_LIGHT" | "AUTO_FAN" | "NOTIFY_USER"
  actionValue: "ON" | "OFF" | "LOW" | "HIGH" | "INFO" | "WARNING" | "DANGER"
  timeLimitEnabled?: boolean
  startTime?: string | null
  endTime?: string | null
  reason: string
}

export type CalendarSummary = {
  date: string
  hasPhoto: boolean
  thumbnailUrl: string | null
  milestone: string | null
}

export type CalendarDayDetail = {
  plantId: number
  date: string
  photoUrl: string | null
  originPhotoUrl: string | null
  note: string | null
  milestone: string | null
  temperature: number | null
  humidity: number | null
  light: number | null
  hasPhoto: boolean
}

export type PhotoUploadResult = {
  id: number
  plantId: number
  date: string
  originPhotoUrl: string | null
  photoUrl: string | null
  thumbnailUrl: string | null
  milestone: string | null
  note: string | null
  hasPhoto: boolean
  aiStatus: string | null
}

export type DeviceRuntimeStatus = {
  deviceId: number | string | null
  deviceCode: string | null
  deviceName: string | null
  deviceType: string | null
  onlineStatus?: string | null
  workingStatus?: string | null
  powerOn?: boolean | null
  lastSeenAt?: string | null
  rawStatus?: string | null
}

export type InfraredDeviceStatus = DeviceRuntimeStatus & {
  detected?: boolean
  latestEventTitle?: string | null
  latestDetectedAt?: string | null
}

export type DevicesStatus = {
  plantId: number
  light: DeviceRuntimeStatus | null
  fan: DeviceRuntimeStatus | null
  infrared: InfraredDeviceStatus | null
}

export type LoginResult = {
  userId: number | string
  username: string
  role: string
  accessToken: string
  refreshToken?: string
}
