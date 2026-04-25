import type { CSSProperties } from "react"
import { motion } from "framer-motion"
import { Droplets, Fan, Lightbulb, Loader2, RefreshCw, Sprout, SunMedium, Thermometer } from "lucide-react"
import { VoiceAssistantOrb } from "../components/VoiceAssistantOrb"
import type { VoiceAssistantState } from "../hooks/useVoiceAssistant"
import { PlantModelViewer } from "../components/PlantModelViewer"
import type { AlertItem, HomeRealtimeData, Plant } from "../types"

function isUnresolvedTiltLog(log: AlertItem) {
  return (log.alertType || "").toUpperCase() === "TILT_ABNORMAL" && (log.status || "UNRESOLVED").toUpperCase() === "UNRESOLVED"
}

function getModelPath(realtime: HomeRealtimeData | null) {
  const activityLogs = realtime?.activityLogs ?? []
  const hasUnresolvedTilt = activityLogs.some(isUnresolvedTiltLog)
  if (hasUnresolvedTilt) return "/models/qingxie.glb"

  const humidityStatus = (realtime?.environment.humidityStatus || "").toUpperCase()
  const lightStatus = (realtime?.environment.lightStatus || "").toUpperCase()
  const temperatureStatus = (realtime?.environment.temperatureStatus || "").toUpperCase()
  const hasEnvironmentStress = humidityStatus === "LOW" || lightStatus === "HIGH" || temperatureStatus === "HIGH"

  return hasEnvironmentStress ? "/models/kuwei.glb" : "/models/zhizihua.glb"
}

function formatValue(value: number | null | undefined, unit: string, digits = 1) {
  if (value === null || value === undefined) return "--"
  return `${value.toFixed(digits)}${unit}`
}

function formatLight(value: number | null | undefined) {
  if (value === null || value === undefined) return "--"
  return `${value.toLocaleString()} lux`
}

function toChineseStatus(status: string | null | undefined) {
  switch ((status || "").toUpperCase()) {
    case "NORMAL":
      return "正常"
    case "LOW":
      return "偏低"
    case "HIGH":
      return "偏高"
    default:
      return "同步中"
  }
}

function clampProgress(value: number | null | undefined, min: number, max: number) {
  if (value === null || value === undefined) return 0.18
  if (max <= min) return 0
  const ratio = (value - min) / (max - min)
  return Math.max(0, Math.min(1, ratio))
}

function getPlantSubtitle(plant: Plant) {
  if (plant.species && plant.species.trim()) return plant.species.trim()
  if (plant.plantName.includes("蝴蝶兰")) return "Phalaenopsis"
  return "Smart Plant Profile"
}

function PlantPicker({
  plants,
  selectedPlantId,
  onSelect,
}: {
  plants: Plant[]
  selectedPlantId: number
  onSelect: (id: number) => void
}) {
  return (
    <div className="compact-plant-strip">
      {plants.map((item) => (
        <button
          key={item.plantId}
          className={`compact-plant-pill ${item.plantId === selectedPlantId ? "active" : ""}`}
          onClick={() => onSelect(item.plantId)}
        >
          <Sprout size={14} />
          <span>{item.plantName}</span>
        </button>
      ))}
    </div>
  )
}

function DeviceMiniCard({
  icon: Icon,
  label,
  active,
  pending,
  disabled,
  onClick,
}: {
  icon: typeof Fan
  label: string
  active: boolean
  pending: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={`compact-device-mini ${active ? "active" : ""}`} disabled={disabled} onClick={onClick}>
      <span className="compact-device-mini-head">
        <Icon size={16} className={label === "风扇" && active ? "spin" : ""} />
        <strong>{label}</strong>
      </span>
      <span className="compact-device-mini-foot">
        <em>{pending ? "切换中" : active ? "已开启" : "已关闭"}</em>
        <i className={`compact-mini-toggle ${active ? "active" : ""}`}>{pending ? <Loader2 size={10} className="spin" /> : null}</i>
      </span>
    </button>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  status,
  progress,
  accentClass,
}: {
  icon: typeof Thermometer
  label: string
  value: string
  status: string
  progress: number
  accentClass: string
}) {
  const ringStyle = { "--progress": `${Math.round(progress * 360)}deg` } as CSSProperties

  return (
    <article className={`compact-metric-card compact-metric-card-rich ${accentClass}`}>
      <div className="compact-metric-card-head">
        <div>
          <p>{label}</p>
          <strong>{value}</strong>
          <span>{status}</span>
        </div>
        <div className="compact-progress-ring" style={ringStyle}>
          <div className="compact-progress-ring-core">
            <Icon size={18} />
          </div>
        </div>
      </div>
    </article>
  )
}

