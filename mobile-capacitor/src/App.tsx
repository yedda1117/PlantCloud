import { useCallback, useEffect, useMemo, useState } from "react"
import { Haptics, ImpactStyle } from "@capacitor/haptics"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Fan,
  Home,
  Leaf,
  Lightbulb,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Sprout,
  Thermometer,
  Trees,
  UserRound,
  Wind,
} from "lucide-react"
import { askPlantAi, controlHomeDevice, getHomeRealtime, getPlantAiAnalysis, getPlants } from "./api"
import type { ChatMessage, HomeRealtimeData, Plant, PlantAiAnalysis } from "./types"

type Screen = "intro" | "home" | "detail" | "ai"

const fallbackPlants: Plant[] = [
  { plantId: 1, plantName: "网纹草", status: "ACTIVE" },
  { plantId: 2, plantName: "多肉", status: "ACTIVE" },
  { plantId: 3, plantName: "绿萝", status: "ACTIVE" },
]

const quickQuestions = ["今天需要补光吗？", "叶子发黄可能是什么原因？", "现在的湿度适合它吗？", "帮我给出今晚养护建议"]

function impact(style = ImpactStyle.Light) {
  void Haptics.impact({ style }).catch(() => undefined)
}

function formatNumber(value: number | null | undefined, unit: string, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "--"
  return `${Number(value).toFixed(digits)}${unit}`
}

function formatLight(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "--"
  return `${Number(value).toLocaleString("zh-CN")} lux`
}

function formatTime(value: string | null | undefined) {
  if (!value) return "--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
}

function healthScore(data: HomeRealtimeData | null) {
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

function plantContextText(plant: Plant, realtime: HomeRealtimeData | null) {
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

function IntroScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <motion.main className="intro-screen" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.28 }}>
      <div className="intro-visual">
        <div className="orbital-ring ring-one" />
        <div className="orbital-ring ring-two" />
        <motion.div className="living-plant" animate={{ y: [0, -8, 0], rotate: [-1, 1, -1] }} transition={{ duration: 5, repeat: Infinity }}>
          <span className="leaf leaf-a" />
          <span className="leaf leaf-b" />
          <span className="leaf leaf-c" />
          <span className="stem" />
          <span className="pot" />
        </motion.div>
        <div className="signal-chip chip-a">温湿光同步</div>
        <div className="signal-chip chip-b">AI 养护推理</div>
      </div>

      <section className="intro-copy">
        <p className="eyebrow">PlantCloud Mobile</p>
        <h1>把植物状态，装进随身的智能温室。</h1>
        <p>
          移动端保留网页端的清新高级感，直接进入看首页、植物详情和 AI 问答，不再经过登录注册界面。
        </p>
        <button className="primary-action" onClick={onEnter}>
          进入植物云端
          <ArrowRight size={18} />
        </button>
      </section>
    </motion.main>
  )
}

function PlantPicker({ plants, selectedPlantId, onSelect }: { plants: Plant[]; selectedPlantId: number; onSelect: (id: number) => void }) {
  return (
    <div className="plant-strip">
      {plants.map((plant) => (
        <button
          className={`plant-pill ${plant.plantId === selectedPlantId ? "active" : ""}`}
          key={plant.plantId}
          onClick={() => onSelect(plant.plantId)}
        >
          <Sprout size={15} />
          {plant.plantName}
        </button>
      ))}
    </div>
  )
}

function TopBar({ plant, onRefresh, refreshing }: { plant: Plant; onRefresh: () => void; refreshing: boolean }) {
  return (
    <header className="top-bar">
      <div>
        <p>PlantCloud</p>
        <h2>{plant.plantName}</h2>
      </div>
      <button className="icon-button" onClick={onRefresh} aria-label="刷新">
        <RefreshCw size={18} className={refreshing ? "spin" : ""} />
      </button>
    </header>
  )
}

function MetricCard({ icon: Icon, label, value, hint }: { icon: typeof Thermometer; label: string; value: string; hint: string }) {
  return (
    <motion.article className="metric-card" whileTap={{ scale: 0.98 }}>
      <div className="metric-icon">
        <Icon size={18} />
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{hint}</span>
    </motion.article>
  )
}

