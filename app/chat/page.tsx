"use client"

import { useState } from "react"
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
  Thermometer,
  Droplets,
  Sun,
  Fan,
  Send,
  Bot,
  User,
  ChevronDown,
  CheckCircle,
  Loader2,
} from "lucide-react"

// 模拟已上传文件
const uploadedFiles = [
  { name: "绿萝养护手册.pdf", time: "2026-04-08", status: "已入库" },
  { name: "室内植物浇水建议.docx", time: "2026-04-07", status: "已入库" },
  { name: "常见黄叶问题总结.txt", time: "2026-04-09", status: "解析中" },
]

// 推荐问题
const suggestedQuestions = [
  "绿萝叶子发黄怎么办",
  "多肉多久浇一次水",
  "植物适合多少湿度",
  "光照不足会有什么表现",
]

// 模拟对话消息
const initialMessages = [
  {
    role: "assistant",
    content: "您好！我是您的植物养护助手。我可以结合您的植物知识库和当前环境数据为您提供专业的养护建议。您可以问我关于浇水、施肥、光照、病虫害等方面的问题。",
    time: "09:00",
  },
  {
    role: "user",
    content: "绿萝叶子发黄怎么办？",
    time: "09:15",
  },
  {
    role: "assistant",
    content: `根据当前湿度 61% 和温度 26.4℃，您的绿萝暂时不缺水。叶子发黄可能的原因包括：

1. **光照过强或不足** - 绿萝喜欢散射光，避免阳光直射
2. **浇水过多导致根部腐烂** - 检查盆土是否过湿
3. **缺乏营养或施肥过量** - 建议每月施一次稀薄液肥
4. **环境温度变化过大** - 保持温度在 15-28℃ 之间

建议您检查盆土湿度，观察是否有积水现象，并适当调整光照条件。`,
    time: "09:16",
    sources: [
      { file: "绿萝养护手册.pdf", section: "第 2 节 \"叶子发黄原因\"" },
      { file: "室内植物浇水建议.docx", section: "第 1 页 \"过度浇水影响\"" },
      { file: "常见黄叶问题总结.txt", section: "第 3 项 \"环境因素\"" },
    ],
  },
 
]

export default function ChatPage() {
  const [messages, setMessages] = useState(initialMessages)
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showSources, setShowSources] = useState<number | null>(null)

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return

    const newUserMessage = {
      role: "user" as const,
      content: inputValue,
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages([...messages, newUserMessage])
    setInputValue("")
    setIsLoading(true)

    // 模拟AI回复
    setTimeout(() => {
      const aiResponse = {
        role: "assistant" as const,
        content: "感谢您的提问！根据您的植物知识库和当前环境数据，我正在为您分析中...\n\n这是一个模拟回复，在实际应用中会连接到AI模型进行智能回答。",
        time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      }
      setMessages((prev) => [...prev, aiResponse])
      setIsLoading(false)
    }, 1500)
  }

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100/80 via-emerad-50/50 to-teal-50/60">
      <NavHeader />

      <main className="container mx-auto px-4 py-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-100px)]">
          {/* 左侧栏：知识上传与辅助区 */}
          <div className="lg:col-span-3 space-y-2">
            {/* 知识库与文件 */}
            <Card className="bg-white/90 border-green-200">
              <CardHeader className="pb-2 pt-2 px-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Database className="h-4 w-4" />
                  知识库
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2 pt-0 space-y-2">
                {/* 统计信息 */}
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-primary/5">
                  <div>
                    <p className="text-base font-bold text-primary leading-none">12 份</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">已收录资料</p>
                  </div>
                  <FileText className="h-5 w-5 text-primary/40" />
                </div>
                {/* 文件上传区域 */}
                <div className="border-2 border-dashed border-border rounded-lg p-2 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-0.5" />
                  <p className="text-[9px] text-muted-foreground mb-0.5">拖拽文件至此 或 点击上传</p>
                  <p className="text-[8px] text-muted-foreground">支持 PDF / DOCX / TXT / Markdown</p>
                </div>
                <Button className="w-full h-6 text-[9px]" variant="outline">
                  <Upload className="h-2.5 w-2.5 mr-1" />
                  上传资料
                </Button>

                
    

                {/* 文件列表 */}
                <div className="space-y-1">
                  <p className="text-[9px] text-muted-foreground font-medium">最近上传</p>
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium truncate">{file.name}</p>
                        <p className="text-[9px] text-muted-foreground">{file.time}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          file.status === "已入库"
                            ? "bg-green-100 text-green-700 text-[9px] h-4"
                            : "bg-amber-100 text-amber-700 text-[9px] h-4"
                        }
                      >
                        {file.status === "已入库" ? (
                          <CheckCircle className="h-2 w-2 mr-0.5" />
                        ) : (
                          <Loader2 className="h-2 w-2 mr-0.5 animate-spin" />
                        )}
                        {file.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 猜你想问 */}
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

          {/* 右侧主区域：AI 问答区 */}
          <div className="lg:col-span-9 flex flex-col">
            {/* AI 助手信息卡片 */}
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

                {/* 当前环境状态条 */}
               
              </CardContent>
            </Card>

            {/* 对话消息区 */}
            <Card className="flex-1 flex flex-col overflow-hidden">
              {/* 消息滚动区 */}
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-3">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <Avatar className={`h-6 w-6 shrink-0 ${message.role === "user" ? "bg-primary" : "bg-primary/10"}`}>
                        <AvatarFallback className={message.role === "user" ? "bg-primary text-primary-foreground" : "bg-primary/10"}>
                          {message.role === "user" ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Bot className="h-3 w-3 text-primary" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                        <div
                          className={`px-2.5 py-2 rounded-xl ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md"
                          }`}
                        >
                          <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        </div>
                        <p className={`text-[10px] text-muted-foreground mt-0.5 ${message.role === "user" ? "text-right" : ""}`}>
                          {message.time}
                        </p>

                        {/* 参考来源 */}
                        {message.role === "assistant" && "sources" in message && message.sources && (
                          <div className="mt-1.5">
                            <button
                              onClick={() => setShowSources(showSources === index ? null : index)}
                              className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                            >
                              查看 {message.sources.length} 个参考来源
                              <ChevronDown
                                className={`h-2.5 w-2.5 transition-transform ${showSources === index ? "rotate-180" : ""}`}
                              />
                            </button>
                            {showSources === index && (
                              <div className="mt-1.5 p-2 rounded-lg bg-muted/50 space-y-1.5">
                                {message.sources.map((source, sIndex) => (
                                  <div key={sIndex} className="flex items-start gap-1.5 text-[10px]">
                                    <FileText className="h-2.5 w-2.5 text-muted-foreground shrink-0 mt-0.5" />
                                    <span>
                                      <span className="font-medium">{source.file}</span>
                                      <span className="text-muted-foreground"> - {source.section}</span>
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
                          <span className="text-[11px] text-muted-foreground">正在思考...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </ScrollArea>
              </div>

              {/* 输入区域 */}
              <div className="shrink-0 p-2 border-t bg-background">
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="输入您的问题..."
                    className="flex-1 h-7 text-[11px]"
                  />
                  <Button onClick={handleSend} disabled={!inputValue.trim() || isLoading} className="h-7 w-7 p-0">
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
