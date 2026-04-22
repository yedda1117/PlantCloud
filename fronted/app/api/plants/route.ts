import { NextRequest, NextResponse } from "next/server"

// 这里的基准地址可以根据开发环境切换
const BACKEND_BASE_URL = "http://localhost:8080"



export async function GET(req: NextRequest) {
  try {
    const headers: HeadersInit = {
      'accept': 'application/json',
    }
    
    // 获取前端传来的 Authorization
    const authorization = req.headers.get("authorization")
    if (authorization) {
      headers.Authorization = authorization
    }

    // ！！！精确对齐你的 curl 接口地址：/plants
    const backendResponse = await fetch(`${BACKEND_BASE_URL}/plants`, {
      method: "GET",
      headers,
      cache: "no-store",
    })

    const responseText = await backendResponse.text()
    let data: any = null
    
    try {
      // 增加健壮性校验：只有响应存在且非空时才解析
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      // 如果解析失败（例如返回了 403 HTML 页面），构造一个符合前端结构的错误对象
      data = {
        code: backendResponse.status,
        message: "接口返回格式异常，请检查后端地址或权限",
        data: []
      }
    }

    return NextResponse.json(data, { status: backendResponse.status })
  } catch (error) {
    return NextResponse.json(
      {
        code: 500,
        message: error instanceof Error ? error.message : "Internal Server Error",
        data: [],
      },
      { status: 500 }
    )
  }
}

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

    const body = await req.json() 

    const backendResponse = await fetch(`${BACKEND_BASE_URL}/plants`, {
      method: "POST",
      headers,
      body: body, // 直接透传，不要再在 route.ts 里二次构造转换
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