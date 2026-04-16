import { NextRequest, NextResponse } from "next/server"

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:8080"

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const photo = form.get("photo")
    const plantId = form.get("plant_id")
    const date = form.get("date")
    const note = form.get("note")
    const milestone = form.get("milestone")

    if (!(photo instanceof File)) {
      return NextResponse.json(
        { code: 400, message: "Missing photo file", data: null },
        { status: 400 },
      )
    }

    if (typeof plantId !== "string" || typeof date !== "string") {
      return NextResponse.json(
        { code: 400, message: "Missing plant_id or date", data: null },
        { status: 400 },
      )
    }

    const uploadForm = new FormData()
    uploadForm.append("plant_id", plantId)
    uploadForm.append("date", date)
    uploadForm.append("photo", photo)
    if (typeof note === "string") {
      uploadForm.append("note", note)
    }
    if (typeof milestone === "string") {
      uploadForm.append("milestone", milestone)
    }

    const headers: HeadersInit = {}
    const authorization = req.headers.get("authorization")
    if (authorization) {
      headers.Authorization = authorization
    }

    const backendResponse = await fetch(`${BACKEND_BASE_URL}/photos/upload`, {
      method: "POST",
      headers,
      body: uploadForm,
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
