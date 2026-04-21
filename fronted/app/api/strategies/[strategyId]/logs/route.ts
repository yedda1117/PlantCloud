import { NextRequest, NextResponse } from "next/server"

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:8080"
const LONG_ID_FIELDS = ["id", "strategyId", "plantId", "createdBy", "targetDeviceId", "commandLogId"] as const

type RouteContext = {
  params: Promise<{ strategyId: string }>
}

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

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { strategyId } = await context.params
    const pageNum = req.nextUrl.searchParams.get("page_num") ?? req.nextUrl.searchParams.get("pageNum") ?? "1"
    const pageSize = req.nextUrl.searchParams.get("page_size") ?? req.nextUrl.searchParams.get("pageSize") ?? "10"

    const backendSearch = new URLSearchParams()
    backendSearch.set("current", pageNum)
    backendSearch.set("pageSize", pageSize)

    const backendResponse = await fetch(
      `${BACKEND_BASE_URL}/strategies/${encodeURIComponent(strategyId)}/logs?${backendSearch.toString()}`,
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
