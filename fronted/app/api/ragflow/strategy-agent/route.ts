import { NextRequest, NextResponse } from "next/server"

const RAGFLOW_BASE_URL = process.env.RAGFLOW_BASE_URL
const RAGFLOW_API_KEY = process.env.RAGFLOW_API_KEY
const RAGFLOW_AGENT_ID = process.env.RAGFLOW_AGENT_ID
const RAGFLOW_AGENT_URL = process.env.RAGFLOW_AGENT_URL

type StrategyProposal = {
  shouldSuggest: boolean
  detected: string
  strategyName: string
  metricType: "LIGHT" | "TEMPERATURE" | "HUMIDITY"
  operatorType: "LT" | "GT" | "EQ"
  thresholdMin: number
  actionType: "AUTO_LIGHT" | "AUTO_FAN" | "NOTIFY_USER"
  actionValue: "ON" | "OFF" | "LOW" | "HIGH" | "INFO" | "WARNING" | "DANGER"
  timeLimitEnabled?: boolean
  startTime?: string | null
  endTime?: string | null
  reason: string
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value)
}

function normalizeActionValue(actionType: StrategyProposal["actionType"], actionValue: unknown): StrategyProposal["actionValue"] {
  if (actionType === "AUTO_LIGHT") {
    return actionValue === "OFF" ? "OFF" : "ON"
  }
  if (actionType === "AUTO_FAN") {
    return actionValue === "LOW" ? "LOW" : "HIGH"
  }
  if (actionValue === "DANGER" || actionValue === "WARNING") {
    return actionValue
  }
  return "INFO"
}

function extractJsonObject(content: string) {
  const trimmed = content.trim()
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed
  }

  const matched = trimmed.match(/\{[\s\S]*\}/)
  return matched?.[0] ?? null
}

function normalizeProposal(value: Partial<StrategyProposal> | null): StrategyProposal | null {
  if (!value || value.shouldSuggest === false) {
    return null
  }

  const metricType = value.metricType
  const operatorType = value.operatorType
  const actionType = value.actionType
  const validMetric = metricType === "LIGHT" || metricType === "TEMPERATURE" || metricType === "HUMIDITY"
  const validOperator = operatorType === "LT" || operatorType === "GT" || operatorType === "EQ"
  const validAction = actionType === "AUTO_LIGHT" || actionType === "AUTO_FAN" || actionType === "NOTIFY_USER"

  if (!validMetric || !validOperator || !validAction || typeof value.thresholdMin !== "number") {
    return null
  }

  return {
    shouldSuggest: true,
    detected: value.detected || "当前植物环境存在需要关注的趋势",
    strategyName: value.strategyName || "智能推荐策略",
    metricType,
    operatorType,
    thresholdMin: value.thresholdMin,
    actionType,
    actionValue: normalizeActionValue(actionType, value.actionValue),
    timeLimitEnabled: Boolean(value.timeLimitEnabled && isTime(value.startTime) && isTime(value.endTime)),
    startTime: value.timeLimitEnabled && isTime(value.startTime) ? value.startTime : null,
    endTime: value.timeLimitEnabled && isTime(value.endTime) ? value.endTime : null,
    reason: value.reason || "根据当前植物数据与近七日趋势生成",
  }
}

function average(values: Array<number | null | undefined>) {
  const validValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (validValues.length === 0) {
    return null
  }
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length
}

