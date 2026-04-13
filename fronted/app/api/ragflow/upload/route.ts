import { NextRequest, NextResponse } from "next/server"

const RAGFLOW_BASE_URL = process.env.RAGFLOW_BASE_URL!
const RAGFLOW_API_KEY = process.env.RAGFLOW_API_KEY!
const RAGFLOW_DATASET_ID = process.env.RAGFLOW_DATASET_ID!

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const files = form.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "没有上传文件" },
        { status: 400 }
      )
    }

    const uploadedDocumentIds: string[] = []

    for (const file of files) {
      const uploadForm = new FormData()
      uploadForm.append("file", file)

      const uploadResp = await fetch(
        `${RAGFLOW_BASE_URL}/api/v1/datasets/${RAGFLOW_DATASET_ID}/documents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RAGFLOW_API_KEY}`,
          },
          body: uploadForm,
        }
      )

      const uploadData = await uploadResp.json()

      if (!uploadResp.ok) {
        return NextResponse.json(
          { success: false, error: uploadData },
          { status: uploadResp.status }
        )
      }

      const docs =
        uploadData?.data ||
        uploadData?.documents ||
        uploadData?.docs ||
        []

      if (Array.isArray(docs)) {
        docs.forEach((doc: any) => {
          if (doc?.id) uploadedDocumentIds.push(doc.id)
        })
      }
    }

    if (uploadedDocumentIds.length > 0) {
      const parseResp = await fetch(
        `${RAGFLOW_BASE_URL}/api/v1/datasets/${RAGFLOW_DATASET_ID}/chunks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RAGFLOW_API_KEY}`,
          },
          body: JSON.stringify({
            document_ids: uploadedDocumentIds,
          }),
        }
      )

      const parseData = await parseResp.json()

      if (!parseResp.ok) {
        return NextResponse.json(
          { success: false, error: parseData },
          { status: parseResp.status }
        )
      }
    }

    return NextResponse.json({
      success: true,
      documentIds: uploadedDocumentIds,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "server error" },
      { status: 500 }
    )
  }
}
