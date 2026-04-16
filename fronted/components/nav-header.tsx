"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Leaf, LogOut, User } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/home", label: "主页" },
  { href: "/dashboard", label: "植物总览" },
  { href: "/chat", label: "AI 问答" },
  { href: "/calendar", label: "生长日历" },
  { href: "/settings", label: "系统设置" },
]

interface NavHeaderProps {
  rightSlot?: ReactNode
}

export function NavHeader({ rightSlot }: NavHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = () => {
    window.localStorage.removeItem("plantcloud_token")
    window.localStorage.removeItem("plantcloud_user")
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/92 backdrop-blur-md">
      <div className="flex h-16 items-center px-5 sm:px-6">
        <Link href="/" className="mr-7 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-zinc-950">PlantCloud</span>
            <span className="text-[10px] text-zinc-500">智能植物云端养护</span>
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-emerald-100 text-emerald-800" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {rightSlot ? <div className="mr-1 hidden items-center gap-2 border-r border-zinc-200 pr-3 lg:flex">{rightSlot}</div> : null}
          <button className="relative rounded-lg p-2 transition hover:bg-zinc-100" aria-label="通知">
            <Bell className="h-5 w-5 text-zinc-500" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
            <User className="h-5 w-5" />
          </span>
          <button
            onClick={handleLogout}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            <LogOut className="h-4 w-4" />
            退出
          </button>
        </div>
      </div>
    </header>
  )
}
