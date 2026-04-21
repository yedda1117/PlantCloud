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

export type PlantPredictionAnalysis = {
  plantId: number
  plantName: string
  species: string | null
  status: string | null
  trend: string | null
  summary: string | null
  advice: string[] | string | null
  riskWarnings: string[] | string | null
}

export type PlantAiAnalysis = {
  summary: string
  advice: string[]
  riskWarnings: string[]
  riskLevel?: string
  riskScore?: number
  riskType?: string[]
}

function buildHeaders(token: string): HeadersInit {
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {}
}

function normalizeTextList(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }

  return []
}

export async function analyzePlantRisk(plantId: number, token: string) {
  return request<PlantRiskAnalysis>(`/api/plants/${plantId}/analyze-risk`, {
    method: "POST",
    headers: buildHeaders(token),
  })
}

export async function analyzePlantPrediction(plantId: number, token: string) {
  return request<PlantPredictionAnalysis>(`/api/plant/${plantId}/analysis`, {
    method: "POST",
    headers: buildHeaders(token),
  })
}

export function normalizePlantAiResult(result: PlantRiskAnalysis | PlantPredictionAnalysis, plantId: number): PlantAiAnalysis {
  if (plantId === 1 || plantId === 2) {
    const predictionResult = result as PlantPredictionAnalysis
    return {
      summary: predictionResult.summary?.trim() || "",
      advice: normalizeTextList(predictionResult.advice),
      riskWarnings: normalizeTextList(predictionResult.riskWarnings),
    }
  }

  const riskResult = result as PlantRiskAnalysis
  return {
    summary: riskResult.aiSummary?.trim() || "",
    advice: normalizeTextList(riskResult.aiAdvice),
    riskWarnings: normalizeTextList(riskResult.aiWarning),
    riskLevel: riskResult.riskLevel,
    riskScore: riskResult.riskScore,
    riskType: Array.isArray(riskResult.riskType) ? riskResult.riskType : [],
  }
}

export async function getPlantAiAnalysis(plantId: number, token: string): Promise<PlantAiAnalysis> {
  const response = plantId === 1 || plantId === 2
    ? await analyzePlantPrediction(plantId, token)
    : await analyzePlantRisk(plantId, token)

  return normalizePlantAiResult(response, plantId)
}