function HomeScreen({
  plant,
  plants,
  selectedPlantId,
  realtime,
  loading,
  error,
  onSelectPlant,
  onRefresh,
  onGoDetail,
  onGoAi,
}: {
  plant: Plant
  plants: Plant[]
  selectedPlantId: number
  realtime: HomeRealtimeData | null
  loading: boolean
  error: string | null
  onSelectPlant: (id: number) => void
  onRefresh: () => void
  onGoDetail: () => void
  onGoAi: () => void
}) {
  const score = healthScore(realtime)
  const env = realtime?.environment

  return (
    <main className="screen">
      <TopBar plant={plant} onRefresh={onRefresh} refreshing={loading} />
      <PlantPicker plants={plants} selectedPlantId={selectedPlantId} onSelect={onSelectPlant} />

      <motion.section className="hero-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div className="hero-copy">
          <p>实时生命指数</p>
          <h1>{score}</h1>
          <span>{error ? "接口连接异常，正在展示最近可用视图" : "环境、设备和告警正在统一采样"}</span>
        </div>
        <div className="plant-stage">
          <div className="halo" />
          <motion.div className="living-plant mini" animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}>
            <span className="leaf leaf-a" />
            <span className="leaf leaf-b" />
            <span className="leaf leaf-c" />
            <span className="stem" />
            <span className="pot" />
          </motion.div>
        </div>
      </motion.section>

      <section className="metrics-grid">
        <MetricCard icon={Thermometer} label="温度" value={formatNumber(env?.temperature, "°C")} hint={env?.temperatureStatus || "舒适区间监测"} />
        <MetricCard icon={Wind} label="湿度" value={formatNumber(env?.humidity, "%")} hint={env?.humidityStatus || "叶面蒸腾参考"} />
        <MetricCard icon={Lightbulb} label="光照" value={formatLight(env?.lightLux)} hint={env?.lightStatus || "补光策略依据"} />
      </section>

      <section className="action-band">
        <button onClick={onGoDetail}>
          <Trees size={18} />
          植物详情
        </button>
        <button onClick={onGoAi}>
          <Bot size={18} />
          AI 问答
        </button>
      </section>

      <section className="status-card">
        <div>
          <p>设备联动</p>
          <h3>{realtime?.device.connected ? "设备在线" : "等待设备同步"}</h3>
        </div>
        <div className="device-states">
          <span className={realtime?.device.fanOn ? "on" : ""}>
            <Fan size={15} />
            风扇
          </span>
          <span className={realtime?.device.lightOn ? "on" : ""}>
            <Lightbulb size={15} />
            补光
          </span>
        </div>
      </section>
    </main>
  )
}

function DetailScreen({
  plant,
  realtime,
  analysis,
  loadingAnalysis,
  onAnalyze,
  onToggle,
}: {
  plant: Plant
  realtime: HomeRealtimeData | null
  analysis: PlantAiAnalysis | null
  loadingAnalysis: boolean
  onAnalyze: () => void
  onToggle: (target: "light" | "fan", next: boolean) => void
}) {
  const env = realtime?.environment
  const deviceId = realtime?.device.deviceId

  return (
    <main className="screen detail-screen">
      <section className="detail-header">
        <p>植物详情</p>
        <h1>{plant.plantName}</h1>
        <span>最近采集：{formatTime(env?.collectedAt)}</span>
      </section>

      <section className="detail-orbit">
        <div className="orbit-copy">
          <strong>{healthScore(realtime)}%</strong>
          <span>综合状态</span>
        </div>
        <div className="orbit-lines" />
      </section>

      <section className="control-card">
        <h3>即时控制</h3>
        <button disabled={!deviceId} onClick={() => onToggle("light", !realtime?.device.lightOn)}>
          <Lightbulb size={19} />
          <span>补光灯</span>
          <strong>{realtime?.device.lightOn ? "关闭" : "开启"}</strong>
        </button>
        <button disabled={!deviceId} onClick={() => onToggle("fan", !realtime?.device.fanOn)}>
          <Fan size={19} />
          <span>风扇</span>
          <strong>{realtime?.device.fanOn ? "关闭" : "开启"}</strong>
        </button>
      </section>

      <section className="analysis-card">
        <div className="section-title">
          <div>
            <p>AI 风险分析</p>
            <h3>{analysis?.riskLevel ? `风险等级 ${analysis.riskLevel}` : "养护洞察"}</h3>
          </div>
          <button className="tiny-button" onClick={onAnalyze} disabled={loadingAnalysis}>
            {loadingAnalysis ? "分析中" : "刷新"}
          </button>
        </div>
        <p className="analysis-summary">{analysis?.summary || "点击刷新，调用当前项目的植物分析接口生成养护建议。"}</p>
        <div className="advice-list">
          {(analysis?.advice.length ? analysis.advice : ["保持稳定通风，观察叶片和土壤状态。"]).map((item) => (
            <span key={item}>
              <Sparkles size={14} />
              {item}
            </span>
          ))}
        </div>
        {analysis?.riskWarnings.length ? (
          <div className="warning-list">
            {analysis.riskWarnings.map((item) => (
              <span key={item}>
                <AlertTriangle size={14} />
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}

function AiScreen({ plant, realtime }: { plant: Plant; realtime: HomeRealtimeData | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "你好，我是 PlantCloud 养护助手。你可以直接问当前植物的光照、湿度、异常和养护策略。",
      time: "现在",
    },
  ])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)

  const send = useCallback(
    async (preset?: string) => {
      const content = (preset ?? input).trim()
      if (!content || sending) return
      impact()
      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content, time: "现在" }
      setMessages((items) => [...items, userMessage])
      setInput("")
      setSending(true)
      try {
        const history = messages.slice(-8).map((item) => ({ role: item.role, content: item.content }))
        const result = await askPlantAi(content, plantContextText(plant, realtime), history)
        setMessages((items) => [
          ...items,
          { id: crypto.randomUUID(), role: "assistant", content: result.answer, sources: result.sources, time: "刚刚" },
        ])
      } catch (error) {
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: error instanceof Error ? error.message : "AI 服务连接失败，请检查 VITE_WEB_API_BASE_URL 是否指向网页端服务。",
            time: "刚刚",
          },
        ])
      } finally {
        setSending(false)
      }
    },
    [input, messages, plant, realtime, sending],
  )

  return (
    <main className="screen ai-screen">
      <section className="ai-header">
        <Bot size={22} />
        <div>
          <p>AI 问答</p>
          <h1>{plant.plantName} 的随身养护专家</h1>
        </div>
      </section>

      <div className="quick-row">
        {quickQuestions.map((question) => (
          <button key={question} onClick={() => send(question)}>
            {question}
          </button>
        ))}
      </div>

      <section className="chat-list">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.article
              key={message.id}
              className={`chat-bubble ${message.role}`}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="avatar">{message.role === "assistant" ? <Bot size={15} /> : <UserRound size={15} />}</span>
              <div>
                <p>{message.content}</p>
                {message.sources?.length ? (
                  <div className="sources">
                    {message.sources.slice(0, 3).map((source) => (
                      <em key={`${source.file}-${source.section || ""}`}>{source.file}</em>
                    ))}
                  </div>
                ) : null}
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
        {sending ? <div className="typing">AI 正在结合实时环境推理...</div> : null}
      </section>

      <form
        className="chat-input"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="问问当前植物怎么养..." />
        <button disabled={!input.trim() || sending}>
          <Send size={17} />
        </button>
      </form>
    </main>
  )
}

