"use client"

import { useEffect, useRef, useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getIntegratedControlDeviceId } from "@/lib/device-api"
import { getHomeRealtime, type HomeRealtimeData } from "@/lib/home-api"
import { getPlantContextPayload, type PlantContextPayload } from "@/lib/plant-context"
import { createStrategy, type StrategyUpsertPayload } from "@/lib/strategy-api"
import { usePlantSelection } from "@/context/plant-selection"
import {
  ArrowUp,
  Bot,
  ChevronDown,
  FileText,
  Leaf,
  LibraryBig,
  Loader2,
  Upload,
  User,
} from "lucide-react"

type ChatSource = {
  file: string
  section?: string
}

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  time: string
  sources?: ChatSource[]
}

type UploadedFileItem = {
  id?: string
  name: string
  time: string
  status: "已入库" | "解析中" | "失败"
}

type StrategyAgentProposal = {
  shouldSuggest: boolean
  detected: string
  strategyName: string
  metricType: "LIGHT" | "TEMPERATURE" | "HUMIDITY"
  operatorType: "LT" | "GT" | "EQ"
  thresholdMin: number
  actionType: "AUTO_LIGHT" | "AUTO_FAN" | "NOTIFY_USER"
  actionValue: "ON" | "OFF" | "LOW" | "HIGH" | "INFO" | "WARNING" | "DANGER"
  timeLimitEnabled?: boolean
  startTime?: string | null
  endTime?: string | null
  reason: string
}

function normalizeProposalActionValue(proposal: StrategyAgentProposal) {
  if (proposal.actionType === "AUTO_LIGHT") {
    return proposal.actionValue === "OFF" ? "OFF" : "ON"
  }
  if (proposal.actionType === "AUTO_FAN") {
    return proposal.actionValue === "LOW" ? "LOW" : "HIGH"
  }
  if (proposal.actionValue === "DANGER" || proposal.actionValue === "WARNING") {
    return proposal.actionValue
  }
  return "INFO"
}

const suggestedQuestions = [
  "绿萝叶子发黄怎么办",
  "多肉多久浇一次水",
  "植物适合多少湿度",
  "光照不足会有什么表现",
  "策略是否要更改",
]

const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "您好，我是您的植物养护助手。我会结合知识库、当前环境数据和自动化策略上下文，为您给出可执行的养护建议。",
    time: "09:00",
  },
]

const fallbackFiles: UploadedFileItem[] = [
  { name: "绿萝养护手册.pdf", time: "示例资料", status: "已入库" },
  { name: "多肉控水指南.md", time: "示例资料", status: "已入库" },
  { name: "温湿度策略规范.docx", time: "示例资料", status: "解析中" },
  { name: "病虫害识别卡片.txt", time: "示例资料", status: "已入库" },
]

const shelfColors = [
  "from-emerald-500 to-teal-600",
  "from-lime-400 to-emerald-500",
  "from-cyan-400 to-teal-500",
  "from-amber-300 to-lime-500",
  "from-green-600 to-emerald-700",
]

function isStrategyChangeQuestion(message: string) {
  return /策略/.test(message) && /(更改|修改|调整|新增|优化|要不要|是否)/.test(message)
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
  return atob(padded)
}

