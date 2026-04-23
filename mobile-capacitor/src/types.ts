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
  fanStatus: string | null
  fanOn: boolean | null
  lightStatus: string | null
  lightOn: boolean | null
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
