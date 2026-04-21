export type ApiResult<T> = {
  code?: number
  message?: string
  data?: T
  timestamp?: number
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (typeof window !== "undefined" && !headers.has("Authorization")) {
    const token = window.localStorage.getItem("plantcloud_token")
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: "no-store",
  })

  let payload: ApiResult<T> | null = null
  try {
    payload = (await response.json()) as ApiResult<T>
  } catch {
    payload = null
  }

  const businessCode = typeof payload?.code === "number" ? payload.code : undefined
  const hasBusinessCode = typeof businessCode === "number"
  const isBusinessSuccess = !hasBusinessCode || businessCode === 0

  if (!response.ok || !isBusinessSuccess) {
    throw new ApiError(payload?.message || response.statusText || "Request failed", response.status)
  }

  return (payload?.data ?? payload) as T
}
