import { NextRequest, NextResponse } from "next/server"
import { SERVER_BACKEND_BASE_URL } from "@/lib/backend-base-url"

const BACKEND_BASE_URL = SERVER_BACKEND_BASE_URL

type RouteContext = {
  params: Promise<{ date: string }>
}

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

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { date } = await context.params
    const plantId = req.nextUrl.searchParams.get("plant_id")
    if (!plantId) {
      return NextResponse.json(
        { code: 400, message: "Missing plant_id", data: null },
        { status: 400 },
      )
    }

    const backendResponse = await fetch(
      `${BACKEND_BASE_URL}/calendar/${encodeURIComponent(date)}?plant_id=${encodeURIComponent(plantId)}`,
      {
        method: "GET",
        headers: buildHeaders(req),
        cache: "no-store",
      },
    )

    const responseText = await backendResponse.text()
    let data: unknown = null
    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      data = {
        code: backendResponse.status,
        message: responseText || "Backend returned a non-JSON response",
        data: null,
      }
    }

    return NextResponse.json(data, { status: backendResponse.status })
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

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { date } = await context.params
    const plantId = req.nextUrl.searchParams.get("plant_id")
    if (!plantId) {
      return NextResponse.json(
        { code: 400, message: "Missing plant_id", data: null },
        { status: 400 },
      )
    }

    const body = await req.text()
    const backendResponse = await fetch(
      `${BACKEND_BASE_URL}/calendar/${encodeURIComponent(date)}?plant_id=${encodeURIComponent(plantId)}`,
      {
        method: "PUT",
        headers: buildHeaders(req, true),
        body,
      },
    )

    const responseText = await backendResponse.text()
    let data: unknown = null
    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      data = {
        code: backendResponse.status,
        message: responseText || "Backend returned a non-JSON response",
        data: null,
      }
    }

    return NextResponse.json(data, { status: backendResponse.status })
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
