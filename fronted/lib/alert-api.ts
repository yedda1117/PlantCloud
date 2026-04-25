const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8080"

/** 与后端 `AlertVO` / `GET /alerts` 返回项一致，用于策略侧读取 `metricName` / `metricValue`。 */
export type AlertListItem = {
  id: number | string
  plantId?: number | null
  deviceId?: number | string | null
  alertType?: string | null
  severity?: string | null
  title?: string | null
  content?: string | null
  metricName?: string | null
  metricValue?: number | string | null
  thresholdValue?: number | string | null
  status?: string | null
  resolvedBy?: number | string | null
  resolvedAt?: string | null
  extraData?: string | null
  createdAt?: string | null
}

export const SMOKE_GAS_METRIC_NAME = "smoke_gas_ppm"

export type AlertLogItem = {
  id: number | string
  deviceId?: number | string | null
  alertType?: string | null
  metricValue?: number | string | null
  createdAt?: string | null
}

type AlertLogPageResult = {
  current?: number
  pageSize?: number
  total?: number
  records?: AlertLogItem[]
}

type BackendResult<T> = {
  code?: number
  message?: string
  data?: T
}

/**
 * `GET /alerts` — 列表顺序与库中一致（按 `createdAt` 倒序，即从最新到最旧）。
 * 烟雾策略：使用 `status=UNRESOLVED`，在返回数组中自上而下找到第一条 `metricName === smoke_gas_ppm`，
 * 取其 `metricValue` 与策略阈值比较（需与当前 `plantId` 一致时再参与判断）。
 */
export async function listAlerts(params: { status?: string }) {
  const search = new URLSearchParams()
  if (params.status) {
    search.set("status", params.status)
  }
  const token = typeof window !== "undefined" ? window.localStorage.getItem("plantcloud_token") : null
  const qs = search.toString()
  const url = qs ? `${BACKEND_BASE_URL}/alerts?${qs}` : `${BACKEND_BASE_URL}/alerts`
  console.info("[ALERT_API] listAlerts:request", { url, status: params.status ?? null })
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const payload = (await response.json().catch(() => null)) as BackendResult<AlertListItem[]> | AlertListItem[] | null
  console.info("[ALERT_API] listAlerts:response", {
    url,
    status: response.status,
    ok: response.ok,
    count: Array.isArray(payload) ? payload.length : payload && "data" in payload ? payload.data?.length ?? 0 : 0,
  })
  if (!response.ok) {
    const message = payload && "message" in payload && payload.message ? payload.message : "获取预警列表失败"
    throw new Error(message)
  }
  const list = Array.isArray(payload) ? payload : payload?.data ?? []
  return { requestUrl: url, alerts: list }
}

export async function listAlertLogs(params: {
  alertType?: string
  deviceId?: string | number | null
  current?: number
  pageSize?: number
}) {
  const search = new URLSearchParams()
  if (params.alertType) {
    search.set("alert_type", params.alertType)
  }
  if (params.deviceId != null) {
    search.set("device_id", String(params.deviceId))
  }
  search.set("current", String(params.current ?? 1))
  search.set("pageSize", String(params.pageSize ?? 1))

  const token = typeof window !== "undefined" ? window.localStorage.getItem("plantcloud_token") : null
  const url = `${BACKEND_BASE_URL}/alerts/logs?${search.toString()}`
  console.info("[ALERT_API] listAlertLogs:request", {
    url,
    alertType: params.alertType ?? null,
    deviceId: params.deviceId ?? null,
    current: params.current ?? 1,
    pageSize: params.pageSize ?? 1,
  })
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  const payload = (await response.json().catch(() => null)) as BackendResult<AlertLogPageResult> | AlertLogPageResult | null
  console.info("[ALERT_API] listAlertLogs:response", {
    url,
    status: response.status,
    ok: response.ok,
    recordCount: payload && "data" in payload ? payload.data?.records?.length ?? 0 : (payload as AlertLogPageResult | null)?.records?.length ?? 0,
  })
  if (!response.ok) {
    const message = payload && "message" in payload && payload.message ? payload.message : "获取预警日志失败"
    throw new Error(message)
  }

  const page = payload && "data" in payload ? payload.data : (payload as AlertLogPageResult | null)
  return {
    requestUrl: url,
    records: page?.records ?? [],
  }
}
