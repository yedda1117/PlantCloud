"use client"

import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { Thermometer, Droplets, Sun, AlertTriangle, Flame, RotateCcw } from "lucide-react"

export interface PlantData {
  id: string
  name: string
  emoji: string
  temp: number
  humidity: number
  lux: number
  tempStatus: "normal" | "warning" | "error"
  humidStatus: "normal" | "warning" | "error"
  luxStatus: "normal" | "warning" | "error"
  smokeAlert: boolean   // E53_SF1
  tiltAlert: boolean    // E53_SC2
}

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

const statusColor = {
  normal: "text-green-600",
  warning: "text-amber-500",
  error: "text-red-500",
}

const statusBg = {
  normal: "bg-green-50",
  warning: "bg-amber-50",
  error: "bg-red-50",
}

export default function DashMain() {
  const router = useRouter()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {plants.map((plant, i) => {
        const hasAlert = plant.smokeAlert || plant.tiltAlert
        return (
          <motion.div
            key={plant.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.4, ease: "easeOut" }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="relative cursor-pointer group"
            onClick={() => router.push(`/dashboard?plant=${plant.id}`)}
          >
            {/* 红色呼吸灯 — 仅在传感器报警时显示 */}
            {hasAlert && (
              <span className="absolute -top-1.5 -right-1.5 z-10 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
              </span>
            )}

            <div className={`rounded-2xl border bg-card shadow-sm overflow-hidden transition-shadow group-hover:shadow-lg ${hasAlert ? "border-red-300" : "border-border"}`}>
              {/* 顶部：植物图标 + 名称 */}
              <div className="flex items-center gap-4 px-5 pt-5 pb-3">
                <div className={`flex items-center justify-center w-14 h-14 rounded-2xl text-3xl ${hasAlert ? "bg-red-50" : "bg-muted"}`}>
                  {plant.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base text-foreground">{plant.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {plant.smokeAlert && (
                      <span className="flex items-center gap-1 text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                        <Flame className="h-3 w-3" /> 烟雾警报
                      </span>
                    )}
                    {plant.tiltAlert && (
                      <span className="flex items-center gap-1 text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                        <RotateCcw className="h-3 w-3" /> 倾斜警报
                      </span>
                    )}
                    {!hasAlert && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">状态正常</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 数据行 */}
              <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
                {/* 温度 */}
                <div className={`flex flex-col items-center py-3 gap-0.5 ${statusBg[plant.tempStatus]}`}>
                  <Thermometer className={`h-4 w-4 ${statusColor[plant.tempStatus]}`} />
                  <span className={`text-lg font-bold ${statusColor[plant.tempStatus]}`}>{plant.temp}°</span>
                  <span className="text-[10px] text-muted-foreground">温度</span>
                </div>
                {/* 湿度 */}
                <div className={`flex flex-col items-center py-3 gap-0.5 ${statusBg[plant.humidStatus]}`}>
                  <Droplets className={`h-4 w-4 ${statusColor[plant.humidStatus]}`} />
                  <span className={`text-lg font-bold ${statusColor[plant.humidStatus]}`}>{plant.humidity}%</span>
                  <span className="text-[10px] text-muted-foreground">湿度</span>
                </div>
                {/* 光照 */}
                <div className={`flex flex-col items-center py-3 gap-0.5 ${statusBg[plant.luxStatus]}`}>
                  <Sun className={`h-4 w-4 ${statusColor[plant.luxStatus]}`} />
                  <span className={`text-lg font-bold ${statusColor[plant.luxStatus]}`}>
                    {plant.lux >= 1000 ? `${(plant.lux / 1000).toFixed(0)}k` : plant.lux}
                  </span>
                  <span className="text-[10px] text-muted-foreground">lux</span>
                </div>
              </div>

              {/* Hover 提示遮罩 */}
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-foreground bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow">
                  点击查看详情 →
                </span>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
