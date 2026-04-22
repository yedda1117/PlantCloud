"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bot,
  CalendarDays,
  Home,
  Leaf,
  Settings,
  Sprout,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePlantSelection } from "@/context/plant-selection"

const HIDDEN_NAV_PATHS = ["/login", "/register", "/"]
const PLANT_SELECTOR_PATHS = ["/home", "/calendar", "/chat", "/settings"]

const navItems = [
  { href: "/home",      label: "主页",     icon: Home },
  { href: "/dashboard", label: "植物总览", icon: Sprout },
  { href: "/chat",      label: "AI 问答",  icon: Bot },
  { href: "/calendar",  label: "生长日历", icon: CalendarDays },
  { href: "/settings",  label: "系统设置", icon: Settings },
]

type TooltipState = { label: string; x: number; y: number } | null

export function GlobalNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { selectedPlantId, setSelectedPlantId, plants, setPlants } = usePlantSelection()

  const [logoutOpen, setLogoutOpen] = useState(false)
  const [plantDrawerOpen, setPlantDrawerOpen] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const plantDrawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (HIDDEN_NAV_PATHS.includes(pathname)) return
    const fetchPlants = async () => {
      try {
        const token = window.localStorage.getItem("plantcloud_token")
        const res = await fetch("/api/plants", {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        })
        const result = await res.json()
        if (Array.isArray(result)) setPlants(result)
        else if (Array.isArray(result?.data)) setPlants(result.data)
      } catch {}
    }
    fetchPlants()
  }, [pathname, setPlants])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setLogoutOpen(false)
      }
    }
    if (logoutOpen) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [logoutOpen])

  if (HIDDEN_NAV_PATHS.includes(pathname)) return null

  const showPlantSelector = PLANT_SELECTOR_PATHS.some((p) => pathname.startsWith(p))
  const currentPlantObj = plants.find((p) => p.id === selectedPlantId)

  const handleLogout = () => {
    window.localStorage.removeItem("plantcloud_token")
    window.localStorage.removeItem("plantcloud_user")
    router.push("/login")
  }

  return (
    <>
      {/* 跟随鼠标的 tooltip */}
      {tooltip && (
        <div
          className="fixed z-[9999] pointer-events-none rounded-lg bg-black/10 px-2.5 py-1 text-xs font-medium text-green-900 backdrop-blur-sm"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          {tooltip.label}
        </div>
      )}

      <aside className="fixed left-3 top-1/2 -translate-y-1/2 z-50 flex w-16 flex-col items-center rounded-2xl border border-green-100 bg-white shadow-md shadow-green-50 py-5 gap-0"
        style={{ height: "75vh" }}
      >
        {/* 顶部：植物抽屉按钮 */}
        <div
          ref={plantDrawerRef}
          className="relative w-full flex justify-center px-2 mb-3"
          onMouseEnter={() => showPlantSelector && setPlantDrawerOpen(true)}
          onMouseLeave={() => setPlantDrawerOpen(false)}
        >
          <button
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
            onMouseMove={(e) => setTooltip({ label: currentPlantObj ? `${currentPlantObj.emoji} ${currentPlantObj.name}` : "选择植物", x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setTooltip(null)}
          >
            <Leaf className="h-6 w-6" />
          </button>

          {/* 向右弹出的植物列表浮窗 */}
          {plantDrawerOpen && showPlantSelector && (
            <div className="absolute left-full top-0 ml-3 z-50 min-w-[140px] rounded-xl border border-green-100 bg-white/80 backdrop-blur-md shadow-lg shadow-green-50 py-2 flex flex-col">
              <p className="px-3 pb-1.5 text-[10px] font-semibold text-green-600 uppercase tracking-wide">选择植物</p>
              {plants.length > 0 ? plants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPlantId(p.id); setPlantDrawerOpen(false) }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left",
                    p.id === selectedPlantId
                      ? "bg-green-50 text-green-700 font-medium"
                      : "text-gray-600 hover:bg-green-50 hover:text-green-700"
                  )}
                >
                  <span>{p.emoji}</span>
                  <span>{p.name}</span>
                </button>
              )) : (
                <p className="px-3 py-1.5 text-xs text-gray-400">暂无植物</p>
              )}
            </div>
          )}
        </div>

        <div className="w-8 h-px bg-green-100 mb-3" />

        {/* 导航项，flex-1 居中 */}
        <nav className="flex flex-1 flex-col items-center justify-center gap-6 w-full px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all",
                  isActive ? "text-green-600" : "text-gray-400 hover:text-green-500"
                )}
                onMouseMove={(e) => { setTooltip({ label, x: e.clientX, y: e.clientY }) }}
                onMouseLeave={() => setTooltip(null)}
              >
                <Icon className="h-6 w-6" />
                {isActive && (
                  <span className="absolute -right-3 top-2 bottom-2 w-1 rounded-full bg-green-500" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="w-8 h-px bg-green-100 mt-3 mb-3" />

        {/* 底部：用户头像 */}
        <div className="relative flex flex-col items-center px-2" ref={popoverRef}>
          <button
            onClick={() => setLogoutOpen((o) => !o)}
            onMouseMove={(e) => setTooltip({ label: "用户", x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setTooltip(null)}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
          >
            <User className="h-6 w-6" />
          </button>

          {logoutOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-40 rounded-xl border border-green-100 bg-white shadow-lg shadow-green-50 p-3 flex flex-col gap-2">
              <p className="text-xs text-gray-500 leading-snug">确认退出登录？</p>
              <div className="flex gap-2">
                <button
                  onClick={handleLogout}
                  className="flex-1 rounded-lg bg-green-500 py-1.5 text-xs font-medium text-white hover:bg-green-600 transition-colors"
                >
                  退出
                </button>
                <button
                  onClick={() => setLogoutOpen(false)}
                  className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
