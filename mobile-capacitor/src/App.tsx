import { useCallback, useEffect, useMemo, useState } from "react"
import { ImpactStyle } from "@capacitor/haptics"
import { AnimatePresence, motion } from "framer-motion"
import { CalendarDays, Home, Leaf, MessageCircle } from "lucide-react"
import { controlHomeDevice, getHomeRealtime, getPlantAiAnalysis, getPlants } from "./api"
import { AiPage } from "./pages/AiPage"
import { CalendarPage } from "./pages/CalendarPage"
import { DetailPage } from "./pages/DetailPage"
import { HomePage } from "./pages/HomePage"
import { IntroPage } from "./pages/IntroPage"
import type { HomeRealtimeData, Plant, PlantAiAnalysis } from "./types"
import { fallbackPlants, impact } from "./mobile-utils"

type Screen = "intro" | "home" | "detail" | "calendar" | "ai"

function TabBar({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  const tabs = [
    { id: "home" as Screen, label: "首页", icon: Home },
    { id: "detail" as Screen, label: "详情", icon: Leaf },
    { id: "calendar" as Screen, label: "日历", icon: CalendarDays },
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
          <IntroPage
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
              <HomePage
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
              <DetailPage plant={plant} realtime={realtime} analysis={analysis} loadingAnalysis={loadingAnalysis} onAnalyze={refreshAnalysis} onToggle={toggleDevice} />
            ) : null}
            {screen === "calendar" ? <CalendarPage plant={plant} /> : null}
            {screen === "ai" ? <AiPage plant={plant} realtime={realtime} /> : null}
            <TabBar screen={screen} onChange={setScreen} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

