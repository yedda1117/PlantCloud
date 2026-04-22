import { NextRequest, NextResponse } from "next/server"

const BACKEND_BASE_URL = "http://localhost:8080"

function getHeaders(req: NextRequest): HeadersInit {
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ plantId: string }> }
) {
  try {
    const { plantId } = await params
    console.log(`[Next.js API] 收到 GET 请求，正在获取植物模板 ID: ${plantId}`);
    const backendResponse = await fetch(`${BACKEND_BASE_URL}/plant-config/templates/${plantId}`, {
      method: "GET",
      headers: getHeaders(req),
    })
    const data = await backendResponse.json()
    return NextResponse.json(data, { status: backendResponse.status })
  } catch (error) {
    console.error(`[Next.js API] GET 接口异常:`, error);
    return NextResponse.json(
      { code: 500, message: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 },
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ plantId: string }> }
) {
  try {
    const { plantId } = await params
    const body = await req.text()

    console.log(`[Next.js API] 收到 PUT 请求，正在更新植物模板 ID: ${plantId}`);
    console.log(`[Next.js API] 提交的内容为: ${body}`);

    const backendResponse = await fetch(`${BACKEND_BASE_URL}/plant-config/templates/${plantId}`, {
      method: "PUT",
      headers: getHeaders(req),
      body,
    })
    const responseText = await backendResponse.text()
    let data: unknown = null
    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      data = { code: backendResponse.status, message: "解析后端返回数据失败" }
    }
    console.log(`[Next.js API] 后端响应状态: ${backendResponse.status}`);
    return NextResponse.json(data, { status: backendResponse.status })
  } catch (error) {
    console.error(`[Next.js API] PUT 接口异常:`, error);
    return NextResponse.json(
      { code: 500, message: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 },
    )
  }
}
