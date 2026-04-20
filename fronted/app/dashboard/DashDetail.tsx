"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Bot,
  CheckCircle,
  Droplets,
  Leaf,
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
import { getDashboardData, type DashboardData } from "@/lib/dashboard-api"
import type { PlantMeta } from "./page"

const POLL_INTERVAL_MS = 30000
const LIGHT_THRESHOLD = 500
const AIR_THRESHOLD = 300

type MetricTab = "temperature" | "humidity" | "light" | "air"

type Props = {
  plant: PlantMeta
  onBack: () => void
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

function getAirQualitySummary(data: DashboardData | null) {
  const latestAirLog = data?.airLogs[0] || null
  const value = latestAirLog?.metricValue ?? null

  if (value === null || value === undefined) {
    return {
      value: null,
      text: "良好",
      className: "bg-green-100 text-green-700 hover:bg-green-100",
    }
  }

  if (value >= AIR_THRESHOLD) {
    return {
      value,
      text: "异常",
      className: "bg-red-100 text-red-700 hover:bg-red-100",
    }
  }

  if (value >= AIR_THRESHOLD * 0.6) {
    return {
      value,
      text: "关注",
      className: "bg-amber-100 text-amber-700 hover:bg-amber-100",
    }
  }

  return {
    value,
    text: "良好",
    className: "bg-green-100 text-green-700 hover:bg-green-100",
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

export default function DashDetail({ plant, onBack }: Props) {
  const [metricTab, setMetricTab] = useState<MetricTab>("temperature")
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        setError(loadError instanceof Error ? loadError.message : "环境分析加载失败")
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
    const airScore =
      airSummary.value === null || airSummary.value === undefined
        ? 100
        : Math.max(0, Math.round((1 - Math.min(airSummary.value, AIR_THRESHOLD) / AIR_THRESHOLD) * 100))

    return [
      { subject: "温度", value: normalizeRange(current?.temperature ?? null, 18, 30, 12) },
      { subject: "湿度", value: normalizeRange(current?.humidity ?? null, 40, 80, 30) },
      { subject: "光照", value: normalizeRange(current?.lightLux ?? null, 300, 30000, 15000) },
      { subject: "空气质量", value: airScore },
    ]
  }, [airSummary.value, current?.humidity, current?.lightLux, current?.temperature])

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

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed left-1/2 top-4 z-40 -translate-x-1/2">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex items-center gap-3 rounded-full border border-border/70 bg-background/80 px-4 py-2 shadow-lg backdrop-blur-md"
        >
          <button
            onClick={onBack}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/80"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-foreground" />
          </button>
          <span className="pr-1 text-sm font-medium text-foreground">
            {plant.emoji} {plant.name} · 环境分析看板
          </span>
        </motion.div>
      </div>

      <main className="container mx-auto flex flex-col gap-4 px-6 pb-6 pt-16">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">数据库环境数据已接入</p>
            <p className="text-xs text-muted-foreground">
              {loading ? "正在加载环境分析..." : `最近更新：${lastUpdatedText}`}
            </p>
            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Leaf className="h-4 w-4 text-primary" />
            <span>植物 ID：{plant.plantId}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
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
              <p className="mt-1 text-xs text-muted-foreground">建议范围：18°C - 30°C</p>
            </CardContent>
          </Card>

          <Card>
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
              <p className="mt-1 text-xs text-muted-foreground">建议范围：40% - 80%</p>
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
              <p className="mt-1 text-xs text-muted-foreground">建议范围：300 - 30,000 lux</p>
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
              <p className="mt-1 text-xs text-muted-foreground">数据源：烟雾/空气异常告警日志最新值</p>
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
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Radar name="环境指数" dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.28} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 16px rgba(15, 23, 42, 0.12)" }} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-9">
          <Card className="lg:col-span-4">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="text-sm">近 24 小时光照曲线</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={170}>
                <ComposedChart data={dayChartData} margin={{ top: 8, right: 36, left: -12, bottom: 0 }}>
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
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bot className="h-4 w-4 text-primary" />
                AI 生长趋势分析
                <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  即将上线
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex h-[170px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-primary/25 bg-primary/3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary/60" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">AI 模型接入中</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    将基于历史环境数据，自动生成植物生长趋势预测与养护建议
                  </p>
                </div>
              </div>
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
