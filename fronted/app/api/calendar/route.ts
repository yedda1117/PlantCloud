import { NextRequest, NextResponse } from "next/server"

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:8080"

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams
    const plantId = search.get("plant_id")
    const year = search.get("year")
    const month = search.get("month")

    if (!plantId || !year || !month) {
      return NextResponse.json(
        { code: 400, message: "Missing required query params", data: null },
        { status: 400 },
      )
    }

    const headers: HeadersInit = {}
    const authorization = req.headers.get("authorization")
    if (authorization) {
      headers.Authorization = authorization
    }

    const backendResponse = await fetch(
      `${BACKEND_BASE_URL}/calendar?plant_id=${encodeURIComponent(plantId)}&year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`,
      {
        method: "GET",
        headers,
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
