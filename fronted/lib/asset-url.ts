import { BACKEND_BASE_URL } from "@/lib/backend-base-url"

export function resolveBackendAssetUrl(value: string | null | undefined) {
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

  return `${BACKEND_BASE_URL}/${trimmed}`
}
