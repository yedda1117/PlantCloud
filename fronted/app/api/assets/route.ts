import { createReadStream, existsSync } from "node:fs"
import { stat } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"
import { NextRequest, NextResponse } from "next/server"
import { SERVER_BACKEND_BASE_URL } from "@/lib/backend-base-url"

const BACKEND_BASE_URL = SERVER_BACKEND_BASE_URL
const WORKSPACE_ROOT = path.resolve(process.cwd(), "..")
const BACKEND_UPLOAD_ROOT = path.join(WORKSPACE_ROOT, "backend", "uploads")
const BACKEND_STATIC_ROOT = path.join(WORKSPACE_ROOT, "backend", "src", "main", "resources", "static")

function getContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  switch (extension) {
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".webp":
      return "image/webp"
    case ".bmp":
      return "image/bmp"
    case ".gif":
      return "image/gif"
    default:
      return "application/octet-stream"
  }
}

function buildBackendAssetUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return new URL(encodeURI(normalizedPath), BACKEND_BASE_URL)
}

function resolveLocalAssetPath(assetPath: string) {
  const normalized = assetPath.replace(/\\/g, "/")

  if (normalized.startsWith("/uploads/")) {
    const relativeUploadPath = normalized.slice("/uploads/".length)
    const directPath = path.join(BACKEND_UPLOAD_ROOT, ...relativeUploadPath.split("/"))
    if (existsSync(directPath)) {
      return directPath
    }

    const legacyMatch = normalized.match(/^\/uploads\/calendar\/plant-(\d+)\/(\d{4})-(\d{2})-(\d{2})\/(.+)$/)
    if (legacyMatch) {
      const [, plantId, year, month, day, filename] = legacyMatch
      const modernDir = path.join(BACKEND_UPLOAD_ROOT, "photos", plantId, `${year}${month}${day}`)
      const directModernPath = path.join(modernDir, filename)
      if (existsSync(directModernPath)) {
        return directModernPath
      }
    }
  }

  const staticPath = path.join(BACKEND_STATIC_ROOT, normalized.replace(/^\/+/, ""))
  if (existsSync(staticPath)) {
    return staticPath
  }

  return null
}

async function createLocalFileResponse(filePath: string) {
  const fileStat = await stat(filePath)
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": getContentType(filePath),
      "Content-Length": String(fileStat.size),
      "Cache-Control": "public, max-age=60",
    },
  })
}

export async function GET(req: NextRequest) {
  const assetPath = req.nextUrl.searchParams.get("path")
  if (!assetPath) {
    return NextResponse.json(
      { code: 400, message: "Missing asset path", data: null },
      { status: 400 },
    )
  }

  try {
    const localPath = resolveLocalAssetPath(assetPath)
    if (localPath) {
      return await createLocalFileResponse(localPath)
    }

    const backendUrl = buildBackendAssetUrl(assetPath)
    const backendResponse = await fetch(backendUrl, {
      method: "GET",
      cache: "no-store",
    })

    if (!backendResponse.ok) {
      return new NextResponse(backendResponse.body, {
        status: backendResponse.status,
        headers: {
          "Content-Type": backendResponse.headers.get("Content-Type") || "text/plain; charset=utf-8",
        },
      })
    }

    const headers = new Headers()
    const contentType = backendResponse.headers.get("Content-Type")
    if (contentType) {
      headers.set("Content-Type", contentType)
    }
    const cacheControl = backendResponse.headers.get("Cache-Control")
    if (cacheControl) {
      headers.set("Cache-Control", cacheControl)
    }

    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      headers,
    })
  } catch (error) {
    return NextResponse.json(
      {
        code: 500,
        message: error instanceof Error ? error.message : "Asset proxy failed",
        data: null,
      },
      { status: 500 },
    )
  }
}
