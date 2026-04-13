"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Thermometer, Droplets, Sun, AlertTriangle, AlertCircle,
  CheckCircle, Wifi, ArrowLeft, Sparkles, X, Flame, RotateCcw,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, ComposedChart, Area, Line, ReferenceLine,
} from "recharts"
import type { PlantData } from "./DashMain"

// ─── Mock data ────────────────────────────────────────────────────────────────
const dailyTempData = Array.from({ length: 31 }, (_, i) => ({
  day: `${i + 1}日`,
  最高温度: Math.round(22 + Math.random() * 10),
  最低温度: Math.round(12 + Math.random() * 8),
}))
const dailyHumidData = Array.from({ length: 31 }, (_, i) => ({
  day: `${i + 1}日`,
  最高湿度: Math.round(70 + Math.random() * 20),
  最低湿度: Math.round(40 + Math.random() * 20),
}))
const radarData = [
  { subject: "空气质量", value: 85, fullMark: 100 },
  { subject: "湿度", value: 78, fullMark: 100 },
  { subject: "光照", value: 92, fullMark: 100 },
  { subject: "温度", value: 88, fullMark: 100 },
]
const LIGHT_THRESHOLD = 500
const lightData = Array.from({ length: 25 }, (_, i) => {
  let lux = 0
  if (i >= 6 && i <= 18) {
    const peak = Math.sin(((i - 6) / 12) * Math.PI) * 28000 + 200
    lux = Math.round(peak + (Math.random() - 0.5) * 2000)
  } else {
    lux = Math.round(50 + Math.random() * 150)
  }
  if (i === 13) lux = 40000
  return {
    time: `${String(i).padStart(2, "0")}:00`,
    光照强度: lux,
    补光灯状态: lux < LIGHT_THRESHOLD ? 1 : 0,
    isAlert: lux > 30000,
  }
})

// ─── Alert Dot ────────────────────────────────────────────────────────────────
const AlertDot = (props: any) => {
  const { cx, cy, payload } = props
  if (!payload?.isAlert) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="#ef4444" opacity={0.9} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="white">!</text>
    </g>
  )
}

// ─── AI 分析弹窗 ──────────────────────────────────────────────────────────────
const AI_RESPONSES: Record<string, string> = {
  温度: "📊 根据本月温度极值趋势分析：\n\n• 最高温度均值约 27°C，整体处于植物适宜生长区间（18–30°C）。\n• 4月中旬出现 2 次超过 32°C 的峰值，建议在 11:00–15:00 时段开启风扇辅助降温。\n• 最低温度稳定在 14–18°C，夜间无需额外加热。\n\n🌱 生长预测：当前温度条件有利于根系发育，预计本月末可见明显新叶萌发。",
  湿度: "💧 根据本月湿度极值趋势分析：\n\n• 最高湿度均值约 82%，部分时段超过 85% 警戒线，存在真菌滋生风险。\n• 建议在湿度 > 80% 时自动开启通风，持续 15 分钟。\n• 最低湿度偶有跌至 38% 以下，可在早晨 7:00 补充叶面喷水。\n\n🌱 生长预测：湿度波动较大，建议稳定在 55–70% 区间，有助于叶片光泽度提升。",
}

