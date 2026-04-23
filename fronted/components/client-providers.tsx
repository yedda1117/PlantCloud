"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { PlantSelectionProvider } from "@/context/plant-selection"
import { GlobalNavbar } from "@/components/global-navbar"
import { RouteTransitionOverlay } from "@/components/route-transition-overlay"
import { Toaster } from "@/components/ui/toaster"

const HIDDEN_NAV_PATHS = ["/", "/login", "/register"]

export function ClientProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const hideNav = HIDDEN_NAV_PATHS.includes(pathname)

  return (
    <PlantSelectionProvider>
      <GlobalNavbar />
      <div
        className={
          hideNav
            ? "absolute inset-0 overflow-auto bg-white"
            : "absolute bottom-0 right-0 top-0 left-20 overflow-auto rounded-l-[36px] bg-white shadow-2xl"
        }
      >
        {children}
      </div>
      <RouteTransitionOverlay />
      <Toaster />
    </PlantSelectionProvider>
  )
}