export function HomePage({
  plant,
  plants,
  selectedPlantId,
  realtime,
  loading,
  onSelectPlant,
  onRefresh,
  onToggleDevice,
  controlLoadingTarget,
  voiceAssistant,
}: {
  plant: Plant
  plants: Plant[]
  selectedPlantId: number
  realtime: HomeRealtimeData | null
  loading: boolean
  onSelectPlant: (id: number) => void
  onRefresh: () => void
  onToggleDevice: (target: "light" | "fan", next: boolean) => void
  controlLoadingTarget: "light" | "fan" | null
  voiceAssistant: {
    state: VoiceAssistantState
    lastHeard: string
    liveTranscript: string
  }
}) {
  const modelPath = getModelPath(realtime)
  const fanOn = realtime?.device.fanOn === true
  const lightOn = realtime?.device.lightOn === true
  const controlDisabled = !realtime?.device.deviceId || realtime?.device.connected !== true
  const subtitle = getPlantSubtitle(plant)

  const temperatureProgress = clampProgress(realtime?.environment.temperature, 0, 40)
  const humidityProgress = clampProgress(realtime?.environment.humidity, 0, 100)
  const lightProgress = clampProgress(realtime?.environment.lightLux, 0, 1200)

  return (
    <main className="screen compact-home-screen">
      <section className="compact-brand-bar">
        <div className="compact-brand-copy">
          <span className="compact-brand-kicker">PLANTCLOUD</span>
          <strong>植物状态中心</strong>
        </div>
        <button className="compact-brand-refresh" onClick={onRefresh} aria-label="刷新">
          <RefreshCw size={18} className={loading ? "spin" : ""} />
        </button>
      </section>

      <PlantPicker plants={plants} selectedPlantId={selectedPlantId} onSelect={onSelectPlant} />

      <section className="compact-env-grid">
        <MetricCard
          icon={Thermometer}
          label="温度"
          value={formatValue(realtime?.environment.temperature, "°C")}
          status={toChineseStatus(realtime?.environment.temperatureStatus)}
          progress={temperatureProgress}
          accentClass="temperature"
        />
        <MetricCard
          icon={Droplets}
          label="湿度"
          value={formatValue(realtime?.environment.humidity, "%", 0)}
          status={toChineseStatus(realtime?.environment.humidityStatus)}
          progress={humidityProgress}
          accentClass="humidity"
        />
        <MetricCard
          icon={SunMedium}
          label="光照"
          value={formatLight(realtime?.environment.lightLux)}
          status={toChineseStatus(realtime?.environment.lightStatus)}
          progress={lightProgress}
          accentClass="light"
        />
      </section>

      <motion.section className="compact-model-card compact-model-card-tight" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="compact-model-stage">
          <div className="compact-model-voice-anchor">
            <VoiceAssistantOrb state={voiceAssistant.state} liveTranscript={voiceAssistant.liveTranscript} lastHeard={voiceAssistant.lastHeard} />
          </div>
          <div className="compact-model-label">
            <strong>{plant.plantName}</strong>
            <span>{subtitle}</span>
          </div>
          <PlantModelViewer modelPath={modelPath} />
        </div>
      </motion.section>

      <section className="compact-device-row">
        <DeviceMiniCard
          icon={Fan}
          label="风扇"
          active={fanOn}
          pending={controlLoadingTarget === "fan"}
          disabled={controlDisabled || controlLoadingTarget === "fan" || controlLoadingTarget === "light"}
          onClick={() => onToggleDevice("fan", !fanOn)}
        />
        <DeviceMiniCard
          icon={Lightbulb}
          label="灯光"
          active={lightOn}
          pending={controlLoadingTarget === "light"}
          disabled={controlDisabled || controlLoadingTarget === "fan" || controlLoadingTarget === "light"}
          onClick={() => onToggleDevice("light", !lightOn)}
        />
      </section>
    </main>
  )
}
