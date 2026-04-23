import { Haptics, ImpactStyle } from "@capacitor/haptics"
import type { HomeRealtimeData, Plant, StrategyAgentProposal, UploadedFileItem } from "./types"

export const fallbackPlants: Plant[] = [
  { plantId: 1, plantName: "网纹草", status: "ACTIVE" },
  { plantId: 2, plantName: "多肉", status: "ACTIVE" },
  { plantId: 3, plantName: "绿萝", status: "ACTIVE" },
]

export const quickQuestions = ["绿萝叶子发黄怎么办", "多肉多久浇一次水", "植物适合多少湿度", "光照不足会有什么表现", "策略是否要更改"]

export const fallbackFiles: UploadedFileItem[] = [
  { name: "绿萝养护手册.pdf", time: "示例资料", status: "已入库" },
  { name: "多肉控水指南.md", time: "示例资料", status: "已入库" },
  { name: "温湿度策略规范.docx", time: "示例资料", status: "解析中" },
  { name: "病虫害识别卡片.txt", time: "示例资料", status: "已入库" },
]

export const metricLabels: Record<StrategyAgentProposal["metricType"], string> = {
  LIGHT: "光照强度",
  TEMPERATURE: "温度",
  HUMIDITY: "湿度",
}

export const metricUnits: Record<StrategyAgentProposal["metricType"], string> = {
  LIGHT: "lux",
  TEMPERATURE: "°C",
  HUMIDITY: "%",
}

export const operatorLabels: Record<StrategyAgentProposal["operatorType"], string> = {
  LT: "<",
  GT: ">",
  EQ: "=",
}

export const actionLabels: Record<StrategyAgentProposal["actionType"], string> = {
  AUTO_LIGHT: "开启补光灯",
  AUTO_FAN: "启动风扇",
  NOTIFY_USER: "通知用户",
}

export function impact(style = ImpactStyle.Light) {
  void Haptics.impact({ style }).catch(() => undefined)
}

export function formatNumber(value: number | null | undefined, unit: string, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "--"
  return `${Number(value).toFixed(digits)}${unit}`
}

export function formatLight(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "--"
  return `${Number(value).toLocaleString("zh-CN")} lux`
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
}

export function healthScore(data: HomeRealtimeData | null) {
  if (!data) return 72
  let score = 92
  const { temperature, humidity, lightLux } = data.environment
  if (temperature != null && (temperature < 15 || temperature > 30)) score -= 14
  if (humidity != null && (humidity < 40 || humidity > 80)) score -= 12
  if (lightLux != null && lightLux < 300) score -= 12
  if (data.abnormal.hasAlert) score -= 16
  if (data.tilt.hasAlert) score -= 18
  return Math.max(12, Math.min(100, score))
}

export function plantContextText(plant: Plant, realtime: HomeRealtimeData | null) {
  if (!realtime) return `当前植物：${plant.plantName}。实时数据暂未加载完成。`
  const env = realtime.environment
  return [
    `当前植物：${plant.plantName}，ID：${plant.plantId}`,
    `温度：${formatNumber(env.temperature, "°C")}`,
    `湿度：${formatNumber(env.humidity, "%")}`,
    `光照：${formatLight(env.lightLux)}`,
    `设备：${realtime.device.connected ? "在线" : "离线或未知"}，风扇${realtime.device.fanOn ? "开启" : "关闭或未知"}，补光灯${realtime.device.lightOn ? "开启" : "关闭或未知"}`,
    `未处理异常：${realtime.abnormal.count} 条，倾倒告警：${realtime.tilt.count} 条`,
  ].join("\n")
}

export function isStrategyChangeQuestion(message: string) {
  return /策略/.test(message) && /(更改|修改|调整|新增|优化|要不要|是否)/.test(message)
}

export function getCurrentUserId() {
  const rawUser = window.localStorage.getItem("plantcloud_user")
  if (!rawUser) return undefined
  try {
    const parsed = JSON.parse(rawUser) as { userId?: string | number; id?: string | number }
    return parsed.userId != null ? String(parsed.userId) : parsed.id != null ? String(parsed.id) : undefined
  } catch {
    return undefined
  }
}

export function normalizeProposalActionValue(proposal: StrategyAgentProposal) {
  if (proposal.actionType === "AUTO_LIGHT") return proposal.actionValue === "OFF" ? "OFF" : "ON"
  if (proposal.actionType === "AUTO_FAN") return proposal.actionValue === "LOW" ? "LOW" : "HIGH"
  return proposal.actionValue === "DANGER" || proposal.actionValue === "WARNING" ? proposal.actionValue : "INFO"
}

export function formatProposalCondition(proposal: StrategyAgentProposal) {
  const timeLimit = proposal.timeLimitEnabled && proposal.startTime && proposal.endTime ? `，且时间在 ${proposal.startTime}-${proposal.endTime}` : ""
  return `${metricLabels[proposal.metricType]} ${operatorLabels[proposal.operatorType]} ${proposal.thresholdMin} ${metricUnits[proposal.metricType]}${timeLimit}`
}

export function buildMobilePlantContext(plant: Plant, realtime: HomeRealtimeData | null) {
  return {
    selectedPlant: {
      plantId: plant.plantId,
      name: plant.plantName,
      species: plant.species,
    },
    realtime,
    contextText: plantContextText(plant, realtime),
  }
}

export function buildStrategyPayloadFromProposal(proposal: StrategyAgentProposal, plant: Plant, realtime: HomeRealtimeData | null) {
  return {
    plantId: String(plant.plantId),
    createdBy: getCurrentUserId(),
    strategyName: proposal.strategyName,
    strategyType: "CONDITION",
    metricType: proposal.metricType,
    operatorType: proposal.operatorType,
    thresholdMin: proposal.thresholdMin,
    actionType: proposal.actionType,
    actionValue: normalizeProposalActionValue(proposal),
    targetDeviceId: proposal.actionType === "NOTIFY_USER" ? null : realtime?.device.deviceId != null ? String(realtime.device.deviceId) : null,
    enabled: true,
    priority: 10,
    timeLimitEnabled: Boolean(proposal.timeLimitEnabled),
    startTime: proposal.timeLimitEnabled ? proposal.startTime ?? null : null,
    endTime: proposal.timeLimitEnabled ? proposal.endTime ?? null : null,
    configJson: {
      timeLimitEnabled: Boolean(proposal.timeLimitEnabled),
      notifyTitleTemplate: proposal.strategyName,
      notifyContentTemplate: proposal.reason,
    },
  }
}

