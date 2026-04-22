"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Leaf } from "lucide-react"

const TRANSITION_DURATION = 920

function isInternalNavigationTarget(href: string) {
  try {
    const url = new URL(href, window.location.href)
    const current = new URL(window.location.href)

    if (url.origin !== current.origin) {
      return false
    }

    return url.pathname !== current.pathname || url.search !== current.search
  } catch {
    return false
  }
}

export function RouteTransitionOverlay() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const didMountRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showTransition = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    setVisible(true)
    timerRef.current = setTimeout(() => {
      setVisible(false)
    }, TRANSITION_DURATION)
  }

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }

    showTransition()
  }, [pathname])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const target = event.target instanceof Element ? event.target.closest("a[href]") : null
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.hasAttribute("download")) {
        return
      }

      if (isInternalNavigationTarget(target.href)) {
        showTransition()
      }
    }

    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState

    window.history.pushState = function pushState(data, unused, url) {
      if (typeof url === "string" && isInternalNavigationTarget(url)) {
        showTransition()
      }
      return originalPushState.call(this, data, unused, url)
    }

    window.history.replaceState = function replaceState(data, unused, url) {
      if (typeof url === "string" && isInternalNavigationTarget(url)) {
        showTransition()
      }
      return originalReplaceState.call(this, data, unused, url)
    }

    document.addEventListener("click", handleClick, true)

    return () => {
      document.removeEventListener("click", handleClick, true)
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-emerald-950/12 backdrop-blur-[2px] transition duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`relative flex items-center gap-4 rounded-full border border-white/80 bg-white/50 px-4 py-3 pr-5 shadow-2xl shadow-emerald-950/14 backdrop-blur-2xl transition duration-300 ${
          visible ? "translate-y-0 scale-100" : "translate-y-2 scale-95"
        }`}
      >
        <div className="absolute left-3 h-24 w-24 rounded-full bg-emerald-200/24 blur-2xl" />
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-emerald-100/80 shadow-[inset_0_1px_10px_rgba(255,255,255,0.9)]">
          <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/90 bg-emerald-50/62 shadow-lg shadow-emerald-900/10">
            {visible ? (
              <div className="absolute inset-x-0 bottom-0 h-full animate-[plant-water-rise_920ms_ease-in-out_forwards] bg-gradient-to-t from-emerald-500/78 via-teal-300/58 to-lime-200/54">
                <span className="absolute -top-2 left-1/2 h-5 w-14 -translate-x-1/2 animate-[plant-water-wave_1.6s_ease-in-out_infinite] rounded-[50%] bg-lime-100/86" />
                <span className="absolute -top-1 left-0 h-4 w-full animate-[plant-water-wave_1.3s_ease-in-out_infinite_reverse] rounded-[50%] bg-white/28" />
              </div>
            ) : null}
            <span className="absolute left-3 top-2 h-4 w-1.5 -rotate-12 rounded-full bg-white/56 blur-[0.5px]" />
            <span className="absolute inset-0 rounded-full border border-white/70" />
          </div>
          <Leaf className="absolute h-5 w-5 text-emerald-800 drop-shadow-sm" />
        </div>
        <div className="relative min-w-0">
          <p className="whitespace-nowrap text-sm font-semibold tracking-wide text-emerald-950">云空间准备中</p>
          <div className="mt-1 flex items-center gap-1">
            <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-600 [animation-delay:-0.2s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.1s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-lime-500" />
          </div>
        </div>
      </div>
    </div>
  )
}
