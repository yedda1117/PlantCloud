"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useRef, useState } from "react"
import { ArrowLeft, Camera, CheckCircle2, Leaf, Loader2, Lock, User, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8080"

type ApiResponse<T> = {
  code: number
  message?: string
  data: T
}

export default function RegisterPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("请保持正脸、无遮挡、光线均匀。")
  const [messageType, setMessageType] = useState<"idle" | "success" | "error">("idle")

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setHasCamera(false)
        setMessageType("error")
        setMessage("当前浏览器无法访问摄像头，请更换设备或检查权限。")
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 960, height: 720, facingMode: "user" },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          try {
            await videoRef.current.play()
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
              return
            }
            throw error
          }
        }
        setReady(true)
      } catch (error) {
        console.error("Camera startup failed", error)
        setHasCamera(false)
        setMessageType("error")
        setMessage("摄像头启动失败，请允许浏览器访问摄像头。")
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const captureFace = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.9)
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (password !== confirmPassword) {
      setMessageType("error")
      setMessage("两次输入的密码不一致。")
      return
    }

    const faceImage = captureFace()
    if (!faceImage) {
      setMessageType("error")
      setMessage("没有采集到摄像头画面，请刷新页面后重试。")
      return
    }

    setLoading(true)
    setMessageType("idle")
    setMessage("正在采集人脸并写入 SmartJavaAI 特征库。")

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/auth/face-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, faceImage }),
      })
      const result = (await response.json()) as ApiResponse<string | null>

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message || "注册失败")
      }

      setMessageType("success")
      setMessage("注册成功。账号已写入数据库，人脸特征已写入 SmartJavaAI 特征库。")
      setTimeout(() => router.push("/login"), 900)
    } catch (error) {
      console.error(error)
      setMessageType("error")
      setMessage(error instanceof Error ? error.message : "注册失败，请重新采集。")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <section>
          <Link href="/" className="mb-10 inline-flex items-center gap-3 text-zinc-950">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400">
              <Leaf className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold">PlantCloud</span>
          </Link>

          <p className="text-sm font-semibold text-emerald-700">账号与人脸注册</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">建立属于你的安全入口。</h1>
          <p className="mt-5 max-w-xl leading-8 text-zinc-600">
            现场注册会同时创建账号、保存密码哈希、写入人脸注册图片，并把人脸特征注册到 SmartJavaAI 的 SQLite 特征库。
          </p>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="font-semibold">拍摄建议</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">正脸、自然光、无遮挡，人脸区域尽量占画面中央。</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="font-semibold">后续登录</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">注册成功后回到登录页，直接使用摄像头刷脸进入。</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-xl shadow-zinc-200/70 sm:p-6">
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          </div>

          <div className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm leading-6 ${messageType === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : messageType === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}>
            {messageType === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : messageType === "error" ? <XCircle className="mt-0.5 h-4 w-4" /> : <Camera className="mt-0.5 h-4 w-4" />}
            <span>{message}</span>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleRegister}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-700">用户名</span>
              <span className="relative block">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input className="h-11 rounded-lg pl-10" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="例如 user2" />
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">密码</span>
                <span className="relative block">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input className="h-11 rounded-lg pl-10" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="设置密码" />
                </span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">确认密码</span>
                <span className="relative block">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input className="h-11 rounded-lg pl-10" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入" />
                </span>
              </label>
            </div>
            <Button className="h-11 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700" type="submit" disabled={loading || !ready || !hasCamera || !username || !password || !confirmPassword}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              注册账号与人脸
            </Button>
          </form>

          <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-emerald-700">
            <ArrowLeft className="h-4 w-4" />
            返回登录
          </Link>
        </section>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </main>
  )
}
