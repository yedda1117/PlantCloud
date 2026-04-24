import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Activity, Bot, Check, ChevronDown, FileText, Leaf, LibraryBig, Loader2, Send, Upload, UserRound, X } from "lucide-react"
import {
  askPlantAi,
  createStrategyFromProposal,
  getDevicesStatus,
  getKnowledgeFiles,
  getStrategyProposal,
  uploadKnowledgeFiles,
} from "../api"
import type { ChatMessage, HomeRealtimeData, Plant, StrategyAgentProposal, UploadedFileItem } from "../types"
import {
  actionLabels,
  buildMobilePlantContext,
  buildStrategyPayloadFromProposal,
  fallbackFiles,
  formatLight,
  formatNumber,
  formatProposalCondition,
  getCurrentUserId,
  impact,
  isStrategyChangeQuestion,
  quickQuestions,
} from "../mobile-utils"

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function AiPage({ plant, realtime }: { plant: Plant; realtime: HomeRealtimeData | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "您好，我是您的植物养护助手。我会结合知识库、当前环境数据和自动化策略上下文，为您给出可执行的养护建议。",
      time: "09:00",
    },
  ])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [showSources, setShowSources] = useState<string | null>(null)
  const [files, setFiles] = useState<UploadedFileItem[]>([])
  const [filesLoading, setFilesLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeSheet, setActiveSheet] = useState<"status" | "knowledge" | null>(null)
  const [pendingProposal, setPendingProposal] = useState<StrategyAgentProposal | null>(null)
  const [creatingStrategy, setCreatingStrategy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const chatInputRef = useRef<HTMLInputElement | null>(null)
  const sendingRef = useRef(false)

  const visibleFiles = files.length ? files : fallbackFiles
  const hasStartedChat = messages.some((message) => message.role === "user")

  const fetchFiles = useCallback(async () => {
    try {
      setFilesLoading(true)
      setFiles(await getKnowledgeFiles())
    } catch {
      setFiles([])
    } finally {
      setFilesLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchFiles()
  }, [fetchFiles])

  const send = useCallback(async (forcedContent?: string) => {
    const content = (forcedContent ?? chatInputRef.current?.value ?? input).trim()
    if (!content || sendingRef.current) return
    sendingRef.current = true
    impact()
    const now = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    const userMessage: ChatMessage = { id: createMessageId(), role: "user", content, time: now }
    const history = messages.slice(-8).map((item) => ({ role: item.role, content: item.content }))
    setMessages((items) => [...items, userMessage])
    setInput("")
    setSending(true)
    try {
      const context = buildMobilePlantContext(plant, realtime)
      const result = await askPlantAi(content, context.contextText, history)
      setMessages((items) => [...items, { id: createMessageId(), role: "assistant", content: result.answer, sources: result.sources, time: "刚刚" }])
      if (isStrategyChangeQuestion(content)) {
        const proposal = await getStrategyProposal(content, result.answer, context, context.contextText)
        if (proposal?.shouldSuggest) setPendingProposal(proposal)
      }
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: createMessageId(),
          role: "assistant",
          content: error instanceof Error ? error.message : "AI 服务连接失败，请检查 VITE_WEB_API_BASE_URL 是否指向网页端服务。",
          time: "刚刚",
        },
      ])
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [input, messages, plant, realtime])

  const uploadFiles = async (selectedFiles: FileList | File[]) => {
    if (!selectedFiles.length || uploading) return
    try {
      setUploading(true)
      await uploadKnowledgeFiles(selectedFiles)
      await fetchFiles()
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: createMessageId(),
          role: "assistant",
          content: error instanceof Error ? `上传失败：${error.message}` : "上传失败，请稍后重试。",
          time: "刚刚",
        },
      ])
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const confirmStrategy = async () => {
    if (!pendingProposal || creatingStrategy) return
    try {
      setCreatingStrategy(true)
      const devicesStatus = await getDevicesStatus(plant.plantId)
      const targetDeviceId =
        pendingProposal.actionType === "AUTO_LIGHT"
          ? devicesStatus?.light?.deviceId != null
            ? String(devicesStatus.light.deviceId)
            : null
          : pendingProposal.actionType === "AUTO_FAN"
            ? devicesStatus?.fan?.deviceId != null
              ? String(devicesStatus.fan.deviceId)
              : null
            : null
      const payload = buildStrategyPayloadFromProposal(pendingProposal, plant, realtime, targetDeviceId)
      if (!getCurrentUserId()) {
        throw new Error("请先登录后再新增策略，移动端需要登录态里的 userId 作为 createdBy。")
      }
      if (pendingProposal.actionType !== "NOTIFY_USER" && !targetDeviceId) {
        throw new Error("未获取到对应执行设备，暂时无法创建自动控制策略")
      }
      await createStrategyFromProposal(payload)
      setMessages((items) => [...items, { id: createMessageId(), role: "assistant", content: `已新增策略：${pendingProposal.strategyName}。您可以到设置页查看或调整。`, time: "刚刚" }])
      setPendingProposal(null)
    } catch (error) {
      setMessages((items) => [...items, { id: createMessageId(), role: "assistant", content: error instanceof Error ? `新增策略失败：${error.message}` : "新增策略失败。", time: "刚刚" }])
    } finally {
      setCreatingStrategy(false)
    }
  }

  return (
    <main className="screen ai-screen web-chat-mobile">
      <section className="mobile-chat-panel">
        <div className="assistant-summary compact-ai-header">
          <div className="assistant-brand">
            <div className="assistant-icon">
              <Leaf size={22} />
            </div>
            <div>
              <p>PlantCloud AI</p>
              <h1>植物问答</h1>
            </div>
          </div>
          <div className="ai-header-actions">
            <button type="button" onClick={() => setActiveSheet("status")} aria-label="实时状态">
              <Activity size={18} />
            </button>
            <button type="button" onClick={() => setActiveSheet("knowledge")} aria-label="知识库">
              <LibraryBig size={18} />
            </button>
          </div>
        </div>

        {!hasStartedChat ? (
          <section className="ai-floating-brand" aria-label="PlantCloud AI">
            <div className="ai-orbit-logo">
              <span className="orbit-ring orbit-ring-a" />
              <span className="orbit-ring orbit-ring-b" />
              <span className="logo-glass" />
              <span className="logo-stem" />
              <span className="logo-leaf logo-leaf-top" />
              <span className="logo-leaf logo-leaf-left" />
              <span className="logo-leaf logo-leaf-right" />
              <span className="logo-base" />
            </div>
            <p>PlantCloud AI</p>
            <span>结合知识库、实时环境与策略上下文，为当前植物生成可执行建议</span>
          </section>
        ) : null}

        <section className="chat-list web-chat-list">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.article key={message.id} className={`chat-bubble ${message.role}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="avatar">{message.role === "assistant" ? <Bot size={15} /> : <UserRound size={15} />}</span>
                <div>
                  <p>{message.content}</p>
                  <small>{message.time}</small>
                  {message.role === "assistant" && message.sources?.length ? (
                    <div className="source-block">
                      <button type="button" onClick={() => setShowSources(showSources === message.id ? null : message.id)}>
                        查看 {message.sources.length} 个参考来源
                        <ChevronDown size={13} className={showSources === message.id ? "open" : ""} />
                      </button>
                      {showSources === message.id ? (
                        <div className="sources">
                          {message.sources.map((source, index) => (
                            <em key={`${source.file}-${source.section || ""}-${index}`}>
                              <FileText size={13} />
                              {source.file}
                              {source.section ? ` - ${source.section}` : ""}
                            </em>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
          {sending ? (
            <div className="thinking-card">
              <Leaf size={18} />
              <span>PlantCloud 正在思考</span>
              <i />
              <i />
              <i />
            </div>
          ) : null}
        </section>

        <div className="composer-card">
          <div className="quick-row">
            {quickQuestions.map((question) => (
              <button type="button" key={question} onClick={() => setInput(question)}>
                {question}
              </button>
            ))}
          </div>
          <form
            className="chat-input inline-composer"
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <input
              ref={chatInputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onInput={(event) => setInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void send()
                }
              }}
              placeholder="Hit me with your best shot! 想问什么养护问题？"
            />
            <button
              type="button"
              disabled={sending}
              onTouchEnd={(event) => {
                event.preventDefault()
                void send()
              }}
              onClick={() => {
                void send()
              }}
            >
              <Send size={17} />
            </button>
          </form>
        </div>
      </section>

      <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.md,.markdown" hidden onChange={(event) => event.target.files && void uploadFiles(event.target.files)} />

      <AnimatePresence>
        {activeSheet ? (
          <motion.div className="ai-sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveSheet(null)}>
            <motion.section
              className={`ai-bottom-sheet ${activeSheet === "knowledge" ? "knowledge-mode" : ""}`}
              initial={{ scale: 0.96, y: 8, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 8, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="modal-close" onClick={() => setActiveSheet(null)}>
                <X size={18} />
              </button>
              {activeSheet === "status" ? (
                <>
                  <div className="sheet-title">
                    <Activity size={20} />
                    <div>
                      <p>实时状态</p>
                      <h2>{plant.plantName}</h2>
                    </div>
                    <i className={realtime ? "online" : ""}>{realtime ? "在线" : "同步中"}</i>
                  </div>
                  <div className="context-metrics sheet-metrics">
                    {[
                      ["温度", formatNumber(realtime?.environment.temperature, "°C"), realtime?.environment.temperatureStatus || "未知"],
                      ["湿度", formatNumber(realtime?.environment.humidity, "%"), realtime?.environment.humidityStatus || "未知"],
                      ["光照", formatLight(realtime?.environment.lightLux), realtime?.environment.lightStatus || "未知"],
                    ].map(([label, value, status]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                        <em>{status}</em>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="sheet-title">
                    <LibraryBig size={20} />
                    <div>
                      <p>Knowledge Files</p>
                      <h2>植物知识库</h2>
                    </div>
                    <i>{filesLoading ? "同步中" : `${visibleFiles.length} 个`}</i>
                  </div>
                  <div className="book-shelf">
                    {visibleFiles.slice(0, 7).map((file, index) => (
                      <button key={file.id || `${file.name}-${index}`} title={file.name} style={{ height: 44 + (index % 4) * 13 }}>
                        <span />
                      </button>
                    ))}
                  </div>
                  <button type="button" className="upload-tile" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                    {uploading ? "正在整理资料..." : "上传知识资料"}
                  </button>
                  <div className="file-list">
                    {visibleFiles.map((file, index) => (
                      <button key={file.id || `${file.name}-row-${index}`} title={file.name}>
                        <FileText size={16} />
                        <span>{file.name}</span>
                        {file.status === "解析中" ? <Loader2 size={14} className="spin" /> : <i />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {pendingProposal ? (
        <div className="strategy-modal-backdrop">
          <section className="strategy-modal">
            <button type="button" className="modal-close" onClick={() => setPendingProposal(null)} disabled={creatingStrategy}>
              <X size={18} />
            </button>
            <div className="modal-plant-mark">
              <Leaf size={24} />
            </div>
            <p className="modal-kicker">PlantCloud Strategy</p>
            <h2>给 {plant.plantName} 新增策略</h2>
            <span>检测到{pendingProposal.detected}，建议启用一条自动化养护规则。</span>
            <div className="proposal-card">
              <strong>{pendingProposal.strategyName}</strong>
              <p>{pendingProposal.reason}</p>
            </div>
            <div className="proposal-grid">
              <div>
                <p>触发条件</p>
                <strong>{formatProposalCondition(pendingProposal)}</strong>
              </div>
              <div>
                <p>执行动作</p>
                <strong>{actionLabels[pendingProposal.actionType]}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setPendingProposal(null)} disabled={creatingStrategy}>暂不新增</button>
              <button type="button" onClick={() => void confirmStrategy()} disabled={creatingStrategy}>
                {creatingStrategy ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                {creatingStrategy ? "新增中..." : "确认新增"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
