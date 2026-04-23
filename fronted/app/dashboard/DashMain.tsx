"use client"

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { AlertCircle, ChevronRight, Droplets, Sun, Thermometer } from "lucide-react"
import { getCurrentEnvironment, type CurrentEnvironment } from "@/lib/dashboard-api"
import type { PlantMeta } from "./page"

type MetricStatus = "normal" | "warning" | "error" | "unknown"

type PlantCardState = {
  data: CurrentEnvironment | null
  loading: boolean
  error: string | null
}

type DragState = {
  active: boolean
  startX: number
  startScrollLeft: number
  moved: boolean
}

type TrackMetrics = {
  dockWidth: number
  focusOffset: number
  leftInset: number
  rightInset: number
}

const statusColor: Record<MetricStatus, string> = {
  normal: "text-emerald-700",
  warning: "text-orange-600",
  error: "text-red-600",
  unknown: "text-zinc-500",
}

const statusBg: Record<MetricStatus, string> = {
  normal: "bg-emerald-50/90",
  warning: "bg-orange-50/90",
  error: "bg-red-50/90",
  unknown: "bg-zinc-100/90",
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

function getPreviewTone(status: MetricStatus) {
  switch (status) {
    case "normal":
      return {
        badge: "正常",
        dot: "bg-emerald-500",
        active: "border-emerald-200/90 bg-emerald-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_24px_rgba(16,185,129,0.12)]",
        rail: "bg-emerald-400",
      }
    case "warning":
    case "error":
      return {
        badge: "异常",
        dot: "bg-orange-500",
        active: "border-orange-200/90 bg-orange-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_24px_rgba(249,115,22,0.12)]",
        rail: "bg-orange-400",
      }
    default:
      return {
        badge: "暂无数据",
        dot: "bg-zinc-400",
        active: "border-zinc-200/90 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_10px_24px_rgba(148,163,184,0.1)]",
        rail: "bg-zinc-300",
      }
  }
}

function getCardAmbientClass(status: MetricStatus) {
  switch (status) {
    case "normal":
      return "plant-card-ambient plant-card-ambient-normal"
    case "warning":
    case "error":
      return "plant-card-ambient plant-card-ambient-alert"
    default:
      return "plant-card-ambient plant-card-ambient-muted"
  }
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
    <div className={`flex min-h-32 flex-1 flex-col items-center justify-center gap-1.5 rounded-[1.35rem] border border-white/60 px-4 py-5 backdrop-blur-sm ${statusBg[status]}`}>
      <div className={statusColor[status]}>{icon}</div>
      <span className={`text-xl font-semibold ${statusColor[status]}`}>{value}</span>
      <span className="text-[11px] tracking-[0.18em] text-zinc-500 uppercase">{label}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-[2rem] border border-dashed border-zinc-300 bg-white/70 px-8 py-14 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <p className="text-lg font-semibold text-zinc-900">还没有植物卡片</p>
      <p className="mt-2 text-sm text-zinc-500">添加植物后，这里会显示横向滑动的监测卡片。</p>
    </div>
  )
}

