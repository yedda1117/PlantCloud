import { NextRequest, NextResponse } from "next/server"

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:8080"
const LONG_ID_FIELDS = ["id", "plantId", "deviceId"] as const

function buildHeaders(req: NextRequest) {
  const headers: HeadersInit = {}
  const authorization = req.headers.get("authorization")
  if (authorization) {
    headers.Authorization = authorization
  }
  return headers
}

function stringifyLongIdFields(responseText: string) {
  return LONG_ID_FIELDS.reduce((text, field) => {
    const pattern = new RegExp(`("${field}"\\s*:\\s*)(-?\\d{16,})`, "g")
    return text.replace(pattern, '$1"$2"')
  }, responseText)
}

async function toJsonResponse(response: Response) {
  const responseText = await response.text()
  const normalizedText = stringifyLongIdFields(responseText)
  let data: unknown = null
  try {
    data = normalizedText ? JSON.parse(normalizedText) : null
  } catch {
    data = {
      code: response.status,
      message: responseText || "Backend returned a non-JSON response",
      data: null,
    }
  }

  return NextResponse.json(data, { status: response.status })
}

export async function GET(req: NextRequest) {
  try {
    const plantId = req.nextUrl.searchParams.get("plantId") ?? req.nextUrl.searchParams.get("plant_id")
    if (!plantId) {
      return NextResponse.json({ code: 400, message: "Missing plantId", data: null }, { status: 400 })
    }

    const backendResponse = await fetch(
      `${BACKEND_BASE_URL}/monitoring/environment/current?plantId=${encodeURIComponent(plantId)}`,
      {
        method: "GET",
        headers: buildHeaders(req),
        cache: "no-store",
      },
    )

    return toJsonResponse(backendResponse)
  } catch (error) {
    return NextResponse.json(
      {
        code: 500,
        message: error instanceof Error ? error.message : "server error",
        data: null,
      },
      { status: 500 },
    )
  }
}