function TabBar({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  const tabs = [
    { id: "home" as Screen, label: "首页", icon: Home },
    { id: "detail" as Screen, label: "详情", icon: Leaf },
    { id: "ai" as Screen, label: "AI", icon: MessageCircle },
  ]

  return (
    <nav className="tab-bar">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = screen === tab.id
        return (
          <button
            key={tab.id}
            className={active ? "active" : ""}
            onClick={() => {
              impact()
              onChange(tab.id)
            }}
          >
            <Icon size={19} />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => (localStorage.getItem("plantcloud_mobile_seen_intro") ? "home" : "intro"))
  const [plants, setPlants] = useState<Plant[]>(fallbackPlants)
  const [selectedPlantId, setSelectedPlantId] = useState(() => Number(localStorage.getItem("plantcloud_selected_mobile_plant") || import.meta.env.VITE_DEFAULT_PLANT_ID || 1))
  const [realtime, setRealtime] = useState<HomeRealtimeData | null>(null)
  const [analysis, setAnalysis] = useState<PlantAiAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plant = useMemo(() => plants.find((item) => item.plantId === selectedPlantId) || plants[0] || fallbackPlants[0], [plants, selectedPlantId])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getHomeRealtime(plant.plantId)
      setRealtime(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "实时数据获取失败")
    } finally {
      setLoading(false)
    }
  }, [plant.plantId])

  const refreshAnalysis = useCallback(async () => {
    setLoadingAnalysis(true)
    try {
      setAnalysis(await getPlantAiAnalysis(plant.plantId))
    } finally {
      setLoadingAnalysis(false)
    }
  }, [plant.plantId])

  useEffect(() => {
    getPlants()
      .then((items) => {
        if (Array.isArray(items) && items.length) setPlants(items)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 8000)
    return () => window.clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    setAnalysis(null)
  }, [plant.plantId])

  const selectPlant = (id: number) => {
    impact()
    setSelectedPlantId(id)
    localStorage.setItem("plantcloud_selected_mobile_plant", String(id))
  }

  const toggleDevice = async (target: "light" | "fan", next: boolean) => {
    if (!realtime?.device.deviceId) return
    impact(ImpactStyle.Medium)
    await controlHomeDevice(plant.plantId, realtime.device.deviceId, target, next)
    await refresh()
  }

  return (
    <div className="app-shell">
      <AnimatePresence mode="wait">
        {screen === "intro" ? (
          <IntroScreen
            key="intro"
            onEnter={() => {
              impact(ImpactStyle.Medium)
              localStorage.setItem("plantcloud_mobile_seen_intro", "1")
              setScreen("home")
            }}
          />
        ) : (
          <motion.div key={screen} className="content-shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {screen === "home" ? (
              <HomeScreen
                plant={plant}
                plants={plants}
                selectedPlantId={selectedPlantId}
                realtime={realtime}
                loading={loading}
                error={error}
                onSelectPlant={selectPlant}
                onRefresh={refresh}
                onGoDetail={() => setScreen("detail")}
                onGoAi={() => setScreen("ai")}
              />
            ) : null}
            {screen === "detail" ? (
              <DetailScreen
                plant={plant}
                realtime={realtime}
                analysis={analysis}
                loadingAnalysis={loadingAnalysis}
                onAnalyze={refreshAnalysis}
                onToggle={toggleDevice}
              />
            ) : null}
            {screen === "ai" ? <AiScreen plant={plant} realtime={realtime} /> : null}
            <TabBar screen={screen} onChange={setScreen} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
