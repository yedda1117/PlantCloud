import { NextRequest, NextResponse } from "next/server"

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:8080"

type RouteContext = {
  params: Promise<{ id: string }>
}

function buildHeaders(req: NextRequest) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    accept: "application/json",
  }

  const authorization = req.headers.get("authorization")
  if (authorization) {
    headers.Authorization = authorization
  }

  return headers
}

async function toJsonResponse(response: Response) {
  const responseText = await response.text()
  let data: unknown = null

  try {
    data = responseText ? JSON.parse(responseText) : null
  } catch {
    data = {
      code: response.status,
      message: responseText || "Backend returned a non-JSON response",
      data: null,
    }
  }

  return NextResponse.json(data, { status: response.status })
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const backendResponse = await fetch(`${BACKEND_BASE_URL}/plant/${encodeURIComponent(id)}/analysis`, {
      method: "POST",
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
