"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { getDevicesStatus, getIntegratedControlDeviceId, type DevicesStatus } from "@/lib/device-api"
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
import { listAlerts, SMOKE_GAS_METRIC_NAME } from "@/lib/alert-api"
import { controlHomeDevice } from "@/lib/home-api"
import { formatStrategyAction, formatStrategyCondition, resolveStrategyConfig } from "@/lib/strategy-format"
import {
  AlertCircle,
  Bell,
  CircleMinus,
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
  X,
  Zap,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type PolicyLog = {
  id: string
  strategyId: string
  stateKey: string
  time: string
  message: string
  variant: "info" | "success" | "warning" | "status-enabled" | "status-disabled"
}

type StrategyFormState = {
  strategyName: string
  metricType: "LIGHT" | "TEMPERATURE" | "HUMIDITY" | "SMOKE"
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
    metricType:
      strategy.metricType === "TEMPERATURE" || strategy.metricType === "HUMIDITY" || strategy.metricType === "SMOKE"
        ? strategy.metricType
        : "LIGHT",
    operatorType: strategy.operatorType === "GT" || strategy.operatorType === "EQ" ? strategy.operatorType : "LT",
    thresholdMin: String(strategy.thresholdMin ?? strategy.thresholdMax ?? ""),
    timeLimitEnabled: Boolean(config.timeLimitEnabled),
    startTime: config.startTime ?? "18:00",
    endTime: config.endTime ?? "22:00",
    ...action,
  }
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
  targetDeviceId: string | null,
): StrategyUpsertPayload {
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
  targetDeviceId: string | null,
): StrategyUpsertPayload {
  return {
    plantId: strategy.plantId,
    createdBy: strategy.createdBy,
    strategyName: form.strategyName.trim(),
    strategyType: "CONDITION",
    targetDeviceId,
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
  userId: string | undefined,
  requireUserId: boolean,
  targetDeviceId?: string | number | null,
) {
  if (requireUserId && !userId) return "当前登录信息缺少 userId，无法满足后端 createdBy 要求，请重新登录后再试"
  if (!form.strategyName.trim()) return "请输入策略名称"
  if (!form.thresholdMin.trim() || Number.isNaN(Number(form.thresholdMin))) return "请输入有效的触发阈值"
  if (form.timeLimitEnabled && (!form.startTime || !form.endTime)) return "请完整填写时间范围"
  if ((form.actionType === "AUTO_LIGHT" || form.actionType === "AUTO_FAN") && targetDeviceId == null) {
    return "当前未获取到 E53IA1 一体化控制设备，暂时无法保存自动控制策略"
  }
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

function getLogVariantMeta(variant: PolicyLog["variant"]) {
  const defaultCardClassName = "border-emerald-100/75 bg-emerald-50/72 hover:border-emerald-200/80 hover:bg-emerald-50/90 hover:shadow-[0_14px_30px_rgba(16,185,129,0.12)]"
  if (variant === "warning") {
    return {
      icon: AlertCircle,
      className: defaultCardClassName,
      iconClassName: "text-amber-500",
      timeClassName: "text-amber-800/60",
      timeTextClassName: "text-amber-900/55",
      textClassName: "text-amber-700/90",
    }
  }
  if (variant === "status-disabled") {
    return {
      icon: CircleMinus,
      className: "border-[#d7ead8]/58 bg-[linear-gradient(135deg,rgba(247,252,245,0.62),rgba(231,245,235,0.44))] shadow-[0_8px_20px_rgba(102,153,113,0.08),inset_0_1px_0_rgba(255,255,255,0.52)] backdrop-blur-[10px] hover:border-[#cce4cd]/72 hover:bg-[linear-gradient(135deg,rgba(248,253,246,0.72),rgba(234,247,238,0.54))] hover:shadow-[0_12px_24px_rgba(102,153,113,0.10),inset_0_1px_0_rgba(255,255,255,0.6)]",
      iconClassName: "text-[#71967a]/88",
      timeClassName: "text-[#7da186]/76",
      timeTextClassName: "text-[#6e9174]/74",
      textClassName: "text-[#5f7d66]/94",
    }
  }
  if (variant === "success" || variant === "status-enabled") {
    return {
      icon: CheckCircle,
      className: defaultCardClassName,
      iconClassName: "text-emerald-500",
      timeClassName: "text-emerald-800/60",
      timeTextClassName: "text-emerald-900/55",
      textClassName: "text-emerald-800/90",
    }
  }
  return {
    icon: Zap,
    className: defaultCardClassName,
    iconClassName: "text-cyan-500",
    timeClassName: "text-cyan-800/60",
    timeTextClassName: "text-cyan-900/55",
    textClassName: "text-emerald-950/80",
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
  const fieldClass =
    "h-11 rounded-2xl border-emerald-300/75 bg-white/74 text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] placeholder:text-emerald-900/50 focus-visible:border-emerald-500/70 focus-visible:ring-emerald-400/30"
  const selectTriggerClass =
    "h-11 w-full rounded-2xl border-emerald-300/75 bg-white/74 text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] focus-visible:border-emerald-500/70 focus-visible:ring-emerald-400/30"
  const selectContentClass =
    "overflow-hidden rounded-[1.25rem] border border-emerald-200/85 bg-[linear-gradient(180deg,rgba(248,255,246,0.98),rgba(226,247,234,0.96))] text-emerald-950 shadow-[0_22px_54px_rgba(73,128,98,0.2),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-2xl"
  const selectItemClass =
    "rounded-xl px-3 py-2.5 text-emerald-950/82 transition-colors focus:bg-emerald-100/78 focus:text-emerald-950 data-[state=checked]:bg-emerald-100 data-[state=checked]:text-emerald-900 data-[disabled]:text-emerald-900/36 data-[disabled]:opacity-60"
  const groupClass =
    "rounded-[1.45rem] border border-emerald-200/90 bg-white/58 p-4 shadow-[0_16px_36px_rgba(16,185,129,0.11)] backdrop-blur-xl"
  const labelClass = "mb-1.5 block text-xs font-semibold text-emerald-900/74"

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden rounded-[2rem] border border-white/65 bg-[linear-gradient(180deg,rgba(248,255,246,0.99),rgba(218,245,228,0.97))] p-0 text-emerald-950 shadow-[0_30px_90px_rgba(73,128,98,0.28),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-3xl"
        style={{ display: "flex" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,253,245,0.9),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(187,247,208,0.48),transparent_32%)]" />
        <DialogHeader className="relative shrink-0 border-b border-emerald-900/16 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/75 bg-white/68 text-emerald-800 shadow-[0_14px_28px_rgba(16,185,129,0.16)]">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-[0.02em] text-emerald-950">{title}</DialogTitle>
                <p className="mt-1.5 text-sm leading-6 text-emerald-900/70">配置触发条件、时间范围与自动执行动作。</p>
              </div>
            </div>
            <DialogClose className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300/75 bg-white/68 text-emerald-800 shadow-[0_12px_24px_rgba(16,185,129,0.16)] transition-all hover:-translate-y-0.5 hover:bg-white/86 hover:text-emerald-950 active:translate-y-0 active:scale-95" aria-label="关闭弹窗">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {submitError ? (
            <div className="rounded-2xl border border-rose-200/70 bg-rose-50/78 px-3 py-2 text-sm text-rose-600">
              {submitError}
            </div>
          ) : null}
          <div className={groupClass}>
            <p className="mb-3 text-sm font-semibold text-emerald-950">基础信息</p>
            <label className={labelClass}>策略名称</label>
            <Input
              className={fieldClass}
              placeholder="例如：光照不足自动补光"
              value={form.strategyName}
              onChange={(e) => onChange({ strategyName: e.target.value })}
            />
          </div>
          <div className={groupClass}>
            <p className="mb-3 text-sm font-semibold text-emerald-950">触发条件</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClass}>指标</label>
                <Select value={form.metricType} onValueChange={(v) => onChange({ metricType: v as StrategyFormState["metricType"] })}>
                  <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem className={selectItemClass} value="LIGHT">光照强度</SelectItem>
                    <SelectItem className={selectItemClass} value="TEMPERATURE">温度</SelectItem>
                    <SelectItem className={selectItemClass} value="HUMIDITY">湿度</SelectItem>
                    <SelectItem className={selectItemClass} value="SMOKE">烟雾浓度</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={labelClass}>判断条件</label>
                <Select value={form.operatorType} onValueChange={(v) => onChange({ operatorType: v as StrategyFormState["operatorType"] })}>
                  <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem className={selectItemClass} value="LT">小于</SelectItem>
                    <SelectItem className={selectItemClass} value="GT">大于</SelectItem>
                    <SelectItem className={selectItemClass} value="EQ">等于</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={labelClass}>阈值</label>
                <Input className={fieldClass} placeholder="阈值" value={form.thresholdMin} onChange={(e) => onChange({ thresholdMin: e.target.value })} />
              </div>
            </div>
          </div>
          <div className={groupClass}>
            <p className="mb-3 text-sm font-semibold text-emerald-950">附加条件</p>
            <div className="flex items-center justify-between rounded-2xl border border-emerald-200/85 bg-white/62 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-950/82">限制时间范围</span>
              </div>
              <Switch checked={form.timeLimitEnabled} onCheckedChange={(checked) => onChange({ timeLimitEnabled: checked })} />
            </div>
            {form.timeLimitEnabled ? (
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl border border-emerald-200/85 bg-white/62 p-4">
                <div>
                  <label className={labelClass}>开始时间</label>
                  <Input type="time" className={`${fieldClass} font-mono`} value={form.startTime} onChange={(e) => onChange({ startTime: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>结束时间</label>
                  <Input type="time" className={`${fieldClass} font-mono`} value={form.endTime} onChange={(e) => onChange({ endTime: e.target.value })} />
                </div>
              </div>
            ) : null}
          </div>
          <div className={groupClass}>
            <p className="mb-3 text-sm font-semibold text-emerald-950">执行动作</p>
            <Select value={getStrategyFormActionSelectValue(form)} onValueChange={(v) => onChange(resolveStrategyActionValue(v))}>
              <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
              <SelectContent className={selectContentClass}>
                {strategyActionOptions.map((option) => (
                  <SelectItem className={selectItemClass} key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="relative shrink-0 border-t border-emerald-900/16 bg-white/46 px-6 py-5">
          <Button variant="outline" className="h-10 rounded-full border-emerald-300/75 bg-white/74 px-5 text-emerald-900 shadow-[0_8px_18px_rgba(16,185,129,0.08)] hover:border-emerald-400/70 hover:bg-white/92 hover:text-emerald-950" onClick={onClose} disabled={submitting}>取消</Button>
          <Button className="h-10 rounded-full border border-emerald-400/55 bg-emerald-600 px-6 text-white shadow-[0_14px_30px_rgba(16,185,129,0.26)] hover:bg-emerald-700" onClick={onSubmit} disabled={submitting}>{submitting ? "提交中..." : "保存"}</Button>
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
  const fieldClass =
    "h-11 rounded-2xl border-emerald-300/75 bg-white/74 text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] placeholder:text-emerald-900/50 focus-visible:border-emerald-500/70 focus-visible:ring-emerald-400/30"
  const sectionClass =
    "rounded-[1.45rem] border border-emerald-200/90 bg-white/58 p-4 shadow-[0_16px_36px_rgba(16,185,129,0.11)] backdrop-blur-xl"
  const labelClass = "mb-1.5 block text-xs font-semibold text-emerald-900/74"
  const metricCardClass = "rounded-[1.2rem] border border-emerald-200/85 bg-white/62 p-4"
  const sliderClass =
    "[&_[data-slot=slider-range]]:bg-emerald-500/80 [&_[data-slot=slider-thumb]]:border-emerald-500 [&_[data-slot=slider-thumb]]:shadow-[0_4px_12px_rgba(16,185,129,0.22)] [&_[data-slot=slider-thumb]]:hover:ring-emerald-200/70 [&_[data-slot=slider-thumb]]:focus-visible:ring-emerald-200/70 [&_[data-slot=slider-track]]:bg-emerald-100/90"
  const secondaryButtonClass =
    "h-10 rounded-full border-emerald-300/75 bg-white/74 px-5 text-emerald-900 shadow-[0_8px_18px_rgba(16,185,129,0.08)] hover:border-emerald-400/70 hover:bg-white/92 hover:text-emerald-950"
  const primaryButtonClass =
    "h-10 rounded-full border border-emerald-400/55 bg-emerald-600 px-6 text-white shadow-[0_14px_30px_rgba(16,185,129,0.26)] hover:bg-emerald-700"

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
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden rounded-[2rem] border border-white/65 bg-[linear-gradient(180deg,rgba(248,255,246,0.99),rgba(218,245,228,0.97))] p-0 text-emerald-950 shadow-[0_30px_90px_rgba(73,128,98,0.28),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-3xl"
        style={{ display: "flex" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,253,245,0.9),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(187,247,208,0.48),transparent_32%)]" />
        <DialogHeader className="relative shrink-0 border-b border-emerald-900/16 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/75 bg-white/68 text-emerald-800 shadow-[0_14px_28px_rgba(16,185,129,0.16)]">
                <Pencil className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-[0.02em] text-emerald-950">编辑植物配置</DialogTitle>
                <p className="mt-1.5 text-sm leading-6 text-emerald-900/70">调整 {plantName} 的环境阈值与敏感度参数。</p>
              </div>
            </div>
            <DialogClose className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300/75 bg-white/68 text-emerald-800 shadow-[0_12px_24px_rgba(16,185,129,0.16)] transition-all hover:-translate-y-0.5 hover:bg-white/86 hover:text-emerald-950 active:translate-y-0 active:scale-95" aria-label="关闭弹窗">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="rounded-2xl border border-rose-200/70 bg-rose-50/78 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-[1.45rem] border border-emerald-200/90 bg-white/58 px-4 py-12 text-center text-sm text-emerald-900/70 shadow-[0_16px_36px_rgba(16,185,129,0.11)]">
              正在加载配置...
            </div>
          ) : (
            <div className="space-y-4">
              <div className={sectionClass}>
                <p className="mb-3 text-sm font-semibold text-emerald-950">基础信息</p>
                <div className="rounded-[1.2rem] border border-emerald-200/85 bg-white/62 p-4">
                  <p className="text-xs font-semibold text-emerald-900/66">植物名称</p>
                  <p className="mt-2 text-sm font-medium text-emerald-950">{plantName}</p>
                </div>
              </div>

              <div className={sectionClass}>
                <p className="mb-3 text-sm font-semibold text-emerald-950">环境阈值设置</p>
                <div className="space-y-3">
                  <div className={`${metricCardClass} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium text-emerald-950/82">温度范围</span>
                    </div>
                      <span className="text-sm text-emerald-900/70">
                      {form.tempRange[0]}°C – {form.tempRange[1]}°C
                    </span>
                  </div>
                    <Slider className={sliderClass} value={form.tempRange} min={0} max={50} step={1} onValueChange={(v) => patch({ tempRange: v as [number, number] })} />
                </div>
                  <div className={`${metricCardClass} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-emerald-950/82">湿度范围</span>
                    </div>
                      <span className="text-sm text-emerald-900/70">
                      {form.humidityRange[0]}% – {form.humidityRange[1]}%
                    </span>
                  </div>
                    <Slider className={sliderClass} value={form.humidityRange} min={0} max={100} step={1} onValueChange={(v) => patch({ humidityRange: v as [number, number] })} />
                </div>
                  <div className={`${metricCardClass} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium text-emerald-950/82">光照范围</span>
                    </div>
                      <span className="text-sm text-emerald-900/70">
                      {form.lightRange[0].toLocaleString()} – {form.lightRange[1].toLocaleString()} lux
                    </span>
                  </div>
                    <Slider className={sliderClass} value={form.lightRange} min={0} max={50000} step={100} onValueChange={(v) => patch({ lightRange: v as [number, number] })} />
                  </div>
                </div>
              </div>

              <div className={sectionClass}>
                <p className="mb-3 text-sm font-semibold text-emerald-950">敏感度参数</p>
                <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className={labelClass}>温度敏感度</label>
                    <Input className={fieldClass} type="number" min={0} max={1} step={0.1} value={form.tempRiseSensitive} onChange={(e) => patch({ tempRiseSensitive: Number(e.target.value) })} />
                </div>
                <div>
                    <label className={labelClass}>湿度敏感度</label>
                    <Input className={fieldClass} type="number" min={0} max={1} step={0.1} value={form.humidityDropSensitive} onChange={(e) => patch({ humidityDropSensitive: Number(e.target.value) })} />
                </div>
                <div>
                    <label className={labelClass}>光照敏感度</label>
                    <Input className={fieldClass} type="number" min={0} max={1} step={0.1} value={form.lightRiseSensitive} onChange={(e) => patch({ lightRiseSensitive: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="relative shrink-0 border-t border-emerald-900/16 bg-white/46 px-6 py-5">
          <Button variant="outline" className={secondaryButtonClass} onClick={handleClose} disabled={submitting || loading}>取消</Button>
          <Button className={primaryButtonClass} onClick={handleSubmit} disabled={submitting || loading}>
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
    form.careLevel === "easy" ? "border-emerald-300/75 bg-emerald-50/95 text-emerald-800" :
    form.careLevel === "medium" ? "border-lime-300/75 bg-lime-50/95 text-lime-800" :
    "border-rose-300/75 bg-rose-50/95 text-rose-700"

  const fieldClass =
    "h-11 rounded-2xl border-emerald-300/75 bg-white/74 text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] placeholder:text-emerald-900/50 focus-visible:border-emerald-500/70 focus-visible:ring-emerald-400/30"
  const selectTriggerClass =
    "h-11 w-full rounded-2xl border-emerald-300/75 bg-white/74 text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] focus-visible:border-emerald-500/70 focus-visible:ring-emerald-400/30"
  const selectContentClass =
    "overflow-hidden rounded-[1.25rem] border border-emerald-200/85 bg-[linear-gradient(180deg,rgba(248,255,246,0.98),rgba(226,247,234,0.96))] text-emerald-950 shadow-[0_22px_54px_rgba(73,128,98,0.2),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-2xl"
  const selectItemClass =
    "rounded-xl px-3 py-2.5 text-emerald-950/82 transition-colors focus:bg-emerald-100/78 focus:text-emerald-950 data-[state=checked]:bg-emerald-100 data-[state=checked]:text-emerald-900 data-[disabled]:text-emerald-900/36 data-[disabled]:opacity-60"
  const sectionClass =
    "rounded-[1.45rem] border border-emerald-200/90 bg-white/58 p-4 shadow-[0_16px_36px_rgba(16,185,129,0.11)] backdrop-blur-xl"
  const labelClass = "mb-1.5 block text-xs font-semibold text-emerald-900/74"
  const secondaryButtonClass =
    "h-10 rounded-full border-emerald-300/75 bg-white/74 px-5 text-emerald-900 shadow-[0_8px_18px_rgba(16,185,129,0.08)] hover:border-emerald-400/70 hover:bg-white/92 hover:text-emerald-950"
  const primaryButtonClass =
    "h-10 rounded-full border border-emerald-400/55 bg-emerald-600 px-6 text-white shadow-[0_14px_30px_rgba(16,185,129,0.26)] hover:bg-emerald-700"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden rounded-[2rem] border border-white/65 bg-[linear-gradient(180deg,rgba(248,255,246,0.99),rgba(218,245,228,0.97))] p-0 text-emerald-950 shadow-[0_30px_90px_rgba(73,128,98,0.28),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-3xl"
        style={{ display: "flex" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,253,245,0.9),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(187,247,208,0.48),transparent_32%)]" />
        <DialogHeader className="relative shrink-0 border-b border-emerald-900/16 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/75 bg-white/68 text-emerald-800 shadow-[0_14px_28px_rgba(16,185,129,0.16)]">
                <Leaf className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-[0.02em] text-emerald-950">新增植物</DialogTitle>
                <p className="mt-1.5 text-sm leading-6 text-emerald-900/70">绑定设备并确认 AI 生成的养护参数。</p>
              </div>
            </div>
            <DialogClose className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300/75 bg-white/68 text-emerald-800 shadow-[0_12px_24px_rgba(16,185,129,0.16)] transition-all hover:-translate-y-0.5 hover:bg-white/86 hover:text-emerald-950 active:translate-y-0 active:scale-95" aria-label="关闭弹窗">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
          {/* Step indicator */}
          <div className="mt-5 flex items-center gap-2">
            {([1, 2, 3] as const).map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold shadow-sm transition-all ${
                    step === s ? "border-emerald-400 bg-emerald-600 text-white shadow-[0_10px_20px_rgba(16,185,129,0.24)]" :
                    step > s ? "border-emerald-300/85 bg-emerald-100/95 text-emerald-800" : "border-emerald-200/85 bg-white/62 text-emerald-900/52"
                  }`}
                >
                  {step > s ? "✓" : s}
                </div>
                {s < 3 && <div className={`h-px w-9 ${step > s ? "bg-emerald-500/80" : "bg-emerald-200/80"}`} />}
              </div>
            ))}
            <span className="ml-2 rounded-full border border-emerald-200/85 bg-white/58 px-3 py-1 text-xs font-semibold text-emerald-900/78">
              {step === 1 ? "基础信息" : step === 2 ? "阈值确认" : "确认绑定"}
            </span>
          </div>
        </DialogHeader>
        <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-200/70 bg-rose-50/78 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className={`${sectionClass} space-y-4`}>
            <p className="text-sm font-semibold text-emerald-950">基础信息</p>
            <div>
              <label className={labelClass}>植物名称</label>
              <Input
                className={fieldClass}
                placeholder="例如：薄荷、绿萝、多肉..."
                value={form.plantName}
                onChange={(e) => patch({ plantName: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>绑定设备</label>
              <Select value={form.deviceId} onValueChange={(v) => patch({ deviceId: v })}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="选择设备" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {MOCK_DEVICES.map((d) => (
                    <SelectItem
                      key={d.id}
                      value={d.id}
                      disabled={d.bound}
                      className={`${selectItemClass} ${d.bound ? "text-emerald-900/36" : ""}`}
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
          <div className="space-y-4">
            {/* Env thresholds */}
            <div className={sectionClass}>
              <p className="mb-3 text-sm font-semibold text-emerald-950">环境阈值设置</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-emerald-950/82">温度范围</span>
                    </div>
                    <span className="text-sm text-emerald-900/70">
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
                <Separator className="bg-emerald-100/80" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-emerald-950/82">湿度范围</span>
                    </div>
                    <span className="text-sm text-emerald-900/70">
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
                <Separator className="bg-emerald-100/80" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-emerald-950/82">光照范围</span>
                    </div>
                    <span className="text-sm text-emerald-900/70">
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

            {/* Sensitivity */}
            <div className={sectionClass}>
              <p className="mb-3 text-sm font-semibold text-emerald-950">敏感度</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>温度敏感度</label>
                  <Input
                    className={fieldClass}
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={form.tempRiseSensitive}
                    onChange={(e) => patch({ tempRiseSensitive: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className={labelClass}>湿度敏感度</label>
                  <Input
                    className={fieldClass}
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={form.humidityDropSensitive}
                    onChange={(e) => patch({ humidityDropSensitive: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className={labelClass}>光照敏感度</label>
                  <Input
                    className={fieldClass}
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

            {/* Care level + summary */}
            <div className={`${sectionClass} flex items-start gap-4`}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-sm font-semibold shadow-sm ${careLevelColor}`}
                >
                  {form.careLevel}
                </div>
                <span className="text-xs text-emerald-900/66">养护难度</span>
              </div>
              <p className="flex-1 pt-1 text-sm italic leading-relaxed text-emerald-950/70">
                {form.summary || "暂无总结"}
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div className={`${sectionClass} space-y-4`}>
            <p className="text-sm font-semibold text-emerald-950">确认绑定信息</p>
            <div className="space-y-2 rounded-[1.2rem] border border-emerald-200/85 bg-white/62 p-4 text-sm text-emerald-950/86">
              <div className="flex justify-between">
                <span className="text-emerald-900/66">植物名称</span>
                <span className="font-medium">{form.plantName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-900/66">绑定设备</span>
                <span className="font-medium">设备 #{form.deviceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-900/66">温度范围</span>
                <span className="font-medium">{form.tempRange[0]}°C – {form.tempRange[1]}°C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-900/66">湿度范围</span>
                <span className="font-medium">{form.humidityRange[0]}% – {form.humidityRange[1]}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-900/66">光照范围</span>
                <span className="font-medium">{form.lightRange[0].toLocaleString()} – {form.lightRange[1].toLocaleString()} lux</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-900/66">养护难度</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${careLevelColor}`}>{form.careLevel}</span>
              </div>
            </div>
            <p className="text-xs italic leading-5 text-emerald-950/66">{form.summary}</p>
          </div>
        )}
        </div>

        <DialogFooter className="relative shrink-0 border-t border-emerald-900/16 bg-white/46 px-6 py-5">
          {step > 1 && (
            <Button variant="outline" className={secondaryButtonClass} onClick={() => setStep((s) => (s - 1) as AddPlantStep)} disabled={submitting || aiLoading}>
              上一步
            </Button>
          )}
          <Button variant="outline" className={secondaryButtonClass} onClick={handleClose} disabled={submitting || aiLoading}>
            取消
          </Button>
          {step === 1 && (
            <Button className={primaryButtonClass} onClick={handleStep1Next} disabled={aiLoading}>
              {aiLoading ? "等待ai提供参考值中..." : "下一步"}
            </Button>
          )}
          {step === 2 && (
            <Button className={primaryButtonClass} onClick={handleStep2Next}>下一步</Button>
          )}
          {step === 3 && (
            <Button className={primaryButtonClass} onClick={handleSubmit} disabled={submitting}>
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

  const compareMetric = (operatorType: string, currentValue: number, thresholdValue: number) => {
    switch (operatorType) {
      case "LT":
        return currentValue < thresholdValue
      case "GT":
        return currentValue > thresholdValue
      case "EQ":
        return currentValue === thresholdValue
      default:
        return false
    }
  }

  const triggerStrategyAction = async (strategy: StrategyItem) => {
    console.info("[SMOKE_STRATEGY] action:start", {
      strategyId: strategy.id,
      actionType: strategy.actionType,
      actionValue: strategy.actionValue,
      targetDeviceId: strategy.targetDeviceId ?? null,
      plantId: currentPlantApiId,
    })
    if (strategy.actionType !== "AUTO_LIGHT" && strategy.actionType !== "AUTO_FAN") {
      console.info("[SMOKE_STRATEGY] action:skip-device-control", {
        strategyId: strategy.id,
        actionType: strategy.actionType,
      })
      toast({ title: "烟雾策略命中", description: "已命中阈值，当前动作为通知类，无需设备控制。" })
      return
    }
    const token = typeof window !== "undefined" ? window.localStorage.getItem("plantcloud_token") : null
    if (!token) {
      console.warn("[SMOKE_STRATEGY] action:missing-token", { strategyId: strategy.id })
      throw new Error("登录态已失效，请重新登录后再执行策略")
    }
    const resolvedDeviceId = strategy.targetDeviceId ?? (await getIntegratedControlDeviceId(currentPlantApiId))
    if (!resolvedDeviceId) {
      console.warn("[SMOKE_STRATEGY] action:missing-device", {
        strategyId: strategy.id,
        targetDeviceId: strategy.targetDeviceId ?? null,
      })
      throw new Error("未找到可执行控制的目标设备")
    }
    const target = strategy.actionType === "AUTO_LIGHT" ? "light" : "fan"
    const turnOn = (strategy.actionValue ?? "ON").toUpperCase() !== "OFF"
    console.info("[SMOKE_STRATEGY] action:control-request", {
      strategyId: strategy.id,
      target,
      turnOn,
      resolvedDeviceId,
      plantId: currentPlantApiId,
    })
    await controlHomeDevice(currentPlantApiId, resolvedDeviceId, target, turnOn, token)
    console.info("[SMOKE_STRATEGY] action:control-success", {
      strategyId: strategy.id,
      target,
      turnOn,
      resolvedDeviceId,
    })
    toast({
      title: "烟雾策略已触发",
      description: strategy.actionType === "AUTO_LIGHT" ? "已执行补光灯控制动作。" : "已执行风扇控制动作。",
    })
  }

  const evaluateSmokeStrategy = async (strategy: StrategyItem) => {
    if (!strategy.enabled || strategy.metricType !== "SMOKE") {
      console.info("[SMOKE_STRATEGY] evaluate:skip", {
        strategyId: strategy.id,
        enabled: strategy.enabled,
        metricType: strategy.metricType,
      })
      return
    }
    try {
      const { requestUrl: alertsUrl, alerts } = await listAlerts({ status: "UNRESOLVED" })
      console.info("[SMOKE_STRATEGY] evaluate:fetch-alerts", {
        strategyId: strategy.id,
        url: alertsUrl,
        plantId: currentPlantApiId,
      })
      const plantAlerts = alerts.filter(
        (a) => a.plantId != null && Number(a.plantId) === Number(currentPlantApiId),
      )
      console.info("[SMOKE_STRATEGY] evaluate:alerts-loaded", {
        strategyId: strategy.id,
        total: plantAlerts.length,
        sample: plantAlerts.slice(0, 5).map((a) => ({
          id: a.id,
          alertType: a.alertType,
          metricName: a.metricName,
          metricValue: a.metricValue,
          createdAt: a.createdAt,
        })),
      })
      let detectedSmokeMetric: number | null = null
      let matchedAlertId: number | string | null = null
      for (const alert of plantAlerts) {
        if (alert.metricName !== SMOKE_GAS_METRIC_NAME) continue
        const value = Number(alert.metricValue)
        if (Number.isNaN(value)) continue
        detectedSmokeMetric = value
        matchedAlertId = alert.id
        break
      }
      if (detectedSmokeMetric == null) {
        console.info("[SMOKE_STRATEGY] evaluate:no-smoke-gas-ppm", {
          strategyId: strategy.id,
          metricName: SMOKE_GAS_METRIC_NAME,
        })
        return
      }
      const thresholdRaw = strategy.operatorType === "LT" ? strategy.thresholdMax ?? strategy.thresholdMin : strategy.thresholdMin ?? strategy.thresholdMax
      const thresholdValue = Number(thresholdRaw)
      if (Number.isNaN(thresholdValue)) {
        console.warn("[SMOKE_STRATEGY] evaluate:invalid-threshold", {
          strategyId: strategy.id,
          operatorType: strategy.operatorType,
          thresholdMin: strategy.thresholdMin,
          thresholdMax: strategy.thresholdMax,
          resolvedThreshold: thresholdRaw,
        })
        toast({ title: "烟雾策略未执行", description: "策略阈值无效，请编辑后重试。", variant: "destructive" })
        return
      }
      const matched = compareMetric(strategy.operatorType, detectedSmokeMetric, thresholdValue)
      console.info("[SMOKE_STRATEGY] evaluate:compare-result", {
        strategyId: strategy.id,
        matchedAlertId,
        metricValue: detectedSmokeMetric,
        operatorType: strategy.operatorType,
        thresholdValue,
        matched,
      })
      if (!matched) return
      await triggerStrategyAction(strategy)
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error)
      console.error("[SMOKE_STRATEGY] evaluate:error", {
        strategyId: strategy.id,
        message,
        rawError: error,
      })
      toast({
        title: "烟雾策略执行失败",
        description: message && message !== "{}" ? message : "获取日志或执行动作失败",
        variant: "destructive",
      })
    }
  }

  function buildPolicyLogSummary(log: StrategyExecutionLogItem, strategyName: string): Pick<PolicyLog, "message" | "variant" | "stateKey"> {
    const rawMessage = log.resultMessage?.trim() || log.executionResult
    if (log.triggerSource === "STRATEGY_UPDATE") {
      if (rawMessage.includes("已停用")) {
        return { message: rawMessage, variant: "status-disabled", stateKey: "status-disabled" }
      }
      if (rawMessage.includes("已启用")) {
        return { message: rawMessage, variant: "status-enabled", stateKey: "status-enabled" }
      }
      const message = rawMessage || `策略 ${strategyName} 已更新`
      return { message, variant: "info", stateKey: `info:${message}` }
    }
    if (log.executionResult === "FAILED" || log.executionResult === "ERROR") {
      return { message: `策略 ${strategyName} 执行失败`, variant: "warning", stateKey: "warning" }
    }
    if (log.executionResult === "SUCCESS" || log.executionResult === "TRIGGERED") {
      return { message: `策略 ${strategyName} 执行成功`, variant: "success", stateKey: "success" }
    }
    const message = rawMessage || `策略 ${strategyName} 已记录`
    return { message, variant: "info", stateKey: `info:${message}` }
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
          const strategyName = strategyList[idx]?.strategyName ?? "策略"
          const summary = buildPolicyLogSummary(log, strategyName)
          merged.push({
            id: log.id,
            strategyId: log.strategyId,
            stateKey: summary.stateKey,
            time: log.executedAt
              ? new Date(log.executedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
              : "--:--",
            message: summary.message,
            variant: summary.variant,
          })
        })
      })
      // 按时间倒序
      merged.sort((a, b) => b.time.localeCompare(a.time))
      const deduped = merged.reduce<PolicyLog[]>((acc, current) => {
        const previous = acc[acc.length - 1]
        if (previous && previous.strategyId === current.strategyId && previous.stateKey === current.stateKey) {
          return acc
        }
        acc.push(current)
        return acc
      }, [])
      setLogs(deduped)
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
    const requestAt = new Date().toISOString()
    const requestUrl = `/api/strategies/${strategy.id}`
    console.info("[settings][strategy-toggle] request:start", {
      strategyId: strategy.id,
      enabled: nextEnabled,
      url: requestUrl,
      requestAt,
    })
    setTogglingId(strategy.id)
    setStrategies((cur) => cur.map((item) => (item.id === strategy.id ? { ...item, enabled: nextEnabled } : item)))
    try {
      const detail = await getStrategyDetail(strategy.id)
      const payload = buildUpdatePayload(detail, nextEnabled)
      await updateStrategy(strategy.id, payload)
      if (nextEnabled) {
        console.info("[SMOKE_STRATEGY] evaluate:on-toggle-enabled", {
          strategyId: strategy.id,
          metricType: payload.metricType ?? detail.metricType,
          operatorType: payload.operatorType ?? detail.operatorType,
        })
        await evaluateSmokeStrategy({
          ...detail,
          ...payload,
          id: strategy.id,
          enabled: true,
        } as StrategyItem)
      }
      console.info("[settings][strategy-toggle] request:success", {
        strategyId: strategy.id,
        enabled: nextEnabled,
        url: requestUrl,
        requestAt,
        responseAt: new Date().toISOString(),
      })
      await loadStrategies()
    } catch (error) {
      console.error("[settings][strategy-toggle] request:error", {
        strategyId: strategy.id,
        enabled: nextEnabled,
        url: requestUrl,
        requestAt,
        responseAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : error,
      })
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
    const targetDeviceId = await getIntegratedControlDeviceId(currentPlantApiId)
    const validationMessage = validateStrategyForm(
      strategyForm,
      currentUserId,
      !editingStrategy,
      targetDeviceId,
    )
    if (validationMessage) {
      setStrategySubmitError(validationMessage)
      toast({ title: "表单校验失败", description: validationMessage, variant: "destructive" })
      return
    }
    const payload = editingStrategy
      ? buildEditPayload(editingStrategy, strategyForm, targetDeviceId)
      : buildCreatePayload(strategyForm, currentPlantApiId, currentUserId, targetDeviceId)
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
      <div
        className="min-h-screen overflow-hidden text-emerald-950"
        style={{
          background:
            "radial-gradient(circle at top, rgba(208,232,222,0.55), transparent 38%), linear-gradient(135deg, #d0e8de 0%, #eaf6f0 100%)",
        }}
      >
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
                  <h1 className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-700 bg-clip-text text-3xl font-semibold tracking-[0.02em] text-transparent drop-shadow-[0_2px_12px_rgba(236,253,245,0.58)] sm:text-4xl">植物智能控制面板</h1>
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
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold">植物绑定管理</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full border border-emerald-200/70 bg-white/45 text-emerald-700 shadow-[0_10px_24px_rgba(16,185,129,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50/90 hover:text-emerald-800 hover:shadow-[0_14px_28px_rgba(16,185,129,0.2)] active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void loadPlants()}
                    disabled={plantsLoading}
                    aria-label="刷新植物绑定列表"
                    title="刷新植物绑定列表"
                  >
                    <RefreshCw className={`h-4 w-4 ${plantsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>

              </div>
              {/* 模块内部滚动：植物列表卡片固定高度，超出内容仅在卡片内部滚动 */}
              <Card className="min-h-0 flex-1 rounded-[2rem] border border-white/45 bg-white/24 shadow-[0_20px_48px_rgba(109,170,145,0.16)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_58px_rgba(109,170,145,0.22)]">
                <CardContent className="flex h-full min-h-0 flex-col p-3.5">
                  <div className="flex min-h-0 flex-1 flex-col">
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
                        {visiblePlants.map((plant, index) => (
                          <div key={plant.id} className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-border/60 bg-emerald-50/75 p-3.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{plant.plantName}</p>
                              <p className="mt-1 text-xs text-muted-foreground">绑定设备 ID：{index + 1}</p>
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
                  </div>
                  <div className="flex justify-center pt-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-14 rounded-full border border-emerald-200/80 bg-gradient-to-r from-white/72 via-emerald-50/88 to-lime-50/82 text-emerald-700 shadow-[0_12px_26px_rgba(16,185,129,0.16),inset_0_1px_0_rgba(255,255,255,0.85)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:from-white/86 hover:via-emerald-100/90 hover:to-lime-100/86 hover:text-emerald-900 hover:shadow-[0_16px_34px_rgba(16,185,129,0.22),inset_0_1px_0_rgba(255,255,255,0.95)] active:translate-y-0 active:scale-[0.97]"
                      onClick={() => setAddPlantOpen(true)}
                      aria-label="新增植物"
                      title="新增植物"
                    >
                      <Plus className="h-4.5 w-4.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="flex h-[560px] min-h-0 flex-col gap-1.5 pt-0.5">
              <div className="px-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold">自动化策略管理</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full border border-emerald-200/70 bg-white/45 text-emerald-700 shadow-[0_10px_24px_rgba(16,185,129,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50/90 hover:text-emerald-800 hover:shadow-[0_14px_28px_rgba(16,185,129,0.2)] active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void loadStrategies()}
                    disabled={strategiesLoading}
                    aria-label="刷新自动化策略"
                    title="刷新自动化策略"
                  >
                    <RefreshCw className={`h-4 w-4 ${strategiesLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                
              </div>
              {/* 模块内部滚动：策略列表卡片固定高度，内部滚动而不是整页滚动 */}
              <Card className="min-h-0 flex-1 rounded-[2rem] border border-white/45 bg-white/24 shadow-[0_20px_48px_rgba(109,170,145,0.16)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_58px_rgba(109,170,145,0.22)]">
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
                      当前植物还没有策略，点击下方按钮创建第一条自动化策略。
                    </div>
                  ) : null}
                  {!strategiesLoading && !strategiesError ? (
                    <div className="settings-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {strategies.map((strategy) => (
                        <div
                          key={strategy.id}
                          className={`rounded-[1.25rem] border p-3.5 shadow-[0_10px_24px_rgba(16,185,129,0.08)] transition-all duration-200 hover:border-emerald-200/80 hover:bg-emerald-50/90 hover:shadow-[0_14px_30px_rgba(16,185,129,0.12)] ${strategy.enabled ? "border-emerald-100/75 bg-emerald-50/72" : "border-emerald-100/60 bg-white/52 opacity-85"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-emerald-950/90">{strategy.strategyName}</p>
                                <Badge variant="outline" className="border-emerald-200/70 bg-white/45 text-xs text-emerald-700">
                                  {strategy.enabled ? "已启用" : "已停用"}
                                </Badge>
                              </div>
                              <p className="text-xs leading-6 text-emerald-950/65">
                                <span className="font-medium text-teal-700">如果</span>{" "}
                                {formatStrategyCondition(strategy)}
                              </p>
                              <p className="text-xs leading-6 text-emerald-950/65">
                                <span className="font-medium text-emerald-700">则</span>{" "}
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
                  <div className="mt-auto flex justify-center pt-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-14 rounded-full border border-emerald-200/80 bg-gradient-to-r from-white/72 via-emerald-50/88 to-lime-50/82 text-emerald-700 shadow-[0_12px_26px_rgba(16,185,129,0.16),inset_0_1px_0_rgba(255,255,255,0.85)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:from-white/86 hover:via-emerald-100/90 hover:to-lime-100/86 hover:text-emerald-900 hover:shadow-[0_16px_34px_rgba(16,185,129,0.22),inset_0_1px_0_rgba(255,255,255,0.95)] active:translate-y-0 active:scale-[0.97]"
                      onClick={openCreateStrategyDialog}
                      aria-label="新建自动化策略"
                      title="新建自动化策略"
                    >
                      <Plus className="h-4.5 w-4.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="flex h-[560px] min-h-0 flex-col gap-1.5 pt-0.5">
              <div className="px-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ScrollText className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold">策略日志</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full border border-emerald-200/70 bg-white/45 text-emerald-700 shadow-[0_10px_24px_rgba(16,185,129,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50/90 hover:text-emerald-800 hover:shadow-[0_14px_28px_rgba(16,185,129,0.2)] active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void loadLogs(strategies)}
                    disabled={logsLoading}
                    aria-label="刷新策略日志"
                    title="刷新策略日志"
                  >
                    <RefreshCw className={`h-4 w-4 ${logsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                
              </div>
              {/* 模块内部滚动：日志列表卡片固定高度，内部滚动显示更多内容 */}
              <Card className="min-h-0 flex-1 rounded-[2rem] border border-white/45 bg-white/24 shadow-[0_20px_48px_rgba(109,170,145,0.16)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_58px_rgba(109,170,145,0.22)]">
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
                    {!logsLoading && !logsError ? logs.map((log) => {
                      const meta = getLogVariantMeta(log.variant)
                      const StatusIcon = meta.icon
                      return (
                        <div
                          key={log.id}
                          className={`flex items-start gap-3 rounded-[1.25rem] border p-3.5 shadow-[0_10px_24px_rgba(16,185,129,0.08)] transition-all duration-200 ${meta.className}`}
                        >
                          <div className={`mt-0.5 flex shrink-0 items-center gap-1.5 ${meta.timeClassName}`}>
                            <Clock className="h-3.5 w-3.5" />
                            <span className={`font-mono text-xs ${meta.timeTextClassName}`}>{log.time}</span>
                          </div>
                          <div className="flex flex-1 items-start gap-2">
                            <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.iconClassName}`} />
                            <p className={`text-sm leading-6 ${meta.textClassName}`}>
                              {log.message}
                            </p>
                          </div>
                        </div>
                      )
                    }) : null}
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
