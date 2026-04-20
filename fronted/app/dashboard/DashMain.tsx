"use client"

import { useEffect, useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { AlertCircle, Droplets, Sun, Thermometer } from "lucide-react"
import { getCurrentEnvironment, type CurrentEnvironment } from "@/lib/dashboard-api"
import type { PlantMeta } from "./page"

type MetricStatus = "normal" | "warning" | "error" | "unknown"

type PlantCardState = {
  data: CurrentEnvironment | null
  loading: boolean
  error: string | null
}

const statusColor: Record<MetricStatus, string> = {
  normal: "text-green-600",
  warning: "text-amber-500",
  error: "text-red-500",
  unknown: "text-zinc-400",
}

const statusBg: Record<MetricStatus, string> = {
  normal: "bg-green-50",
  warning: "bg-amber-50",
  error: "bg-red-50",
  unknown: "bg-zinc-50",
}

function hasEnvironmentData(data: CurrentEnvironment | null) {
  return data?.temperature != null || data?.humidity != null || data?.lightLux != null
}

function mapMetricStatus(status: string | null | undefined): MetricStatus {
  switch ((status || "").toUpperCase()) {
    case "NORMAL":
      return "normal"
    case "LOW":
    case "HIGH":
      return "warning"
    case "ERROR":
      return "error"
    default:
      return "unknown"
  }
}

function getOverallStatus(data: CurrentEnvironment | null): MetricStatus {
  if (!hasEnvironmentData(data)) {
    return "unknown"
  }

  const statuses = [
    data?.temperature == null ? "unknown" : mapMetricStatus(data.temperatureStatus),
    data?.humidity == null ? "unknown" : mapMetricStatus(data.humidityStatus),
    data?.lightLux == null ? "unknown" : mapMetricStatus(data.lightStatus),
  ]

  if (statuses.includes("error")) {
    return "error"
  }
  if (statuses.includes("warning")) {
    return "warning"
  }
  return "normal"
}

function getStatusText(status: MetricStatus) {
  switch (status) {
    case "normal":
      return "状态正常"
    case "warning":
      return "状态异常"
    case "error":
      return "严重异常"
    default:
      return "暂无数据"
  }
}

function formatNumber(value: number | null | undefined, suffix: string) {
  if (value == null) {
    return "--"
  }

  return `${Math.round(Number(value))}${suffix}`
}

function formatLight(value: number | null | undefined) {
  if (value == null) {
    return "--"
  }

  const numeric = Number(value)
  return numeric >= 1000 ? `${Math.round(numeric / 1000)}k` : `${Math.round(numeric)}`
}

function MetricCell({
  icon,
  value,
  label,
  status,
}: {
  icon: ReactNode
  value: string
  label: string
  status: MetricStatus
}) {
  return (
    <div className={`flex min-h-24 flex-col items-center justify-center gap-0.5 py-3 ${statusBg[status]}`}>
      <div className={statusColor[status]}>{icon}</div>
      <span className={`text-lg font-bold ${statusColor[status]}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

export default function DashMain({ plants }: { plants: PlantMeta[] }) {
  const router = useRouter()
  const [plantStates, setPlantStates] = useState<Record<string, PlantCardState>>({})

  useEffect(() => {
    let cancelled = false
    const token = window.localStorage.getItem("plantcloud_token") || ""

    setPlantStates(
      Object.fromEntries(
        plants.map((plant) => [
          plant.id,
          {
            data: null,
            loading: true,
            error: null,
          },
        ]),
      ),
    )

    const loadCurrentEnvironment = async () => {
      const results = await Promise.allSettled(
        plants.map(async (plant) => ({
          id: plant.id,
          data: await getCurrentEnvironment(plant.plantId, token),
        })),
      )

      if (cancelled) {
        return
      }

      setPlantStates(
        Object.fromEntries(
          results.map((result, index) => {
            const plant = plants[index]
            if (result.status === "fulfilled") {
              return [
                plant.id,
                {
                  data: result.value.data,
                  loading: false,
                  error: null,
                },
              ]
            }

            return [
              plant.id,
              {
                data: null,
                loading: false,
                error: result.reason instanceof Error ? result.reason.message : "加载失败",
              },
            ]
          }),
        ),
      )
    }

    void loadCurrentEnvironment()

    return () => {
      cancelled = true
    }
  }, [plants])

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {plants.map((plant, index) => {
        const state = plantStates[plant.id]
        const data = state?.data ?? null
        const overallStatus = getOverallStatus(data)
        const hasData = hasEnvironmentData(data)
        const hasAlert = overallStatus === "warning" || overallStatus === "error"
        const temperatureStatus = data?.temperature == null ? "unknown" : mapMetricStatus(data.temperatureStatus)
        const humidityStatus = data?.humidity == null ? "unknown" : mapMetricStatus(data.humidityStatus)
        const lightStatus = data?.lightLux == null ? "unknown" : mapMetricStatus(data.lightStatus)

        return (
          <motion.div
            key={plant.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07, duration: 0.4, ease: "easeOut" }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="group relative cursor-pointer"
            onClick={() => router.push(`/dashboard?plant=${plant.id}`)}
          >
            {hasAlert ? (
              <span className="absolute -right-1.5 -top-1.5 z-10 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500" />
              </span>
            ) : null}

            <div className={`overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow group-hover:shadow-lg ${hasAlert ? "border-red-300" : "border-border"}`}>
              <div className="flex items-center gap-4 px-5 pb-3 pt-5">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${hasAlert ? "bg-red-50" : "bg-muted"}`}>
                  {plant.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">{plant.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {state?.loading ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">加载中</span>
                    ) : state?.error ? (
                      <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        数据加载失败
                      </span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusBg[overallStatus]} ${statusColor[overallStatus]}`}>
                        {getStatusText(hasData ? overallStatus : "unknown")}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
                <MetricCell
                  icon={<Thermometer className="h-4 w-4" />}
                  value={state?.loading ? "..." : formatNumber(data?.temperature, "°")}
                  label="温度"
                  status={state?.loading ? "unknown" : temperatureStatus}
                />
                <MetricCell
                  icon={<Droplets className="h-4 w-4" />}
                  value={state?.loading ? "..." : formatNumber(data?.humidity, "%")}
                  label="湿度"
                  status={state?.loading ? "unknown" : humidityStatus}
                />
                <MetricCell
                  icon={<Sun className="h-4 w-4" />}
                  value={state?.loading ? "..." : formatLight(data?.lightLux)}
                  label="lux"
                  status={state?.loading ? "unknown" : lightStatus}
                />
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-black/0 transition-colors group-hover:bg-black/5">
                <span className="rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground opacity-0 shadow backdrop-blur-sm transition-opacity group-hover:opacity-100">
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
