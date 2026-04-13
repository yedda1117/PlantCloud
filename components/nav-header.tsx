"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Leaf, Bell, User } from "lucide-react"

const navItems = [
  { href: "/", label: "首页总览" },
  { href: "/chat", label: "智能问答" },
  { href: "/dashboard", label: "数据可视化" },
  { href: "/calendar", label: "生长日历" },
  { href: "/settings", label: "设置" },
]

interface NavHeaderProps {
  rightSlot?: React.ReactNode
}

export function NavHeader({ rightSlot }: NavHeaderProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card/95 backdrop-blur-sm">
      <div className="flex h-16 items-center px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Leaf className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">云端植物</span>
            <span className="text-[10px] text-muted-foreground">小生态箱照护系统</span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {rightSlot && (
            <div className="flex items-center gap-2 mr-2 border-r border-border/40 pr-3">
              {rightSlot}
            </div>
          )}
          <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </button>
        </div>
      </div>
    </header>
  )
}
