import { NextResponse } from "next/server"

const RAGFLOW_BASE_URL = process.env.RAGFLOW_BASE_URL!
const RAGFLOW_API_KEY = process.env.RAGFLOW_API_KEY!
const RAGFLOW_DATASET_ID = process.env.RAGFLOW_DATASET_ID!

function formatDate(input?: string | number) {
  if (!input) return ""
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("zh-CN")
}

function mapRunStatus(run?: string | number) {
  const value = String(run ?? "").toUpperCase()

  if (value === "3" || value === "DONE") return "已入库"
  if (
    value === "1" ||
    value === "RUNNING" ||
    value === "0" ||
    value === "UNSTART"
  ) {
    return "解析中"
  }
  return "失败"
}

export async function GET() {
  try {
    const url =
      `${RAGFLOW_BASE_URL}/api/v1/datasets/${RAGFLOW_DATASET_ID}/documents` +
      `?page=1&page_size=50&orderby=create_time&desc=true`

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${RAGFLOW_API_KEY}`,
      },
      cache: "no-store",
    })

    const data = await resp.json()

    if (!resp.ok) {
      return NextResponse.json(
        { success: false, error: data },
        { status: resp.status }
      )
    }

    const rawList =
      data?.data?.docs ||
      data?.data?.documents ||
      data?.data?.items ||
      data?.data ||
      []

    const files = Array.isArray(rawList)
      ? rawList.map((doc: any) => ({
          id: doc.id,
          name: doc.name || doc.filename || "未命名文件",
          time: formatDate(doc.create_time || doc.created_at || doc.update_time),
          status: mapRunStatus(doc.run),
        }))
      : []

    return NextResponse.json({
      success: true,
      files,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "server error" },
      { status: 500 }
    )
  }
}
