import { motion } from "framer-motion"
import { Bot, Fan, Lightbulb, RefreshCw, Sprout, Thermometer, Trees, Wind } from "lucide-react"
import type { HomeRealtimeData, Plant } from "../types"
import { formatLight, formatNumber, healthScore } from "../mobile-utils"

function PlantPicker({ plants, selectedPlantId, onSelect }: { plants: Plant[]; selectedPlantId: number; onSelect: (id: number) => void }) {
  return (
    <div className="plant-strip">
      {plants.map((plant) => (
        <button className={`plant-pill ${plant.plantId === selectedPlantId ? "active" : ""}`} key={plant.plantId} onClick={() => onSelect(plant.plantId)}>
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

export function HomePage({
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

