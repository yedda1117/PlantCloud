import { useCallback, useEffect, useMemo, useState } from "react"
import { ImpactStyle } from "@capacitor/haptics"
import { AnimatePresence, motion } from "framer-motion"
import { CalendarDays, Home, Leaf, MessageCircle } from "lucide-react"
import { controlHomeDevice, getHomeRealtime, getPlantAiAnalysis, getPlants, hasAuthSession } from "./api"
import { AiPage } from "./pages/AiPage"
import { CalendarPage } from "./pages/CalendarPage"
import { DetailPage } from "./pages/DetailPage"
import { HomePage } from "./pages/HomePage"
import { IntroPage } from "./pages/IntroPage"
import { LoginPage } from "./pages/LoginPage"
import { RegisterPage } from "./pages/RegisterPage"
import type { HomeRealtimeData, LoginResult, Plant, PlantAiAnalysis } from "./types"
import { fallbackPlants, impact } from "./mobile-utils"

type MainScreen = "home" | "detail" | "calendar" | "ai"
type Screen = "login" | "register" | "intro" | MainScreen

const DEVICE_OVERRIDE_STORAGE_KEY = "plantcloud_mobile_device_overrides"
const REALTIME_CACHE_STORAGE_KEY = "plantcloud_mobile_realtime_cache"

function initialScreen(): Screen {
  if (!hasAuthSession()) return "login"
  return "home"
}

function TabBar({ screen, onChange }: { screen: MainScreen; onChange: (screen: MainScreen) => void }) {
  const tabs = [
    { id: "home" as MainScreen, label: "首页", icon: Home },
    { id: "detail" as MainScreen, label: "详情", icon: Leaf },
    { id: "calendar" as MainScreen, label: "日历", icon: CalendarDays },
    { id: "ai" as MainScreen, label: "AI", icon: MessageCircle },
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
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [authenticated, setAuthenticated] = useState(hasAuthSession)
  const [plants, setPlants] = useState<Plant[]>(fallbackPlants)
  const [selectedPlantId, setSelectedPlantId] = useState(() => Number(localStorage.getItem("plantcloud_selected_mobile_plant") || import.meta.env.VITE_DEFAULT_PLANT_ID || 1))
  const [realtime, setRealtime] = useState<HomeRealtimeData | null>(null)
  const [analysis, setAnalysis] = useState<PlantAiAnalysis | null>(null)
  const [analysisLoadedPlantId, setAnalysisLoadedPlantId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [controlLoadingTarget, setControlLoadingTarget] = useState<"light" | "fan" | null>(null)
  const [, setError] = useState<string | null>(null)

  const plant = useMemo(() => plants.find((item) => item.plantId === selectedPlantId) || plants[0] || fallbackPlants[0], [plants, selectedPlantId])

  const refresh = useCallback(async () => {
    if (!authenticated) return
    setLoading(true)
    try {
      const data = await getHomeRealtime(plant.plantId)
      setRealtime(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "实时数据加载失败")
    } finally {
      setLoading(false)
    }
  }, [authenticated, plant.plantId])

  const refreshAnalysis = useCallback(async () => {
    if (!authenticated) return
    setLoadingAnalysis(true)
    try {
      setAnalysis(await getPlantAiAnalysis(plant.plantId))
      setAnalysisLoadedPlantId(plant.plantId)
    } catch (err) {
      setAnalysis({
        summary: err instanceof Error ? err.message : "养护洞察接口暂时不可用",
        advice: [],
        riskWarnings: [],
      })
      setAnalysisLoadedPlantId(plant.plantId)
    } finally {
      setLoadingAnalysis(false)
    }
  }, [authenticated, plant.plantId])

  useEffect(() => {
    if (!authenticated) return
    getPlants()
      .then((items) => {
        if (Array.isArray(items) && items.length) setPlants(items)
      })
      .catch(() => undefined)
  }, [authenticated])

  useEffect(() => {
    localStorage.removeItem(DEVICE_OVERRIDE_STORAGE_KEY)
    localStorage.removeItem(REALTIME_CACHE_STORAGE_KEY)
  }, [])

  useEffect(() => {
    if (!authenticated) return undefined
    void refresh()
    const timer = window.setInterval(() => void refresh(), 8000)
    return () => window.clearInterval(timer)
  }, [authenticated, refresh])

  useEffect(() => {
    setAnalysis(null)
    setAnalysisLoadedPlantId(null)
  }, [plant.plantId])

  useEffect(() => {
    if (screen === "detail" && !analysis && !loadingAnalysis && analysisLoadedPlantId !== plant.plantId) {
      void refreshAnalysis()
    }
  }, [analysis, analysisLoadedPlantId, loadingAnalysis, plant.plantId, refreshAnalysis, screen])

  const handleLoggedIn = useCallback((_session: LoginResult) => {
    setAuthenticated(true)
    setScreen("home")
  }, [])

  const selectPlant = (id: number) => {
    impact()
    setSelectedPlantId(id)
    localStorage.setItem("plantcloud_selected_mobile_plant", String(id))
  }

  const toggleDevice = async (target: "light" | "fan", next: boolean) => {
    if (!realtime?.device.deviceId) return
    impact(ImpactStyle.Medium)
    setControlLoadingTarget(target)
    try {
      await controlHomeDevice(plant.plantId, realtime.device.deviceId, target, next)
      await refresh()
      ;[800, 1800, 3200].forEach((delay) => {
        window.setTimeout(() => {
          void refresh()
        }, delay)
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "设备控制失败")
    } finally {
      setControlLoadingTarget(null)
    }
  }

  return (
    <div className="app-shell">
      <AnimatePresence mode="wait">
        {screen === "login" ? (
          <motion.div key="login" className="content-shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <LoginPage onLoggedIn={handleLoggedIn} onRegister={() => setScreen("register")} />
          </motion.div>
        ) : screen === "register" ? (
          <motion.div key="register" className="content-shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <RegisterPage onBackToLogin={() => setScreen("login")} onRegistered={() => setScreen("login")} />
          </motion.div>
        ) : screen === "intro" ? (
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
                onSelectPlant={selectPlant}
                onRefresh={refresh}
                onToggleDevice={toggleDevice}
                controlLoadingTarget={controlLoadingTarget}
              />
            ) : null}
            {screen === "detail" ? <DetailPage plant={plant} realtime={realtime} analysis={analysis} loadingAnalysis={loadingAnalysis} onAnalyze={refreshAnalysis} /> : null}
            {screen === "calendar" ? <CalendarPage plant={plant} /> : null}
            {screen === "ai" ? <AiPage plant={plant} realtime={realtime} /> : null}
            <TabBar screen={screen} onChange={setScreen} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
