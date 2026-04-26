"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MapPin, Leaf } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import { usePlantSelection } from "@/context/plant-selection"
import { BACKEND_BASE_URL } from "@/lib/backend-base-url"

type ApiResult<T> = {
  code?: number
  message?: string
  data?: T
}

type GpsLocation = {
  id: number | string
  plantId: number | string
  deviceId: number | string | null
  longitude: number | string | null
  latitude: number | string | null
  createdAt: string | null
}

type GpsState = {
  latest: GpsLocation | null
  loading: boolean
  error: boolean
}

// ─── 懒加载地图（避免 SSR 报错） ─────────────────────────────────────────────
const GpsMap = dynamic(() => import("@/components/gps-map"), {
  ssr: false,
  loading: () => (
    <div className="w-[300px] h-[200px] flex items-center justify-center bg-muted/50 rounded-lg text-xs text-muted-foreground">
      地图加载中…
    </div>
  ),
})

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatCoordinate(value: number | string | null | undefined) {
  const parsed = toNumber(value)
  return parsed === null ? "--" : parsed.toFixed(6)
}

function formatLocationTime(value: string | null | undefined) {
  if (!value) return "--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function getLatestLocation(locations: GpsLocation[]) {
  if (!locations.length) return null
  return [...locations].sort((a, b) => {
    const left = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const right = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return right - left
  })[0] ?? null
}

async function fetchGpsLocations(plantId: number, token: string) {
  const headers: HeadersInit = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${BACKEND_BASE_URL}/gps/locations?plantId=${encodeURIComponent(String(plantId))}`, {
    cache: "no-store",
    headers,
  })

  let payload: ApiResult<GpsLocation[]> | null = null
  try {
    payload = (await response.json()) as ApiResult<GpsLocation[]>
  } catch {
    payload = null
  }

  if (!response.ok || (payload && typeof payload.code === "number" && payload.code !== 0)) {
    throw new Error(payload?.message || "定位获取失败")
  }

  return Array.isArray(payload?.data) ? payload.data : []
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export function GpsBadge() {
  const { currentPlant } = usePlantSelection()
  const [gpsState, setGpsState] = useState<GpsState>({
    latest: null,
    loading: true,
    error: false,
  })
  const [showPopover, setShowPopover] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // 用 timer ref 防止鼠标在触发区与 popover 之间短暂离开时闪烁
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const latest = gpsState.latest
  const latitude = toNumber(latest?.latitude)
  const longitude = toNumber(latest?.longitude)
  const hasLocation = latest !== null && latitude !== null && longitude !== null
  const summaryText = gpsState.error
    ? "定位获取失败"
    : gpsState.loading
      ? "定位加载中"
      : hasLocation
        ? `经度 ${formatCoordinate(longitude)}`
        : "暂无定位数据"

  // ── 数据获取逻辑（useEffect） ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const loadGpsData = async () => {
      try {
        setGpsState((prev) => ({ ...prev, loading: true, error: false }))
        const token = window.localStorage.getItem("plantcloud_token") || ""
        const locations = await fetchGpsLocations(currentPlant.plantId, token)
        if (!cancelled) {
          setGpsState({
            latest: getLatestLocation(locations),
            loading: false,
            error: false,
          })
        }
      } catch (error) {
        console.error("定位获取失败:", error)
        if (!cancelled) {
          setGpsState({
            latest: null,
            loading: false,
            error: true,
          })
        }
      }
    }

    void loadGpsData()
    return () => { cancelled = true }
  }, [currentPlant.plantId])

  // ── 点击外部关闭 Popover ──────────────────────────────────────────────────
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setShowPopover(false)
    }
  }, [])

  useEffect(() => {
    if (showPopover) {
      document.addEventListener("mousedown", handleClickOutside)
    } else {
      document.removeEventListener("mousedown", handleClickOutside)
    }
    return () => { document.removeEventListener("mousedown", handleClickOutside) }
  }, [showPopover, handleClickOutside])

  // ── 防抖 hover 处理（避免鼠标在触发区↔popover 间移动时闪烁） ──────────────
  const handleMouseEnter = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setShowPopover(true)
  }

  const handleMouseLeave = () => {
    hideTimerRef.current = setTimeout(() => setShowPopover(false), 120)
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── GPS 触发区（整个模块都可感应） ──────────────────────────────────── */}
      <button
        type="button"
        className="flex items-center gap-2 cursor-pointer select-none rounded-xl px-3 py-2
                   bg-primary/8 hover:bg-primary/15 active:bg-primary/20
                   border border-primary/20 transition-colors duration-150
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label="查看植物 GPS 位置"
        aria-expanded={showPopover}
        onClick={() => setShowPopover((v) => !v)}
      >
        <MapPin className="h-4 w-4 text-primary shrink-0" />
        <div className="flex flex-col leading-tight text-left">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1">
            <Leaf className="h-3 w-3 text-primary" />
            {currentPlant.name}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {summaryText}
          </span>
        </div>
      </button>

      {/* ── 气泡 Popover（Framer Motion 淡入 + 上移） ────────────────────── */}
      <AnimatePresence>
        {showPopover && (
          <motion.div
            key="gps-popover"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 top-full mt-3 z-50 w-[320px] bg-background border border-border/60 rounded-[12px] p-3"
            style={{
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.07)",
            }}
          >
            {/* 气泡尖角 —— 指向触发区中心 */}
            <span
              aria-hidden
              className="absolute -top-[7px] right-6 w-3 h-3 bg-background border-l border-t border-border/60 rotate-45"
            />

            {gpsState.error ? (
              <p className="text-sm text-destructive">定位获取失败</p>
            ) : !hasLocation ? (
              <p className="text-sm text-muted-foreground">暂无定位数据</p>
            ) : (
              <>
                <div className="mb-3 space-y-1.5 px-0.5 text-xs">
                  <p className="flex items-center gap-1 font-medium text-foreground">
                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                    最新定位
                  </p>
                  <p className="text-muted-foreground">经度：{formatCoordinate(longitude)}</p>
                  <p className="text-muted-foreground">纬度：{formatCoordinate(latitude)}</p>
                  <p className="text-muted-foreground">更新时间：{formatLocationTime(latest.createdAt)}</p>
                </div>

                {/* 地图：沿用现有已预留组件 */}
                <GpsMap lat={latitude} lng={longitude} plantName={currentPlant.name} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
