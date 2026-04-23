import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Bot, Check, ChevronDown, FileText, Leaf, LibraryBig, Loader2, Send, Upload, UserRound, X } from "lucide-react"
import {
  askPlantAi,
  createStrategyFromProposal,
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
  impact,
  isStrategyChangeQuestion,
  quickQuestions,
} from "../mobile-utils"

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
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [pendingProposal, setPendingProposal] = useState<StrategyAgentProposal | null>(null)
  const [creatingStrategy, setCreatingStrategy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  const send = useCallback(async () => {
    const content = input.trim()
    if (!content || sending) return
    impact()
    const now = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content, time: now }
    const history = messages.slice(-8).map((item) => ({ role: item.role, content: item.content }))
    setMessages((items) => [...items, userMessage])
    setInput("")
    setSending(true)
    try {
      const context = buildMobilePlantContext(plant, realtime)
      const result = await askPlantAi(content, context.contextText, history)
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: result.answer, sources: result.sources, time: "刚刚" }])
      if (isStrategyChangeQuestion(content)) {
        const proposal = await getStrategyProposal(content, result.answer, context, context.contextText)
        if (proposal?.shouldSuggest) setPendingProposal(proposal)
      }
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: error instanceof Error ? error.message : "AI 服务连接失败，请检查 VITE_WEB_API_BASE_URL 是否指向网页端服务。",
          time: "刚刚",
        },
      ])
    } finally {
      setSending(false)
    }
  }, [input, messages, plant, realtime, sending])

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
          id: crypto.randomUUID(),
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
      const payload = buildStrategyPayloadFromProposal(pendingProposal, plant, realtime)
      if (pendingProposal.actionType !== "NOTIFY_USER" && !payload.targetDeviceId) {
        throw new Error("未获取到对应执行设备，暂时无法创建自动控制策略")
      }
      await createStrategyFromProposal(payload)
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: `已新增策略：${pendingProposal.strategyName}。您可以到设置页查看或调整。`, time: "刚刚" }])
      setPendingProposal(null)
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? `新增策略失败：${error.message}` : "新增策略失败。", time: "刚刚" }])
    } finally {
      setCreatingStrategy(false)
    }
  }

  return (
    <main className="screen ai-screen web-chat-mobile">
      <section className="mobile-chat-panel">
        <div className="assistant-summary">
          <div className="assistant-icon">
            <Bot size={23} />
          </div>
          <div>
            <p>Plant Assistant</p>
            <h1>植物问答助手</h1>
            <span>围绕养护知识、环境数据和自动化策略进行问答。</span>
          </div>
        </div>

        <div className="plant-context-card">
          <div className="context-head">
            <div>
              <p>{plant.plantName}</p>
              <span>实时生长环境</span>
            </div>
            <i className={realtime ? "online" : ""}>{realtime ? "在线" : "同步中"}</i>
          </div>
          <div className="context-metrics">
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
        </div>

        <button className="knowledge-toggle" onClick={() => setKnowledgeOpen((open) => !open)}>
          <span>
            <LibraryBig size={16} />
            植物知识库
          </span>
          <strong>{filesLoading ? "同步中" : `${visibleFiles.length} 个文件`}</strong>
        </button>

        {knowledgeOpen ? (
          <section className="knowledge-sheet">
            <div className="book-shelf">
              {visibleFiles.slice(0, 7).map((file, index) => (
                <button key={file.id || `${file.name}-${index}`} title={file.name} style={{ height: 44 + (index % 4) * 13 }}>
                  <span />
                </button>
              ))}
            </div>
            <button className="upload-tile" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
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
          </section>
        ) : null}

        {!hasStartedChat ? (
          <div className="mobile-hero-figure">
            <div className="glass-dome" />
            <div className="figure-leaf leaf-left" />
            <div className="figure-leaf leaf-right" />
            <div className="figure-pot" />
            <p>PlantCloud AI 养护助手</p>
            <span>结合知识库、环境数据和策略上下文回答问题</span>
          </div>
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
                      <button onClick={() => setShowSources(showSources === message.id ? null : message.id)}>
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
              <button key={question} onClick={() => setInput(question)}>
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
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Hit me with your best shot! 想问什么养护问题？" />
            <button disabled={!input.trim() || sending}>
              <Send size={17} />
            </button>
          </form>
        </div>
      </section>

      <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.md,.markdown" hidden onChange={(event) => event.target.files && void uploadFiles(event.target.files)} />

      {pendingProposal ? (
        <div className="strategy-modal-backdrop">
          <section className="strategy-modal">
            <button className="modal-close" onClick={() => setPendingProposal(null)} disabled={creatingStrategy}>
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
              <button onClick={() => setPendingProposal(null)} disabled={creatingStrategy}>暂不新增</button>
              <button onClick={() => void confirmStrategy()} disabled={creatingStrategy}>
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

