"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Leaf } from "lucide-react"

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const token = window.localStorage.getItem("plantcloud_token")

    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/home")}`)
      return
    }

    setAllowed(true)
  }, [pathname, router])

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-900">
        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Leaf className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">正在确认登录状态</p>
            <p className="text-xs text-zinc-500">PlantCloud 会在验证后进入系统</p>
          </div>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
