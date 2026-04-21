"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { usePlantSelection } from "@/context/plant-selection" // [修改] 引入全局 Context 钩子
import  DashMain  from "./DashMain" // [修改] 添加花括号，匹配 DashMain.tsx 的命名导出
import DashDetail from "./DashDetail"

// [修改] 移除硬编码的静态 plants 数组，数据将从 Context 获取

function DashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // [修改] 从全局状态获取 plants 列表和状态逻辑
  const { plants } = usePlantSelection()
  
  const plantId = searchParams.get("plant")
  
  // [修改] 从动态获取的 plants 列表中查找当前选中的植物
  const plant = plants.find((item) => item.id === plantId)

  if (plant) {
    return <DashDetail plant={plant} onBack={() => router.push("/dashboard")} />
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-foreground">植物监测总览</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            点击任意植物卡片查看环境分析详情
          </p>
        </div>
        {/* [修改] 将从 Context 获取的动态 plants 列表传入 DashMain */}
        <DashMain plants={plants} />
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Suspense>
        <DashboardContent />
      </Suspense>
    </AuthGuard>
  )
}

// "use client"

// import { Suspense } from "react"
// import { useRouter, useSearchParams } from "next/navigation"
// import { AuthGuard } from "@/components/auth-guard"
// import DashMain from "./DashMain"
// import DashDetail from "./DashDetail"

// export type PlantMeta = {
//   id: string
//   plantId: number
//   name: string
//   emoji: string
// }

// const plants: PlantMeta[] = [
//   { id: "p1", plantId: 1, name: "绿萝", emoji: "🌿" },
//   { id: "p2", plantId: 2, name: "多肉植物", emoji: "🌵" },
//   { id: "p3", plantId: 3, name: "薰衣草", emoji: "🌸" },
//   { id: "p4", plantId: 4, name: "番茄苗", emoji: "🍅" },
//   { id: "p5", plantId: 5, name: "薄荷", emoji: "🌱" },
//   { id: "p6", plantId: 6, name: "仙人掌", emoji: "🌵" },
// ]

// function DashboardContent() {
//   const searchParams = useSearchParams()
//   const router = useRouter()
//   const plantId = searchParams.get("plant")
//   const plant = plants.find((item) => item.id === plantId)

//   if (plant) {
//     return <DashDetail plant={plant} onBack={() => router.push("/dashboard")} />
//   }

//   return (
//     <div className="min-h-screen bg-background">
//       <main className="container mx-auto px-6 py-6">
//         <div className="mb-5">
//           <h1 className="text-xl font-semibold text-foreground">植物监测总览</h1>
//           <p className="mt-0.5 text-sm text-muted-foreground">
//             点击任意植物卡片查看环境分析详情
//           </p>
//         </div>
//         <DashMain plants={plants} />
//       </main>
//     </div>
//   )
// }

// export default function DashboardPage() {
//   return (
//     <AuthGuard>
//       <Suspense>
//         <DashboardContent />
//       </Suspense>
//     </AuthGuard>
//   )
// }
