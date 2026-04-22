"use client"

import type { RefObject } from "react"

type FaceScannerTone = "idle" | "success" | "error" | "loading"

type FaceScannerFrameProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  tone?: FaceScannerTone
  label?: string
  sublabel?: string
}

const toneClass: Record<FaceScannerTone, string> = {
  idle: "border-emerald-300/70 text-emerald-100 shadow-emerald-500/25",
  loading: "border-cyan-300/80 text-cyan-100 shadow-cyan-500/35",
  success: "border-emerald-300 text-emerald-100 shadow-emerald-400/45",
  error: "border-red-300/80 text-red-100 shadow-red-500/35",
}

const dotClass: Record<FaceScannerTone, string> = {
  idle: "bg-emerald-300",
  loading: "bg-cyan-300",
  success: "bg-emerald-300",
  error: "bg-red-300",
}

export function FaceScannerFrame({
  videoRef,
  tone = "idle",
  label = "Face alignment",
  sublabel = "Keep face inside frame",
}: FaceScannerFrameProps) {
  return (
    <div className={`face-scan-frame relative overflow-hidden rounded-lg border bg-zinc-950 shadow-2xl ${toneClass[tone]}`}>
      <video ref={videoRef} className="aspect-[4/3] w-full scale-x-[-1] object-cover opacity-92 saturate-[1.08]" muted playsInline />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_34%,rgba(2,6,23,0.18)_55%,rgba(2,6,23,0.66)_100%)]" />
      <div className="face-scan-grid pointer-events-none absolute inset-0 opacity-45" />
      <div className="face-scan-line pointer-events-none absolute left-0 right-0 h-16" />

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[58%] w-[46%] min-w-44 max-w-72 -translate-x-1/2 -translate-y-1/2 rounded-[48%] border border-current/50 shadow-[0_0_34px_currentColor]">
        <span className="absolute -left-3 top-8 h-16 w-6 rounded-l-full border-y-2 border-l-2 border-current" />
        <span className="absolute -right-3 top-8 h-16 w-6 rounded-r-full border-y-2 border-r-2 border-current" />
        <span className="absolute -bottom-2 left-1/2 h-8 w-24 -translate-x-1/2 rounded-b-full border-b-2 border-current" />
        <span className="absolute left-1/2 top-[47%] h-px w-[118%] -translate-x-1/2 bg-current/40" />
        <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current/25" />
      </div>

      <div className="pointer-events-none absolute inset-6">
        <span className="absolute left-0 top-0 h-12 w-12 border-l-2 border-t-2 border-current" />
        <span className="absolute right-0 top-0 h-12 w-12 border-r-2 border-t-2 border-current" />
        <span className="absolute bottom-0 left-0 h-12 w-12 border-b-2 border-l-2 border-current" />
        <span className="absolute bottom-0 right-0 h-12 w-12 border-b-2 border-r-2 border-current" />
      </div>

      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-white/18 bg-zinc-950/55 px-3 py-2 text-xs backdrop-blur-md">
        <span className={`h-2 w-2 rounded-full ${dotClass[tone]} ${tone === "loading" ? "animate-ping" : ""}`} />
        <span className="font-medium">{label}</span>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-lg border border-white/16 bg-zinc-950/58 px-3 py-2 text-xs text-white/82 backdrop-blur-md">
        <span>{sublabel}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">BIO SCAN</span>
      </div>
    </div>
  )
}
