import { NextResponse, type NextRequest } from "next/server"

const allowedDevOrigins = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/192\.168\.\d+\.\d+:\d+$/]

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false
  return allowedDevOrigins.some((pattern) => pattern.test(origin))
}

function withCors(response: NextResponse, origin: string | null) {
  if (isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.append("Vary", "Origin")
  }
  return response
}

export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return withCors(new NextResponse(null, { status: 204 }), request.headers.get("origin"))
  }

  return withCors(NextResponse.next(), request.headers.get("origin"))
}

export const config = {
  matcher: "/api/:path*",
}

