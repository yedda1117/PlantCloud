"use client"

import { cn } from "@/lib/utils"

export type PlantState = "healthy" | "thirsty" | "hot" | "cold" | "dark" | "fallen" | "happy"

interface PixelPlantProps {
  state?: PlantState
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeClasses = {
  sm: "w-24 h-24",
  md: "w-40 h-40",
  lg: "w-56 h-56",
  xl: "w-72 h-72",
}

// 像素植物 SVG 组件 - 根据不同状态显示不同样式
export function PixelPlant({ state = "healthy", size = "lg", className }: PixelPlantProps) {
  const getPlantColors = () => {
    switch (state) {
      case "healthy":
        return { leaf: "#4ade80", stem: "#22c55e", pot: "#d97706", soil: "#78350f", accent: "#86efac" }
      case "thirsty":
        return { leaf: "#a3e635", stem: "#84cc16", pot: "#d97706", soil: "#92400e", accent: "#bef264" }
      case "hot":
        return { leaf: "#fbbf24", stem: "#f59e0b", pot: "#dc2626", soil: "#78350f", accent: "#fcd34d" }
      case "cold":
        return { leaf: "#67e8f9", stem: "#22d3ee", pot: "#6366f1", soil: "#78350f", accent: "#a5f3fc" }
      case "dark":
        return { leaf: "#6b7280", stem: "#4b5563", pot: "#57534e", soil: "#44403c", accent: "#9ca3af" }
      case "fallen":
        return { leaf: "#f87171", stem: "#ef4444", pot: "#d97706", soil: "#78350f", accent: "#fca5a5" }
      case "happy":
        return { leaf: "#34d399", stem: "#10b981", pot: "#f59e0b", soil: "#78350f", accent: "#6ee7b7" }
      default:
        return { leaf: "#4ade80", stem: "#22c55e", pot: "#d97706", soil: "#78350f", accent: "#86efac" }
    }
  }

  const colors = getPlantColors()

  const getAnimationClass = () => {
    switch (state) {
      case "healthy":
      case "happy":
        return "animate-sway"
      case "thirsty":
        return "animate-bounce-slow"
      case "hot":
        return "animate-pulse"
      case "fallen":
        return "rotate-45"
      default:
        return ""
    }
  }

  const getExpression = () => {
    switch (state) {
      case "happy":
        return (
          <>
            {/* Happy eyes - closed arcs */}
            <path d="M28 44 Q32 40 36 44" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M44 44 Q48 40 52 44" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
            {/* Smile */}
            <path d="M32 54 Q40 62 48 54" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
            {/* Blush */}
            <circle cx="24" cy="52" r="4" fill="#fda4af" opacity="0.6" />
            <circle cx="56" cy="52" r="4" fill="#fda4af" opacity="0.6" />
          </>
        )
      case "thirsty":
        return (
          <>
            {/* Tired eyes */}
            <ellipse cx="32" cy="44" rx="4" ry="3" fill="#1f2937" />
            <ellipse cx="48" cy="44" rx="4" ry="3" fill="#1f2937" />
            {/* Wavy mouth */}
            <path d="M32 56 Q36 54 40 56 Q44 58 48 56" stroke="#1f2937" strokeWidth="2" fill="none" />
            {/* Sweat drop */}
            <path d="M58 36 Q62 44 58 48 Q54 44 58 36" fill="#60a5fa" />
          </>
        )
      case "hot":
        return (
          <>
            {/* Dizzy eyes */}
            <text x="28" y="48" fontSize="12" fill="#1f2937">x</text>
            <text x="44" y="48" fontSize="12" fill="#1f2937">x</text>
            {/* Wavy mouth */}
            <path d="M32 56 Q40 52 48 56" stroke="#1f2937" strokeWidth="2" fill="none" />
            {/* Heat lines */}
            <path d="M20 28 Q22 24 20 20" stroke="#ef4444" strokeWidth="2" fill="none" opacity="0.7" />
            <path d="M60 28 Q58 24 60 20" stroke="#ef4444" strokeWidth="2" fill="none" opacity="0.7" />
          </>
        )
      case "cold":
        return (
          <>
            {/* Wide scared eyes */}
            <ellipse cx="32" cy="44" rx="5" ry="6" fill="#1f2937" />
            <ellipse cx="48" cy="44" rx="5" ry="6" fill="#1f2937" />
            <circle cx="33" cy="42" r="2" fill="white" />
            <circle cx="49" cy="42" r="2" fill="white" />
            {/* Shivering mouth */}
            <path d="M32 58 L36 56 L40 58 L44 56 L48 58" stroke="#1f2937" strokeWidth="2" fill="none" />
          </>
        )
      case "dark":
        return (
          <>
            {/* Sleepy eyes - closed */}
            <path d="M28 44 L36 44" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
            <path d="M44 44 L52 44" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
            {/* Sleeping mouth */}
            <ellipse cx="40" cy="56" rx="4" ry="3" fill="#1f2937" />
            {/* Zzz */}
            <text x="58" y="32" fontSize="10" fill="#6b7280" fontWeight="bold">z</text>
            <text x="64" y="26" fontSize="8" fill="#6b7280" fontWeight="bold">z</text>
            <text x="68" y="22" fontSize="6" fill="#6b7280" fontWeight="bold">z</text>
          </>
        )
      case "fallen":
        return (
          <>
            {/* Dizzy swirl eyes */}
            <circle cx="32" cy="44" r="5" fill="none" stroke="#1f2937" strokeWidth="2" />
            <circle cx="32" cy="44" r="2" fill="#1f2937" />
            <circle cx="48" cy="44" r="5" fill="none" stroke="#1f2937" strokeWidth="2" />
            <circle cx="48" cy="44" r="2" fill="#1f2937" />
            {/* Sad mouth */}
            <path d="M32 58 Q40 52 48 58" stroke="#1f2937" strokeWidth="2" fill="none" />
            {/* Pain stars */}
            <text x="18" y="32" fontSize="10" fill="#fbbf24">*</text>
            <text x="58" y="28" fontSize="8" fill="#fbbf24">*</text>
          </>
        )
      default: // healthy
        return (
          <>
            {/* Normal happy eyes */}
            <ellipse cx="32" cy="44" rx="4" ry="5" fill="#1f2937" />
            <ellipse cx="48" cy="44" rx="4" ry="5" fill="#1f2937" />
            <circle cx="33" cy="43" r="1.5" fill="white" />
            <circle cx="49" cy="43" r="1.5" fill="white" />
            {/* Smile */}
            <path d="M34 54 Q40 60 46 54" stroke="#1f2937" strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        )
    }
  }

  return (
    <div className={cn("relative flex items-center justify-center", sizeClasses[size], className)}>
      <svg
        viewBox="0 0 80 100"
        className={cn("pixel-plant w-full h-full", getAnimationClass())}
        style={{ imageRendering: "pixelated" }}
      >
        {/* Flower pot */}
        <path
          d="M16 72 L20 92 L60 92 L64 72 Z"
          fill={colors.pot}
          stroke="#92400e"
          strokeWidth="2"
        />
        {/* Pot rim */}
        <rect x="12" y="68" width="56" height="8" rx="2" fill={colors.pot} stroke="#92400e" strokeWidth="2" />
        {/* Soil */}
        <ellipse cx="40" cy="72" rx="20" ry="4" fill={colors.soil} />
        
        {/* Main stem */}
        <rect x="38" y="32" width="4" height="40" fill={colors.stem} />
        
        {/* Left leaf cluster */}
        <ellipse cx="24" cy="36" rx="16" ry="12" fill={colors.leaf} />
        <ellipse cx="20" cy="32" rx="12" ry="8" fill={colors.accent} opacity="0.6" />
        
        {/* Right leaf cluster */}
        <ellipse cx="56" cy="36" rx="16" ry="12" fill={colors.leaf} />
        <ellipse cx="60" cy="32" rx="12" ry="8" fill={colors.accent} opacity="0.6" />
        
        {/* Top leaf cluster */}
        <ellipse cx="40" cy="24" rx="20" ry="14" fill={colors.leaf} />
        <ellipse cx="40" cy="20" rx="14" ry="8" fill={colors.accent} opacity="0.6" />
        
        {/* Center leaf with face */}
        <ellipse cx="40" cy="44" rx="24" ry="20" fill={colors.leaf} />
        <ellipse cx="40" cy="40" rx="18" ry="12" fill={colors.accent} opacity="0.4" />
        
        {/* Face expression based on state */}
        {getExpression()}
      </svg>
      
      {/* State indicator badge */}
      <div className={cn(
        "absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium",
        state === "healthy" && "bg-green-100 text-green-700",
        state === "happy" && "bg-emerald-100 text-emerald-700",
        state === "thirsty" && "bg-yellow-100 text-yellow-700",
        state === "hot" && "bg-red-100 text-red-700",
        state === "cold" && "bg-blue-100 text-blue-700",
        state === "dark" && "bg-gray-100 text-gray-700",
        state === "fallen" && "bg-rose-100 text-rose-700",
      )}>
        {state === "healthy" && "状态良好"}
        {state === "happy" && "心情愉快"}
        {state === "thirsty" && "需要浇水"}
        {state === "hot" && "温度过高"}
        {state === "cold" && "温度过低"}
        {state === "dark" && "光照不足"}
        {state === "fallen" && "花盆倾斜"}
      </div>
    </div>
  )
}
