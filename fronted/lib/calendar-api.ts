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

export function getCalendarSummary(plantId: number, year: number, month: number) {
  return request<CalendarSummary[]>(`/api/calendar?plant_id=${plantId}&year=${year}&month=${month}`)
}

export function getCalendarDayDetail(plantId: number, date: string) {
  return request<CalendarDayDetail>(`/api/calendar/${date}?plant_id=${plantId}`)
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
  })
}

export function uploadPlantPhoto(formData: FormData) {
  return request<PhotoUploadResult>("/api/photos/upload", {
    method: "POST",
    body: formData,
  })
}

export function deletePlantPhoto(plantId: number, date: string) {
  return request<void>(`/api/photos/${date}?plant_id=${plantId}`, {
    method: "DELETE",
  })
}
