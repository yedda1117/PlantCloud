const DEFAULT_PRODUCTION_BACKEND_BASE_URL = "http://150.158.76.53:8080"

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed
}

export const BACKEND_BASE_URL =
  normalizeBaseUrl(process.env.NEXT_PUBLIC_BACKEND_BASE_URL) || DEFAULT_PRODUCTION_BACKEND_BASE_URL

export const SERVER_BACKEND_BASE_URL =
  normalizeBaseUrl(process.env.BACKEND_BASE_URL) ||
  normalizeBaseUrl(process.env.NEXT_PUBLIC_BACKEND_BASE_URL) ||
  DEFAULT_PRODUCTION_BACKEND_BASE_URL