function fallbackProposal(plantContext: any): StrategyProposal | null {
  const plantName = plantContext?.selectedPlant?.name || "当前植物"
  const current = plantContext?.realtime?.environment
  const history = plantContext?.sevenDayHistory
  const currentLight = current?.lightLux
  const currentHumidity = current?.humidity
  const currentTemperature = current?.temperature
  const avgLight = average((history?.light || []).map((point: any) => point.value))
  const avgHumidity = average((history?.humidity || []).map((point: any) => point.value))
  const avgTemperature = average((history?.temperature || []).map((point: any) => point.value))

  if (currentLight != null && (currentLight < 300 || (avgLight != null && avgLight < 500))) {
    return {
      shouldSuggest: true,
      detected: `${plantName} 光照偏低`,
      strategyName: `${plantName} 光照不足自动补光`,
      metricType: "LIGHT",
      operatorType: "LT",
      thresholdMin: 300,
      actionType: "AUTO_LIGHT",
      actionValue: "ON",
      timeLimitEnabled: true,
      startTime: "17:00",
      endTime: "23:00",
      reason: "当前或近七日光照低于常用养护阈值，建议补光。",
    }
  }

  if (currentHumidity != null && (currentHumidity < 40 || (avgHumidity != null && avgHumidity < 45))) {
    return {
      shouldSuggest: true,
      detected: `${plantName} 湿度偏低`,
      strategyName: `${plantName} 湿度偏低提醒`,
      metricType: "HUMIDITY",
      operatorType: "LT",
      thresholdMin: 40,
      actionType: "NOTIFY_USER",
      actionValue: "INFO",
      timeLimitEnabled: false,
      startTime: null,
      endTime: null,
      reason: "当前或近七日湿度偏低，系统暂无浇水执行设备，先新增通知策略。",
    }
  }

  if (currentTemperature != null && (currentTemperature > 30 || (avgTemperature != null && avgTemperature > 30))) {
    return {
      shouldSuggest: true,
      detected: `${plantName} 温度偏高`,
      strategyName: `${plantName} 高温自动风扇`,
      metricType: "TEMPERATURE",
      operatorType: "GT",
      thresholdMin: 30,
      actionType: "AUTO_FAN",
      actionValue: "HIGH",
      timeLimitEnabled: false,
      startTime: null,
      endTime: null,
      reason: "当前或近七日温度偏高，建议增加风扇策略。",
    }
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const { message, plantContext, plantContextText } = await req.json()

    let proposal: StrategyProposal | null = null
    let agentAnswer = ""

    if (RAGFLOW_API_KEY && (RAGFLOW_AGENT_URL || (RAGFLOW_BASE_URL && RAGFLOW_AGENT_ID))) {
      const endpoint =
        RAGFLOW_AGENT_URL ||
        `${RAGFLOW_BASE_URL}/api/v1/agents_openai/${RAGFLOW_AGENT_ID}/chat/completions`

      const prompt = [
        "你是 PlantCloud 策略分析 Agent。",
        "用户询问策略是否要更改时，请像农业策略工程师一样，直接生成一条可保存到 PlantCloud 自动化策略管理里的最新策略。",
        "请只输出 JSON，不要输出 Markdown。",
        "JSON 字段：shouldSuggest, detected, strategyName, metricType, operatorType, thresholdMin, actionType, actionValue, timeLimitEnabled, startTime, endTime, reason。",
        "metricType 只能是 LIGHT/TEMPERATURE/HUMIDITY；operatorType 只能是 LT/GT/EQ；actionType 只能是 AUTO_LIGHT/AUTO_FAN/NOTIFY_USER。",
        "actionValue 必须匹配后端：AUTO_LIGHT 只能 ON/OFF；AUTO_FAN 只能 LOW/HIGH；NOTIFY_USER 只能 INFO/WARNING/DANGER。",
        "timeLimitEnabled 为 true 时，startTime/endTime 必须是 HH:mm；不需要时间限制时 timeLimitEnabled=false, startTime=null, endTime=null。",
        "光照不足通常建议 AUTO_LIGHT + ON，可按傍晚到夜间生成时间范围；温度过高通常建议 AUTO_FAN + HIGH；湿度偏低且没有浇水设备时建议 NOTIFY_USER + INFO。",
        "必须阅读“当前已有自动化策略”：如果已有启用策略已经覆盖同一植物、同一指标、同一动作和相近阈值，请输出 {\"shouldSuggest\":false}，不要重复新增会与数据库冲突的策略。",
        "只有当前策略列表没有覆盖该风险，或新策略条件/动作明显不同且不会重复时，才输出 shouldSuggest=true。",
        "如果不需要新增策略，输出 {\"shouldSuggest\":false}。",
        "",
        "植物数据：",
        plantContextText,
        "",
        "用户问题：",
        message,
      ].join("\n")

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RAGFLOW_API_KEY}`,
        },
        body: JSON.stringify({
          model: "ragflow",
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      })

      const data = await resp.json()
      if (!resp.ok) {
        return NextResponse.json({ success: false, error: data }, { status: resp.status })
      }

      agentAnswer = data?.choices?.[0]?.message?.content || ""
      const jsonText = extractJsonObject(agentAnswer)
      if (jsonText) {
        try {
          proposal = normalizeProposal(JSON.parse(jsonText) as Partial<StrategyProposal>)
        } catch {
          proposal = null
        }
      }
    }

    proposal = proposal ?? fallbackProposal(plantContext)

    return NextResponse.json({
      success: true,
      proposal,
      answer: agentAnswer,
      usedAgent: Boolean(agentAnswer),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "server error" },
      { status: 500 },
    )
  }
}
