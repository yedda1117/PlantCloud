import { NextRequest, NextResponse } from "next/server"

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:8080"

export async function GET(req: NextRequest) {
  try {
    const headers: HeadersInit = {}
    const authorization = req.headers.get("authorization")
    if (authorization) {
      headers.Authorization = authorization
    }

    const plantId = req.nextUrl.searchParams.get("plantId")
    if (!plantId) {
      return NextResponse.json(
        { code: 400, message: "plantId is required", data: null },
        { status: 400 },
      )
    }

    const backendResponse = await fetch(`${BACKEND_BASE_URL}/devices/status?plantId=${encodeURIComponent(plantId)}`, {
      method: "GET",
      headers,
      cache: "no-store",
    })

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
