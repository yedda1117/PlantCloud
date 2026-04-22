"use client"

/**
 * GpsMap — 纯客户端 Leaflet 地图组件
 * 通过 dynamic() + ssr:false 加载，避免 SSR 报错。
 * 组件卸载时 Leaflet 实例会随 DOM 一起销毁，无内存泄漏。
 */

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"

interface GpsMapProps {
  lat: number
  lng: number
  plantName: string
  className?: string
}

export default function GpsMap({ lat, lng, plantName, className }: GpsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  // 保存 map 实例，用于卸载时销毁
  const mapRef = useRef<import("leaflet").Map | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current) return

    // 动态 import，确保只在客户端执行
    let cancelled = false

    const initMap = async () => {
      const L = (await import("leaflet")).default

      if (cancelled || !mapContainerRef.current) return

      // 修复 Leaflet 默认图标路径问题（Next.js 打包后路径会丢失）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      // 创建地图实例
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
        attributionControl: false,
      })

      // 使用 OpenStreetMap 瓦片（无需 API Key）
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map)

      // 自定义植物图标（使用 emoji + DivIcon）
      const plantIcon = L.divIcon({
        html: `<div style="
          font-size: 24px;
          line-height: 1;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
          transform: translateY(-50%);
        ">🌿</div>`,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -30],
      })

      // 添加标记
      L.marker([lat, lng], { icon: plantIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:13px;font-weight:600;white-space:nowrap">🌿 ${plantName}</div>`,
          { closeButton: false, offset: [0, -10] }
        )
        .openPopup()

      mapRef.current = map
    }

    void initMap()

    // 卸载时销毁地图，防止内存泄漏
    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [lat, lng, plantName])

  return (
    <div
      ref={mapContainerRef}
      className={className}
      style={{ width: "100%", height: "100%", borderRadius: "inherit", overflow: "hidden" }}
    />
  )
}
