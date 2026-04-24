import { request } from "@/lib/api-client"

const IA1_DEVICE_CODE = "E53IA1"

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

type DeviceStatusOverviewItem = {
  deviceId: number | string | null
  deviceCode: string | null
  deviceName: string | null
  deviceType: string | null
  onlineStatus: string | null
  currentStatus: string | null
}

type DeviceStatusOverview = {
  plantId: number | string
  devices: DeviceStatusOverviewItem[]
}

export function getDevicesStatus(plantId: number | string) {
  return request<DevicesStatus>(`/api/devices/status?plantId=${encodeURIComponent(String(plantId))}`)
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

function findIa1ControlDevice(devices: DeviceStatusOverviewItem[]) {
  return devices.find((device) => (device.deviceCode || "").toUpperCase() === IA1_DEVICE_CODE)
    || devices.find((device) => (device.deviceType || "").toUpperCase() === "IA1")
    || devices.find((device) => {
      const status = parseStatusJson(device.currentStatus)
      return "fanStatus" in status || "lightStatus" in status || "mqttStatus" in status
    })
    || null
}

export async function getIntegratedControlDeviceId(
  plantId: number | string,
  fallback?: string | number | null,
) {
  try {
    const overview = await request<DeviceStatusOverview>(
      `/api/monitoring/devices/status?plantId=${encodeURIComponent(String(plantId))}`,
    )
    const device = findIa1ControlDevice(overview?.devices || [])
    if (device?.deviceId != null) {
      return String(device.deviceId)
    }
  } catch (error) {
    console.warn("[device-api] failed to resolve integrated control device", {
      plantId,
      error: error instanceof Error ? error.message : error,
    })
  }

  return fallback != null ? String(fallback) : null
}
