"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { getDevicesStatus, type DevicesStatus } from "@/lib/device-api"
import { DEFAULT_PLANT_ID, getPlantApiId, getPlantOption, plantOptions, SELECTED_PLANT_STORAGE_KEY } from "@/lib/plants"
import { usePlantSelection } from "@/context/plant-selection"
import {
  createStrategy,
  deleteStrategy,
  getStrategyDetail,
  listStrategyExecutionLogs,
  listStrategies,
  updateStrategy,
  type StrategyExecutionLogItem,
  type StrategyItem,
  type StrategyUpsertPayload,
} from "@/lib/strategy-api"
import { formatStrategyAction, formatStrategyCondition, resolveStrategyConfig } from "@/lib/strategy-format"
import {
  AlertCircle,
  Bell,
  ChevronRight,
  CheckCircle,
  Clock,
  Cpu,
  Droplets,
  Eye,
  Leaf,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Smartphone,
  Sun,
  Thermometer,
  Trash2,
  Wifi,
  Wind,
  Zap,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type PolicyLog = {
  id: string
  time: string
  message: string
  type: "info" | "success" | "warning"
}

type StrategyFormState = {
  strategyName: string
  metricType: "LIGHT" | "TEMPERATURE" | "HUMIDITY"
  operatorType: "LT" | "GT" | "EQ"
  thresholdMin: string
  timeLimitEnabled: boolean
  startTime: string
  endTime: string
  actionType: "AUTO_LIGHT" | "AUTO_FAN"
  actionValue: "ON" | "OFF"
}

type StrategySaveFeedback = {
  title: string
  description: string
}

type PlantItem = {
  id: string
  plantName: string
  deviceId: string
  status?: string // ACTIVE, INACTIVE, DELETED
}

type AiPlantConfig = {
  plantName: string
  tempMin: number
  tempMax: number
  humidityMin: number
  humidityMax: number
  lightMin: number
  lightMax: number
  tempRiseSensitive: number
  humidityDropSensitive: number
  lightRiseSensitive: number
  careLevel: string
  summary: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const initialFormState: StrategyFormState = {
  strategyName: "",
  metricType: "LIGHT",
  operatorType: "LT",
  thresholdMin: "",
  timeLimitEnabled: false,
  startTime: "18:00",
  endTime: "22:00",
  actionType: "AUTO_LIGHT",
  actionValue: "ON",
}

const strategyActionOptions = [
  { value: "AUTO_LIGHT_ON", label: "开启补光灯", actionType: "AUTO_LIGHT", actionValue: "ON" },
  { value: "AUTO_LIGHT_OFF", label: "关闭补光灯", actionType: "AUTO_LIGHT", actionValue: "OFF" },
  { value: "AUTO_FAN_ON", label: "启动风扇", actionType: "AUTO_FAN", actionValue: "ON" },
  { value: "AUTO_FAN_OFF", label: "关闭风扇", actionType: "AUTO_FAN", actionValue: "OFF" },
] as const

type StrategyActionSelectValue = (typeof strategyActionOptions)[number]["value"]

// Mock device list: #1-#6 bound, #7-#8 available
const MOCK_DEVICES = Array.from({ length: 8 }, (_, i) => ({
  id: `${i + 1}`,
  label: `#${i + 1}`,
  bound: i < 6,
}))

// ─── Auth helpers ─────────────────────────────────────────────────────────────

type StoredUserSnapshot = {
  rawUser: string | null
  parsedUser: unknown
  tokenUserId?: string
  resolvedUserId?: string
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
  return atob(padded)
}

function getUserIdFromToken(token: string | null) {
  if (!token) return undefined
  try {
    const [, payload = ""] = token.split(".")
    const decoded = decodeBase64Url(payload)
    const matched = decoded.match(/"userId"\s*:\s*("?)(-?\d+)\1/)
    return matched?.[2]
  } catch {
    return undefined
  }
}

function readStoredUserSnapshot(): StoredUserSnapshot {
  if (typeof window === "undefined") return { rawUser: null, parsedUser: null }
  const rawUser = window.localStorage.getItem("plantcloud_user")
  const tokenUserId = getUserIdFromToken(window.localStorage.getItem("plantcloud_token"))
  if (!rawUser) return { rawUser, parsedUser: null, tokenUserId, resolvedUserId: tokenUserId }
  try {
    const parsedUser = JSON.parse(rawUser) as { userId?: string | number; id?: string | number }
    const localUserId =
      parsedUser.userId != null ? String(parsedUser.userId) : parsedUser.id != null ? String(parsedUser.id) : undefined
    return { rawUser, parsedUser, tokenUserId, resolvedUserId: tokenUserId ?? localUserId }
  } catch (error) {
    return {
      rawUser,
      parsedUser: { parseError: error instanceof Error ? error.message : "Unknown parse error" },
      tokenUserId,
      resolvedUserId: tokenUserId,
    }
  }
}

function getCurrentUserId() {
  return readStoredUserSnapshot().resolvedUserId
}

// ─── Strategy helpers ─────────────────────────────────────────────────────────

function resolveStrategyActionValue(value: string): Pick<StrategyFormState, "actionType" | "actionValue"> {
  const option = strategyActionOptions.find((item) => item.value === value)
  if (!option) {
    return { actionType: "AUTO_LIGHT", actionValue: "ON" }
  }
  return { actionType: option.actionType, actionValue: option.actionValue }
}

function getStrategyActionSelectValue(actionType: string, actionValue?: string | null): StrategyActionSelectValue {
  const normalizedActionValue = actionValue?.toUpperCase()
  if (actionType === "AUTO_LIGHT") {
    return normalizedActionValue === "OFF" ? "AUTO_LIGHT_OFF" : "AUTO_LIGHT_ON"
  }
  if (actionType === "AUTO_FAN") {
    return normalizedActionValue === "OFF" ? "AUTO_FAN_OFF" : "AUTO_FAN_ON"
  }
  return "AUTO_LIGHT_ON"
}

function getStrategyFormActionSelectValue(form: StrategyFormState): StrategyActionSelectValue {
  return getStrategyActionSelectValue(form.actionType, form.actionValue)
}

function buildStrategyFormFromItem(strategy: StrategyItem): StrategyFormState {
  const config = resolveStrategyConfig(strategy)
  const action = resolveStrategyActionValue(getStrategyActionSelectValue(strategy.actionType, strategy.actionValue))
  return {
    strategyName: strategy.strategyName ?? "",
    metricType: strategy.metricType === "TEMPERATURE" || strategy.metricType === "HUMIDITY" ? strategy.metricType : "LIGHT",
    operatorType: strategy.operatorType === "GT" || strategy.operatorType === "EQ" ? strategy.operatorType : "LT",
    thresholdMin: String(strategy.thresholdMin ?? strategy.thresholdMax ?? ""),
    timeLimitEnabled: Boolean(config.timeLimitEnabled),
    startTime: config.startTime ?? "18:00",
    endTime: config.endTime ?? "22:00",
    ...action,
  }
}

function resolveTargetDeviceId(
  actionType: StrategyFormState["actionType"],
  devicesStatus: DevicesStatus | null,
  fallback?: string | number | null,
) {
  const resolved =
    actionType === "AUTO_LIGHT"
      ? devicesStatus?.light?.deviceId
      : devicesStatus?.fan?.deviceId
  if (resolved != null) {
    return String(resolved)
  }
  return fallback != null ? String(fallback) : null
}

function buildThresholdPayload(form: StrategyFormState) {
  const threshold = Number(form.thresholdMin)
  return {
    thresholdMin: form.operatorType === "LT" ? null : threshold,
    thresholdMax: form.operatorType === "LT" ? threshold : null,
  }
}

function buildCreatePayload(
  form: StrategyFormState,
  plantId: number,
  userId: string | undefined,
  devicesStatus: DevicesStatus | null,
): StrategyUpsertPayload {
  const targetDeviceId = resolveTargetDeviceId(form.actionType, devicesStatus)

  return {
    plantId: String(plantId),
    createdBy: userId,
    strategyName: form.strategyName.trim(),
    strategyType: "CONDITION",
    metricType: form.metricType,
    operatorType: form.operatorType,
    ...buildThresholdPayload(form),
    actionType: form.actionType,
    actionValue: form.actionValue,
    targetDeviceId,
    enabled: true,
    priority: 10,
    timeLimitEnabled: form.timeLimitEnabled,
    startTime: form.timeLimitEnabled ? form.startTime : null,
    endTime: form.timeLimitEnabled ? form.endTime : null,
    configJson: {
      timeLimitEnabled: form.timeLimitEnabled,
      ...(form.timeLimitEnabled ? { startTime: form.startTime, endTime: form.endTime } : {}),
    },
  }
}

function buildEditPayload(
  strategy: StrategyItem,
  form: StrategyFormState,
  devicesStatus: DevicesStatus | null,
): StrategyUpsertPayload {
  return {
    plantId: strategy.plantId,
    createdBy: strategy.createdBy,
    strategyName: form.strategyName.trim(),
    strategyType: "CONDITION",
    targetDeviceId: resolveTargetDeviceId(
      form.actionType,
      devicesStatus,
      strategy.actionType === form.actionType ? strategy.targetDeviceId : null,
    ),
    metricType: form.metricType,
    operatorType: form.operatorType,
    ...buildThresholdPayload(form),
    cronExpr: null,
    actionType: form.actionType,
    actionValue: form.actionValue,
    enabled: strategy.enabled,
    priority: strategy.priority ?? 10,
    timeLimitEnabled: form.timeLimitEnabled,
    startTime: form.timeLimitEnabled ? form.startTime : null,
    endTime: form.timeLimitEnabled ? form.endTime : null,
    notifyTitleTemplate: null,
    notifyContentTemplate: null,
    configJson: {
      timeLimitEnabled: form.timeLimitEnabled,
      ...(form.timeLimitEnabled ? { startTime: form.startTime, endTime: form.endTime } : {}),
    },
  }
}

function buildUpdatePayload(strategy: StrategyItem, enabled: boolean): StrategyUpsertPayload {
  const config = resolveStrategyConfig(strategy)
  return {
    plantId: strategy.plantId,
    createdBy: strategy.createdBy,
    strategyName: strategy.strategyName,
    strategyType: strategy.strategyType,
    targetDeviceId: strategy.targetDeviceId ?? null,
    metricType: strategy.metricType,
    operatorType: strategy.operatorType,
    thresholdMin: strategy.thresholdMin ?? null,
    thresholdMax: strategy.thresholdMax ?? null,
    actionType: strategy.actionType,
    actionValue: strategy.actionValue ?? null,
    cronExpr: strategy.cronExpr ?? null,
    enabled,
    priority: strategy.priority ?? 0,
    timeLimitEnabled: config.timeLimitEnabled ?? false,
    startTime: config.timeLimitEnabled ? config.startTime ?? null : null,
    endTime: config.timeLimitEnabled ? config.endTime ?? null : null,
    notifyTitleTemplate: config.notifyTitleTemplate ?? null,
    notifyContentTemplate: config.notifyContentTemplate ?? null,
    configJson: {
      ...(typeof config.timeLimitEnabled === "boolean" ? { timeLimitEnabled: config.timeLimitEnabled } : {}),
      ...(config.startTime ? { startTime: config.startTime } : {}),
      ...(config.endTime ? { endTime: config.endTime } : {}),
      ...(config.notifyTitleTemplate ? { notifyTitleTemplate: config.notifyTitleTemplate } : {}),
      ...(config.notifyContentTemplate ? { notifyContentTemplate: config.notifyContentTemplate } : {}),
    },
  }
}

function validateStrategyForm(
  form: StrategyFormState,
  devicesStatus: DevicesStatus | null,
  userId: string | undefined,
  requireUserId: boolean,
  fallbackTargetDeviceId?: string | number | null,
) {
  if (requireUserId && !userId) return "当前登录信息缺少 userId，无法满足后端 createdBy 要求，请重新登录后再试"
  if (!form.strategyName.trim()) return "请输入策略名称"
  if (!form.thresholdMin.trim() || Number.isNaN(Number(form.thresholdMin))) return "请输入有效的触发阈值"
  if (form.timeLimitEnabled && (!form.startTime || !form.endTime)) return "请完整填写时间范围"
  const hasFallbackTarget = fallbackTargetDeviceId != null
  if (form.actionType === "AUTO_LIGHT" && !devicesStatus?.light?.deviceId && !hasFallbackTarget) return "当前未获取到补光灯设备，暂时无法创建补光策略"
  if (form.actionType === "AUTO_FAN" && !devicesStatus?.fan?.deviceId && !hasFallbackTarget) return "当前未获取到风扇设备，暂时无法创建风扇策略"
  return null
}

function buildFriendlyStrategySaveFeedback(
  error: unknown,
): StrategySaveFeedback {
  const message = error instanceof Error ? error.message : "保存策略失败，请稍后重试。"
  return { title: "保存策略失败", description: message }
}

function formatDateTime(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getPlantStatusMeta(status?: string) {
  if (status === "ACTIVE") {
    return {
      label: "在线",
      className: "border-emerald-300/60 bg-white/70 text-emerald-700 shadow-[0_0_18px_rgba(110,231,183,0.28)]",
    }
  }
  if (status === "DELETED") {
    return {
      label: "已删除",
      className: "border-rose-300/55 bg-white/70 text-rose-500",
    }
  }
  return {
    label: "离线",
    className: "border-emerald-200/50 bg-white/65 text-emerald-700/70",
  }
}

function getStrategyTypeMeta(strategy: StrategyItem) {
  switch (strategy.actionType) {
    case "AUTO_LIGHT":
      return { label: "补光", icon: Sun }
    case "AUTO_FAN":
      return { label: "通风", icon: Wind }
    case "NOTIFY_USER":
      return { label: "通知", icon: Bell }
    default:
      return { label: "策略", icon: Zap }
  }
}

function getStrategySummary(strategy: StrategyItem) {
  const condition = formatStrategyCondition(strategy)
  const action = formatStrategyAction(strategy, {})
  return `${condition}，${action}`
}

function getStrategyStatusClass(enabled: boolean) {
  return enabled
    ? "border-emerald-300/60 bg-white/72 text-emerald-700 shadow-[0_0_18px_rgba(110,231,183,0.22)]"
    : "border-emerald-200/45 bg-white/60 text-emerald-800/65"
}

function getLogTypeMeta(type: PolicyLog["type"]) {
  if (type === "warning") {
    return {
      icon: AlertCircle,
      className: "border-amber-300/45 bg-white/70 text-amber-700",
      iconClassName: "text-amber-500",
    }
  }
  if (type === "success") {
    return {
      icon: CheckCircle,
      className: "border-emerald-300/45 bg-white/72 text-emerald-700",
      iconClassName: "text-emerald-500",
    }
  }
  return {
    icon: Zap,
    className: "border-cyan-300/45 bg-white/72 text-cyan-700",
    iconClassName: "text-cyan-500",
  }
}

// ─── Strategy Dialog ──────────────────────────────────────────────────────────

function StrategyDialog({
  open,
  title,
  form,
  submitting,
  submitError,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean
  title: string
  form: StrategyFormState
  submitting: boolean
  submitError: string | null
  onClose: () => void
  onChange: (patch: Partial<StrategyFormState>) => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden border border-emerald-300/20 bg-[linear-gradient(180deg,rgba(11,24,28,0.96),rgba(6,14,18,0.98))] text-white shadow-[0_32px_80px_rgba(0,0,0,0.52),0_0_48px_rgba(16,185,129,0.14)] backdrop-blur-3xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_32%)]" />
        <DialogHeader className="relative">
          <DialogTitle className="text-xl font-semibold tracking-[0.03em] text-white">{title}</DialogTitle>
        </DialogHeader>
        <div className="relative space-y-4 py-2">
          {submitError ? (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {submitError}
            </div>
          ) : null}
          <div>
            <label className="text-sm text-white/55">策略名称</label>
            <Input
              className="mt-1 border-white/10 bg-white/5 text-white placeholder:text-white/28"
              placeholder="例如：光照不足自动补光"
              value={form.strategyName}
              onChange={(e) => onChange({ strategyName: e.target.value })}
            />
          </div>
          <Separator />
          <p className="text-sm font-medium text-white/85">触发条件</p>
          <div className="grid grid-cols-3 gap-2">
            <Select value={form.metricType} onValueChange={(v) => onChange({ metricType: v as StrategyFormState["metricType"] })}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LIGHT">光照强度</SelectItem>
                <SelectItem value="TEMPERATURE">温度</SelectItem>
                <SelectItem value="HUMIDITY">湿度</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.operatorType} onValueChange={(v) => onChange({ operatorType: v as StrategyFormState["operatorType"] })}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LT">小于</SelectItem>
                <SelectItem value="GT">大于</SelectItem>
                <SelectItem value="EQ">等于</SelectItem>
              </SelectContent>
            </Select>
            <Input className="border-white/10 bg-white/5 text-white placeholder:text-white/28" placeholder="阈值" value={form.thresholdMin} onChange={(e) => onChange({ thresholdMin: e.target.value })} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-300" />
                <span className="text-sm font-medium text-white/82">限制时间范围</span>
              </div>
              <Switch checked={form.timeLimitEnabled} onCheckedChange={(checked) => onChange({ timeLimitEnabled: checked })} />
            </div>
            {form.timeLimitEnabled ? (
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div>
                  <label className="mb-1.5 block text-xs text-white/45">开始时间</label>
                  <Input type="time" className="border-white/10 bg-white/5 font-mono text-white" value={form.startTime} onChange={(e) => onChange({ startTime: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-white/45">结束时间</label>
                  <Input type="time" className="border-white/10 bg-white/5 font-mono text-white" value={form.endTime} onChange={(e) => onChange({ endTime: e.target.value })} />
                </div>
              </div>
            ) : null}
          </div>
          <Separator />
          <p className="text-sm font-medium text-white/85">执行动作</p>
          <Select value={getStrategyFormActionSelectValue(form)} onValueChange={(v) => onChange(resolveStrategyActionValue(v))}>
            <SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {strategyActionOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="relative gap-3 border-t border-white/10 pt-5">
          <Button variant="outline" className="rounded-full border-white/12 bg-white/5 text-white/78 hover:border-white/20 hover:bg-white/10 hover:text-white" onClick={onClose} disabled={submitting}>取消</Button>
          <Button className="rounded-full border border-emerald-300/20 bg-emerald-400/12 text-emerald-50 shadow-[0_0_22px_rgba(16,185,129,0.18)] hover:bg-emerald-400/20" onClick={onSubmit} disabled={submitting}>{submitting ? "提交中..." : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Plant Modal ─────────────────────────────────────────────────────────

function StrategyDetailDialog({
  strategy,
  devicesStatus,
  onClose,
  onEdit,
  onDelete,
}: {
  strategy: StrategyItem | null
  devicesStatus: DevicesStatus | null
  onClose: () => void
  onEdit: (strategy: StrategyItem) => void
  onDelete: (strategy: StrategyItem) => void
}) {
  const open = strategy !== null
  const config = strategy ? resolveStrategyConfig(strategy) : null
  const typeMeta = strategy ? getStrategyTypeMeta(strategy) : null
  const TypeIcon = typeMeta?.icon

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      {strategy ? (
        <DialogContent className="max-w-3xl overflow-hidden border border-white/50 bg-[linear-gradient(180deg,rgba(244,255,242,0.94),rgba(215,243,224,0.92))] p-0 text-emerald-950 shadow-[0_24px_80px_rgba(79,132,102,0.16)] backdrop-blur-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(233,255,189,0.55),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(183,236,207,0.42),transparent_36%)]" />
          <div className="relative">
            <DialogHeader className="space-y-5 border-b border-emerald-900/10 px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/45 bg-white/55 text-emerald-600 shadow-[0_0_20px_rgba(163,230,53,0.18)]">
                    {TypeIcon ? <TypeIcon className="h-5 w-5" /> : null}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-semibold tracking-[0.02em] text-emerald-950">
                      {strategy.strategyName}
                    </DialogTitle>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-900/60">
                      {getStrategySummary(strategy)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className={`rounded-full border px-3 py-1 text-xs font-medium ${getStrategyStatusClass(strategy.enabled)}`}>
                    {strategy.enabled ? "已启用" : "已停用"}
                  </Badge>
                  <Badge className="rounded-full border border-emerald-300/45 bg-white/58 px-3 py-1 text-xs font-medium text-emerald-700">
                    {typeMeta?.label}
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
              {[
                { label: "触发条件", value: formatStrategyCondition(strategy) },
                { label: "执行动作", value: formatStrategyAction(strategy, { light: devicesStatus?.light, fan: devicesStatus?.fan }) },
                {
                  label: "时间范围",
                  value: config?.timeLimitEnabled && config.startTime && config.endTime ? `${config.startTime} - ${config.endTime}` : "不限时段",
                },
                { label: "关联设备", value: strategy.targetDeviceId ? `设备 #${strategy.targetDeviceId}` : "系统自动分配" },
                { label: "优先级", value: strategy.priority != null ? String(strategy.priority) : "—" },
                { label: "策略类型", value: strategy.strategyType || "CONDITION" },
                { label: "创建时间", value: formatDateTime(strategy.createdAt) },
                { label: "更新时间", value: formatDateTime(strategy.updatedAt) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.5rem] border border-white/55 bg-white/48 px-4 py-4 shadow-[0_14px_32px_rgba(90,141,110,0.1)] backdrop-blur-xl"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-900/38">{item.label}</p>
                  <p className="mt-3 text-sm leading-6 text-emerald-950/88">{item.value}</p>
                </div>
              ))}
            </div>

            <DialogFooter className="border-t border-emerald-900/10 bg-white/28 px-6 py-5 sm:justify-between">
              <div className="text-xs text-white/40">完整信息集中展示，列表只保留摘要，减少视觉噪音</div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="rounded-full border-emerald-300/40 bg-white/60 px-5 text-emerald-800 hover:border-emerald-400/55 hover:bg-white/85 hover:text-emerald-950"
                  onClick={() => onEdit(strategy)}
                >
                  编辑策略
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-emerald-300/40 bg-white/60 px-5 text-emerald-800 hover:border-emerald-400/55 hover:bg-white/85 hover:text-emerald-950"
                  onClick={onClose}
                >
                  关闭
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-rose-300/45 bg-white/60 px-5 text-rose-500 hover:border-rose-400/55 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => onDelete(strategy)}
                >
                  删除策略
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

type EditPlantFormState = {
  tempRange: [number, number]
  humidityRange: [number, number]
  lightRange: [number, number]
  tempRiseSensitive: number
  humidityDropSensitive: number
  lightRiseSensitive: number
}

const initialEditPlantForm: EditPlantFormState = {
  tempRange: [18, 28],
  humidityRange: [40, 70],
  lightRange: [2000, 20000],
  tempRiseSensitive: 0.6,
  humidityDropSensitive: 0.4,
  lightRiseSensitive: 0.4,
}

function EditPlantModal({
  open,
  plantId,
  plantName,
  onClose,
  onSuccess,
}: {
  open: boolean
  plantId: string
  plantName: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState<EditPlantFormState>(initialEditPlantForm)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (p: Partial<EditPlantFormState>) => setForm((f) => ({ ...f, ...p }))

  useEffect(() => {
    if (!open || !plantId) return
    if (!plantId || plantId === "" || plantId === "undefined") {
      setError("无法获取植物 ID，请刷新页面后重试")
      return
    }
    setLoading(true)
    setError(null)
    const token = typeof window !== "undefined" ? window.localStorage.getItem("plantcloud_token") : null
    const headers: HeadersInit = { accept: "application/json" }
    if (token) headers.Authorization = `Bearer ${token}`
    fetch(`/api/plant-config/templates/${plantId}`, { headers })
      .then((res) => res.json())
      .then((json) => {
        const d = json?.data ?? json
        if (!d) return
        setForm({
          tempRange: [d.tempMin ?? 18, d.tempMax ?? 28],
          humidityRange: [d.humidityMin ?? 40, d.humidityMax ?? 70],
          lightRange: [d.lightMin ?? 2000, d.lightMax ?? 20000],
          tempRiseSensitive: d.tempRiseSensitive ?? 0.6,
          humidityDropSensitive: d.humidityDropSensitive ?? 0.4,
          lightRiseSensitive: d.lightRiseSensitive ?? 0.4,
        })
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载配置失败"))
      .finally(() => setLoading(false))
  }, [open, plantId])

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const token = typeof window !== "undefined" ? window.localStorage.getItem("plantcloud_token") : null
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(`/api/plant-config/templates/${plantId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          plantName,
          tempMin: form.tempRange[0],
          tempMax: form.tempRange[1],
          humidityMin: form.humidityRange[0],
          humidityMax: form.humidityRange[1],
          lightMin: form.lightRange[0],
          lightMax: form.lightRange[1],
          tempRiseSensitive: form.tempRiseSensitive,
          humidityDropSensitive: form.humidityDropSensitive,
          lightRiseSensitive: form.lightRiseSensitive,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = json?.message ?? json?.msg ?? `更新失败（${res.status}）`
        throw new Error(msg)
      }
      toast({ title: "更新成功 🌿", description: `${plantName} 的配置已保存。` })
      handleClose()
      onSuccess()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "更新失败，请重试"
      setError(msg)
      toast({ title: "更新失败", description: msg, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            编辑植物配置
          </DialogTitle>
          <p className="text-sm font-semibold text-primary pt-1">{plantName}</p>
        </DialogHeader>

        {error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">正在加载配置...</div>
        ) : (
          <div className="space-y-5 py-2">
            <div>
              <p className="mb-3 text-sm font-medium">环境阈值设置</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">温度范围</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {form.tempRange[0]}°C – {form.tempRange[1]}°C
                    </span>
                  </div>
                  <Slider value={form.tempRange} min={0} max={50} step={1} onValueChange={(v) => patch({ tempRange: v as [number, number] })} />
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">湿度范围</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {form.humidityRange[0]}% – {form.humidityRange[1]}%
                    </span>
                  </div>
                  <Slider value={form.humidityRange} min={0} max={100} step={1} onValueChange={(v) => patch({ humidityRange: v as [number, number] })} />
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium">光照范围</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {form.lightRange[0].toLocaleString()} – {form.lightRange[1].toLocaleString()} lux
                    </span>
                  </div>
                  <Slider value={form.lightRange} min={0} max={50000} step={100} onValueChange={(v) => patch({ lightRange: v as [number, number] })} />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="mb-3 text-sm font-medium">敏感度</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">温度敏感度</label>
                  <Input type="number" min={0} max={1} step={0.1} value={form.tempRiseSensitive} onChange={(e) => patch({ tempRiseSensitive: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">湿度敏感度</label>
                  <Input type="number" min={0} max={1} step={0.1} value={form.humidityDropSensitive} onChange={(e) => patch({ humidityDropSensitive: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">光照敏感度</label>
                  <Input type="number" min={0} max={1} step={0.1} value={form.lightRiseSensitive} onChange={(e) => patch({ lightRiseSensitive: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting || loading}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting || loading}>
            {submitting ? "提交中..." : "提交"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Plant Step Modal ─────────────────────────────────────────────────────

type AddPlantStep = 1 | 2 | 3

type AddPlantFormState = {
  plantName: string
  deviceId: string
  tempRange: [number, number]
  humidityRange: [number, number]
  lightRange: [number, number]
  tempRiseSensitive: number
  humidityDropSensitive: number
  lightRiseSensitive: number
  careLevel: string
  summary: string
  aiPlantName: string
}

const initialAddPlantForm: AddPlantFormState = {
  plantName: "",
  deviceId: "",
  tempRange: [18, 28],
  humidityRange: [40, 70],
  lightRange: [2000, 20000],
  tempRiseSensitive: 0.6,
  humidityDropSensitive: 0.4,
  lightRiseSensitive: 0.4,
  careLevel: "中等",
  summary: "",
  aiPlantName: "",
}

function AddPlantModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState<AddPlantStep>(1)
  const [form, setForm] = useState<AddPlantFormState>(initialAddPlantForm)
  const [aiLoading, setAiLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (p: Partial<AddPlantFormState>) => setForm((f) => ({ ...f, ...p }))

  const handleClose = () => {
    setStep(1)
    setForm(initialAddPlantForm)
    setError(null)
    onClose()
  }

  const handleStep1Next = async () => {
    if (!form.plantName.trim()) {
      setError("请输入植物名称")
      return
    }
    if (!form.deviceId) {
      setError("请选择绑定设备")
      return
    }
    setError(null)
    setAiLoading(true)
    try {
      const res = await fetch("/api/plant-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantName: form.plantName.trim() }),
      })
      const json = await res.json()
      const data: AiPlantConfig = json.data
      patch({
        tempRange: [data.tempMin, data.tempMax],
        humidityRange: [data.humidityMin, data.humidityMax],
        lightRange: [data.lightMin, data.lightMax],
        tempRiseSensitive: data.tempRiseSensitive,
        humidityDropSensitive: data.humidityDropSensitive,
        lightRiseSensitive: data.lightRiseSensitive,
        careLevel: data.careLevel,
        summary: data.summary,
        aiPlantName: data.plantName,
      })
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 生成失败，请重试")
    } finally {
      setAiLoading(false)
    }
  }

  const handleStep2Next = () => {
    setError(null)
    setStep(3)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const token = typeof window !== "undefined" ? window.localStorage.getItem("plantcloud_token") : null
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (token) headers.Authorization = `Bearer ${token}`

      const payload = {
        plantName: form.plantName.trim(),
        templateData: {
          plantName: form.plantName.trim(),
          species: " ",
          tempMin: form.tempRange[0],
          tempMax: form.tempRange[1],
          humidityMin: form.humidityRange[0],
          humidityMax: form.humidityRange[1],
          lightMin: form.lightRange[0],
          lightMax: form.lightRange[1],
          tempRiseSensitive: form.tempRiseSensitive,
          humidityDropSensitive: form.humidityDropSensitive,
          lightRiseSensitive: form.lightRiseSensitive,
          careLevel: form.careLevel,
          summary: form.summary,
        },
      }

      const res = await fetch("/api/plants", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })

      // 尝试解析响应体，无论成功失败
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        // 提取后端错误信息，优先取 message 字段，其次取 code
        const backendMsg = json?.message ?? json?.msg ?? json?.error ?? null
        const backendCode = json?.code ?? res.status
        const errorText = backendMsg
          ? `${backendMsg}（错误码：${backendCode}）`
          : `绑定失败，错误码：${backendCode}`
        throw new Error(errorText)
      }

      // 成功：toast 提示 + 关闭弹窗 + 刷新列表
      toast({ title: "绑定成功 🌱", description: `${form.plantName} 已成功绑定到设备 #${form.deviceId}。` })
      handleClose()
      onSuccess()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "绑定失败，请重试"
      // 同时在弹窗内显示错误 + 弹出 toast
      setError(msg)
      toast({ title: "绑定失败", description: msg, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const careLevelColor =
    form.careLevel === "easy" ? "bg-green-100 text-green-700" :
    form.careLevel === "medium" ? "bg-yellow-100 text-yellow-700" :
    "bg-red-100 text-red-700"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-primary" />
            新增植物
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-2 pt-1">
            {([1, 2, 3] as const).map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    step === s ? "bg-primary text-primary-foreground" :
                    step > s ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? "✓" : s}
                </div>
                {s < 3 && <div className={`h-px w-8 ${step > s ? "bg-green-500" : "bg-muted"}`} />}
              </div>
            ))}
            <span className="ml-2 text-xs text-muted-foreground">
              {step === 1 ? "基础信息" : step === 2 ? "阈值确认" : "确认绑定"}
            </span>
          </div>
        </DialogHeader>

        {error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-sm font-medium">植物名称</label>
              <Input
                placeholder="例如：薄荷、绿萝、多肉..."
                value={form.plantName}
                onChange={(e) => patch({ plantName: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">绑定设备</label>
              <Select value={form.deviceId} onValueChange={(v) => patch({ deviceId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="选择设备" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_DEVICES.map((d) => (
                    <SelectItem
                      key={d.id}
                      value={d.id}
                      disabled={d.bound}
                      className={d.bound ? "text-muted-foreground" : ""}
                    >
                      <span title={d.bound ? "已绑定植物" : "未绑定植物"}>
                        设备 {d.label}
                        {d.bound ? " （已绑定）" : " （可用）"}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="space-y-5 py-2">
            {/* Env thresholds */}
            <div>
              <p className="mb-3 text-sm font-medium">环境阈值设置</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">温度范围</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {form.tempRange[0]}°C – {form.tempRange[1]}°C
                    </span>
                  </div>
                  <Slider
                    value={form.tempRange}
                    min={0}
                    max={50}
                    step={1}
                    onValueChange={(v) => patch({ tempRange: v as [number, number] })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">湿度范围</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {form.humidityRange[0]}% – {form.humidityRange[1]}%
                    </span>
                  </div>
                  <Slider
                    value={form.humidityRange}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(v) => patch({ humidityRange: v as [number, number] })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium">光照范围</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {form.lightRange[0].toLocaleString()} – {form.lightRange[1].toLocaleString()} lux
                    </span>
                  </div>
                  <Slider
                    value={form.lightRange}
                    min={0}
                    max={50000}
                    step={100}
                    onValueChange={(v) => patch({ lightRange: v as [number, number] })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Sensitivity */}
            <div>
              <p className="mb-3 text-sm font-medium">敏感度</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">温度敏感度</label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={form.tempRiseSensitive}
                    onChange={(e) => patch({ tempRiseSensitive: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">湿度敏感度</label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={form.humidityDropSensitive}
                    onChange={(e) => patch({ humidityDropSensitive: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">光照敏感度</label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={form.lightRiseSensitive}
                    onChange={(e) => patch({ lightRiseSensitive: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Care level + summary */}
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold shadow-sm ${careLevelColor}`}
                >
                  {form.careLevel}
                </div>
                <span className="text-xs text-muted-foreground">养护难度</span>
              </div>
              <p className="flex-1 pt-1 text-sm italic text-muted-foreground leading-relaxed">
                {form.summary || "暂无总结"}
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">请确认以下绑定信息：</p>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">植物名称</span>
                <span className="font-medium">{form.plantName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">绑定设备</span>
                <span className="font-medium">设备 #{form.deviceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">温度范围</span>
                <span className="font-medium">{form.tempRange[0]}°C – {form.tempRange[1]}°C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">湿度范围</span>
                <span className="font-medium">{form.humidityRange[0]}% – {form.humidityRange[1]}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">光照范围</span>
                <span className="font-medium">{form.lightRange[0].toLocaleString()} – {form.lightRange[1].toLocaleString()} lux</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">养护难度</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${careLevelColor}`}>{form.careLevel}</span>
              </div>
            </div>
            <p className="text-xs italic text-muted-foreground">{form.summary}</p>
          </div>
        )}

        <DialogFooter>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as AddPlantStep)} disabled={submitting || aiLoading}>
              上一步
            </Button>
          )}
          <Button variant="outline" onClick={handleClose} disabled={submitting || aiLoading}>
            取消
          </Button>
          {step === 1 && (
            <Button onClick={handleStep1Next} disabled={aiLoading}>
              {aiLoading ? "等待ai提供参考值中..." : "下一步"}
            </Button>
          )}
          {step === 2 && (
            <Button onClick={handleStep2Next}>下一步</Button>
          )}
          {step === 3 && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "绑定中..." : "绑定新植物"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function SettingsPageContent() {
  const { currentPlant, selectedPlantId } = usePlantSelection()
  // 后端用的数字 plantId
  const currentPlantApiId = currentPlant.plantId

  const [strategies, setStrategies] = useState<StrategyItem[]>([])
  const [devicesStatus, setDevicesStatus] = useState<DevicesStatus | null>(null)
  const [strategiesLoading, setStrategiesLoading] = useState(true)
  const [strategiesError, setStrategiesError] = useState<string | null>(null)
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false)
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyItem | null>(null)
  const [editingStrategy, setEditingStrategy] = useState<StrategyItem | null>(null)
  const [strategyForm, setStrategyForm] = useState<StrategyFormState>(initialFormState)
  const [strategySubmitError, setStrategySubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 策略日志
  const [logs, setLogs] = useState<PolicyLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)

  // Plant binding state
  const [plants, setPlants] = useState<PlantItem[]>([])
  const [plantsLoading, setPlantsLoading] = useState(true)
  const [addPlantOpen, setAddPlantOpen] = useState(false)
  const [removedPlantIds, setRemovedPlantIds] = useState<Set<string>>(new Set())
  const [editingPlant, setEditingPlant] = useState<PlantItem | null>(null)

  const visiblePlants = plants.filter((p) => !removedPlantIds.has(p.id))
  const enabledStrategiesCount = strategies.filter((strategy) => strategy.enabled).length
  const latestLogTime = logs[0]?.time ?? "--:--"
  const syncedDevicesLabel = devicesLoading ? "同步中" : "已同步"

  function getCompactLogMessage(message: string) {
    const matched = message.match(/^\[([^\]]+)\]/)
    const strategyName = matched?.[1]?.trim() || "未命名策略"
    const relatedStrategy = strategies.find((strategy) => strategy.strategyName === strategyName)
    const statusLabel = relatedStrategy?.enabled === false ? "已停用" : "已开启"
    return `策略 ${strategyName} ${statusLabel}`
  }

  const loadPlants = async () => {
    setPlantsLoading(true)
    try {
      const token = typeof window !== "undefined" ? window.localStorage.getItem("plantcloud_token") : null
      const headers: HeadersInit = { accept: "application/json" }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch("/api/plants", { headers, cache: "no-store" })
      const json = await res.json()
      const raw: unknown[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : []
      if (raw.length > 0) console.log("[plants] first item keys:", Object.keys(raw[0] as object), raw[0])
      const mapped: PlantItem[] = raw.map((item: any) => {
        // 穷举后端可能返回的所有 id 字段名
        const resolvedId =
          item.plantId != null ? String(item.plantId) :
          item.plant_id != null ? String(item.plant_id) :
          item.id != null ? String(item.id) : ""
        return {
          id: resolvedId,
          plantName: item.plantName ?? item.plant_name ?? item.name ?? "未知植物",
          deviceId: String(item.deviceId ?? item.device_id ?? item.bindDeviceId ?? "—"),
          status: item.status ?? "ACTIVE",
        }
      })
      setPlants(mapped)
      setRemovedPlantIds(new Set()) // reset on reload
    } catch {
      setPlants([])
    } finally {
      setPlantsLoading(false)
    }
  }

  const loadStrategies = async () => {
    setStrategiesLoading(true)
    setStrategiesError(null)
    try {
      const data = await listStrategies({ plantId: currentPlantApiId })
      setStrategies(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : "策略列表加载失败"
      setStrategies([])
      setStrategiesError(message)
      toast({ title: "策略列表加载失败", description: message, variant: "destructive" })
    } finally {
      setStrategiesLoading(false)
    }
  }

  const loadDevicesStatus = async () => {
    setDevicesLoading(true)
    try {
      const status = await getDevicesStatus(currentPlantApiId)
      setDevicesStatus(status)
    } catch (error) {
      toast({ title: "设备状态加载失败", description: error instanceof Error ? error.message : "请稍后重试", variant: "destructive" })
    } finally {
      setDevicesLoading(false)
    }
  }

  // 加载所有策略的执行日志（汇总展示）
  const loadLogs = async (strategyList: StrategyItem[]) => {
    if (strategyList.length === 0) {
      setLogs([])
      return
    }
    setLogsLoading(true)
    setLogsError(null)
    try {
      // 并发拉取每条策略的最近日志
      const results = await Promise.allSettled(
        strategyList.map((s) =>
          listStrategyExecutionLogs({ strategyId: s.id, pageNum: 1, pageSize: 5 }),
        ),
      )
      const merged: PolicyLog[] = []
      results.forEach((r, idx) => {
        if (r.status !== "fulfilled") return
        const records = r.value?.records ?? []
        records.forEach((log: StrategyExecutionLogItem) => {
          const isSuccess = log.executionResult === "SUCCESS"
          const isFail = log.executionResult === "FAILED" || log.executionResult === "ERROR"
          merged.push({
            id: log.id,
            time: log.executedAt
              ? new Date(log.executedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
              : "--:--",
            message: `[${strategyList[idx]?.strategyName ?? "策略"}] ${log.resultMessage ?? log.executionResult}`,
            type: isSuccess ? "success" : isFail ? "warning" : "info",
          })
        })
      })
      // 按时间倒序
      merged.sort((a, b) => b.time.localeCompare(a.time))
      setLogs(merged)
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : "日志加载失败")
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => { void loadPlants() }, [])
  useEffect(() => {
    void loadStrategies()
    void loadDevicesStatus()
  }, [currentPlantApiId])

  // 策略加载完后再拉日志
  useEffect(() => {
    if (!strategiesLoading) {
      void loadLogs(strategies)
    }
  }, [strategies, strategiesLoading])

  const handleToggleStrategy = async (strategy: StrategyItem, nextEnabled: boolean) => {
    setTogglingId(strategy.id)
    setStrategies((cur) => cur.map((item) => (item.id === strategy.id ? { ...item, enabled: nextEnabled } : item)))
    try {
      const detail = await getStrategyDetail(strategy.id)
      const payload = buildUpdatePayload(detail, nextEnabled)
      await updateStrategy(strategy.id, payload)
      await loadStrategies()
    } catch (error) {
      setStrategies((cur) => cur.map((item) => (item.id === strategy.id ? { ...item, enabled: strategy.enabled } : item)))
      toast({ title: "更新策略失败", description: error instanceof Error ? error.message : "请稍后重试", variant: "destructive" })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDeleteStrategy = async (strategy: StrategyItem) => {
    if (!window.confirm(`确认删除策略「${strategy.strategyName}」吗？`)) return
    setDeletingId(strategy.id)
    try {
      await deleteStrategy(strategy.id)
      setStrategies((cur) => cur.filter((item) => item.id !== strategy.id))
      setSelectedStrategy((current) => (current?.id === strategy.id ? null : current))
      toast({ title: "策略已删除" })
    } catch (error) {
      toast({ title: "删除策略失败", description: error instanceof Error ? error.message : "请稍后重试", variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  const openCreateStrategyDialog = () => {
    setEditingStrategy(null)
    setStrategySubmitError(null)
    setStrategyForm(initialFormState)
    setStrategyDialogOpen(true)
  }

  const openEditStrategyDialog = (strategy: StrategyItem) => {
    setSelectedStrategy(null)
    setEditingStrategy(strategy)
    setStrategySubmitError(null)
    setStrategyForm(buildStrategyFormFromItem(strategy))
    setStrategyDialogOpen(true)
  }

  const handleSaveStrategy = async () => {
    const currentUserId = getCurrentUserId()
    setStrategySubmitError(null)
    const fallbackTargetDeviceId =
      editingStrategy?.actionType === strategyForm.actionType ? editingStrategy.targetDeviceId : null
    const validationMessage = validateStrategyForm(
      strategyForm,
      devicesStatus,
      currentUserId,
      !editingStrategy,
      fallbackTargetDeviceId,
    )
    if (validationMessage) {
      setStrategySubmitError(validationMessage)
      toast({ title: "表单校验失败", description: validationMessage, variant: "destructive" })
      return
    }
    const payload = editingStrategy
      ? buildEditPayload(editingStrategy, strategyForm, devicesStatus)
      : buildCreatePayload(strategyForm, currentPlantApiId, currentUserId, devicesStatus)
    setSubmitting(true)
    try {
      if (editingStrategy) {
        await updateStrategy(editingStrategy.id, payload)
      } else {
        await createStrategy(payload)
      }
      setStrategySubmitError(null)
      setStrategyDialogOpen(false)
      setEditingStrategy(null)
      setStrategyForm(initialFormState)
      await loadStrategies()
      toast({ title: "策略保存成功", description: "策略已保存并刷新列表。" })
    } catch (error) {
      const feedback = buildFriendlyStrategySaveFeedback(error)
      setStrategySubmitError(feedback.description)
      toast({ title: feedback.title, description: feedback.description, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthGuard>
      {/* 单屏展示：背景铺满视口，内容保持紧凑的上下分组 */}
      <div className="min-h-screen overflow-hidden bg-[#dff6de] text-emerald-950">
        <style jsx>{`
          /* 模块内部滚动：保留滚动能力，但隐藏内部滚动条，避免整页滚动视觉 */
          .settings-scroll {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }

          .settings-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(233,255,188,0.95),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(113,188,148,0.35),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(223,255,210,0.9),transparent_22%),linear-gradient(135deg,#dff6de_0%,#a6d7c8_44%,#79b7af_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_72%,rgba(250,255,229,0.45),transparent_12%),radial-gradient(circle_at_68%_58%,rgba(238,255,205,0.25),transparent_14%)]" />
        <main className="relative mx-auto flex min-h-screen w-full max-w-[1580px] flex-col px-6 py-10 xl:px-10">
          {/* 单屏展示：页面本身固定为一屏，主内容和底部通栏共同占满可视高度 */}
          <div className="mx-auto mb-7 w-full max-w-[1380px] rounded-[2.2rem] border border-white/45 bg-white/22 px-7 py-7 shadow-[0_30px_80px_rgba(109,170,145,0.22),inset_0_1px_0_rgba(255,255,255,0.52)] backdrop-blur-3xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/45 bg-white/45 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-emerald-700">
                  <Cpu className="h-3.5 w-3.5" />
                  Plant Cloud Control Matrix
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-[0.02em] text-white sm:text-4xl">植物智能控制面板</h1>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "当前植物", value: `${currentPlant.emoji} ${currentPlant.name}` },
                  { label: "绑定植物", value: String(visiblePlants.length) },
                  { label: "启用策略", value: String(enabledStrategiesCount) },
                  { label: "最新日志", value: latestLogTime },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1.45rem] border border-white/55 bg-white/28 px-5 py-4 text-left shadow-[0_16px_45px_rgba(113,174,151,0.18)] backdrop-blur-2xl transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.02] hover:border-emerald-300/65 hover:bg-white/42 hover:shadow-[0_24px_52px_rgba(113,174,151,0.24),0_0_30px_rgba(187,247,208,0.34)]"
                  >
                    <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-800/55">{item.label}</p>
                    <p className="mt-3 truncate text-xl font-semibold text-emerald-950">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* 三列栅格分布式布局：多个内容块共同分布在 3 个纵向栅格中，而不是三大面板并排 */}
          <div className="mx-auto grid w-full max-w-[1380px] grid-cols-1 gap-6 xl:grid-cols-3">
            {/* 避免“三大面板并排”：这里是分散卡片，不是一列只放一个大模块 */}
            <section className="flex h-[560px] min-h-0 flex-col gap-1.5 pt-0.5">
              <div className="px-1">
                <div className="flex items-center gap-2">
                  <Leaf className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold">植物绑定管理</h2>
                </div>

              </div>
              <Card className="rounded-[2rem] border border-white/45 bg-white/24 shadow-[0_20px_48px_rgba(109,170,145,0.16)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_58px_rgba(109,170,145,0.22)]">
                <CardContent className="space-y-3 p-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[1.25rem] border border-border/60 bg-emerald-50/75 p-3">
                      <p className="text-xs text-muted-foreground">绑定植物数</p>
                      <p className="mt-1.5 text-xl font-semibold">{visiblePlants.length}</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-border/60 bg-emerald-50/75 p-3">
                      <p className="text-xs text-muted-foreground">当前植物</p>
                      <p className="mt-1.5 truncate text-[0.95rem] font-semibold">
                        {currentPlant.emoji} {currentPlant.name}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-11 rounded-[1.15rem]" onClick={() => void loadPlants()}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${plantsLoading ? "animate-spin" : ""}`} />
                      刷新
                    </Button>
                    <Button variant="outline" className="h-11 rounded-[1.15rem]" onClick={() => setAddPlantOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      新增植物
                    </Button>
                  </div>
                </CardContent>
              </Card>
              {/* 模块内部滚动：植物列表卡片固定高度，超出内容仅在卡片内部滚动 */}
              <Card className="min-h-0 flex-1 rounded-[2rem] border border-white/45 bg-white/24 shadow-[0_20px_48px_rgba(109,170,145,0.16)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_58px_rgba(109,170,145,0.22)]">
                <CardContent className="flex h-full min-h-0 flex-col p-3.5">
                  {plantsLoading ? (
                    <div className="rounded-[1.4rem] border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                      正在加载植物列表...
                    </div>
                  ) : visiblePlants.length === 0 ? (
                    <div className="rounded-[1.4rem] border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                      暂无绑定植物，点击下方按钮添加第一株植物。
                    </div>
                  ) : (
                    <div className="settings-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {visiblePlants.map((plant) => (
                        <div key={plant.id} className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-border/60 bg-emerald-50/75 p-3.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{plant.plantName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">绑定设备 ID：{plant.deviceId}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge
                              className={
                                plant.status === "ACTIVE"
                                  ? "bg-green-100 text-green-700"
                                  : plant.status === "INACTIVE"
                                    ? "bg-gray-100 text-gray-500"
                                    : plant.status === "DELETED"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-500"
                              }
                            >
                              {plant.status === "ACTIVE"
                                ? "在线"
                                : plant.status === "INACTIVE"
                                  ? "离线"
                                  : plant.status === "DELETED"
                                    ? "已删除"
                                    : "未知"}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => plant.id && setEditingPlant(plant)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setRemovedPlantIds((prev) => new Set([...prev, plant.id]))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="flex h-[560px] min-h-0 flex-col gap-1.5 pt-0.5">
              <div className="px-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold">自动化策略管理</h2>
                </div>
                
              </div>
              <Card className="rounded-[1.9rem] border-border/60 bg-white/78 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                <CardContent className="space-y-3 p-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[1.25rem] border border-border/60 bg-sky-50/75 p-3">
                      <p className="text-xs text-muted-foreground">已启用</p>
                      <p className="mt-1.5 text-xl font-semibold">{enabledStrategiesCount}</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-border/60 bg-sky-50/75 p-3">
                      <p className="text-xs text-muted-foreground">总策略数</p>
                      <p className="mt-1.5 text-xl font-semibold">{strategies.length}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" size="sm" className="h-11 rounded-[1.15rem]" onClick={() => void loadStrategies()} disabled={strategiesLoading}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${strategiesLoading ? "animate-spin" : ""}`} />
                      刷新
                    </Button>
                    <Button variant="outline" size="sm" className="h-11 rounded-[1.15rem]" onClick={openCreateStrategyDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      新建
                    </Button>
                  </div>
                </CardContent>
              </Card>
              {/* 模块内部滚动：策略列表卡片固定高度，内部滚动而不是整页滚动 */}
              <Card className="min-h-0 flex-1 rounded-[1.9rem] border-border/60 bg-white/78 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                <CardContent className="flex h-full min-h-0 flex-col p-3.5">
                  {strategiesLoading ? (
                    <div className="rounded-[1.4rem] border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
                      正在加载策略列表...
                    </div>
                  ) : null}
                  {!strategiesLoading && strategiesError ? (
                    <div className="rounded-[1.4rem] border border-destructive/20 bg-destructive/5 px-4 py-6 text-sm text-destructive">
                      {strategiesError}
                    </div>
                  ) : null}
                  {!strategiesLoading && !strategiesError && strategies.length === 0 ? (
                    <div className="rounded-[1.4rem] border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
                      当前植物还没有策略，点击上方按钮创建第一条自动化策略。
                    </div>
                  ) : null}
                  {!strategiesLoading && !strategiesError ? (
                    <div className="settings-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {strategies.map((strategy) => (
                        <div
                          key={strategy.id}
                          className={`rounded-[1.25rem] border p-3.5 transition-colors ${strategy.enabled ? "border-border/60 bg-sky-50/75" : "border-border/60 bg-slate-50/72 opacity-80"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex items-center gap-2">
                                <p className="truncate text-sm font-medium">{strategy.strategyName}</p>
                                <Badge variant="outline" className="text-xs">
                                  {strategy.enabled ? "已启用" : "已停用"}
                                </Badge>
                              </div>
                              <p className="text-xs leading-6 text-muted-foreground">
                                <span className="font-medium text-blue-600">如果</span>{" "}
                                {formatStrategyCondition(strategy)}
                              </p>
                              <p className="text-xs leading-6 text-muted-foreground">
                                <span className="font-medium text-green-600">则</span>{" "}
                                {formatStrategyAction(strategy, { light: devicesStatus?.light, fan: devicesStatus?.fan })}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Switch
                                checked={strategy.enabled}
                                disabled={togglingId === strategy.id}
                                onCheckedChange={(checked) => void handleToggleStrategy(strategy, checked)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditStrategyDialog(strategy)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={deletingId === strategy.id}
                                onClick={() => void handleDeleteStrategy(strategy)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {devicesLoading ? (
                    <p className="mt-3 text-xs text-muted-foreground">正在同步设备状态，用于补全策略动作中的设备信息...</p>
                  ) : null}
                </CardContent>
              </Card>
            </section>

            <section className="flex h-[560px] min-h-0 flex-col gap-1.5 pt-0.5">
              <div className="px-1">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold">策略日志</h2>
                </div>
                
              </div>
              <Card className="rounded-[1.9rem] border-border/60 bg-white/78 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                <CardContent className="space-y-3 p-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[1.2rem] border border-border/60 bg-amber-50/82 p-3">
                      <p className="text-xs text-muted-foreground">日志条数</p>
                      <p className="mt-1.5 text-xl font-semibold">{logs.length}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-border/60 bg-amber-50/82 p-3">
                      <p className="text-xs text-muted-foreground">设备状态</p>
                      <p className="mt-1.5 text-[0.95rem] font-semibold">{devicesLoading ? "同步中" : "已同步"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <Button variant="outline" size="sm" className="h-11 w-full rounded-[1.15rem]" onClick={() => void loadLogs(strategies)} disabled={logsLoading}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${logsLoading ? "animate-spin" : ""}`} />
                      刷新
                    </Button>
                  </div>
                </CardContent>
              </Card>
              {/* 模块内部滚动：日志列表卡片固定高度，内部滚动显示更多内容 */}
              <Card className="min-h-0 flex-1 rounded-[1.9rem] border-border/60 bg-white/78 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                <CardContent className="flex h-full min-h-0 flex-col p-3.5">
                  <div className="settings-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                    {logsLoading ? (
                      <div className="rounded-[1.4rem] border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                        正在加载策略执行日志...
                      </div>
                    ) : null}
                    {!logsLoading && logsError ? (
                      <div className="rounded-[1.4rem] border border-destructive/20 bg-destructive/5 px-4 py-6 text-sm text-destructive">
                        {logsError}
                      </div>
                    ) : null}
                    {!logsLoading && !logsError && logs.length === 0 ? (
                      <div className="rounded-[1.4rem] border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                        暂无策略执行日志。保存策略后，当实时温度、湿度或光照满足触发条件时会自动写入。
                      </div>
                    ) : null}
                    {!logsLoading && !logsError ? logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 rounded-[1.25rem] border border-border/60 bg-amber-50/78 p-3">
                        <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-mono text-xs text-muted-foreground">{log.time}</span>
                        </div>
                        <div className="flex flex-1 items-start gap-2">
                          {log.type === "warning" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" /> : null}
                          {log.type === "success" ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" /> : null}
                          {log.type === "info" ? <Zap className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /> : null}
                          <p className={`text-sm leading-6 ${log.type === "warning" ? "text-yellow-700" : log.type === "success" ? "text-green-700" : "text-foreground"}`}>
                            {getCompactLogMessage(log.message)}
                          </p>
                        </div>
                      </div>
                    )) : null}
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>

        </main>

        <StrategyDialog
          open={strategyDialogOpen}
          title={editingStrategy ? "编辑策略" : "新建策略"}
          form={strategyForm}
          submitting={submitting}
          submitError={strategySubmitError}
          onClose={() => {
            setStrategyDialogOpen(false)
            setEditingStrategy(null)
            setStrategySubmitError(null)
            setStrategyForm(initialFormState)
          }}
          onChange={(patch) => {
            setStrategySubmitError(null)
            setStrategyForm((cur) => ({ ...cur, ...patch }))
          }}
          onSubmit={() => void handleSaveStrategy()}
        />

        <StrategyDetailDialog
          strategy={selectedStrategy}
          devicesStatus={devicesStatus}
          onClose={() => setSelectedStrategy(null)}
          onEdit={openEditStrategyDialog}
          onDelete={(strategy) => void handleDeleteStrategy(strategy)}
        />

        <AddPlantModal
          open={addPlantOpen}
          onClose={() => setAddPlantOpen(false)}
          onSuccess={() => void loadPlants()}
        />

        <EditPlantModal
          open={editingPlant !== null}
          plantId={editingPlant?.id ?? ""}
          plantName={editingPlant?.plantName ?? ""}
          onClose={() => setEditingPlant(null)}
          onSuccess={() => void loadPlants()}
        />
      </div>
    </AuthGuard>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageContent />
    </Suspense>
  )
}
