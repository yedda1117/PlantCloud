"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Bot,
  CheckCircle,
  Droplets,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
  Sun,
  Thermometer,
  Wifi,
} from "lucide-react"
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getDashboardData,
  getPlantTemplateProfile,
  type DashboardData,
  type PlantTemplateProfile,
} from "@/lib/dashboard-api"
import { getPlantAiAnalysis, type PlantAiAnalysis } from "@/lib/plant-api"
import type { PlantMeta } from "./page"

const POLL_INTERVAL_MS = 5000
const LIGHT_THRESHOLD = 500
const AIR_THRESHOLD = 300

type MetricTab = "temperature" | "humidity" | "light" | "air"

type Props = {
  plant: PlantMeta
  onBack: () => void
}

const riskTypeLabelMap: Record<string, string> = {
  HIGH_TEMP_RISK: "高温风险",
  DRYNESS_RISK: "干燥风险",
  STRONG_LIGHT_RISK: "强光风险",
  HOT_DRY_TREND_RISK: "高温干燥趋势风险",
  NO_RISK: "暂无明显风险",
}

const riskLevelStyleMap: Record<string, { label: string; className: string }> = {
  HIGH: {
    label: "高风险",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  MEDIUM: {
    label: "中风险",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  LOW: {
    label: "低风险",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "暂无数据"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString("zh-CN", { hour12: false })
}

function formatHourLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(11, 16)
  }
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function formatDayLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(5, 10)
  }
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function mapStatusBadge(status: string | null | undefined, type: "temperature" | "humidity" | "light") {
  switch ((status || "").toUpperCase()) {
    case "HIGH":
      return {
        text: type === "light" ? "过强" : "偏高",
        className: "bg-red-100 text-red-700 hover:bg-red-100",
      }
    case "LOW":
      return {
        text: type === "light" ? "不足" : "偏低",
        className: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      }
    case "NORMAL":
      return {
        text: "正常",
        className: "bg-green-100 text-green-700 hover:bg-green-100",
      }
    default:
      return {
        text: "未知",
        className: "bg-slate-100 text-slate-600 hover:bg-slate-100",
      }
  }
}

function isAbnormalStatus(status: string | null | undefined) {
  const normalized = (status || "").toUpperCase()
  return normalized === "HIGH" || normalized === "LOW" || normalized === "ERROR"
}

function getAirQualitySummary(data: DashboardData | null) {
  const latestAirLog = data?.airLogs[0] || null
  const value = latestAirLog?.metricValue ?? null
  const status = (latestAirLog?.status || "").toUpperCase()
  const severity = (latestAirLog?.severity || "").toUpperCase()

  if (!latestAirLog) {
    return {
      value: null,
      text: "暂无数据",
      className: "bg-slate-100 text-slate-600 hover:bg-slate-100",
    }
  }

  if (status === "UNRESOLVED") {
    return {
      value,
      text: severity === "LOW" || severity === "MEDIUM" ? "关注" : "异常",
      className:
        severity === "LOW" || severity === "MEDIUM"
          ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
          : "bg-red-100 text-red-700 hover:bg-red-100",
    }
  }

  if (status === "RESOLVED") {
    return {
      value,
      text: "正常",
      className: "bg-green-100 text-green-700 hover:bg-green-100",
    }
  }

  return {
    value,
    text: "状态未知",
    className: "bg-slate-100 text-slate-600 hover:bg-slate-100",
  }
}

function normalizeRange(value: number | null | undefined, idealMin: number, idealMax: number, clampMax: number) {
  if (value === null || value === undefined) {
    return 0
  }
  if (value >= idealMin && value <= idealMax) {
    return 100
  }
  const distance = value < idealMin ? idealMin - value : value - idealMax
  const ratio = Math.max(0, 1 - distance / clampMax)
  return Math.round(ratio * 100)
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function calculateRangeScore(value: number | null | undefined, min: number | null | undefined, max: number | null | undefined) {
  if (value === null || value === undefined || min === null || min === undefined || max === null || max === undefined || min >= max) {
    return null
  }

  if (value >= min && value <= max) {
    return 100
  }

  if (value < min) {
    if (min <= 0) {
      return 0
    }
    return clampPercent((value / min) * 100)
  }

  if (value <= 0) {
    return 0
  }

  return clampPercent((max / value) * 100)
}

function formatRangeLabel(min: number | null | undefined, max: number | null | undefined, unit: string) {
  if (min === null || min === undefined || max === null || max === undefined) {
    return "暂无建议范围"
  }

  const formatValue = (value: number) => {
    if (unit === "lux") {
      return Number(value).toLocaleString()
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }

  return `${formatValue(min)} - ${formatValue(max)} ${unit}`
}

function formatCardRangeText({
  min,
  max,
  unit,
  loading,
  error,
}: {
  min: number | null | undefined
  max: number | null | undefined
  unit: string
  loading: boolean
  error: boolean
}) {
  if (loading) {
    return "建议范围：加载中..."
  }

  if (error) {
    return "建议范围：获取失败"
  }

  const rangeLabel = formatRangeLabel(min, max, unit)
  return rangeLabel === "暂无建议范围" ? "建议范围：暂无数据" : `建议范围：${rangeLabel}`
}

function mapRiskTypeLabel(value: string) {
  return riskTypeLabelMap[value] ?? value
}

function getRiskLevelMeta(level: string | null | undefined) {
  return riskLevelStyleMap[level || ""] ?? {
    label: level || "未知风险",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  }
}

export default function DashDetail({ plant, onBack }: Props) {
  const [metricTab, setMetricTab] = useState<MetricTab>("temperature")
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [plantTemplate, setPlantTemplate] = useState<PlantTemplateProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [aiAnalysisData, setAiAnalysisData] = useState<PlantAiAnalysis | null>(null)
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(true)
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let firstLoad = true

    const loadData = async () => {
      const token = window.localStorage.getItem("plantcloud_token") || ""
      if (firstLoad) {
        setLoading(true)
      }

      try {
        const nextData = await getDashboardData(plant.plantId, token)
        if (cancelled) {
          return
        }
        setDashboardData(nextData)
        setError(null)
      } catch (loadError) {
        if (cancelled) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : "数据获取失败")
      } finally {
        if (!cancelled && firstLoad) {
          setLoading(false)
        }
        firstLoad = false
      }
    }

    void loadData()
    const timer = window.setInterval(() => {
      void loadData()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [plant.plantId])

  useEffect(() => {
    let cancelled = false

    const loadPlantTemplate = async () => {
      const token = window.localStorage.getItem("plantcloud_token") || ""
      setBalanceLoading(true)
      setBalanceError(null)

      try {
        const nextTemplate = await getPlantTemplateProfile(plant.plantId, token)
        if (cancelled) {
          return
        }
        setPlantTemplate(nextTemplate)
      } catch (loadError) {
        if (cancelled) {
          return
        }
        setPlantTemplate(null)
        setBalanceError(loadError instanceof Error ? loadError.message : "建议范围获取失败")
      } finally {
        if (!cancelled) {
          setBalanceLoading(false)
        }
      }
    }

    void loadPlantTemplate()

    return () => {
      cancelled = true
    }
  }, [plant.plantId])

  useEffect(() => {
    let cancelled = false

    const loadAiAnalysis = async () => {
      const token = window.localStorage.getItem("plantcloud_token") || ""
      setAiAnalysisLoading(true)
      setAiAnalysisError(null)

      try {
        const nextData = await getPlantAiAnalysis(plant.plantId, token)
        if (cancelled) {
          return
        }
        setAiAnalysisData(nextData)
      } catch (loadError) {
        if (cancelled) {
          return
        }
        setAiAnalysisData(null)
        setAiAnalysisError(loadError instanceof Error ? loadError.message : "AI 分析暂时获取失败，请稍后重试")
      } finally {
        if (!cancelled) {
          setAiAnalysisLoading(false)
        }
      }
    }

    void loadAiAnalysis()

    return () => {
      cancelled = true
    }
  }, [plant.plantId])

  const current = dashboardData?.current
  const airSummary = getAirQualitySummary(dashboardData)

  const monthChartData = useMemo(() => {
    const temperatureMap = new Map((dashboardData?.monthHistory.temperature || []).map((item) => [item.time, item.value]))
    const humidityMap = new Map((dashboardData?.monthHistory.humidity || []).map((item) => [item.time, item.value]))
    const lightMap = new Map((dashboardData?.monthHistory.light || []).map((item) => [item.time, item.value]))
    const airMap = new Map<string, number>()

    ;(dashboardData?.airLogs || []).forEach((item) => {
      if (!item.createdAt || item.metricValue === null || item.metricValue === undefined) {
        return
      }
      const date = new Date(item.createdAt)
      if (Number.isNaN(date.getTime())) {
        return
      }
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T00:00:00`
      const currentValue = airMap.get(key)
      airMap.set(key, currentValue === undefined ? item.metricValue : Math.max(currentValue, item.metricValue))
    })

    const keySet = new Set<string>([
      ...temperatureMap.keys(),
      ...humidityMap.keys(),
      ...lightMap.keys(),
      ...airMap.keys(),
    ])

    return Array.from(keySet)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((time) => ({
        time,
        label: formatDayLabel(time),
        temperature: temperatureMap.get(time) ?? null,
        humidity: humidityMap.get(time) ?? null,
        light: lightMap.get(time) ?? null,
        air: airMap.get(time) ?? null,
      }))
  }, [dashboardData])

  // 只取最近 15 天，并附加 15 日平均值（avg）
  const monthChartData15 = useMemo(() => {
    const raw = monthChartData.slice(-15)
    // 计算各指标的 15 日平均（排除 null）
    const avg = (key: MetricTab) => {
      const vals = raw.map((d) => d[key]).filter((v): v is number => v !== null)
      if (vals.length === 0) return null
      return vals.reduce((s, v) => s + v, 0) / vals.length
    }
    const avgValues: Record<MetricTab, number | null> = {
      temperature: avg("temperature"),
      humidity: avg("humidity"),
      light: avg("light"),
      air: avg("air"),
    }
    return { data: raw, avgValues }
  }, [monthChartData])

  const dayChartData = useMemo(() => {
    const temperatureMap = new Map((dashboardData?.dayHistory.temperature || []).map((item) => [item.time, item.value]))
    const humidityMap = new Map((dashboardData?.dayHistory.humidity || []).map((item) => [item.time, item.value]))
    const lightMap = new Map((dashboardData?.dayHistory.light || []).map((item) => [item.time, item.value]))

    return Array.from(new Set<string>([
      ...temperatureMap.keys(),
      ...humidityMap.keys(),
      ...lightMap.keys(),
    ]))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((time) => {
        const lightValue = lightMap.get(time) ?? null
        return {
          time,
          label: formatHourLabel(time),
          temperature: temperatureMap.get(time) ?? null,
          humidity: humidityMap.get(time) ?? null,
          light: lightValue,
          supplemental: lightValue !== null && lightValue < LIGHT_THRESHOLD ? 1 : 0,
        }
      })
  }, [dashboardData])

  const radarData = useMemo(() => {
    const metrics = [
      {
        subject: "温度",
        value: calculateRangeScore(current?.temperature ?? null, plantTemplate?.tempMin ?? null, plantTemplate?.tempMax ?? null),
        currentValue: current?.temperature ?? null,
        unit: "°C",
        rangeText: formatRangeLabel(plantTemplate?.tempMin ?? null, plantTemplate?.tempMax ?? null, "°C"),
      },
      {
        subject: "湿度",
        value: calculateRangeScore(current?.humidity ?? null, plantTemplate?.humidityMin ?? null, plantTemplate?.humidityMax ?? null),
        currentValue: current?.humidity ?? null,
        unit: "% RH",
        rangeText: formatRangeLabel(plantTemplate?.humidityMin ?? null, plantTemplate?.humidityMax ?? null, "%"),
      },
      {
        subject: "光照",
        value: calculateRangeScore(current?.lightLux ?? null, plantTemplate?.lightMin ?? null, plantTemplate?.lightMax ?? null),
        currentValue: current?.lightLux ?? null,
        unit: "lux",
        rangeText: formatRangeLabel(plantTemplate?.lightMin ?? null, plantTemplate?.lightMax ?? null, "lux"),
      },
    ]

    return metrics.filter((metric) => metric.value !== null)
  }, [
    current?.humidity,
    current?.lightLux,
    current?.temperature,
    plantTemplate?.humidityMax,
    plantTemplate?.humidityMin,
    plantTemplate?.lightMax,
    plantTemplate?.lightMin,
    plantTemplate?.tempMax,
    plantTemplate?.tempMin,
  ])

  const balanceFormulaText = "评分规则：处于建议范围内 = 100；低于下限 = 当前值 / 下限 × 100；高于上限 = 上限 / 当前值 × 100。结果限制在 0 - 100。"
  const balanceHasRenderableData = radarData.length >= 3
  const balanceStatusText = balanceLoading
    ? "正在加载该植物的建议范围..."
    : balanceError
      ? "建议范围获取失败，暂时无法计算环境平衡指数。"
      : !balanceHasRenderableData
        ? "当前实时值或建议范围不完整，暂时无法生成完整指数。"
        : "指数按该植物自己的建议范围实时计算。"

  const temperatureRangeText = formatCardRangeText({
    min: plantTemplate?.tempMin ?? null,
    max: plantTemplate?.tempMax ?? null,
    unit: "°C",
    loading: balanceLoading,
    error: Boolean(balanceError),
  })
  const humidityRangeText = formatCardRangeText({
    min: plantTemplate?.humidityMin ?? null,
    max: plantTemplate?.humidityMax ?? null,
    unit: "%",
    loading: balanceLoading,
    error: Boolean(balanceError),
  })
  const lightRangeText = formatCardRangeText({
    min: plantTemplate?.lightMin ?? null,
    max: plantTemplate?.lightMax ?? null,
    unit: "lux",
    loading: balanceLoading,
    error: Boolean(balanceError),
  })

  const lastUpdatedText = formatTimestamp(current?.collectedAt)

  const monthlyMetricMeta = {
    temperature: {
      title: "温度日均趋势",
      color: "#f97316",
      unit: "°C",
      description: "来自数据库温度历史数据，按天聚合",
    },
    humidity: {
      title: "湿度日均趋势",
      color: "#3b82f6",
      unit: "% RH",
      description: "来自数据库湿度历史数据，按天聚合",
    },
    light: {
      title: "光照日均趋势",
      color: "#f59e0b",
      unit: "lux",
      description: "来自数据库光照历史数据，按天聚合",
    },
    air: {
      title: "空气质量事件趋势",
      color: "#ef4444",
      unit: "ppm",
      description: "来自烟雾/空气异常告警日志中的数值记录",
    },
  } satisfies Record<MetricTab, { title: string; color: string; unit: string; description: string }>

  const currentMetric = monthlyMetricMeta[metricTab]
  const temperatureBadge = mapStatusBadge(current?.temperatureStatus, "temperature")
  const humidityBadge = mapStatusBadge(current?.humidityStatus, "humidity")
  const lightBadge = mapStatusBadge(current?.lightStatus, "light")
  const riskLevelMeta = getRiskLevelMeta(aiAnalysisData?.riskLevel)
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at top, rgba(208,232,222,0.55), transparent 38%), linear-gradient(135deg, #d0e8de 0%, #eaf6f0 100%)",
      }}
    >
      <main className="container mx-auto flex flex-col gap-4 px-6 pb-6 pt-4">
        <div className="flex items-start justify-between gap-4">
          {/* 返回按钮 */}
          <motion.button
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={onBack}
            className="mb-2 w-fit rounded-full border border-border/70 bg-background/85 px-3 py-2 shadow-md backdrop-blur-md transition-colors hover:bg-muted flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">返回总览</span>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="ml-auto flex min-w-0 flex-1 justify-end"
          >
            <div className="inline-flex max-w-full items-center gap-3 rounded-[1.25rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,252,0.9))] px-3.5 py-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:px-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/80 bg-white/85 text-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_8px_18px_rgba(15,23,42,0.06)]">
                {plant.emoji}
              </div>
              <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="rounded-full bg-emerald-50/85 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                  当前植物
                </span>
                <p className="truncate text-base font-semibold text-foreground sm:text-lg">
                  {plant.name}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {error ? <p className="rounded-xl bg-destructive/5 px-4 py-2 text-xs text-destructive">{error}</p> : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="bg-gradient-to-br from-pink-50 to-card">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-orange-100 p-2">
                    <Thermometer className="h-5 w-5 text-orange-600" />
                  </div>
                  <span className="text-sm text-muted-foreground">当前温度</span>
                </div>
                <Badge className={temperatureBadge.className}>{temperatureBadge.text}</Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold">
                  {current?.temperature !== null && current?.temperature !== undefined
                    ? Number(current.temperature).toFixed(1)
                    : "--"}
                </span>
                <span className="text-xl text-muted-foreground">°C</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{temperatureRangeText}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-sky-50 to-card">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-blue-100 p-2">
                    <Droplets className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-sm text-muted-foreground">当前湿度</span>
                </div>
                <Badge className={humidityBadge.className}>{humidityBadge.text}</Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold">
                  {current?.humidity !== null && current?.humidity !== undefined
                    ? Number(current.humidity).toFixed(1)
                    : "--"}
                </span>
                <span className="text-xl text-muted-foreground">% RH</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{humidityRangeText}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-card">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-amber-100 p-2">
                    <Sun className="h-5 w-5 text-amber-600" />
                  </div>
                  <span className="text-sm text-muted-foreground">当前光照</span>
                </div>
                <Badge className={lightBadge.className}>{lightBadge.text}</Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold">
                  {current?.lightLux !== null && current?.lightLux !== undefined
                    ? Number(current.lightLux).toLocaleString()
                    : "--"}
                </span>
                <span className="text-xl text-muted-foreground">lux</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{lightRangeText}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-card">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-emerald-100 p-2">
                    <ShieldAlert className="h-5 w-5 text-emerald-600" />
                  </div>
                  <span className="text-sm text-muted-foreground">空气质量</span>
                </div>
                <Badge className={airSummary.className}>{airSummary.text}</Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold">
                  {airSummary.value !== null && airSummary.value !== undefined
                    ? Number(airSummary.value).toFixed(0)
                    : "--"}
                </span>
                <span className="text-xl text-muted-foreground">ppm</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {airSummary.value !== null && airSummary.value !== undefined
                  ? "数据源：后端告警日志最新空气质量记录"
                  : "数据源：后端告警日志，暂无空气质量记录"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
          <Card className="lg:col-span-6">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <span>{currentMetric.title}</span>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">{currentMetric.description}</p>
                </div>
                {/* 指标选择下拉框 */}
                <Select value={metricTab} onValueChange={(v) => setMetricTab(v as MetricTab)}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="temperature">🌡️ 温度</SelectItem>
                    <SelectItem value="humidity">💧 湿度</SelectItem>
                    <SelectItem value="light">☀️ 光照</SelectItem>
                    <SelectItem value="air">🌫️ 空气质量</SelectItem>
                  </SelectContent>
                </Select>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={monthChartData15.data}
                  margin={{ top: 8, right: 16, left: -12, bottom: 0 }}
                  barCategoryGap="20%"
                  barGap={2}
                >
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 16px rgba(15, 23, 42, 0.12)" }}
                    formatter={(value, name) => {
                      if (value === null || value === undefined) return ["暂无数据", String(name)]
                      const formatted = metricTab === "light"
                        ? Number(value).toLocaleString()
                        : Number(value).toFixed(1)
                      const label = name === "avg" ? "15日均值" : "当日值"
                      return [`${formatted} ${currentMetric.unit}`, label]
                    }}
                    labelFormatter={(label) => `日期：${label}`}
                  />
                  {/* 当日值柱 */}
                  <Bar dataKey={metricTab} name="当日值" radius={[4, 4, 0, 0]} barSize={10}>
                    {monthChartData15.data.map((entry) => (
                      <Cell
                        key={`val-${entry.time}`}
                        fill={entry[metricTab] === null ? "#cbd5e1" : currentMetric.color}
                        fillOpacity={entry[metricTab] === null ? 0.4 : 0.9}
                      />
                    ))}
                  </Bar>
                  {/* 15日平均值柱（固定柔和灰蓝色） */}
                  <Bar
                    dataKey={() => monthChartData15.avgValues[metricTab]}
                    name="avg"
                    radius={[4, 4, 0, 0]}
                    barSize={8}
                    fill="#94a3b8"
                    fillOpacity={0.55}
                  />
                </BarChart>
              </ResponsiveContainer>
              {/* 图例 */}
              <div className="mt-2 flex items-center gap-4 px-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-4 rounded-sm"
                    style={{ backgroundColor: currentMetric.color, opacity: 0.9 }}
                  />
                  <span className="text-xs text-muted-foreground">当日值</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-4 rounded-sm bg-slate-400/55" />
                  <span className="text-xs text-muted-foreground">
                    15日均值（
                    {monthChartData15.avgValues[metricTab] !== null
                      ? metricTab === "light"
                        ? Number(monthChartData15.avgValues[metricTab]).toLocaleString()
                        : Number(monthChartData15.avgValues[metricTab]).toFixed(1)
                      : "--"}
                    {" "}{currentMetric.unit}）
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="text-sm">环境平衡指数</CardTitle>
              <p className="text-xs leading-5 text-muted-foreground">{balanceStatusText}</p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {balanceHasRenderableData ? (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#64748b" }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                      <Radar name="环境指数" dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.28} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 16px rgba(15, 23, 42, 0.12)" }}
                        formatter={(value, _name, item) => {
                          const payload = item?.payload as {
                            currentValue: number | null
                            unit: string
                            rangeText: string
                          } | undefined

                          const numericValue = typeof value === "number" ? value : Number(value)
                          const currentValueText =
                            payload?.currentValue === null || payload?.currentValue === undefined
                              ? "暂无实时值"
                              : payload.unit === "lux"
                                ? `${Number(payload.currentValue).toLocaleString()} ${payload.unit}`
                                : `${Number(payload.currentValue).toFixed(1)} ${payload.unit}`

                          return [
                            `${numericValue} 分｜当前：${currentValueText}｜建议：${payload?.rangeText || "暂无建议范围"}`,
                            "环境指数",
                          ]
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>

                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{balanceFormulaText}</p>
                </>
              ) : (
                <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center text-sm text-slate-500">
                  {balanceStatusText}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
          <Card className="lg:col-span-4">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="text-sm">近 24 小时光照曲线</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={290}>
                <ComposedChart data={dayChartData} margin={{ top: 10, right: 28, left: -8, bottom: 2 }}>
                  <defs>
                    <linearGradient id="lightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} stroke="#94a3b8" />
                  <YAxis yAxisId="lux" stroke="#f59e0b" tick={{ fontSize: 10 }} width={58} />
                  <YAxis
                    yAxisId="switch"
                    orientation="right"
                    stroke="#16a34a"
                    ticks={[0, 1]}
                    domain={[-0.1, 1.1]}
                    tickFormatter={(value) => (value === 1 ? "ON" : "OFF")}
                    tick={{ fontSize: 10 }}
                    width={34}
                  />
                  <ReferenceLine
                    yAxisId="lux"
                    y={LIGHT_THRESHOLD}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{ value: "补光阈值 500 lux", position: "insideTopLeft", fontSize: 9, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 16px rgba(15, 23, 42, 0.12)" }}
                    formatter={(value: number, name: string) => {
                      if (name === "光照") {
                        return [`${Number(value).toLocaleString()} lux`, name]
                      }
                      return [value === 1 ? "ON" : "OFF", "补光灯"]
                    }}
                    labelFormatter={(label) => `时间：${label}`}
                  />
                  <Area yAxisId="lux" type="monotone" dataKey="light" name="光照" stroke="#f59e0b" strokeWidth={2} fill="url(#lightGradient)" />
                  <Line yAxisId="switch" type="stepAfter" dataKey="supplemental" stroke="#16a34a" strokeDasharray="6 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap items-center gap-4 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-5 rounded-full bg-amber-500" />
                  <span className="text-xs text-muted-foreground">{"\u5149\u7167"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex w-5 items-center gap-0.5">
                    <span className="h-0.5 w-1.5 rounded-full bg-green-600" />
                    <span className="h-0.5 w-1.5 rounded-full bg-green-600" />
                    <span className="h-0.5 w-1.5 rounded-full bg-green-600" />
                  </span>
                  <span className="text-xs text-muted-foreground">{"\u8865\u5149\u706f\u5f00\u542f"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex w-5 items-center gap-0.5">
                    <span className="h-0.5 w-1 rounded-full bg-slate-400" />
                    <span className="h-0.5 w-1 rounded-full bg-slate-400" />
                    <span className="h-0.5 w-1 rounded-full bg-slate-400" />
                    <span className="h-0.5 w-1 rounded-full bg-slate-400" />
                  </span>
                  <span className="text-xs text-muted-foreground">{"\u8865\u5149\u9608\u503c 500 lux"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-6">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  AI 植物管家
                </div>
                {!aiAnalysisLoading && !aiAnalysisError && aiAnalysisData?.riskLevel ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${riskLevelMeta.className}`}>
                      {riskLevelMeta.label}
                    </span>
                    {typeof aiAnalysisData.riskScore === "number" ? (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        风险分 {aiAnalysisData.riskScore}
                      </span>
                    ) : null}
                    {(aiAnalysisData.riskType || []).map((item) => (
                      <Badge
                        key={item}
                        variant="secondary"
                        className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                      >
                        {mapRiskTypeLabel(item)}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {aiAnalysisLoading ? (
                <div className="flex h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-primary/10 bg-gradient-to-br from-emerald-50 via-white to-sky-50 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">正在生成 AI 植物分析</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      正在结合环境数据整理这株植物的管家建议
                    </p>
                  </div>
                </div>
              ) : aiAnalysisError ? (
                <div className="flex h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50/70 px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                    <ShieldAlert className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-700">AI 分析暂时获取失败</p>
                    <p className="mt-1 text-xs text-red-600/80">请稍后重试</p>
                  </div>
                </div>
              ) : !aiAnalysisData || (!aiAnalysisData.summary && aiAnalysisData.advice.length === 0 && aiAnalysisData.riskWarnings.length === 0) ? (
                <div className="flex h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Sparkles className="h-6 w-6 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">暂无分析结果</p>
                    <p className="mt-1 text-xs text-slate-500">当前没有可展示的 AI 植物管家分析数据</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                    <p className="text-xs font-semibold tracking-wide text-primary">AI 总结</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{aiAnalysisData.summary || "暂无总结"}</p>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                    <p className="text-xs font-semibold tracking-wide text-emerald-700">养护建议</p>
                    {aiAnalysisData.advice.length ? (
                      <div className="mt-2 space-y-2 text-sm leading-6 text-foreground">
                        {aiAnalysisData.advice.map((item) => (
                          <p key={item} className="flex items-start gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                            <span>{item}</span>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-foreground">暂无建议</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                    <p className="text-xs font-semibold tracking-wide text-amber-700">风险提醒</p>
                    {aiAnalysisData.riskWarnings.length ? (
                      <div className="mt-2 space-y-2 text-sm leading-6 text-foreground">
                        {aiAnalysisData.riskWarnings.map((item) => (
                          <p key={item} className="flex items-start gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                            <span>{item}</span>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-foreground">暂无提醒</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/30">
          <CardContent className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <span className="text-sm text-muted-foreground">数据库同步正常</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">MQTT 通信在线</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                最近更新时间：{lastUpdatedText}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
