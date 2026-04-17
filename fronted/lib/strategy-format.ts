import type { DeviceRuntimeStatus } from "@/lib/device-api"
import type { StrategyConfig, StrategyItem } from "@/lib/strategy-api"

const metricLabels: Record<string, string> = {
  LIGHT: "光照强度",
  TEMPERATURE: "温度",
  HUMIDITY: "湿度",
  NONE: "条件",
}

const metricUnits: Record<string, string> = {
  LIGHT: "lux",
  TEMPERATURE: "°C",
  HUMIDITY: "%",
}

const operatorLabels: Record<string, string> = {
  LT: "<",
  GT: ">",
  EQ: "=",
  BETWEEN: "介于",
  CRON: "按计划",
}

const actionLabels: Record<string, string> = {
  AUTO_LIGHT: "开启补光灯",
  AUTO_FAN: "启动风扇",
  NOTIFY_USER: "通知用户",
}

export function parseStrategyConfig(config: StrategyItem["configJson"]): StrategyConfig {
  if (!config) {
    return {}
  }

  if (typeof config === "string") {
    try {
      return JSON.parse(config) as StrategyConfig
    } catch {
      return {}
    }
  }

  return config
}

export function resolveStrategyConfig(
  strategy: Pick<
    StrategyItem,
    "config" | "configJson" | "timeLimitEnabled" | "startTime" | "endTime" | "notifyTitleTemplate" | "notifyContentTemplate"
  >,
): StrategyConfig {
  const config = {
    ...(strategy.config ?? {}),
    ...parseStrategyConfig(strategy.configJson),
  }

  if (typeof strategy.timeLimitEnabled === "boolean") {
    config.timeLimitEnabled = strategy.timeLimitEnabled
  }
  if (strategy.startTime) {
    config.startTime = strategy.startTime
  }
  if (strategy.endTime) {
    config.endTime = strategy.endTime
  }
  if (strategy.notifyTitleTemplate) {
    config.notifyTitleTemplate = strategy.notifyTitleTemplate
  }
  if (strategy.notifyContentTemplate) {
    config.notifyContentTemplate = strategy.notifyContentTemplate
  }

  return config
}

function formatTimeLimit(config: StrategyConfig) {
  if (!config.timeLimitEnabled || !config.startTime || !config.endTime) {
    return ""
  }
  return `，且时间在 ${config.startTime}–${config.endTime}`
}

export function formatStrategyCondition(strategy: StrategyItem) {
  const config = resolveStrategyConfig(strategy)

  if (strategy.strategyType === "SCHEDULE") {
    return strategy.cronExpr ? `按计划 ${strategy.cronExpr}` : "按计划执行"
  }

  const metric = metricLabels[strategy.metricType] ?? strategy.metricType
  const operator = operatorLabels[strategy.operatorType] ?? strategy.operatorType
  const unit = metricUnits[strategy.metricType] ? ` ${metricUnits[strategy.metricType]}` : ""

  if (strategy.operatorType === "BETWEEN") {
    return `${metric} 介于 ${strategy.thresholdMin ?? "-"}${unit} 到 ${strategy.thresholdMax ?? "-"}${unit}${formatTimeLimit(config)}`
  }

  return `${metric} ${operator} ${strategy.thresholdMin ?? "-"}${unit}${formatTimeLimit(config)}`
}

export function formatStrategyAction(
  strategy: StrategyItem,
  devices: { light?: DeviceRuntimeStatus | null; fan?: DeviceRuntimeStatus | null },
) {
  if (strategy.actionType === "NOTIFY_USER") {
    return "通知用户"
  }

  const device =
    strategy.actionType === "AUTO_LIGHT"
      ? devices.light
      : strategy.actionType === "AUTO_FAN"
        ? devices.fan
        : null

  const label = actionLabels[strategy.actionType] ?? strategy.actionType
  if (device?.deviceName) {
    return `${label} ${device.deviceName}`
  }
  if (device?.deviceCode) {
    return `${label} ${device.deviceCode}`
  }
  if (strategy.targetDeviceId) {
    return `${label} 设备 #${strategy.targetDeviceId}`
  }
  return label
}
