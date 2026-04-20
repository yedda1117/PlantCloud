import { request } from "@/lib/api-client"

export type PlantRiskAnalysis = {
  plantId: number
  plantName: string
  riskType: string[]
  riskLevel: "HIGH" | "MEDIUM" | "LOW" | string
  riskScore: number
  temperature: number | null
  humidity: number | null
  light: number | null
  tempDelta: number | null
  humidityDelta: number | null
  lightDelta: number | null
  triggerReasons: string[]
  aiSummary: string | null
  aiAdvice: string | null
  aiWarning: string | null
}

export async function analyzePlantRisk(plantId: number, token: string) {
  const headers: HeadersInit = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {}

  return request<PlantRiskAnalysis>(`/api/plants/${plantId}/analyze-risk`, {
    method: "POST",
    headers,
  })
}
