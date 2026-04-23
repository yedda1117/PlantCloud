"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bot,
  CalendarDays,
  Home,
  Leaf,
  type LucideIcon,
  LogOut,
  Settings,
  Sprout,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePlantSelection } from "@/context/plant-selection"

const HIDDEN_NAV_PATHS = ["/login", "/register", "/"]
const PLANT_SELECTOR_PATHS = ["/home", "/calendar", "/chat", "/settings"]

type NavItem =
  | { href: string; label: string; icon: LucideIcon; type?: undefined }
  | { type: "logout"; label: string; icon: LucideIcon; href?: undefined }

const navItems: NavItem[] = [
  { href: "/home",      label: "主页",     icon: Home },
  { href: "/dashboard", label: "植物总览", icon: Sprout },
  { href: "/chat",      label: "AI 问答",  icon: Bot },
  { href: "/calendar",  label: "生长日历", icon: CalendarDays },
  { href: "/settings",  label: "系统设置", icon: Settings },
  { type: "logout",     label: "退出登录", icon: LogOut },
]

type TooltipState = { label: string; x: number; y: number } | null

export function GlobalNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { selectedPlantId, setSelectedPlantId, plants, setPlants } = usePlantSelection()

  const [plantDrawerOpen, setPlantDrawerOpen] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState>(null)
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
          className="fixed z-[9999] pointer-events-none rounded-lg bg-[#064e3b] px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          {tooltip.label}
        </div>
      )}

      <aside className="fixed left-1.5 top-0 z-50 flex w-16 flex-col items-start gap-0 bg-transparent py-5 pl-0.5"
        style={{ height: "100vh" }}
      >
        {/* 顶部：植物抽屉按钮 */}
        <div
          ref={plantDrawerRef}
          className="relative mb-3 flex w-full flex-col items-center px-0.5"
        >
          <button
            onClick={() => setPlantDrawerOpen(!plantDrawerOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white hover:text-green-300 active:scale-125 active:shadow-lg transition-all duration-200"
            onMouseMove={(e) => setTooltip({ label: currentPlantObj ? `${currentPlantObj.emoji} ${currentPlantObj.name}` : "选择植物", x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setTooltip(null)}
          >
            <Leaf className="h-6 w-6" />
          </button>

          {/* 选定植物名称显示 */}
          {currentPlantObj && (
            <p className="text-[10px] text-white mt-1 text-center leading-tight">
              {currentPlantObj.name}
            </p>
          )}

          {/* 向右弹出的植物列表浮窗 */}
          {plantDrawerOpen && showPlantSelector && (
            <div className="absolute left-full top-0 ml-3 z-50 min-w-[140px] rounded-xl border border-green-200 bg-white/90 backdrop-blur-md shadow-xl shadow-green-100 py-2 flex flex-col">
              <p className="px-3 pb-1.5 text-[10px] font-semibold text-green-700 uppercase tracking-wide">选择植物</p>
              {plants.length > 0 ? plants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPlantId(p.id); setPlantDrawerOpen(false) }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left",
                    p.id === selectedPlantId
                      ? "bg-green-100 text-green-800 font-medium"
                      : "text-gray-600 hover:bg-green-100 hover:text-green-700"
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

        {/* 导航项，flex-1 居中 */}
        <nav className="flex w-full flex-1 flex-col items-center justify-center gap-7 px-0.5">
          {navItems.map(({ href, label, icon: Icon, type }) => {
            const isActive = href ? pathname.startsWith(href) : false
            const isLogout = type === "logout"
            return isLogout ? (
              <button
                key={label}
                onClick={handleLogout}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white hover:text-green-300 active:scale-125 active:shadow-lg transition-all duration-200"
                onMouseMove={(e) => { setTooltip({ label, x: e.clientX, y: e.clientY }) }}
                onMouseLeave={() => setTooltip(null)}
              >
                <Icon className="h-6 w-6" />
              </button>
            ) : (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-xl text-white hover:text-green-300 active:scale-125 active:shadow-lg transition-all duration-200",
                  isActive ? "text-green-400" : ""
                )}
                onMouseMove={(e) => { setTooltip({ label, x: e.clientX, y: e.clientY }) }}
                onMouseLeave={() => setTooltip(null)}
              >
                <Icon className="h-6 w-6" />
              </Link>
            )
          })}
        </nav>

        {/* 底部：退出登录，已移到导航项中 */}
      </aside>
    </>
  )
}
