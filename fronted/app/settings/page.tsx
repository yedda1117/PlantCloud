"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { ApiError } from "@/lib/api-client"
import { getDevicesStatus, type DevicesStatus } from "@/lib/device-api"
import { DEFAULT_PLANT_ID, getPlantApiId, getPlantOption, plantOptions, SELECTED_PLANT_STORAGE_KEY } from "@/lib/plants"
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
  CheckCircle,
  Clock,
  Droplets,
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
  Zap,
} from "lucide-react"

type DeviceCard = {
  id: string
  name: string
  topic: string
  online: boolean
  latency: number | null
}

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
  actionType: "AUTO_LIGHT" | "AUTO_FAN" | "NOTIFY_USER"
}

type StrategySaveFeedback = {
  title: string
  description: string
}

type EnvironmentMetricKey = "temperature" | "humidity" | "light"

type EnvironmentRangeState = Record<EnvironmentMetricKey, [number, number]>

const defaultEnvironmentRanges: EnvironmentRangeState = {
  temperature: [18, 30],
  humidity: [40, 80],
  light: [300, 30000],
}

const environmentRangeStrategies: Record<
  EnvironmentMetricKey,
  { metricType: "TEMPERATURE" | "HUMIDITY" | "LIGHT"; strategyName: string; label: string }
> = {
  temperature: {
    metricType: "TEMPERATURE",
    strategyName: "环境阈值-温度范围",
    label: "温度",
  },
  humidity: {
    metricType: "HUMIDITY",
    strategyName: "环境阈值-湿度范围",
    label: "湿度",
  },
  light: {
    metricType: "LIGHT",
    strategyName: "环境阈值-光照范围",
    label: "光照",
  },
}

const initialDevices: DeviceCard[] = [
  { id: "d1", name: "光照传感器 #1", topic: "plant/p1/sensor", online: true, latency: 23 },
  { id: "d2", name: "风扇控制器 #1", topic: "plant/p1/fan", online: false, latency: null },
]

