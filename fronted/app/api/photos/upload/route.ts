import { NextRequest, NextResponse } from "next/server"

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:8080"

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file")
    const plantId = req.nextUrl.searchParams.get("plantId")
    const userId = req.nextUrl.searchParams.get("userId") || "1"

    if (!(file instanceof File)) {
      return NextResponse.json(
        { code: 400, message: "没有上传图片", data: null },
        { status: 400 }
      )
    }

    if (!plantId) {
      return NextResponse.json(
        { code: 400, message: "缺少 plantId", data: null },
        { status: 400 }
      )
    }

    const uploadForm = new FormData()
    uploadForm.append("file", file)

    const headers: HeadersInit = {}
    const authorization = req.headers.get("authorization")
    if (authorization) {
      headers.Authorization = authorization
    }

    const backendResponse = await fetch(
      `${BACKEND_BASE_URL}/photos/upload?plantId=${encodeURIComponent(plantId)}&userId=${encodeURIComponent(userId)}`,
      {
        method: "POST",
        headers,
        body: uploadForm,
      }
    )

    const responseText = await backendResponse.text()
    let data: unknown = null
    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      data = {
        code: backendResponse.status,
        message: responseText || "后端返回了非 JSON 响应",
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
      { status: 500 }
    )
  }
}
