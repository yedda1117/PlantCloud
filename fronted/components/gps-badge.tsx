"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MapPin, Leaf } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"

// ─── Mock 数据（后端接口完成后替换） ────────────────────────────────────────────
const mockGpsData = {
  plantName: "绿萝",
  address: "重庆市两江新区总部基地B1",
  lat: 29.631,  // 纬度（重庆两江新区）
  lng: 106.551, // 经度
}

// ─── 数据类型 ────────────────────────────────────────────────────────────────
interface GpsData {
  plantName: string
  address: string
  lat: number
  lng: number
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

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export function GpsBadge() {
  const [gpsData, setGpsData] = useState<GpsData>(mockGpsData)
  const [showPopover, setShowPopover] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // 用 timer ref 防止鼠标在触发区与 popover 之间短暂离开时闪烁
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── 数据获取逻辑（useEffect） ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const fetchGpsData = async () => {
      // ── 后端接口对接时取消下方注释 ──────────────────────────────────────
      // try {
      //   const token = window.localStorage.getItem("plantcloud_token") || ""
      //   const res = await fetch("http://localhost:8080/api/gps", {
      //     headers: { Authorization: `Bearer ${token}` },
      //   })
      //   if (!res.ok) throw new Error("GPS 接口请求失败")
      //   const data: GpsData = await res.json()
      //   if (!cancelled) setGpsData(data)
      // } catch (err) {
      //   console.error("GPS 数据获取失败:", err)
      // }
      // ── 目前使用 mock 数据 ────────────────────────────────────────────────
      if (!cancelled) setGpsData(mockGpsData)
    }

    void fetchGpsData()
    return () => { cancelled = true }
  }, [])

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
            {gpsData.plantName}
          </span>
          <span className="text-[11px] text-muted-foreground">
            当前位置：{gpsData.address}
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

            {/* 地址文字 */}
            <p className="text-xs text-muted-foreground mb-2 px-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary shrink-0" />
              {gpsData.address}
            </p>

            {/* 地图 */}
            <GpsMap lat={gpsData.lat} lng={gpsData.lng} plantName={gpsData.plantName} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