function AiModal({ metric, onClose }: { metric: "温度" | "湿度"; onClose: () => void }) {
  const [thinking, setThinking] = useState(true)
  const [text, setText] = useState("")

  useState(() => {
    const timer = setTimeout(() => {
      setThinking(false)
      setText(AI_RESPONSES[metric])
    }, 2200)
    return () => clearTimeout(timer)
  })

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative z-10 w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-violet-50 to-card">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <span className="font-semibold text-sm">AI 趋势分析 · {metric}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-5 py-5 min-h-[180px] flex items-center justify-center">
          {thinking ? (
            <div className="flex flex-col items-center gap-3">
              {/* 思考动画 */}
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-2.5 w-2.5 rounded-full bg-violet-400"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">AI 正在分析{metric}趋势数据…</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-foreground leading-relaxed whitespace-pre-line"
            >
              {text}
            </motion.div>
          )}
        </div>

        {!thinking && (
          <div className="px-5 pb-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-full bg-violet-500 text-white text-xs font-medium hover:bg-violet-600 transition-colors"
            >
              知道了
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  plant: PlantData
  onBack: () => void
}

export default function DashDetail({ plant, onBack }: Props) {
  const [barMetric, setBarMetric] = useState<"温度" | "湿度">("温度")
  const [aiOpen, setAiOpen] = useState(false)
  const barData = barMetric === "温度" ? dailyTempData : dailyHumidData

  const criticalLogs = [
    ...(plant.smokeAlert ? [{ time: "2026-04-10 16:30", event: "烟雾/空气异常（E53_SF1 检测）", level: "error" }] : []),
    ...(plant.tiltAlert  ? [{ time: "2026-04-10 15:12", event: "植物位置异常（E53_SC2 倾斜检测）", level: "error" }] : []),
  ]
  const normalLogs = [
    { time: "2026-04-10 16:30", event: "光照过强警报", level: "warning" },
    { time: "2026-04-09 14:15", event: "植物位置异常（E53_SC2 倾斜检测）", level: "error" },
    { time: "2026-04-08 09:45", event: "烟雾/空气异常（E53_SF1 检测）", level: "warning" },
    { time: "2026-04-07 11:20", event: "温度过高警报（>32°C）", level: "warning" },
    { time: "2026-04-06 08:00", event: "湿度过低警报（<30%）", level: "warning" },
    { time: "2026-04-05 15:30", event: "设备连接中断", level: "error" },
  ]
  const allLogs = [...criticalLogs, ...normalLogs]

  return (
    <div className="min-h-screen bg-background">
      {/* ── 胶囊型浮动导航栏 ── */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex items-center gap-3 px-4 py-2 rounded-full
                     bg-background/70 backdrop-blur-md border border-border/60
                     shadow-lg shadow-black/10"
        >
          <button
            onClick={onBack}
            className="flex items-center justify-center h-7 w-7 rounded-full
                       bg-muted hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-foreground" />
          </button>
          <span className="text-sm font-medium text-foreground pr-1">
            {plant.emoji} {plant.name} · 环境分析看板
          </span>
        </motion.div>
      </div>

      {/* ── 内容区（顶部留出胶囊高度） ── */}
      <main className="container mx-auto px-6 pt-16 pb-6 flex flex-col gap-4">

        {/* 传感器紧急警报横幅 */}
        {(plant.smokeAlert || plant.tiltAlert) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200"
          >
            <span className="flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <p className="text-sm font-medium text-red-700">
              {plant.smokeAlert && "⚠️ E53_SF1 烟雾传感器触发报警　"}
              {plant.tiltAlert  && "⚠️ E53_SC2 倾斜传感器触发报警"}
            </p>
          </motion.div>
        )}

        {/* 第一行：实时环境看板 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-orange-100">
                    <Thermometer className="h-5 w-5 text-orange-600" />
                  </div>
                  <span className="text-sm text-muted-foreground">当前温度</span>
                </div>
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">健康</Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold">{plant.temp}</span>
                <span className="text-xl text-muted-foreground">°C</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">建议范围：18°C - 30°C</p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-100">
                    <Droplets className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-sm text-muted-foreground">当前湿度</span>
                </div>
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">正常</Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold">{plant.humidity}</span>
                <span className="text-xl text-muted-foreground">% RH</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">建议范围：40% - 80%</p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden bg-gradient-to-br from-rose-50 to-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-100">
                    <Sun className="h-5 w-5 text-amber-600" />
                  </div>
                  <span className="text-sm text-muted-foreground">当前光照强度</span>
                </div>
                <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 text-xs">过强警报</Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold">{plant.lux.toLocaleString()}</span>
                <span className="text-xl text-muted-foreground">lux</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">建议范围：300 - 30,000 lux</p>
            </CardContent>
          </Card>
        </div>

        {/* 第二行：柱形图 + 雷达图 */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
          <Card className="lg:col-span-7">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center justify-between text-sm">
                <span>每日环境极值柱形图 - 2026年4月</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setBarMetric("温度")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                      barMetric === "温度"
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-orange-100 text-orange-600 border-orange-300 hover:bg-orange-200"
                    }`}
                  >🌡 温度</button>
                  <button
                    onClick={() => setBarMetric("湿度")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                      barMetric === "湿度"
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-blue-100 text-blue-600 border-blue-300 hover:bg-blue-200"
                    }`}
                  >💧 湿度</button>
                  {/* AI 分析按钮 */}
                  <button
                    onClick={() => setAiOpen(true)}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium
                               bg-violet-100 text-violet-700 border border-violet-300
                               hover:bg-violet-200 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" /> AI 分析
                  </button>
                </div>
              </CardTitle>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                {barMetric === "温度" ? (
                  <>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-400 inline-block" />最高温度</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400 inline-block" />最低温度</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-400 inline-block" />最高湿度</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-400 inline-block" />最低湿度</span>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={2} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" unit={barMetric === "温度" ? "°C" : "%"} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                  {barMetric === "温度" ? (
                    <>
                      <Bar dataKey="最高温度" fill="#f87171" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="最低温度" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                    </>
                  ) : (
                    <>
                      <Bar dataKey="最高湿度" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="最低湿度" fill="#818cf8" radius={[4, 4, 0, 0]} />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">环境平衡指数</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} stroke="#9ca3af" />
                  <Radar name="环境指数" dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* 第三行：光照趋势 + 异常日志 */}
        <div className="grid grid-cols-1 lg:grid-cols-9 gap-4">
          <Card className="lg:col-span-5">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>光照关联统计 (24h)</span>
                <div className="flex items-center gap-4 text-xs font-normal text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-4 rounded" style={{ background: "linear-gradient(90deg,#fbbf24,#fb923c)" }} />
                    光照强度 (Lux)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-green-600" />
                    补光灯 ON/OFF
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-500 text-center text-white" style={{ fontSize: 8, lineHeight: "12px" }}>!</span>
                    过强警报
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={110}>
                <ComposedChart data={lightData} margin={{ top: 8, right: 40, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="luxGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#fb923c" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} interval={3} stroke="#9ca3af" />
                  <YAxis yAxisId="lux" orientation="left" tick={{ fontSize: 10 }} stroke="#fbbf24" unit=" lux" width={60} domain={[0, 45000]} />
                  <YAxis yAxisId="led" orientation="right" tick={{ fontSize: 10 }} stroke="#16a34a" ticks={[0, 1]} tickFormatter={(v) => (v === 1 ? "ON" : "OFF")} domain={[-0.1, 1.5]} width={36} />
                  <ReferenceLine yAxisId="lux" y={LIGHT_THRESHOLD} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "阈值 500lux", position: "insideTopLeft", fontSize: 9, fill: "#94a3b8" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: 12 }}
                    formatter={(value: any, name: string) => {
                      if (name === "光照强度") return [`${value.toLocaleString()} lux`, name]
                      return [value === 1 ? "ON" : "OFF", "补光灯"]
                    }}
                  />
                  <Area yAxisId="lux" type="monotone" dataKey="光照强度" stroke="#f59e0b" strokeWidth={2} fill="url(#luxGrad2)" dot={<AlertDot />} activeDot={{ r: 4 }} />
                  <Line yAxisId="led" type="stepAfter" dataKey="补光灯状态" stroke="#16a34a" strokeWidth={2} strokeDasharray="6 3" dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                最近异常事件日志
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ScrollArea className="h-[110px]">
                <div className="space-y-2">
                  {allLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors
                        ${index < criticalLogs.length
                          ? "bg-red-50 border border-red-200"
                          : "bg-muted/50 hover:bg-muted"}`}
                    >
                      {log.level === "error"
                        ? <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                        : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{log.event}</p>
                        <p className="text-xs text-muted-foreground">{log.time}</p>
                      </div>
                      <Badge
                        variant={log.level === "error" ? "destructive" : "secondary"}
                        className={`text-xs ${log.level === "warning" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : ""}`}
                      >
                        {log.level === "error" ? "紧急" : "警告"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* 底部状态栏 */}
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-muted-foreground">小熊派已连接</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">MQTT 通信延时：23ms</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                数据同步正常 | 最后更新：2026-04-10 16:45
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* AI 分析弹窗 */}
      <AnimatePresence>
        {aiOpen && <AiModal metric={barMetric} onClose={() => setAiOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
