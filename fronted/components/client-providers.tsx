"use client"

import type { ReactNode } from "react"
import { PlantSelectionProvider } from "@/context/plant-selection"
import { GlobalNavbar } from "@/components/global-navbar"
import { RouteTransitionOverlay } from "@/components/route-transition-overlay"
import { Toaster } from "@/components/ui/toaster"

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <PlantSelectionProvider>
      <GlobalNavbar />
      {/* 左侧导航宽 64px(w-16) + 左右各 12px(left-3) = 约 76px，加 gap */}
      <div className="pl-24">
        {children}
      </div>
      <RouteTransitionOverlay />
      <Toaster />
    </PlantSelectionProvider>
  )
}