const initialFormState: StrategyFormState = {
  strategyName: "",
  metricType: "LIGHT",
  operatorType: "LT",
  thresholdMin: "",
  timeLimitEnabled: false,
  startTime: "18:00",
  endTime: "22:00",
  actionType: "AUTO_LIGHT",
}

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
  if (!token) {
    return undefined
  }

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
  if (typeof window === "undefined") {
    return { rawUser: null, parsedUser: null }
  }

  const rawUser = window.localStorage.getItem("plantcloud_user")
  const tokenUserId = getUserIdFromToken(window.localStorage.getItem("plantcloud_token"))

  if (!rawUser) {
    return {
      rawUser,
      parsedUser: null,
      tokenUserId,
      resolvedUserId: tokenUserId,
    }
  }

  try {
    const parsedUser = JSON.parse(rawUser) as { userId?: string | number; id?: string | number }
    const localUserId =
      parsedUser.userId != null
        ? String(parsedUser.userId)
        : parsedUser.id != null
          ? String(parsedUser.id)
          : undefined

    return {
      rawUser,
      parsedUser,
      tokenUserId,
      resolvedUserId: tokenUserId ?? localUserId,
    }
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

function logStrategyPayload(stage: string, payload: StrategyUpsertPayload, extra?: Record<string, unknown>) {
  console.group(`[strategy][${stage}]`)
  console.log("payload", payload)
  console.log("payload.createdBy", payload.createdBy, typeof payload.createdBy)
  console.log("payload.targetDeviceId", payload.targetDeviceId, typeof payload.targetDeviceId)
  console.log("payload.plantId", payload.plantId, typeof payload.plantId)
  if (extra) {
    Object.entries(extra).forEach(([key, value]) => {
      console.log(key, value)
    })
  }
  console.groupEnd()
}

function buildCreatePayload(
  form: StrategyFormState,
  plantId: number,
  userId: string | undefined,
  devicesStatus: DevicesStatus | null,
): StrategyUpsertPayload {
  const targetDeviceId =
    form.actionType === "AUTO_LIGHT"
      ? (devicesStatus?.light?.deviceId != null ? String(devicesStatus.light.deviceId) : null)
      : form.actionType === "AUTO_FAN"
        ? (devicesStatus?.fan?.deviceId != null ? String(devicesStatus.fan.deviceId) : null)
        : null

  return {
    plantId: String(plantId),
    createdBy: userId,
    strategyName: form.strategyName.trim(),
    strategyType: "CONDITION",
    metricType: form.metricType,
    operatorType: form.operatorType,
    thresholdMin: Number(form.thresholdMin),
    actionType: form.actionType,
    actionValue:
      form.actionType === "AUTO_LIGHT"
        ? "ON"
        : form.actionType === "AUTO_FAN"
          ? "HIGH"
          : "INFO",
    targetDeviceId,
    enabled: true,
    priority: 10,
    timeLimitEnabled: form.timeLimitEnabled,
    startTime: form.timeLimitEnabled ? form.startTime : null,
    endTime: form.timeLimitEnabled ? form.endTime : null,
    configJson: {
      timeLimitEnabled: form.timeLimitEnabled,
      ...(form.timeLimitEnabled
        ? {
            startTime: form.startTime,
            endTime: form.endTime,
          }
        : {}),
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

function findEnvironmentRangeStrategy(strategies: StrategyItem[], key: EnvironmentMetricKey) {
  const setting = environmentRangeStrategies[key]
  return strategies.find(
    (strategy) =>
      strategy.metricType === setting.metricType &&
      strategy.operatorType === "BETWEEN" &&
      strategy.actionType === "NOTIFY_USER" &&
      strategy.strategyName === setting.strategyName,
  )
}

function buildEnvironmentRangePayload(
  key: EnvironmentMetricKey,
  range: [number, number],
  plantId: number,
  userId: string | undefined,
  existing?: StrategyItem,
): StrategyUpsertPayload {
  const setting = environmentRangeStrategies[key]
  return {
    plantId: String(plantId),
    createdBy: existing?.createdBy ?? userId,
    strategyName: setting.strategyName,
    strategyType: "CONDITION",
    metricType: setting.metricType,
    operatorType: "BETWEEN",
    thresholdMin: range[0],
    thresholdMax: range[1],
    actionType: "NOTIFY_USER",
    actionValue: "WARNING",
    targetDeviceId: null,
    cronExpr: null,
    enabled: true,
    priority: existing?.priority ?? 20,
    timeLimitEnabled: false,
    startTime: null,
    endTime: null,
    notifyTitleTemplate: `${setting.label}超出可接受范围`,
    notifyContentTemplate: `${setting.label}当前值已超出设置范围，请及时查看植物状态。`,
    configJson: {
      timeLimitEnabled: false,
      notifyTitleTemplate: `${setting.label}超出可接受范围`,
      notifyContentTemplate: `${setting.label}当前值已超出设置范围，请及时查看植物状态。`,
    },
  }
}

function formatLogTime(executedAt?: string | null) {
  if (!executedAt) {
    return "--:--"
  }
  const date = new Date(executedAt)
  if (Number.isNaN(date.getTime())) {
    return executedAt.slice(11, 16) || "--:--"
  }
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function formatStrategyLogAction(strategy?: StrategyItem) {
  if (!strategy) {
    return "执行了预设动作"
  }

  if (strategy.actionType === "AUTO_LIGHT") {
    return strategy.actionValue === "OFF" ? "关闭补光灯" : "开启补光灯"
  }

  if (strategy.actionType === "AUTO_FAN") {
    return "开启风扇"
  }

  if (strategy.actionType === "NOTIFY_USER") {
    return "发送提醒通知"
  }

  return "执行了预设动作"
}

function toPolicyLog(log: StrategyExecutionLogItem, strategy?: StrategyItem): PolicyLog {
  const result = (log.executionResult || "").toUpperCase()
  const strategyName = strategy?.strategyName ?? `策略 #${log.strategyId}`
  const actionText = formatStrategyLogAction(strategy)
  const success = result === "SUCCESS" || result === "TRIGGERED"
  return {
    id: String(log.id),
    time: formatLogTime(log.executedAt),
    message: success ? `${strategyName} 策略已经执行，${actionText}。` : `${strategyName} 策略执行失败。`,
    type: success ? "success" : "warning",
  }
}

function validateStrategyForm(
  form: StrategyFormState,
  devicesStatus: DevicesStatus | null,
  userId: string | undefined,
) {
  if (!userId) {
    return "当前登录信息缺少 userId，无法满足后端 createdBy 要求，请重新登录后再试"
  }

  if (!form.strategyName.trim()) {
    return "请输入策略名称"
  }

  if (!form.thresholdMin.trim() || Number.isNaN(Number(form.thresholdMin))) {
    return "请输入有效的触发阈值"
  }

  if (form.timeLimitEnabled && (!form.startTime || !form.endTime)) {
    return "请完整填写时间范围"
  }

  if (form.actionType === "AUTO_LIGHT" && !devicesStatus?.light?.deviceId) {
    return "当前未获取到补光灯设备，暂时无法创建补光策略"
  }

  if (form.actionType === "AUTO_FAN" && !devicesStatus?.fan?.deviceId) {
    return "当前未获取到风扇设备，暂时无法创建风扇策略"
  }

  return null
}

function findPotentialNotifyConflict(strategies: StrategyItem[], form: StrategyFormState) {
  if (form.actionType !== "NOTIFY_USER") {
    return null
  }

  return (
    strategies.find(
      (strategy) =>
        strategy.enabled &&
        strategy.strategyType === "CONDITION" &&
        strategy.actionType === "NOTIFY_USER" &&
        strategy.metricType === form.metricType,
    ) ?? null
  )
}

function buildStrategySaveFeedback(
  error: unknown,
  payload: StrategyUpsertPayload,
  potentialConflict?: StrategyItem | null,
): StrategySaveFeedback {
  const message = error instanceof Error ? error.message : "保存策略失败，请稍后重试"

  if (payload.actionType === "NOTIFY_USER") {
    const isConflict =
      (error instanceof ApiError && error.status === 409) ||
      message.includes("冲突") ||
      message.includes("已启用策略")

    if (isConflict) {
      const conflictName = potentialConflict?.strategyName ? `“${potentialConflict.strategyName}”` : "已有启用中的通知策略"
      return {
        title: "通知策略可能冲突",
        description: `当前通知用户策略可能与${conflictName}重复或冲突。后端返回：${message}`,
      }
    }
  }

  return {
    title: "保存策略失败",
    description: message,
  }
}

function buildFriendlyStrategySaveFeedback(
  error: unknown,
  payload: StrategyUpsertPayload,
  potentialConflict?: StrategyItem | null,
): StrategySaveFeedback {
  const message = error instanceof Error ? error.message : "保存策略失败，请稍后重试。"

  if (payload.actionType === "NOTIFY_USER") {
    const isConflict =
      (error instanceof ApiError && error.status === 409) ||
      message.includes("冲突") ||
      message.includes("已启用策略")

    if (isConflict) {
      const conflictName = potentialConflict?.strategyName
        ? `“${potentialConflict.strategyName}”`
        : "现有启用中的同类通知策略"

      return {
        title: "通知用户策略可能冲突",
        description: `当前“通知用户”策略很可能与 ${conflictName} 冲突，后端已拒绝保存。后端返回：${message}`,
      }
    }
  }

  return {
    title: "保存策略失败",
    description: message,
  }
}

function StrategyDialog({
  open,
  form,
  submitting,
  submitError,
  notifyConflictHint,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean
  form: StrategyFormState
  submitting: boolean
  submitError: string | null
  notifyConflictHint: string | null
  onClose: () => void
  onChange: (patch: Partial<StrategyFormState>) => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新建策略</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {notifyConflictHint ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {notifyConflictHint}
            </div>
          ) : null}

          {submitError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {submitError}
            </div>
          ) : null}

          <div>
            <label className="text-sm text-muted-foreground">策略名称</label>
            <Input
              className="mt-1"
              placeholder="例如：光照不足自动补光"
              value={form.strategyName}
              onChange={(event) => onChange({ strategyName: event.target.value })}
            />
          </div>

          <Separator />

          <p className="text-sm font-medium">触发条件</p>
          <div className="grid grid-cols-3 gap-2">
            <Select value={form.metricType} onValueChange={(value) => onChange({ metricType: value as StrategyFormState["metricType"] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LIGHT">光照强度</SelectItem>
                <SelectItem value="TEMPERATURE">温度</SelectItem>
                <SelectItem value="HUMIDITY">湿度</SelectItem>
              </SelectContent>
            </Select>

            <Select value={form.operatorType} onValueChange={(value) => onChange({ operatorType: value as StrategyFormState["operatorType"] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LT">小于</SelectItem>
                <SelectItem value="GT">大于</SelectItem>
                <SelectItem value="EQ">等于</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="阈值"
              value={form.thresholdMin}
              onChange={(event) => onChange({ thresholdMin: event.target.value })}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">限制时间范围</span>
              </div>
              <Switch checked={form.timeLimitEnabled} onCheckedChange={(checked) => onChange({ timeLimitEnabled: checked })} />
            </div>

            {form.timeLimitEnabled ? (
              <div className="grid grid-cols-2 gap-3 rounded-xl border bg-background p-4">
                <div>
                  <label className="mb-1.5 block text-xs text-muted-foreground">开始时间</label>
                  <Input
                    type="time"
                    className="font-mono"
                    value={form.startTime}
                    onChange={(event) => onChange({ startTime: event.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-muted-foreground">结束时间</label>
                  <Input
                    type="time"
                    className="font-mono"
                    value={form.endTime}
                    onChange={(event) => onChange({ endTime: event.target.value })}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <Separator />

          <p className="text-sm font-medium">执行动作</p>
          <Select value={form.actionType} onValueChange={(value) => onChange({ actionType: value as StrategyFormState["actionType"] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AUTO_LIGHT">开启补光灯</SelectItem>
              <SelectItem value="AUTO_FAN">启动风扇</SelectItem>
              <SelectItem value="NOTIFY_USER">通知用户</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "提交中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SettingsPageContent() {
  const searchParams = useSearchParams()
  const [devices, setDevices] = useState<DeviceCard[]>(initialDevices)
  const [selectedPlantId, setSelectedPlantId] = useState(DEFAULT_PLANT_ID)
  const [strategies, setStrategies] = useState<StrategyItem[]>([])
  const [devicesStatus, setDevicesStatus] = useState<DevicesStatus | null>(null)
  const [strategiesLoading, setStrategiesLoading] = useState(true)
  const [strategiesError, setStrategiesError] = useState<string | null>(null)
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false)
  const [strategyForm, setStrategyForm] = useState<StrategyFormState>(initialFormState)
  const [strategySubmitError, setStrategySubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [environmentRanges, setEnvironmentRanges] = useState<EnvironmentRangeState>(defaultEnvironmentRanges)
  const [environmentSaving, setEnvironmentSaving] = useState(false)
  const [logs, setLogs] = useState<PolicyLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)

  const currentPlant = getPlantOption(selectedPlantId)
  const currentPlantApiId = getPlantApiId(selectedPlantId)
  const potentialNotifyConflict = findPotentialNotifyConflict(strategies, strategyForm)
  const notifyConflictHint =
    potentialNotifyConflict && strategyForm.actionType === "NOTIFY_USER"
      ? `已存在启用中的同类通知策略“${potentialNotifyConflict.strategyName}”，本次保存可能发生冲突，最终以后端校验结果为准。`
      : null

  useEffect(() => {
    const plantFromQuery = searchParams.get("plant")
    if (plantFromQuery && plantOptions.some((plant) => plant.id === plantFromQuery)) {
      setSelectedPlantId(plantFromQuery)
      return
    }

    const storedPlant = window.localStorage.getItem(SELECTED_PLANT_STORAGE_KEY)
    if (storedPlant && plantOptions.some((plant) => plant.id === storedPlant)) {
      setSelectedPlantId(storedPlant)
    }
  }, [searchParams])

  useEffect(() => {
    window.localStorage.setItem(SELECTED_PLANT_STORAGE_KEY, selectedPlantId)
  }, [selectedPlantId])

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
      toast({
        title: "策略列表加载失败",
        description: message,
        variant: "destructive",
      })
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
      toast({
        title: "设备状态加载失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setDevicesLoading(false)
    }
  }

  const loadStrategyLogs = async (sourceStrategies = strategies) => {
    if (sourceStrategies.length === 0) {
      setLogs([])
      setLogsError(null)
      return
    }

    setLogsLoading(true)
    setLogsError(null)
    try {
      const results = await Promise.all(
        sourceStrategies.map(async (strategy) => {
          const page = await listStrategyExecutionLogs({
            strategyId: strategy.id,
            pageNum: 1,
            pageSize: 5,
          })
          return page.records.map((log) => toPolicyLog(log, strategy))
        }),
      )
      setLogs(
        results
          .flat()
          .sort((a, b) => b.time.localeCompare(a.time))
          .slice(0, 10),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "策略日志加载失败"
      setLogs([])
      setLogsError(message)
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    void loadStrategies()
  }, [currentPlantApiId])

  useEffect(() => {
    void loadStrategyLogs(strategies)
  }, [strategies])

  useEffect(() => {
    setEnvironmentRanges(() => {
      const next: EnvironmentRangeState = { ...defaultEnvironmentRanges }
      ;(Object.keys(environmentRangeStrategies) as EnvironmentMetricKey[]).forEach((key) => {
        const strategy = findEnvironmentRangeStrategy(strategies, key)
        next[key] =
          strategy?.thresholdMin != null && strategy.thresholdMax != null
            ? [Number(strategy.thresholdMin), Number(strategy.thresholdMax)]
            : defaultEnvironmentRanges[key]
      })
      return next
    })
  }, [strategies, currentPlantApiId])

  useEffect(() => {
    void loadDevicesStatus()
  }, [])

  useEffect(() => {
    if (!devicesStatus) {
      return
    }

    setDevices((currentDevices) =>
      currentDevices.map((device) => {
        if (device.id === "d1") {
          return {
            ...device,
            name: devicesStatus.light?.deviceName ?? device.name,
            topic: devicesStatus.light?.deviceCode ?? device.topic,
            online: devicesStatus.light?.onlineStatus === "ONLINE",
          }
        }

        if (device.id === "d2") {
          return {
            ...device,
            name: devicesStatus.fan?.deviceName ?? device.name,
            topic: devicesStatus.fan?.deviceCode ?? device.topic,
            online: devicesStatus.fan?.onlineStatus === "ONLINE",
          }
        }

        return device
      }),
    )
  }, [devicesStatus])

  const handleCreateStrategy = async () => {
    const userSnapshot = readStoredUserSnapshot()
    const currentUserId = userSnapshot.resolvedUserId
    setStrategySubmitError(null)
    const validationMessage = validateStrategyForm(strategyForm, devicesStatus, currentUserId)
    if (validationMessage) {
      toast({
        title: "表单校验失败",
        description: validationMessage,
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const payload = buildCreatePayload(strategyForm, currentPlantApiId, currentUserId, devicesStatus)
      logStrategyPayload("create:before-request", payload, {
        "localStorage.plantcloud_user": userSnapshot.rawUser,
        parsedUser: userSnapshot.parsedUser,
        tokenUserId: userSnapshot.tokenUserId,
        resolvedUserId: userSnapshot.resolvedUserId,
        "typeof resolvedUserId": typeof userSnapshot.resolvedUserId,
      })
      if (payload.actionType === "NOTIFY_USER" && potentialNotifyConflict) {
        toast({
          title: "通知策略可能冲突",
          description: notifyConflictHint ?? "当前已存在启用中的同类通知策略，最终以后端校验结果为准。",
          variant: "destructive",
        })
      }
      await createStrategy(payload)
      toast({
        title: "策略已创建",
        description: "新策略已经同步到后端。",
      })
      setStrategyDialogOpen(false)
      setStrategyForm(initialFormState)
      await loadStrategies()
    } catch (error) {
      toast({
        title: "创建策略失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStrategy = async (strategy: StrategyItem, nextEnabled: boolean) => {
    setTogglingId(strategy.id)
    setStrategies((current) => current.map((item) => (item.id === strategy.id ? { ...item, enabled: nextEnabled } : item)))

    try {
      const detail = await getStrategyDetail(strategy.id)
      const payload = buildUpdatePayload(detail, nextEnabled)
      logStrategyPayload("toggle:before-request", payload, {
        strategyId: strategy.id,
        "typeof strategyId": typeof strategy.id,
        detailCreatedBy: detail.createdBy,
        "typeof detailCreatedBy": typeof detail.createdBy,
      })
      await updateStrategy(strategy.id, payload)
      await loadStrategies()
    } catch (error) {
      setStrategies((current) => current.map((item) => (item.id === strategy.id ? { ...item, enabled: strategy.enabled } : item)))
      toast({
        title: "更新策略失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDeleteStrategy = async (strategy: StrategyItem) => {
    if (!window.confirm(`确认删除策略「${strategy.strategyName}」吗？`)) {
      return
    }

    setDeletingId(strategy.id)
    try {
      console.log("[strategy][delete:before-request]", {
        strategyId: strategy.id,
        typeofStrategyId: typeof strategy.id,
      })
      await deleteStrategy(strategy.id)
      setStrategies((current) => current.filter((item) => item.id !== strategy.id))
      toast({
        title: "策略已删除",
      })
    } catch (error) {
      toast({
        title: "删除策略失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaveEnvironmentRanges = async () => {
    const currentUserId = getCurrentUserId()
    if (!currentUserId) {
      toast({
        title: "无法保存环境阈值",
        description: "当前登录信息缺少 userId，请重新登录后再试。",
        variant: "destructive",
      })
      return
    }

    setEnvironmentSaving(true)
    try {
      for (const key of Object.keys(environmentRangeStrategies) as EnvironmentMetricKey[]) {
        const existing = findEnvironmentRangeStrategy(strategies, key)
        const payload = buildEnvironmentRangePayload(
          key,
          environmentRanges[key],
          currentPlantApiId,
          currentUserId,
          existing,
        )
        if (existing) {
          await updateStrategy(existing.id, payload)
        } else {
          await createStrategy(payload)
        }
      }
      await loadStrategies()
      toast({
        title: "环境阈值已保存",
        description: `${currentPlant?.name ?? "当前植物"} 的范围已同步到策略表。`,
      })
    } catch (error) {
      toast({
        title: "环境阈值保存失败",
        description: error instanceof Error ? error.message : "请稍后重试。",
        variant: "destructive",
      })
    } finally {
      setEnvironmentSaving(false)
    }
  }

  const handleCreateStrategyEnhanced = async () => {
    const currentUserId = getCurrentUserId()
    setStrategySubmitError(null)

    const validationMessage = validateStrategyForm(strategyForm, devicesStatus, currentUserId)
    if (validationMessage) {
      setStrategySubmitError(validationMessage)
      toast({
        title: "表单校验失败",
        description: validationMessage,
        variant: "destructive",
      })
      return
    }

    const payload = buildCreatePayload(strategyForm, currentPlantApiId, currentUserId, devicesStatus)

    if (payload.actionType === "NOTIFY_USER" && potentialNotifyConflict) {
      toast({
        title: "通知策略可能冲突",
        description: notifyConflictHint ?? "当前已存在启用中的同类通知策略，最终以后端校验结果为准。",
        variant: "destructive",
      })
    }

    setSubmitting(true)
    try {
      await createStrategy(payload)
      setStrategySubmitError(null)
      setStrategyDialogOpen(false)
      setStrategyForm(initialFormState)
      await loadStrategies()
      toast({
        title: "策略保存成功",
        description: "新策略已创建，并已刷新当前列表。",
      })
    } catch (error) {
      const feedback = buildStrategySaveFeedback(error, payload, potentialNotifyConflict)
      setStrategySubmitError(feedback.description)
      toast({
        title: feedback.title,
        description: feedback.description,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateStrategyFriendly = async () => {
    const currentUserId = getCurrentUserId()
    setStrategySubmitError(null)

    const validationMessage = validateStrategyForm(strategyForm, devicesStatus, currentUserId)
    if (validationMessage) {
      setStrategySubmitError(validationMessage)
      toast({
        title: "表单校验失败",
        description: validationMessage,
        variant: "destructive",
      })
      return
    }

    const payload = buildCreatePayload(strategyForm, currentPlantApiId, currentUserId, devicesStatus)

    if (payload.actionType === "NOTIFY_USER" && potentialNotifyConflict) {
      toast({
        title: "通知策略可能冲突",
        description: notifyConflictHint ?? "当前已存在启用中的同类通知策略，保存时可能被后端判定为冲突。",
      })
    }

    setSubmitting(true)
    try {
      await createStrategy(payload)
      setStrategySubmitError(null)
      setStrategyDialogOpen(false)
      setStrategyForm(initialFormState)
      await loadStrategies()
      toast({
        title: "策略保存成功",
        description: "策略已保存，并刷新列表。",
      })
    } catch (error) {
      const feedback = buildFriendlyStrategySaveFeedback(error, payload, potentialNotifyConflict)
      setStrategySubmitError(feedback.description)
      toast({
        title: feedback.title,
        description: feedback.description,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">

        <main className="container mx-auto max-w-4xl px-6 py-8">
          <h1 className="mb-6 text-2xl font-bold">系统设置</h1>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-primary" />
                  设备连接管理
                </CardTitle>
                <CardDescription>保留现有设备展示样式，策略动作会优先使用后端返回的设备信息。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {devices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between rounded-xl border bg-muted/50 p-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${device.online ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                      <div>
                        <p className="text-sm font-medium">{device.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{device.topic}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={device.online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                        {device.online ? `在线 ${device.latency ?? "--"}ms` : "离线"}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" disabled>
                  <Plus className="mr-2 h-4 w-4" />
                  新增设备
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      自动化策略管理
                    </CardTitle>
                    <CardDescription>
                      当前正在查看 {currentPlant.emoji} {currentPlant.name} 的策略列表，数据已改为来自后端接口。
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void loadStrategies()} disabled={strategiesLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${strategiesLoading ? "animate-spin" : ""}`} />
                    刷新
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {strategiesLoading ? (
                  <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
                    正在加载策略列表...
                  </div>
                ) : null}

                {!strategiesLoading && strategiesError ? (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-sm text-destructive">
                    {strategiesError}
                  </div>
                ) : null}

                {!strategiesLoading && !strategiesError && strategies.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
                    当前植物还没有策略，点击下方按钮创建第一条自动化策略。
                  </div>
                ) : null}

                {!strategiesLoading && !strategiesError
                  ? strategies.map((strategy) => (
                      <div
                        key={strategy.id}
                        className={`rounded-xl border p-4 transition-colors ${
                          strategy.enabled ? "bg-muted/50" : "bg-muted/20 opacity-70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <p className="text-sm font-medium">{strategy.strategyName}</p>
                              <Badge variant="outline" className="text-xs">
                                {strategy.enabled ? "已启用" : "已停用"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-blue-600">如果</span>{" "}
                              {formatStrategyCondition(strategy)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-green-600">则</span>{" "}
                              {formatStrategyAction(strategy, {
                                light: devicesStatus?.light,
                                fan: devicesStatus?.fan,
                              })}
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
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={deletingId === strategy.id}
                              onClick={() => void handleDeleteStrategy(strategy)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  : null}

                <Button variant="outline" className="w-full" onClick={() => setStrategyDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  新建策略
                </Button>

                {devicesLoading ? (
                  <p className="text-xs text-muted-foreground">正在同步设备状态，用于补全策略动作中的设备信息...</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ScrollText className="h-5 w-5 text-primary" />
                      策略日志
                    </CardTitle>
                    <CardDescription>显示当前植物策略被实时环境数据触发后的执行记录。</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void loadStrategyLogs()} disabled={logsLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${logsLoading ? "animate-spin" : ""}`} />
                    刷新
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {logsLoading ? (
                    <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                      正在加载策略执行日志...
                    </div>
                  ) : null}

                  {!logsLoading && logsError ? (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-sm text-destructive">
                      {logsError}
                    </div>
                  ) : null}

                  {!logsLoading && !logsError && logs.length === 0 ? (
                    <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                      暂无策略执行日志。保存策略后，当实时温度、湿度或光照满足触发条件时会自动写入。
                    </div>
                  ) : null}

                  {!logsLoading && !logsError ? logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
                      <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono text-xs text-muted-foreground">{log.time}</span>
                      </div>
                      <div className="flex flex-1 items-start gap-2">
                        {log.type === "warning" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" /> : null}
                        {log.type === "success" ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" /> : null}
                        {log.type === "info" ? <Zap className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /> : null}
                        <p
                          className={`text-sm ${
                            log.type === "warning"
                              ? "text-yellow-700"
                              : log.type === "success"
                                ? "text-green-700"
                                : "text-foreground"
                          }`}
                        >
                          {log.message}
                        </p>
                      </div>
                    </div>
                  )) : null}
                </div>
              </CardContent>
            </Card>

            <Separator />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="h-5 w-5 text-primary" />
                  环境阈值设置
                </CardTitle>
                <CardDescription>保留原页面的其他设置区域，不参与本次策略联调。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">温度范围</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {environmentRanges.temperature[0]}°C - {environmentRanges.temperature[1]}°C
                    </span>
                  </div>
                  <Slider
                    value={environmentRanges.temperature}
                    min={0}
                    max={50}
                    step={1}
                    onValueChange={(value) =>
                      setEnvironmentRanges((current) => ({ ...current, temperature: [value[0], value[1]] }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">湿度范围</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {environmentRanges.humidity[0]}% - {environmentRanges.humidity[1]}%
                    </span>
                  </div>
                  <Slider
                    value={environmentRanges.humidity}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(value) =>
                      setEnvironmentRanges((current) => ({ ...current, humidity: [value[0], value[1]] }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">光照范围</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {environmentRanges.light[0].toLocaleString()} - {environmentRanges.light[1].toLocaleString()} lux
                    </span>
                  </div>
                  <Slider
                    value={environmentRanges.light}
                    min={0}
                    max={50000}
                    step={100}
                    onValueChange={(value) =>
                      setEnvironmentRanges((current) => ({ ...current, light: [value[0], value[1]] }))
                    }
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    disabled={environmentSaving}
                    onClick={() => void handleSaveEnvironmentRanges()}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {environmentSaving ? "保存中..." : "保存环境阈值"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  通知设置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "温度异常通知", desc: "当温度超出安全范围时提醒我。", defaultOn: true },
                  { label: "湿度异常通知", desc: "当湿度超出安全范围时提醒我。", defaultOn: true },
                  { label: "光照异常通知", desc: "当光照不足或过强时提醒我。", defaultOn: true },
                  { label: "策略执行通知", desc: "策略成功执行后发送一条提示。", defaultOn: true },
                  { label: "设备离线通知", desc: "设备失联时推送告警。", defaultOn: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.defaultOn} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  应用信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    { label: "应用版本", value: "v1.0.0" },
                    { label: "硬件型号", value: "BearPi-HM Nano" },
                    { label: "系统版本", value: "HarmonyOS 3.0" },
                    { label: "最近同步", value: "2026-04-13 10:00" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-muted/50 p-3">
                      <p className="text-muted-foreground">{item.label}</p>
                      <p className="font-medium">{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full"
              size="lg"
              disabled={environmentSaving}
              onClick={() => void handleSaveEnvironmentRanges()}
            >
              <Save className="mr-2 h-4 w-4" />
              {environmentSaving ? "保存中..." : "保存设置"}
            </Button>
          </div>
        </main>

        <StrategyDialog
          open={strategyDialogOpen}
          form={strategyForm}
          submitting={submitting}
          submitError={strategySubmitError}
          notifyConflictHint={notifyConflictHint}
          onClose={() => {
            setStrategyDialogOpen(false)
            setStrategySubmitError(null)
            setStrategyForm(initialFormState)
          }}
          onChange={(patch) => {
            setStrategySubmitError(null)
            setStrategyForm((current) => ({ ...current, ...patch }))
          }}
          onSubmit={() => void handleCreateStrategyFriendly()}
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
