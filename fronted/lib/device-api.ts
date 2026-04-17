import { request } from "@/lib/api-client"

export type DeviceRuntimeStatus = {
  deviceId: number | null
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

export function getDevicesStatus() {
  return request<DevicesStatus>("/api/devices/status")
}
