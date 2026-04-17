import { NextRequest, NextResponse } from "next/server"

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:8080"
const LONG_ID_FIELDS = ["id", "strategyId", "plantId", "createdBy", "targetDeviceId", "commandLogId"] as const

function buildHeaders(req: NextRequest, includeJson = false) {
  const headers: HeadersInit = {}
  if (includeJson) {
    headers["Content-Type"] = "application/json"
  }
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
  console.log("[strategies proxy] backend raw response", responseText)
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
    const search = req.nextUrl.searchParams
    const plantId = search.get("plant_id") ?? search.get("plantId")
    const enabled = search.get("enabled")
    const strategyType = search.get("strategy_type") ?? search.get("strategyType")

    if (!plantId) {
      return NextResponse.json(
        { code: 400, message: "Missing plant_id", data: null },
        { status: 400 },
      )
    }

    const backendSearch = new URLSearchParams()
    backendSearch.set("plantId", plantId)
    if (enabled) {
      backendSearch.set("enabled", enabled)
    }
    if (strategyType) {
      backendSearch.set("strategyType", strategyType)
    }

    const backendResponse = await fetch(`${BACKEND_BASE_URL}/strategies?${backendSearch.toString()}`, {
      method: "GET",
      headers: buildHeaders(req),
      cache: "no-store",
    })

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    console.log("[strategies proxy][POST] incoming body", body)
    console.log("[strategies proxy][POST] forwarded body", body)
    const backendResponse = await fetch(`${BACKEND_BASE_URL}/strategies`, {
      method: "POST",
      headers: buildHeaders(req, true),
      body,
    })

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
