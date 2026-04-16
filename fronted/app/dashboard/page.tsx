"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { NavHeader } from "@/components/nav-header"
import DashMain, { type PlantData } from "./DashMain"
import DashDetail from "./DashDetail"

// 与 DashMain 保持一致的植物数据（单一数据源）
const plants: PlantData[] = [
  {
    id: "p1", name: "绿萝", emoji: "🌿",
    temp: 25, humidity: 65, lux: 40000,
    tempStatus: "normal", humidStatus: "normal", luxStatus: "error",
    smokeAlert: false, tiltAlert: false,
  },
  {
    id: "p2", name: "多肉植物", emoji: "🌵",
    temp: 28, humidity: 38, lux: 12000,
    tempStatus: "normal", humidStatus: "warning", luxStatus: "normal",
    smokeAlert: false, tiltAlert: true,
  },
  {
    id: "p3", name: "薰衣草", emoji: "💜",
    temp: 22, humidity: 72, lux: 8000,
    tempStatus: "normal", humidStatus: "normal", luxStatus: "normal",
    smokeAlert: false, tiltAlert: false,
  },
  {
    id: "p4", name: "番茄苗", emoji: "🍅",
    temp: 34, humidity: 55, lux: 15000,
    tempStatus: "error", humidStatus: "normal", luxStatus: "normal",
    smokeAlert: true, tiltAlert: false,
  },
  {
    id: "p5", name: "薄荷", emoji: "🌱",
    temp: 20, humidity: 80, lux: 3000,
    tempStatus: "normal", humidStatus: "warning", luxStatus: "normal",
    smokeAlert: false, tiltAlert: false,
  },
  {
    id: "p6", name: "仙人掌", emoji: "🌴",
    temp: 30, humidity: 25, lux: 22000,
    tempStatus: "normal", humidStatus: "error", luxStatus: "normal",
    smokeAlert: false, tiltAlert: false,
  },
]

function DashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const plantId = searchParams.get("plant")
  const plant = plants.find((p) => p.id === plantId)

  if (plant) {
    return <DashDetail plant={plant} onBack={() => router.push("/dashboard")} />
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader />
      <main className="container mx-auto px-6 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-foreground">植物监测总览</h1>
          <p className="text-sm text-muted-foreground mt-0.5">点击任意植物卡片查看详细环境分析</p>
        </div>
        <DashMain />
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Suspense>
        <DashboardContent />
      </Suspense>
    </AuthGuard>
  )
}
