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

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8080"

type ApiResult<T> = {
  code?: number
  message?: string
  data?: T
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
  })

  let payload: ApiResult<T> | null = null
  try {
    payload = (await response.json()) as ApiResult<T>
  } catch {
    payload = null
  }

  if (!response.ok || (payload && typeof payload.code === "number" && payload.code > 0)) {
    throw new ApiError(payload?.message || "Request failed", response.status)
  }

  return (payload?.data ?? payload) as T
}

function resolveCalendarAssetUrl(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }

  if (trimmed.startsWith("/")) {
    return `${BACKEND_BASE_URL}${trimmed}`
  }

  return trimmed
}

function normalizeCalendarSummary(record: CalendarSummary): CalendarSummary {
  return {
    ...record,
    thumbnailUrl: resolveCalendarAssetUrl(record.thumbnailUrl),
  }
}

function normalizeCalendarDayDetail(detail: CalendarDayDetail): CalendarDayDetail {
  return {
    ...detail,
    photoUrl: resolveCalendarAssetUrl(detail.photoUrl),
    originPhotoUrl: resolveCalendarAssetUrl(detail.originPhotoUrl),
  }
}

function normalizePhotoUploadResult(result: PhotoUploadResult): PhotoUploadResult {
  return {
    ...result,
    photoUrl: resolveCalendarAssetUrl(result.photoUrl),
    originPhotoUrl: resolveCalendarAssetUrl(result.originPhotoUrl),
    thumbnailUrl: resolveCalendarAssetUrl(result.thumbnailUrl),
  }
}

export function getCalendarSummary(plantId: number, year: number, month: number) {
  return request<CalendarSummary[]>(`/api/calendar?plant_id=${plantId}&year=${year}&month=${month}`)
    .then((records) => records.map(normalizeCalendarSummary))
}

export function getCalendarDayDetail(plantId: number, date: string) {
  return request<CalendarDayDetail>(`/api/calendar/${date}?plant_id=${plantId}`)
    .then(normalizeCalendarDayDetail)
}

export function updateCalendarDayLog(
  plantId: number,
  date: string,
  payload: { note?: string; milestone?: string | null },
) {
  return request<CalendarDayDetail>(`/api/calendar/${date}?plant_id=${plantId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).then(normalizeCalendarDayDetail)
}

export function uploadPlantPhoto(formData: FormData) {
  return request<PhotoUploadResult>("/api/photos/upload", {
    method: "POST",
    body: formData,
  }).then(normalizePhotoUploadResult)
}

export function deletePlantPhoto(plantId: number, date: string) {
  return request<void>(`/api/photos/${date}?plant_id=${plantId}`, {
    method: "DELETE",
  })
}