export default function DashMain({ plants }: { plants: PlantMeta[] }) {
  const router = useRouter()
  const [plantStates, setPlantStates] = useState<Record<string, PlantCardState>>({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [trackMetrics, setTrackMetrics] = useState<TrackMetrics>({
    dockWidth: 0,
    focusOffset: 0,
    leftInset: 0,
    rightInset: 0,
  })
  const trackRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const dragStateRef = useRef<DragState>({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  })
  const rafRef = useRef<number | null>(null)

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

  useEffect(() => {
    const track = trackRef.current
    if (!track || plants.length === 0) {
      return
    }

    const updateTrackMetrics = () => {
      const firstCard = cardRefs.current[0]
      if (!firstCard) {
        return
      }

      let dockWidth = 0
      if (track.clientWidth >= 1180) {
        dockWidth = 292
      } else if (track.clientWidth >= 960) {
        dockWidth = 276
      } else if (track.clientWidth >= 768) {
        dockWidth = 248
      }

      const focusOffset = 0
      const focusCenter = track.clientWidth / 2 + focusOffset
      const leftInset = Math.max(focusCenter - firstCard.clientWidth / 2, 0)
      const rightInset = Math.max(track.clientWidth - focusCenter - firstCard.clientWidth / 2, 0)

      setTrackMetrics({
        dockWidth,
        focusOffset,
        leftInset,
        rightInset,
      })
    }

    const updateActiveCard = () => {
      const containerRect = track.getBoundingClientRect()
      const containerCenter = containerRect.left + containerRect.width / 2 + trackMetrics.focusOffset
      let closestIndex = 0
      let closestDistance = Number.POSITIVE_INFINITY

      cardRefs.current.forEach((card, index) => {
        if (!card) {
          return
        }

        const rect = card.getBoundingClientRect()
        const cardCenter = rect.left + rect.width / 2
        const distance = Math.abs(cardCenter - containerCenter)

        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      })

      const maxScroll = Math.max(track.scrollWidth - track.clientWidth, 1)
      setScrollProgress(track.scrollLeft / maxScroll)
      setActiveIndex(closestIndex)
    }

    updateTrackMetrics()
    updateActiveCard()

    const handleScroll = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
      }

      rafRef.current = window.requestAnimationFrame(updateActiveCard)
    }

    track.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", updateTrackMetrics)
    window.addEventListener("resize", updateActiveCard)

    return () => {
      track.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", updateTrackMetrics)
      window.removeEventListener("resize", updateActiveCard)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [plants.length, trackMetrics.focusOffset])

  const scrollToCard = (index: number) => {
    const track = trackRef.current
    const card = cardRefs.current[index]
    if (!track || !card) {
      return
    }

    const targetLeft = card.offsetLeft - (track.clientWidth - card.clientWidth) / 2 - trackMetrics.focusOffset
    track.scrollTo({
      left: targetLeft,
      behavior: "smooth",
    })
  }

  const snapToNearestCard = () => {
    const currentIndex = activeIndex
    window.setTimeout(() => {
      scrollToCard(currentIndex)
    }, 12)
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const track = trackRef.current
    if (!track) {
      return
    }

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (delta === 0) {
      return
    }

    event.preventDefault()
    track.scrollBy({
      left: delta,
      behavior: "auto",
    })
  }

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const track = trackRef.current
    if (!track) {
      return
    }

    dragStateRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: track.scrollLeft,
      moved: false,
    }
  }

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const track = trackRef.current
    const dragState = dragStateRef.current
    if (!track || !dragState.active) {
      return
    }

    const deltaX = event.clientX - dragState.startX
    if (Math.abs(deltaX) > 6 && !dragState.moved) {
      dragStateRef.current.moved = true
    }

    track.scrollLeft = dragState.startScrollLeft - deltaX
  }

  const finishDrag = () => {
    const dragState = dragStateRef.current

    if (!dragState.active) {
      return
    }

    dragStateRef.current = {
      active: false,
      startX: 0,
      startScrollLeft: 0,
      moved: dragState.moved,
    }

    snapToNearestCard()
  }

  if (plants.length === 0) {
    return <EmptyState />
  }

  return (
    <section className="relative flex h-full min-h-0 flex-col justify-center overflow-hidden rounded-[2.25rem] border border-white/60 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(236,253,245,0.9)_34%,_rgba(255,247,237,0.82)_100%)] px-0 pb-9 pt-14 backdrop-blur-xl sm:px-4 sm:pb-10 sm:pt-16">
      <div className="pointer-events-none absolute left-7 top-[8rem] z-20 hidden rounded-[1.75rem] border border-white/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.34)_0%,rgba(255,255,255,0.2)_100%)] shadow-[0_8px_30px_rgba(31,38,135,0.08)] backdrop-blur-[22px] md:block" style={{ width: `${trackMetrics.dockWidth}px`, bottom: "5.75rem" }}>
        <div className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-[1.75rem]">
          <div className="shrink-0 border-b border-white/25 px-5 pb-4 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Plant Preview</p>
            <h3 className="mt-2 text-lg font-semibold text-zinc-900">植物预览栏</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">点击左侧植物，右侧主卡片会平滑切换到对应状态。</p>
          </div>

          <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-3 py-3 [scrollbar-width:none]">
            {plants.map((plant, index) => {
              const data = plantStates[plant.id]?.data ?? null
              const previewStatus = getOverallStatus(data)
              const tone = getPreviewTone(previewStatus)
              const isActive = index === activeIndex

              return (
                <button
                  key={`preview-${plant.id}`}
                  type="button"
                  className={`relative flex w-full items-center gap-3 overflow-hidden rounded-[1rem] border px-4 py-3 text-left transition-all duration-300 ${
                    isActive
                      ? tone.active
                      : "border-transparent bg-white/8 hover:border-white/20 hover:bg-white/18"
                  }`}
                  onClick={() => scrollToCard(index)}
                >
                  <span className={`absolute inset-y-3 left-0 w-1 rounded-full ${isActive ? tone.rail : "bg-transparent"}`} />
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-white/45 text-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                    {plant.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-900">{plant.name}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                      <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                      {tone.badge}
                    </span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    previewStatus === "normal"
                      ? "bg-emerald-100/80 text-emerald-700"
                      : previewStatus === "warning" || previewStatus === "error"
                        ? "bg-orange-100/80 text-orange-700"
                        : "bg-white/55 text-zinc-500"
                  }`}>
                    {index + 1}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.5),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute left-6 top-[7.65rem] z-10 hidden h-[72%] w-[18rem] rounded-[2rem] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2),rgba(255,255,255,0))] md:block" />

      <div className="relative mb-8 flex items-center justify-between px-5 sm:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Plant Cards</p>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-900">滑动查看每株植物状态</h2>
        </div>
        <div className="hidden rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs text-zinc-500 shadow-sm backdrop-blur sm:block">
          {activeIndex + 1} / {plants.length}
        </div>
      </div>

      <div
        ref={trackRef}
        className="no-scrollbar relative z-0 flex min-h-0 flex-1 items-center snap-x snap-mandatory gap-6 overflow-x-auto pb-9 pt-9 [scrollbar-width:none] [-ms-overflow-style:none]"
        style={{
          scrollPaddingLeft: `${trackMetrics.leftInset}px`,
          scrollPaddingRight: `${trackMetrics.rightInset}px`,
          cursor: dragStateRef.current.active ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finishDrag}
        onWheel={handleWheel}
        onMouseLeave={finishDrag}
      >
        <div aria-hidden="true" className="shrink-0" style={{ width: `${trackMetrics.leftInset}px` }} />
        {plants.map((plant, index) => {
          const state = plantStates[plant.id]
          const data = state?.data ?? null
          const overallStatus = getOverallStatus(data)
          const hasData = hasEnvironmentData(data)
          const hasAlert = overallStatus === "warning" || overallStatus === "error"
          const temperatureStatus = data?.temperature == null ? "unknown" : mapMetricStatus(data.temperatureStatus)
          const humidityStatus = data?.humidity == null ? "unknown" : mapMetricStatus(data.humidityStatus)
          const lightStatus = data?.lightLux == null ? "unknown" : mapMetricStatus(data.lightStatus)
          const distance = Math.min(Math.abs(index - activeIndex), 2)
          const scale = distance === 0 ? 1 : distance === 1 ? 0.92 : 0.88
          const opacity = distance === 0 ? 1 : distance === 1 ? 0.72 : 0.6
          const cardShadow = hasAlert
            ? distance === 0
              ? "0 32px 70px rgba(234, 88, 12, 0.28)"
              : "0 20px 42px rgba(234, 88, 12, 0.18)"
            : distance === 0
              ? "0 28px 64px rgba(15, 23, 42, 0.16)"
              : "0 18px 38px rgba(15, 23, 42, 0.1)"

          return (
            <motion.div
              key={plant.id}
              ref={(node) => {
                cardRefs.current[index] = node
              }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity, y: 0, scale }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="relative flex h-[min(25rem,calc(100%-0.75rem))] min-h-[22rem] w-[84%] min-w-[84%] self-center snap-center select-none md:w-[min(82vw,34rem)] md:min-w-[min(82vw,34rem)]"
            >
              {hasAlert ? (
                <span className="absolute -right-1 -top-1 z-20 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-orange-500" />
                </span>
              ) : null}

              <div
                className={`group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[2rem] border bg-white/90 px-5 py-4 backdrop-blur-xl transition-all duration-300 sm:px-6 sm:py-5 ${hasAlert ? "border-orange-300 ring-1 ring-orange-200/80" : "border-white/70"}`}
                style={{ boxShadow: cardShadow }}
                onClick={() => {
                  if (dragStateRef.current.moved) {
                    dragStateRef.current.moved = false
                    return
                  }

                  dragStateRef.current.moved = false
                  router.push(`/dashboard?plant=${plant.id}`)
                }}
              >
                <div className={getCardAmbientClass(hasData ? overallStatus : "unknown")} />
                <div
                  className={`absolute inset-0 ${hasAlert ? "bg-[radial-gradient(circle_at_top_right,_rgba(255,237,213,0.9),_rgba(255,255,255,0)_40%)]" : "bg-[radial-gradient(circle_at_top_right,_rgba(209,250,229,0.85),_rgba(255,255,255,0)_42%)]"}`}
                />

                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] text-4xl shadow-inner ${hasAlert ? "bg-orange-100/90" : "bg-emerald-50/90"}`}>
                      {plant.emoji}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xl font-semibold text-zinc-900">{plant.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {state?.loading ? (
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500">加载中</span>
                        ) : state?.error ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            数据加载失败
                          </span>
                        ) : (
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBg[overallStatus]} ${statusColor[overallStatus]}`}>
                            {getStatusText(hasData ? overallStatus : "unknown")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-full border border-white/70 bg-white/75 p-2 text-zinc-500 shadow-sm backdrop-blur">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>

                <div className="relative mt-5 grid flex-1 grid-cols-3 gap-3 content-center">
                  <MetricCell
                    icon={<Thermometer className="h-4 w-4" />}
                    value={state?.loading ? "..." : formatNumber(data?.temperature, "°")}
                    label="Temp"
                    status={state?.loading ? "unknown" : temperatureStatus}
                  />
                  <MetricCell
                    icon={<Droplets className="h-4 w-4" />}
                    value={state?.loading ? "..." : formatNumber(data?.humidity, "%")}
                    label="Humidity"
                    status={state?.loading ? "unknown" : humidityStatus}
                  />
                  <MetricCell
                    icon={<Sun className="h-4 w-4" />}
                    value={state?.loading ? "..." : formatLight(data?.lightLux)}
                    label="Light"
                    status={state?.loading ? "unknown" : lightStatus}
                  />
                </div>

                <div className="relative mt-4 flex items-center justify-between rounded-[1.4rem] border border-white/60 bg-white/55 px-4 py-3.5 backdrop-blur-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Card Action</p>
                    <p className="mt-1 text-sm font-medium text-zinc-700">点击卡片查看植物环境详情</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hasAlert ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {hasAlert ? "需要关注" : "运行稳定"}
                  </span>
                </div>
              </div>
            </motion.div>
          )
        })}
        <div aria-hidden="true" className="shrink-0" style={{ width: `${trackMetrics.rightInset}px` }} />
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 pb-5">
        {plants.map((plant, index) => (
          <button
            key={plant.id}
            type="button"
            aria-label={`跳转到第 ${index + 1} 张卡片`}
            className={`h-2.5 rounded-full transition-all duration-300 ${index === activeIndex ? "w-7 bg-zinc-900" : "w-2.5 bg-zinc-300 hover:bg-zinc-400"}`}
            onClick={() => scrollToCard(index)}
          />
        ))}
      </div>
    </section>
  )
}
