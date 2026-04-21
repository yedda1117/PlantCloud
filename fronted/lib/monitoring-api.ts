import { request } from "@/lib/api-client"

export type CurrentEnvironment = {
  plantId: string | number
  temperature?: number | null
  humidity?: number | null
  lightLux?: number | null
  temperatureStatus?: string | null
  humidityStatus?: string | null
  lightStatus?: string | null
  collectedAt?: string | null
}

export function getCurrentEnvironment(plantId: string | number) {
  return request<CurrentEnvironment>(`/api/monitoring/environment/current?plantId=${encodeURIComponent(String(plantId))}`)
}
