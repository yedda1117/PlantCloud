"use client"

import { useEffect, useRef, useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { NavHeader } from "@/components/nav-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Upload,
  FileText,
  Database,
  Lightbulb,
  Send,
  Bot,
  User,
  ChevronDown,
  CheckCircle,
  Loader2,
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

const suggestedQuestions = [
  "绿萝叶子发黄怎么办",
  "多肉多久浇一次水",
  "植物适合多少湿度",
  "光照不足会有什么表现",
]

const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "您好！我是您的植物养护助手。我可以结合您的植物知识库和当前环境数据为您提供专业的养护建议。您可以问我关于浇水、施肥、光照、病虫害等方面的问题。",
    time: "09:00",
  },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showSources, setShowSources] = useState<number | null>(null)

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([])
  const [isFilesLoading, setIsFilesLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchFiles = async () => {
    try {
      setIsFilesLoading(true)

      const res = await fetch("/api/ragflow/files", {
        method: "GET",
        cache: "no-store",
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || "获取文件列表失败")
      }

      setUploadedFiles(Array.isArray(data.files) ? data.files : [])
    } catch (error) {
      console.error("fetchFiles error:", error)
    } finally {
      setIsFilesLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

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
        }),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(
          typeof data.error === "string" ? data.error : "请求 RAGFlow 失败"
        )
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

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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
    <div className="min-h-screen bg-gradient-to-br from-green-100/80 via-emerald-50/50 to-teal-50/60">
      <NavHeader />

      <main className="container mx-auto px-4 py-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-100px)]">
          <div className="lg:col-span-3 space-y-2">
            <Card className="bg-white/90 border-green-200">
              <CardHeader className="pb-2 pt-2 px-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Database className="h-4 w-4" />
                  知识库
                </CardTitle>
              </CardHeader>

              <CardContent className="px-2 pb-2 pt-0 space-y-2">
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-primary/5">
                  <div>
                    <p className="text-base font-bold text-primary leading-none">
                      {uploadedFiles.length} 份
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      已收录资料
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-primary/40" />
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md,.markdown"
                  className="hidden"
                  onChange={handleFileInputChange}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragActive(true)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragActive(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragActive(false)
                  }}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-2 text-center transition-colors cursor-pointer ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-0.5" />
                  <p className="text-[9px] text-muted-foreground mb-0.5">
                    拖拽文件至此 或 点击上传
                  </p>
                  <p className="text-[8px] text-muted-foreground">
                    支持 PDF / DOCX / TXT / Markdown
                  </p>
                </div>

                <Button
                  className="w-full h-6 text-[9px]"
                  variant="outline"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-2.5 w-2.5 mr-1" />
                  )}
                  {isUploading ? "上传中..." : "上传资料"}
                </Button>

                <div className="space-y-1">
                  <p className="text-[9px] text-muted-foreground font-medium">
                    最近上传
                  </p>

                  {isFilesLoading ? (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground p-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      正在加载文件列表...
                    </div>
                  ) : uploadedFiles.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground p-2 rounded-lg bg-muted/40">
                      暂无资料，请先上传知识库文件。
                    </div>
                  ) : (
                    uploadedFiles.map((file, index) => (
                      <div
                        key={file.id || `${file.name}-${index}`}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium truncate">
                            {file.name}
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            {file.time}
                          </p>
                        </div>

                        <Badge
                          variant="secondary"
                          className={
                            file.status === "已入库"
                              ? "bg-green-100 text-green-700 text-[9px] h-4"
                              : file.status === "解析中"
                              ? "bg-amber-100 text-amber-700 text-[9px] h-4"
                              : "bg-red-100 text-red-700 text-[9px] h-4"
                          }
                        >
                          {file.status === "已入库" ? (
                            <CheckCircle className="h-2 w-2 mr-0.5" />
                          ) : file.status === "解析中" ? (
                            <Loader2 className="h-2 w-2 mr-0.5 animate-spin" />
                          ) : null}
                          {file.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/90 border-green-200">
              <CardHeader className="pb-2 pt-2 px-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" />
                  猜你想问
                </CardTitle>
              </CardHeader>

              <CardContent className="px-2 pb-2 pt-0 space-y-1">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="w-full text-left px-2 py-1.5 rounded-lg bg-muted/50 hover:bg-primary/10 hover:text-primary transition-colors text-[11px]"
                  >
                    {question}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-9 flex flex-col">
            <Card className="mb-2">
              <CardContent className="p-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7 bg-primary/10">
                    <AvatarFallback className="bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold text-base">植物养护助手</h3>
                    <p className="text-[10px] text-muted-foreground">
                      回答基于知识库与当前设备环境数据
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-3">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-2 ${
                          message.role === "user" ? "flex-row-reverse" : ""
                        }`}
                      >
                        <Avatar
                          className={`h-6 w-6 shrink-0 ${
                            message.role === "user"
                              ? "bg-primary"
                              : "bg-primary/10"
                          }`}
                        >
                          <AvatarFallback
                            className={
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10"
                            }
                          >
                            {message.role === "user" ? (
                              <User className="h-3 w-3" />
                            ) : (
                              <Bot className="h-3 w-3 text-primary" />
                            )}
                          </AvatarFallback>
                        </Avatar>

                        <div className="max-w-[80%]">
                          <div
                            className={`px-2.5 py-2 rounded-xl ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-muted rounded-bl-md"
                            }`}
                          >
                            <p className="text-[11px] whitespace-pre-wrap leading-relaxed">
                              {message.content}
                            </p>
                          </div>

                          <p
                            className={`text-[10px] text-muted-foreground mt-0.5 ${
                              message.role === "user" ? "text-right" : ""
                            }`}
                          >
                            {message.time}
                          </p>

                          {message.role === "assistant" &&
                            message.sources &&
                            message.sources.length > 0 && (
                              <div className="mt-1.5">
                                <button
                                  onClick={() =>
                                    setShowSources(
                                      showSources === index ? null : index
                                    )
                                  }
                                  className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                                >
                                  查看 {message.sources.length} 个参考来源
                                  <ChevronDown
                                    className={`h-2.5 w-2.5 transition-transform ${
                                      showSources === index ? "rotate-180" : ""
                                    }`}
                                  />
                                </button>

                                {showSources === index && (
                                  <div className="mt-1.5 p-2 rounded-lg bg-muted/50 space-y-1.5">
                                    {message.sources.map((source, sIndex) => (
                                      <div
                                        key={sIndex}
                                        className="flex items-start gap-1.5 text-[10px]"
                                      >
                                        <FileText className="h-2.5 w-2.5 text-muted-foreground shrink-0 mt-0.5" />
                                        <span>
                                          <span className="font-medium">
                                            {source.file}
                                          </span>
                                          {source.section ? (
                                            <span className="text-muted-foreground">
                                              {" "}
                                              - {source.section}
                                            </span>
                                          ) : null}
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

                    {isLoading && (
                      <div className="flex gap-2">
                        <Avatar className="h-6 w-6 bg-primary/10">
                          <AvatarFallback className="bg-primary/10">
                            <Bot className="h-3 w-3 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="px-2.5 py-2 rounded-xl bg-muted rounded-bl-md">
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            <span className="text-[11px] text-muted-foreground">
                              正在思考...
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="shrink-0 p-2 border-t bg-background">
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder="输入您的问题..."
                    className="flex-1 h-7 text-[11px]"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    className="h-7 w-7 p-0"
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
    </AuthGuard>
  )
}
