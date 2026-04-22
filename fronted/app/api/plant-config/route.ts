
import { NextRequest, NextResponse } from "next/server"

const BACKEND_BASE_URL = "http://localhost:8080"

export async function POST(req: NextRequest) {
  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      accept: "application/json",
    }

    const authorization = req.headers.get("authorization")
    if (authorization) {
      headers.Authorization = authorization
    }

    const body = await req.text()

    // 直接转发到后端 /plant-config/ai-generate
    const backendResponse = await fetch(`${BACKEND_BASE_URL}/plant-config/ai-generate`, {
      method: "POST",
      headers,
      body,
    })

    const responseText = await backendResponse.text()
    let data: unknown = null
    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      data = { code: backendResponse.status, message: "解析后端返回数据失败" }
    }

    return NextResponse.json(data, { status: backendResponse.status })
  } catch (error) {
    return NextResponse.json(
      { code: 500, message: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 },
    )
  }
}

