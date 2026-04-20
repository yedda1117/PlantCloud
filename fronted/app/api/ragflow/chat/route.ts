import { NextRequest, NextResponse } from "next/server"

const RAGFLOW_BASE_URL = process.env.RAGFLOW_BASE_URL!
const RAGFLOW_API_KEY = process.env.RAGFLOW_API_KEY!
const RAGFLOW_CHAT_ID = process.env.RAGFLOW_CHAT_ID!

type RAGFlowChunkRef = {
  document_name?: string
  doc_name?: string
  positions?: number[][]
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [], plantContextText } = await req.json()

    const plantContext =
      typeof plantContextText === "string" && plantContextText.trim()
        ? plantContextText.trim()
        : "当前主页所选植物数据：前端未提供实时植物上下文。"

    const finalMessage = `${plantContext}

用户问题：
${message}`

    const messages = [
      ...history,
      { role: "user", content: finalMessage },
    ]

    const resp = await fetch(
      `${RAGFLOW_BASE_URL}/api/v1/chats_openai/${RAGFLOW_CHAT_ID}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RAGFLOW_API_KEY}`,
        },
        body: JSON.stringify({
          model: "ragflow",
          messages,
          stream: false,
          extra_body: {
            reference: true,
            reference_metadata: {
              include: true,
            },
          },
        }),
      }
    )

    const data = await resp.json()

    if (!resp.ok) {
      return NextResponse.json(
        { success: false, error: data },
        { status: resp.status }
      )
    }

    const answer =
      data?.choices?.[0]?.message?.content || "未获取到回答"

    const refRoot =
      data?.choices?.[0]?.message?.reference ||
      data?.reference ||
      data?.references ||
      null

    let sources: { file: string; section?: string }[] = []

    if (refRoot?.chunks && typeof refRoot.chunks === "object") {
      const chunks = Object.values(refRoot.chunks) as RAGFlowChunkRef[]
      sources = chunks.map((chunk) => {
        const pos =
          Array.isArray(chunk.positions) && chunk.positions.length > 0
            ? `位置 ${JSON.stringify(chunk.positions[0])}`
            : ""

        return {
          file: chunk.document_name || chunk.doc_name || "未知来源",
          section: pos,
        }
      })
    }

    const dedupedSources = Array.from(
      new Map(
        sources.map((s) => [`${s.file}-${s.section || ""}`, s])
      ).values()
    )

    return NextResponse.json({
      success: true,
      answer,
      sources: dedupedSources,
      raw: data,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "server error" },
      { status: 500 }
    )
  }
}
