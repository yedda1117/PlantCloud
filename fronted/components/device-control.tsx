"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { Fan, Lightbulb, Minus, Plus } from "lucide-react"

interface DeviceControlProps {
  type: "light" | "fan"
  isOn: boolean
  onToggle: (value: boolean) => void
}

const text = {
  lightName: "\u8865\u5149\u706f",
  fanName: "\u98ce\u6247",
  brightness: "\u4eae\u5ea6",
  speed: "\u98ce\u901f",
  openSettingsPrefix: "\u6253\u5f00",
  settings: "\u8bbe\u7f6e",
  adjustDescPrefix: "\u8c03\u6574",
  adjustDescMiddle: "\u7684\u5f00\u5173\u72b6\u6001\u548c",
  deviceStatus: "\u8bbe\u5907\u72b6\u6001",
  running: "\u6b63\u5728\u8fd0\u884c",
  closedNow: "\u5f53\u524d\u5df2\u5173\u95ed",
  close: "\u5173\u95ed",
  open: "\u5f00\u542f",
  closed: "\u5df2\u5173\u95ed",
  adjust: "\u8c03\u8282",
  decrease: "\u964d\u4f4e",
  increase: "\u63d0\u9ad8",
  lowBrightness: "\u4f4e\u4eae\u5ea6",
  midBrightness: "\u4e2d\u4eae\u5ea6",
  highBrightness: "\u9ad8\u4eae\u5ea6",
  lowSpeed: "\u4f4e\u901f",
  midSpeed: "\u4e2d\u901f",
  highSpeed: "\u9ad8\u901f",
  lowGear: "\u4f4e\u6863",
  midGear: "\u4e2d\u6863",
  highLight: "\u9ad8\u4eae",
  enablePrefix: "\u5f00\u542f",
  enableSuffix: "\u540e\u5373\u53ef\u8c03\u8282",
  current: "\u5f53\u524d",
  estimatedPower: "\uff0c\u9884\u8ba1\u529f\u8017",
  estimatedSpeed: "\uff0c\u9884\u8ba1\u8f6c\u901f",
}

const deviceConfig = {
  light: {
    icon: Lightbulb,
    name: text.lightName,
    unit: text.brightness,
    activeBg: "bg-amber-100",
    inactiveBg: "bg-gray-100",
    activeIcon: "text-amber-600",
    inactiveIcon: "text-gray-400",
    activeBadge: "bg-amber-100 text-amber-700",
    inactiveBadge: "bg-gray-100 text-gray-600",
  },
  fan: {
    icon: Fan,
    name: text.fanName,
    unit: text.speed,
    activeBg: "bg-blue-100",
    inactiveBg: "bg-gray-100",
    activeIcon: "text-blue-600",
    inactiveIcon: "text-gray-400",
    activeBadge: "bg-blue-100 text-blue-700",
    inactiveBadge: "bg-gray-100 text-gray-600",
  },
} as const

export function DeviceControl({ type, isOn, onToggle }: DeviceControlProps) {
  const [intensity, setIntensity] = useState(type === "light" ? 75 : 60)

  const config = deviceConfig[type]
  const Icon = config.icon
  const fanSpinStyle =
    isOn && type === "fan"
      ? { animationDuration: `${Math.max(0.3, 2 - intensity / 50)}s` }
      : undefined

  const statusLabel = getStatusLabel(type, isOn, intensity)

  const handleQuickAdjust = (delta: number) => {
    setIntensity((prev) => Math.max(0, Math.min(100, prev + delta)))
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="relative z-30 flex flex-1 items-center gap-3 rounded-xl text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`${text.openSettingsPrefix}${config.name}${text.settings}`}
        >
          <span className={cn("rounded-xl p-2", isOn ? config.activeBg : config.inactiveBg)}>
            <Icon
              className={cn(
                "h-5 w-5",
                isOn ? config.activeIcon : config.inactiveIcon,
                isOn && type === "fan" && "animate-spin",
              )}
              style={fanSpinStyle}
            />
          </span>

          <span className="min-w-[80px] flex-1">
            <span className="block text-sm font-medium">{config.name}</span>
            <span className="block text-xs text-muted-foreground">{statusLabel}</span>
          </span>

          <Badge variant="secondary" className={isOn ? config.activeBadge : config.inactiveBadge}>
            {isOn ? `${intensity}%` : text.closed}
          </Badge>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon
              className={cn(
                "h-5 w-5",
                config.activeIcon,
                isOn && type === "fan" && "animate-spin",
              )}
              style={fanSpinStyle}
            />
            {config.name}
            {text.settings}
          </DialogTitle>
          <DialogDescription>
            {text.adjustDescPrefix}
            {config.name}
            {text.adjustDescMiddle}
            {config.unit}
            {"."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-xl p-3", isOn ? config.activeBg : config.inactiveBg)}>
                <Icon
                  className={cn(
                    "h-6 w-6",
                    isOn ? config.activeIcon : config.inactiveIcon,
                    isOn && type === "fan" && "animate-spin",
                  )}
                  style={fanSpinStyle}
                />
              </div>
              <div>
                <p className="font-medium">{text.deviceStatus}</p>
                <p className="text-sm text-muted-foreground">
                  {isOn ? text.running : text.closedNow}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant={isOn ? "default" : "outline"}
              size="lg"
              onClick={() => onToggle(!isOn)}
            >
              {isOn ? text.close : text.open}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium">
                {config.unit}
                {text.adjust}
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleQuickAdjust(-10)}
                  disabled={!isOn || intensity <= 0}
                  aria-label={`${text.decrease}${config.unit}`}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="min-w-[60px] text-center text-2xl font-bold">{intensity}%</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleQuickAdjust(10)}
                  disabled={!isOn || intensity >= 100}
                  aria-label={`${text.increase}${config.unit}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Slider
              value={[intensity]}
              onValueChange={(value) => setIntensity(value[0] ?? intensity)}
              min={0}
              max={100}
              step={1}
              className="w-full"
              disabled={!isOn}
            />

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              {[25, 50, 100].map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIntensity(value)}
                  className={intensity === value ? "border-primary" : ""}
                  disabled={!isOn}
                >
                  {getPresetLabel(type, value)}
                </Button>
              ))}
            </div>

            {!isOn && (
              <p className="pt-2 text-center text-xs text-muted-foreground">
                {text.enablePrefix}
                {config.name}
                {text.enableSuffix}
                {config.unit}
                {"."}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground">
              {text.current}
              {config.unit}
              {": "}
              <span className="font-medium text-foreground">{statusLabel}</span>
              {isOn ? getRuntimeText(type, intensity) : null}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getStatusLabel(type: "light" | "fan", isOn: boolean, intensity: number) {
  if (!isOn) return text.closed

  if (type === "light") {
    if (intensity < 30) return text.lowBrightness
    if (intensity < 70) return text.midBrightness
    return text.highBrightness
  }

  if (intensity < 30) return text.lowSpeed
  if (intensity < 70) return text.midSpeed
  return text.highSpeed
}

function getPresetLabel(type: "light" | "fan", value: number) {
  const label =
    value === 25 ? text.lowGear :
    value === 50 ? text.midGear :
    type === "light" ? text.highLight : text.highSpeed

  return `${label} (${value}%)`
}

function getRuntimeText(type: "light" | "fan", intensity: number) {
  if (type === "light") {
    return `${text.estimatedPower} ${Math.round(intensity * 0.15)}W`
  }

  return `${text.estimatedSpeed} ${Math.round(intensity * 20)} RPM`
}
