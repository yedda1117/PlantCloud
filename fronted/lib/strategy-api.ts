import { request } from "@/lib/api-client"

export type StrategyConfig = {
  timeLimitEnabled?: boolean
  startTime?: string
  endTime?: string
  notifyTitleTemplate?: string
  notifyContentTemplate?: string
}

export type StrategyItem = {
  id: string
  plantId: string
  createdBy?: string | null
  strategyName: string
  strategyType: string
  targetDeviceId?: string | null
  metricType: string
  operatorType: string
  thresholdMin?: number | null
  thresholdMax?: number | null
  cronExpr?: string | null
  actionType: string
  actionValue?: string | null
  enabled: boolean
  priority?: number | null
  config?: StrategyConfig | null
  configJson?: StrategyConfig | string | null
  timeLimitEnabled?: boolean | null
  startTime?: string | null
  endTime?: string | null
  notifyTitleTemplate?: string | null
  notifyContentTemplate?: string | null
  createdAt?: string
  updatedAt?: string
}

export type StrategyListParams = {
  plantId: string | number
  enabled?: boolean
  strategyType?: string
}

export type StrategyExecutionLogItem = {
  id: string
  strategyId: string
  plantId: string
  triggerSource: string
  triggerMetricValue?: number | null
  triggerPayload?: string | null
  executionResult: string
  resultMessage?: string | null
  commandLogId?: string | null
  executedAt?: string | null
}

export type PageResult<T> = {
  current: number
  pageSize: number
  total: number
  records: T[]
}

export type StrategyExecutionLogListParams = {
  strategyId: string | number
  pageNum?: number
  pageSize?: number
}

export type StrategyUpsertPayload = {
  plantId: string | number
  createdBy?: string | number | null
  strategyName: string
  strategyType: string
  targetDeviceId?: string | number | null
  metricType?: string | null
  operatorType: string
  thresholdMin?: number | null
  thresholdMax?: number | null
  cronExpr?: string | null
  actionType: string
  actionValue?: string | null
  enabled: boolean
  priority?: number | null
  timeLimitEnabled?: boolean | null
  startTime?: string | null
  endTime?: string | null
  notifyTitleTemplate?: string | null
  notifyContentTemplate?: string | null
  configJson?: StrategyConfig | null
}

export function listStrategies(params: StrategyListParams) {
  const search = new URLSearchParams()
  search.set("plantId", String(params.plantId))
  if (typeof params.enabled === "boolean") {
    search.set("enabled", String(params.enabled))
  }
  if (params.strategyType) {
    search.set("strategyType", params.strategyType)
  }
  return request<StrategyItem[]>(`/api/strategies?${search.toString()}`)
}

export function createStrategy(payload: StrategyUpsertPayload) {
  console.log("[strategy-api][create] final body", payload)
  return request<StrategyItem>("/api/strategies", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

export function getStrategyDetail(strategyId: string) {
  return request<StrategyItem>(`/api/strategies/${strategyId}`)
}

export function updateStrategy(strategyId: string, payload: StrategyUpsertPayload) {
  console.log("[strategy-api][update] strategyId", strategyId, typeof strategyId)
  console.log("[strategy-api][update] final body", payload)
  return request<StrategyItem>(`/api/strategies/${strategyId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

export function deleteStrategy(strategyId: string) {
  console.log("[strategy-api][delete] strategyId", strategyId, typeof strategyId)
  return request<void>(`/api/strategies/${strategyId}`, {
    method: "DELETE",
  })
}

export function listStrategyExecutionLogs(params: StrategyExecutionLogListParams) {
  const search = new URLSearchParams()
  search.set("page_num", String(params.pageNum ?? 1))
  search.set("page_size", String(params.pageSize ?? 10))
  return request<PageResult<StrategyExecutionLogItem>>(
    `/api/strategies/${encodeURIComponent(String(params.strategyId))}/logs?${search.toString()}`,
  )
}
