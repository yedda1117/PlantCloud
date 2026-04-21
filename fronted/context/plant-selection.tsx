"use client"

/**
 * PlantSelectionContext
 * 全局植物选择状态，通过 Context 在所有页面间共享。
 * 增加了 setPlants 方法，支持从 GlobalNavbar 等组件动态更新列表。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  DEFAULT_PLANT_ID,
  SELECTED_PLANT_STORAGE_KEY,
} from "@/lib/plants"
import { SELECTED_PLANT_PROFILE_STORAGE_KEY } from "@/lib/plant-context"

// ─── 类型 ─────────────────────────────────────────────────────────────────────

/** 前端统一使用的植物选项 */
export type PlantOption = {
  /** 前端 key，格式 "p{plantId}" */
  id: string
  plantId: number
  name: string
  status?: "ACTIVE" | "INACTIVE" | "DELETED"
  /** emoji 根据 plantId 循环取 */
  emoji: string
}

export type PlantSelectionState = {
  selectedPlantId: string
  currentPlant: PlantOption
  plants: PlantOption[]
  setSelectedPlantId: (id: string) => void
  setPlants: (plants: any[]) => void // 暴露设置接口的方法
}

// ─── emoji 池（循环使用） ──────────────────────────────────────────────────────
const EMOJI_POOL = ["🌿", "🪴", "🍃", "🌱", "🌸", "🌻", "🌺", "🌼", "🌾", "🍀"]

// 将后端返回的原始数据转换为前端 PlantOption 格式
function formatPlantData(data: any[]): PlantOption[] {
  // 确保 data 是数组，否则返回空数组
  if (!Array.isArray(data)) return [];

  return data.map((item: any) => ({
    // 这里的字段名必须严格对应 Swagger 返回的 plantId 和 plantName
    id: `p${item.plantId}`, 
    plantId: item.plantId,
    name: item.plantName,
    status: item.status,
    emoji: EMOJI_POOL[(item.plantId - 1) % EMOJI_POOL.length],
  }))
}

// ─── 静态 fallback ──────────────────────────────────────────────────────────
const FALLBACK_PLANTS: PlantOption[] = [
  { id: "p1", plantId: 1, name: "薄荷",   emoji: "🌿" },
  { id: "p2", plantId: 2, name: "多肉",   emoji: "🪴" },
  { id: "p3", plantId: 3, name: "绿萝",   emoji: "🍃" },
]

function findPlant(plants: PlantOption[], id: string): PlantOption {
  return plants.find((p) => p.id === id) ?? plants[0] ?? FALLBACK_PLANTS[0]
}

// ─── Context ──────────────────────────────────────────────────────────────────
const PlantSelectionContext = createContext<PlantSelectionState | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function PlantSelectionProvider({ children }: { children: ReactNode }) {
  const [plants, setPlantsState] = useState<PlantOption[]>(FALLBACK_PLANTS)
  const [selectedPlantId, setSelectedPlantIdState] = useState<string>(DEFAULT_PLANT_ID)

  // 暴露给外部（如 GlobalNavbar）的更新方法
  const setPlants = useCallback((rawData: any[]) => {
    if (!Array.isArray(rawData)) return
    const formatted = formatPlantData(rawData)
    setPlantsState(formatted)

    // 检查当前选中的 ID 是否还在新列表中，不在则重置
    setSelectedPlantIdState((prev) => {
      const exists = formatted.some((p) => p.id === prev)
      return exists ? prev : (formatted[0]?.id || DEFAULT_PLANT_ID)
    })
  }, [])

  // 初始化：从 localStorage 读取上次选择
  useEffect(() => {
    const stored = window.localStorage.getItem(SELECTED_PLANT_STORAGE_KEY)
    if (stored) {
      setSelectedPlantIdState(stored)
    }
  }, [])

  const currentPlant = findPlant(plants, selectedPlantId)

  // 切换植物
  const setSelectedPlantId = useCallback((id: string) => {
    setSelectedPlantIdState(id)
    window.localStorage.setItem(SELECTED_PLANT_STORAGE_KEY, id)
  }, [])

  // 同步 profile 到 localStorage，供其他非 Hook 逻辑使用
  useEffect(() => {
    if (currentPlant) {
      window.localStorage.setItem(
        SELECTED_PLANT_PROFILE_STORAGE_KEY,
        JSON.stringify(currentPlant)
      )
    }
  }, [currentPlant])

  return (
    <PlantSelectionContext.Provider
      value={{ 
        selectedPlantId, 
        currentPlant, 
        plants, 
        setSelectedPlantId, 
        setPlants // 现在 Navbar 可以调用此方法
      }}
    >
      {children}
    </PlantSelectionContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePlantSelection(): PlantSelectionState {
  const ctx = useContext(PlantSelectionContext)
  if (!ctx) {
    throw new Error("usePlantSelection must be used inside <PlantSelectionProvider>")
  }
  return ctx
}