function getCurrentUserId() {
  if (typeof window === "undefined") {
    return undefined
  }

  const token = window.localStorage.getItem("plantcloud_token")
  if (token) {
    try {
      const [, payload = ""] = token.split(".")
      const decoded = decodeBase64Url(payload)
      const matched = decoded.match(/"userId"\s*:\s*("?)(-?\d+)\1/)
      if (matched?.[2]) {
        return matched[2]
      }
    } catch {
      // Fallback to stored user below.
    }
  }

  const rawUser = window.localStorage.getItem("plantcloud_user")
  if (!rawUser) {
    return undefined
  }

  try {
    const parsed = JSON.parse(rawUser) as { userId?: string | number; id?: string | number }
    return parsed.userId != null
      ? String(parsed.userId)
      : parsed.id != null
        ? String(parsed.id)
        : undefined
  } catch {
    return undefined
  }
}

function buildStrategyPayloadFromProposal(
  proposal: StrategyAgentProposal,
  plantContext: PlantContextPayload,
  userId: string | undefined,
  targetDeviceId: string | null,
): StrategyUpsertPayload {
  return {
    plantId: String(plantContext.selectedPlant.plantId),
    createdBy: userId,
    strategyName: proposal.strategyName,
    strategyType: "CONDITION",
    metricType: proposal.metricType,
    operatorType: proposal.operatorType,
    thresholdMin: proposal.thresholdMin,
    actionType: proposal.actionType,
    actionValue: normalizeProposalActionValue(proposal),
    targetDeviceId,
    enabled: true,
    priority: 10,
    timeLimitEnabled: Boolean(proposal.timeLimitEnabled),
    startTime: proposal.timeLimitEnabled ? proposal.startTime ?? null : null,
    endTime: proposal.timeLimitEnabled ? proposal.endTime ?? null : null,
    configJson: {
      timeLimitEnabled: Boolean(proposal.timeLimitEnabled),
      ...(proposal.timeLimitEnabled
        ? {
            ...(proposal.startTime ? { startTime: proposal.startTime } : {}),
            ...(proposal.endTime ? { endTime: proposal.endTime } : {}),
          }
        : {}),
      notifyTitleTemplate: proposal.strategyName,
      notifyContentTemplate: proposal.reason,
    },
  }
}

const metricLabels: Record<StrategyAgentProposal["metricType"], string> = {
  LIGHT: "光照强度",
  TEMPERATURE: "温度",
  HUMIDITY: "湿度",
}

const metricUnits: Record<StrategyAgentProposal["metricType"], string> = {
  LIGHT: "lux",
  TEMPERATURE: "°C",
  HUMIDITY: "%",
}

const operatorLabels: Record<StrategyAgentProposal["operatorType"], string> = {
  LT: "<",
  GT: ">",
  EQ: "=",
}

const actionLabels: Record<StrategyAgentProposal["actionType"], string> = {
  AUTO_LIGHT: "开启补光灯",
  AUTO_FAN: "启动风扇",
  NOTIFY_USER: "通知用户",
}

function formatProposalCondition(proposal: StrategyAgentProposal) {
  const timeLimit =
    proposal.timeLimitEnabled && proposal.startTime && proposal.endTime
      ? `，且时间在 ${proposal.startTime}-${proposal.endTime}`
      : ""

  return `${metricLabels[proposal.metricType]} ${operatorLabels[proposal.operatorType]} ${proposal.thresholdMin} ${metricUnits[proposal.metricType]}${timeLimit}`
}

function formatProposalAction(proposal: StrategyAgentProposal) {
  return actionLabels[proposal.actionType]
}

function formatMetricValue(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "--"
  }
  return `${Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}${unit}`
}

function normalizeStatus(status: string | null | undefined) {
  if (!status) {
    return "未知"
  }
  if (/normal|ok|good|适宜|正常/i.test(status)) {
    return "适宜"
  }
  if (/high|hot|强|高|偏高/i.test(status)) {
    return "偏高"
  }
  if (/low|cold|weak|低|不足|偏低/i.test(status)) {
    return "偏低"
  }
  return status
}

function PlantKnowledgeFigure() {
  return (
    <div className="plant-float relative mx-auto h-40 w-64" aria-hidden="true">
      <div className="absolute left-1/2 top-8 h-28 w-44 -translate-x-1/2 rounded-full bg-emerald-100/70 blur-3xl" />

      <div className="absolute left-1/2 top-3 h-28 w-36 -translate-x-1/2 rounded-t-[4rem] rounded-b-[1.8rem] border border-white/95 bg-gradient-to-b from-white/62 via-cyan-50/28 to-white/14 shadow-[inset_0_1px_14px_rgba(255,255,255,0.88),0_24px_42px_rgba(6,95,70,0.14)] backdrop-blur-xl" />
      <div className="absolute left-1/2 top-4 h-[6.6rem] w-[8rem] -translate-x-1/2 rounded-t-[3.7rem] rounded-b-[1.5rem] border border-cyan-200/35" />
      <div className="absolute left-[5.05rem] top-5 h-24 w-6 rounded-full bg-white/42 blur-[1px]" />
      <div className="absolute right-[5.2rem] top-7 h-16 w-2 rounded-full bg-white/70" />
      <div className="absolute left-1/2 top-5 h-4 w-20 -translate-x-1/2 rounded-full bg-white/45 blur-[0.5px]" />

      <div className="absolute left-1/2 top-7 h-20 w-0.5 -translate-x-1/2 rounded-full bg-emerald-700" />
      <div className="absolute left-[6.2rem] top-12 h-10 w-16 -rotate-[24deg] rounded-[999px_999px_999px_220px] bg-gradient-to-br from-lime-200 to-emerald-500 shadow-lg shadow-emerald-700/12" />
      <div className="absolute right-[6.2rem] top-12 h-10 w-16 rotate-[24deg] rounded-[999px_999px_220px_999px] bg-gradient-to-bl from-cyan-200 to-teal-500 shadow-lg shadow-teal-700/12" />
      <div className="absolute left-1/2 top-7 h-14 w-10 -translate-x-1/2 rounded-t-[2rem] rounded-b-[0.75rem] bg-gradient-to-b from-emerald-700 to-emerald-500 shadow-lg shadow-emerald-900/14" />

      <div className="absolute left-1/2 top-[6.35rem] h-9 w-32 -translate-x-1/2 rounded-[999px] bg-gradient-to-b from-emerald-800 to-emerald-950 shadow-xl shadow-emerald-900/18" />
      <div className="absolute left-1/2 top-[6.55rem] h-4 w-24 -translate-x-1/2 rounded-full bg-emerald-700/70" />
      <div className="absolute left-1/2 top-[7.35rem] h-5 w-44 -translate-x-1/2 rounded-full border border-white/90 bg-white/72 shadow-lg shadow-emerald-900/10" />
      <div className="absolute left-1/2 top-[7.55rem] h-2 w-36 -translate-x-1/2 rounded-full bg-cyan-100/55" />
    </div>
  )
}

function PlantThinkingLoader() {
  return (
    <div className="flex justify-center py-7">
      <div className="relative flex min-w-[220px] items-center gap-4 rounded-[1.5rem] border border-white/80 bg-white/64 px-5 py-4 shadow-xl shadow-emerald-900/8 backdrop-blur-xl">
        <div className="absolute inset-x-8 -top-4 h-8 rounded-full bg-emerald-200/35 blur-xl" />
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-white to-emerald-50 shadow-lg shadow-emerald-900/10">
          <span className="absolute h-14 w-14 rounded-full border border-emerald-200/70 border-t-emerald-600/80 animate-[spin_2.8s_linear_infinite]" />
          <span className="absolute h-8 w-8 rounded-full bg-lime-200/35 animate-ping" />
          <Leaf className="relative h-5 w-5 text-emerald-700" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">PlantCloud 正在思考</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600 [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lime-500" />
            <span className="ml-2 text-xs text-zinc-500">检索知识库与实时环境</span>
          </div>
        </div>
      </div>
    </div>
  )
}

type DynamicBookshelfProps = {
  files: UploadedFileItem[]
  isFilesLoading: boolean
  filesError: string
  isUploading: boolean
  dragActive: boolean
  selectedIndex: number
  onSelect: (index: number) => void
  onUploadClick: () => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  onDragActiveChange: (active: boolean) => void
}

function DynamicBookshelf({
  files,
  isFilesLoading,
  filesError,
  isUploading,
  dragActive,
  selectedIndex,
  onSelect,
  onUploadClick,
  onDrop,
  onDragActiveChange,
}: DynamicBookshelfProps) {
  const visibleFiles = files.length > 0 ? files : filesError ? [] : fallbackFiles

  return (
    <aside className="flex min-h-0 flex-col border-l border-white/10 bg-gradient-to-b from-emerald-950 via-teal-900 to-cyan-800 p-6 text-white">
      <div className="mb-5 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-50/46">Knowledge Files</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
            <LibraryBig className="h-4 w-4 text-lime-200/90" />
            植物知识库
          </h2>
        </div>
        {isFilesLoading ? <Loader2 className="h-5 w-5 animate-spin text-lime-200" /> : <Badge className="rounded-full bg-white/18 px-3 text-white hover:bg-white/18">{files.length}</Badge>}
      </div>

      <div className="relative mb-5 overflow-hidden rounded-[1.55rem] border border-white/14 bg-white/12 p-4 shadow-inner shadow-black/10">
        <div className="absolute inset-x-4 top-[4.1rem] h-2 rounded-full bg-black/18" />
        <div className="absolute inset-x-4 bottom-8 h-2 rounded-full bg-black/18" />
        <div className="relative grid h-36 grid-cols-7 items-end gap-2 pb-6">
          {visibleFiles.slice(0, 7).map((file, index) => {
            const active = index === selectedIndex
            const height = 52 + (index % 4) * 18
            return (
              <button
                key={file.id || `${file.name}-shelf-${index}`}
                type="button"
                onClick={() => onSelect(index)}
                title={file.name}
                className={`group relative flex min-w-0 origin-bottom items-end transition duration-300 hover:-translate-y-2 ${active ? "-translate-y-2" : ""}`}
                style={{ height }}
              >
                <span className={`relative h-full w-full rounded-t-md bg-gradient-to-b ${shelfColors[index % shelfColors.length]} shadow-lg shadow-black/20`}>
                  <span className="absolute inset-y-3 left-1 w-1 rounded-full bg-white/32" />
                  <span className="absolute bottom-3 left-1/2 h-6 w-1.5 -translate-x-1/2 rounded-full bg-white/30" />
                  {active ? <span className="absolute -inset-1 -z-10 rounded-lg bg-lime-200/60 blur-md" /> : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {filesError ? (
        <div className="mb-5 rounded-[1.1rem] border border-amber-200/30 bg-amber-200/12 px-3 py-2 text-xs leading-5 text-amber-50">
          {filesError}
        </div>
      ) : null}

      <div
        onClick={onUploadClick}
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDragActiveChange(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDragActiveChange(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDragActiveChange(false)
        }}
        onDrop={onDrop}
        className={`group mb-5 cursor-pointer rounded-[1.35rem] border p-4 transition duration-300 ${
          dragActive ? "scale-[1.02] border-lime-200 bg-white/24 shadow-xl shadow-white/10" : "border-white/16 bg-white/12 shadow-lg shadow-black/10 hover:-translate-y-0.5 hover:bg-white/18"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-200 text-emerald-950 shadow-lg shadow-lime-900/12 transition duration-300 group-hover:-translate-y-1">
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{isUploading ? "正在整理资料..." : "拖入资料生成新书"}</p>
            <p className="mt-1 truncate text-xs text-cyan-50/62">PDF / DOCX / TXT / Markdown</p>
          </div>
        </div>
      </div>

      <div className="knowledge-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-1.5">
        {visibleFiles.length > 0 ? visibleFiles.map((file, index) => {
          const active = index === selectedIndex
          return (
            <button
              key={file.id || `${file.name}-${index}`}
              type="button"
              onClick={() => onSelect(index)}
              title={file.name}
              className={`flex w-full items-center gap-3 rounded-[1.2rem] border p-3 text-left transition duration-300 hover:-translate-y-0.5 hover:bg-white/18 hover:shadow-lg hover:shadow-black/10 ${
                active ? "border-lime-200/60 bg-white/20 shadow-lg shadow-black/10" : "border-transparent bg-white/8"
              }`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${shelfColors[index % shelfColors.length]} shadow-md shadow-emerald-900/10`}>
                <FileText className="h-5 w-5 text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{file.name}</span>
                <span className="mt-1 block truncate text-xs text-cyan-50/58">{file.time}</span>
              </span>
              {file.status === "解析中" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-200" /> : <span className="h-2 w-2 shrink-0 rounded-full bg-lime-200" />}
            </button>
          )
        }) : (
          <div className="rounded-[1.2rem] border border-white/12 bg-white/8 p-4 text-sm text-cyan-50/72">
            暂无文件
          </div>
        )}
      </div>
    </aside>
  )
}

export default function ChatPage() {
  const { currentPlant } = usePlantSelection()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showSources, setShowSources] = useState<number | null>(null)
  const [selectedKnowledgeIndex, setSelectedKnowledgeIndex] = useState(0)

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([])
  const [isFilesLoading, setIsFilesLoading] = useState(true)
  const [filesError, setFilesError] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [pendingProposal, setPendingProposal] = useState<StrategyAgentProposal | null>(null)
  const [pendingPlantContext, setPendingPlantContext] = useState<PlantContextPayload | null>(null)
  const [isCreatingStrategy, setIsCreatingStrategy] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<HomeRealtimeData | null>(null)
  const [isRealtimeLoading, setIsRealtimeLoading] = useState(true)

  const hasStartedChat = messages.some((message) => message.role === "user")

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchFiles = async () => {
    try {
      setIsFilesLoading(true)
      setFilesError("")

      const res = await fetch("/api/ragflow/files", {
        method: "GET",
        cache: "no-store",
      })

      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.success) {
        const errorMessage =
          typeof data?.error === "string" && data.error.trim()
            ? data.error
            : "知识库文件暂时不可用，已为你显示空文件列表。"
        console.warn("fetchFiles unavailable:", errorMessage)
        setUploadedFiles([])
        setSelectedKnowledgeIndex(0)
        setFilesError(errorMessage)
        return
      }

      setUploadedFiles(Array.isArray(data.files) ? data.files : [])
      setSelectedKnowledgeIndex(0)
      setFilesError("")
    } catch (error) {
      console.warn("fetchFiles unavailable:", error)
      setUploadedFiles([])
      setSelectedKnowledgeIndex(0)
      setFilesError("知识库文件暂时不可用，已为你显示空文件列表。")
    } finally {
      setIsFilesLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  useEffect(() => {
    let ignore = false

    const fetchRealtimeStatus = async () => {
      try {
        setIsRealtimeLoading(true)
        const token = typeof window === "undefined" ? "" : window.localStorage.getItem("plantcloud_token") || ""
        const data = await getHomeRealtime(currentPlant.plantId, token)
        if (!ignore) {
          setRealtimeStatus(data)
        }
      } catch (error) {
        console.error("fetchRealtimeStatus error:", error)
        if (!ignore) {
          setRealtimeStatus(null)
        }
      } finally {
        if (!ignore) {
          setIsRealtimeLoading(false)
        }
      }
    }

    void fetchRealtimeStatus()

    return () => {
      ignore = true
    }
  }, [currentPlant.plantId])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

    const userText = inputValue.trim()

    const newUserMessage: ChatMessage = {
      role: "user",
      content: userText,
      time: new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }

    setMessages((prev) => [...prev, newUserMessage])
    setInputValue("")
    setIsLoading(true)

    try {
      const plantContext = await getPlantContextPayload(currentPlant)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch("/api/ragflow/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userText,
          history,
          plantContextText: plantContext.contextText,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(typeof data.error === "string" ? data.error : "请求 RAGFlow 失败")
      }

      const aiResponse: ChatMessage = {
        role: "assistant",
        content: data.answer || "未获取到回答",
        time: new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        sources: Array.isArray(data.sources) ? data.sources : [],
      }

      setMessages((prev) => [...prev, aiResponse])

      if (isStrategyChangeQuestion(userText)) {
        const strategyRes = await fetch("/api/ragflow/strategy-agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userText,
            chatAnswer: data.answer || "",
            plantContext,
            plantContextText: plantContext.contextText,
          }),
        })

        const strategyData = await strategyRes.json()
        if (strategyData.success && strategyData.proposal?.shouldSuggest) {
          setPendingPlantContext(plantContext)
          setPendingProposal(strategyData.proposal)
        }
      }
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `连接失败：${error.message || "未知错误"}`,
        time: new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question)
  }

  const handleConfirmStrategyProposal = async () => {
    if (!pendingProposal || !pendingPlantContext || isCreatingStrategy) return

    setIsCreatingStrategy(true)
    try {
      const currentUserId = getCurrentUserId()
      if (!currentUserId) {
        throw new Error("当前登录信息缺少 userId，请重新登录后再新增策略")
      }

      const targetDeviceId =
        pendingProposal.actionType === "AUTO_LIGHT" || pendingProposal.actionType === "AUTO_FAN"
          ? await getIntegratedControlDeviceId(
              pendingPlantContext.selectedPlant.plantId,
              pendingPlantContext.realtime?.device.deviceId ?? null,
            )
          : null

      if (pendingProposal.actionType !== "NOTIFY_USER" && !targetDeviceId) {
        throw new Error("未获取到对应执行设备，暂时无法创建自动控制策略")
      }

      await createStrategy(buildStrategyPayloadFromProposal(pendingProposal, pendingPlantContext, currentUserId, targetDeviceId))

      const successMessage: ChatMessage = {
        role: "assistant",
        content: `已新增策略：${pendingProposal.strategyName}。您可以到设置页查看或调整。`,
        time: new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }

      setMessages((prev) => [...prev, successMessage])
      setPendingProposal(null)
      setPendingPlantContext(null)
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `新增策略失败：${error.message || "未知错误"}`,
        time: new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsCreatingStrategy(false)
    }
  }

  const uploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0 || isUploading) return

    try {
      setIsUploading(true)

      const formData = new FormData()
      Array.from(files).forEach((file) => {
        formData.append("files", file)
      })

      const res = await fetch("/api/ragflow/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || "上传失败")
      }

      await fetchFiles()
    } catch (error: any) {
      alert(error.message || "上传失败")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files)
    }
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files)
    }
  }

  return (
    <AuthGuard>
      <div className="relative min-h-screen overflow-hidden bg-[#dce8df] text-zinc-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(190,242,100,0.26),transparent_28%),radial-gradient(circle_at_88%_16%,rgba(45,212,191,0.18),transparent_30%),linear-gradient(180deg,rgba(232,244,235,0.98),rgba(218,243,226,0.94)_56%,rgba(157,231,207,0.86))]" />

        <main className="relative flex min-h-screen w-full flex-col px-5 py-5 lg:px-6">
          <section className="grid h-[calc(100vh-2.5rem)] min-h-[680px] overflow-hidden rounded-[2rem] border border-white/72 bg-white/46 shadow-2xl shadow-emerald-950/14 backdrop-blur-xl lg:grid-cols-[260px_minmax(0,1fr)_350px]">
            <aside className="hidden min-h-0 flex-col border-r border-white/18 bg-gradient-to-b from-emerald-800 via-teal-700 to-cyan-700 p-7 text-white lg:flex">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-100/90 text-emerald-900 shadow-lg shadow-emerald-950/10">
                  <Bot className="h-6 w-6" />
                </div>
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-50/58">Plant Assistant</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">植物问答助手</h2>
                  <p className="mt-3 text-sm leading-6 text-cyan-50/78">围绕养护知识、环境数据和自动化策略进行问答。</p>
                </div>

                <div className="mt-7 rounded-[1.4rem] border border-white/24 bg-white/18 p-4 shadow-xl shadow-emerald-950/10 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{currentPlant.emoji} {currentPlant.name}</p>
                      <p className="mt-1 text-xs text-cyan-50/72">实时生长环境</p>
                    </div>
                    {isRealtimeLoading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-lime-100" /> : <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-lime-100" />}
                  </div>

                  <div className="mt-4 grid gap-2">
                    {[
                      ["温度", formatMetricValue(realtimeStatus?.environment.temperature, "°C"), normalizeStatus(realtimeStatus?.environment.temperatureStatus)],
                      ["湿度", formatMetricValue(realtimeStatus?.environment.humidity, "%"), normalizeStatus(realtimeStatus?.environment.humidityStatus)],
                      ["光照", formatMetricValue(realtimeStatus?.environment.lightLux, " lux"), normalizeStatus(realtimeStatus?.environment.lightStatus)],
                    ].map(([label, value, status]) => (
                      <div key={label} className="rounded-[1rem] bg-white/18 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-cyan-50/76">{label}</span>
                          <span className="rounded-full bg-lime-100/88 px-2 py-0.5 text-[10px] font-medium text-emerald-900">{status}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-white">{isRealtimeLoading ? "..." : value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-gradient-to-b from-emerald-50/62 via-white/72 to-white/88 px-7 py-6">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {!hasStartedChat ? (
                  <div className="flex shrink-0 justify-center py-7">
                    <div className="text-center">
                      <PlantKnowledgeFigure />
                      <p className="-mt-2 text-sm font-medium text-zinc-700">PlantCloud AI 养护助手</p>
                      <p className="mt-1 text-xs text-zinc-400">结合知识库、环境数据和策略上下文回答问题</p>
                    </div>
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-hidden rounded-[1.7rem] bg-white/72 shadow-inner shadow-zinc-200/70">
                  <ScrollArea className="h-full">
                    <div className="space-y-4 p-4">
                      {messages.map((message, index) => (
                        <div key={index} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                          <Avatar className={`h-9 w-9 shrink-0 ${message.role === "user" ? "bg-zinc-950" : "bg-emerald-100"}`}>
                            <AvatarFallback className={message.role === "user" ? "bg-zinc-950 text-white" : "bg-emerald-100 text-emerald-800"}>
                              {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>

                          <div className={`max-w-[82%] min-w-0 ${message.role === "user" ? "items-end" : "items-start"}`}>
                            <div
                              className={`rounded-[1.25rem] px-4 py-3 shadow-lg ${
                                message.role === "user" ? "bg-zinc-950 text-white shadow-zinc-900/15" : "bg-white text-zinc-800 shadow-emerald-900/8"
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                            </div>

                            <p className={`mt-1 text-xs text-zinc-400 ${message.role === "user" ? "text-right" : ""}`}>{message.time}</p>

                            {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                              <div className="mt-2">
                                <button
                                  onClick={() => setShowSources(showSources === index ? null : index)}
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800 transition hover:bg-emerald-100"
                                >
                                  查看 {message.sources.length} 个参考来源
                                  <ChevronDown className={`h-3 w-3 transition-transform ${showSources === index ? "rotate-180" : ""}`} />
                                </button>

                                {showSources === index && (
                                  <div className="mt-2 space-y-2 rounded-2xl bg-emerald-50/70 p-3">
                                    {message.sources.map((source, sIndex) => (
                                      <div key={sIndex} className="flex items-start gap-2 text-xs text-zinc-600">
                                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                        <span>
                                          <span className="font-medium text-zinc-900">{source.file}</span>
                                          {source.section ? <span className="text-zinc-400"> - {source.section}</span> : null}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {isLoading && <PlantThinkingLoader />}
                    </div>
                  </ScrollArea>
                </div>

                <div className="mt-4 shrink-0 rounded-[1.6rem] bg-white/82 p-3 shadow-xl shadow-emerald-900/8">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {suggestedQuestions.map((question) => (
                      <button
                        key={question}
                        onClick={() => handleSuggestedQuestion(question)}
                        className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 transition hover:-translate-y-0.5 hover:bg-emerald-100 hover:text-emerald-800"
                      >
                        {question}
                      </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                      placeholder="Hit me with your best shot! 想问什么养护问题？"
                      className="h-10 flex-1 rounded-full border-transparent bg-zinc-50 px-4 text-sm focus-visible:ring-emerald-400"
                    />
                    <Button onClick={handleSend} disabled={!inputValue.trim() || isLoading} className="h-10 w-10 rounded-full bg-zinc-950 p-0 text-white hover:bg-zinc-800">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <DynamicBookshelf
              files={uploadedFiles}
              isFilesLoading={isFilesLoading}
              filesError={filesError}
              isUploading={isUploading}
              dragActive={dragActive}
              selectedIndex={selectedKnowledgeIndex}
              onSelect={setSelectedKnowledgeIndex}
              onUploadClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragActiveChange={setDragActive}
            />
          </section>
        </main>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.md,.markdown"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      <AlertDialog
        open={Boolean(pendingProposal)}
        onOpenChange={(open) => {
          if (!open && !isCreatingStrategy) {
            setPendingProposal(null)
            setPendingPlantContext(null)
          }
        }}
      >
        <AlertDialogContent className="overflow-hidden border border-white/70 bg-white/74 p-0 shadow-2xl shadow-emerald-950/16 backdrop-blur-2xl sm:max-w-[460px]">
          <div className="relative px-6 pb-6 pt-6">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-100/58 via-lime-50/42 to-transparent" />
            <div className="absolute left-1/2 top-5 h-20 w-36 -translate-x-1/2 rounded-full bg-emerald-200/20 blur-2xl" />
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-[1.25rem] border border-white/82 bg-gradient-to-b from-white/74 to-emerald-50/68 shadow-lg shadow-emerald-900/8">
              <span className="absolute -top-1.5 left-1/2 h-6 w-3 -translate-x-1/2 rotate-45 rounded-[999px_999px_999px_220px] bg-emerald-500" />
              <span className="absolute -top-0.5 left-[1.75rem] h-5 w-2.5 -rotate-[35deg] rounded-[999px_999px_220px_999px] bg-lime-400" />
              <span className="text-2xl leading-none">
                {currentPlant.emoji || <Leaf className="h-6 w-6 text-emerald-700" />}
              </span>
            </div>

            <AlertDialogHeader className="relative mt-4 items-center gap-2 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-700/70">PlantCloud Strategy</p>
              <AlertDialogTitle className="text-2xl font-semibold tracking-tight text-zinc-950">给 {currentPlant.name} 新增策略</AlertDialogTitle>
              <AlertDialogDescription className="max-w-sm text-xs leading-5 text-zinc-500">
                {pendingProposal ? `检测到${pendingProposal.detected}，建议启用一条自动化养护规则。` : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {pendingProposal ? (
              <div className="relative mt-5 space-y-3">
                <div className="rounded-[1.2rem] border border-white/80 bg-white/52 p-3.5 text-center shadow-lg shadow-emerald-900/6 backdrop-blur">
                  <p className="text-base font-semibold text-zinc-950">{pendingProposal.strategyName}</p>
                  <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-zinc-600">{pendingProposal.reason}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1rem] border border-emerald-100/80 bg-emerald-50/56 p-3.5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-800/70">触发条件</p>
                    <p className="mt-1.5 text-xs font-semibold leading-5 text-zinc-950">{formatProposalCondition(pendingProposal)}</p>
                  </div>
                  <div className="rounded-[1rem] border border-teal-100/80 bg-teal-50/54 p-3.5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-teal-800/70">执行动作</p>
                    <p className="mt-1.5 text-xs font-semibold leading-5 text-zinc-950">{formatProposalAction(pendingProposal)}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <AlertDialogFooter className="grid grid-cols-2 gap-3 border-t border-emerald-100/60 bg-white/38 px-6 pb-6 pt-3.5 sm:grid-cols-2 sm:justify-stretch">
            <AlertDialogCancel
              disabled={isCreatingStrategy}
              className="h-10 rounded-full border-emerald-100 bg-white/62 px-4 text-xs text-zinc-700 shadow-sm backdrop-blur hover:bg-white"
            >
              暂不新增
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmStrategyProposal()
              }}
              disabled={isCreatingStrategy}
              className="h-10 rounded-full bg-emerald-950 px-4 text-xs text-white shadow-lg shadow-emerald-950/16 hover:bg-emerald-900"
            >
              {isCreatingStrategy ? "新增中..." : "确认新增"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthGuard>
  )
}
