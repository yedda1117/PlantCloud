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
      <div className="absolute left-24 top-0 bottom-0 right-0 bg-white rounded-l-[40px] shadow-2xl overflow-auto">
        {children}
      </div>
      <RouteTransitionOverlay />
      <Toaster />
    </PlantSelectionProvider>
  )
}
