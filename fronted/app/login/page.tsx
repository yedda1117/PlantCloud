"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Camera, CheckCircle2, KeyRound, Leaf, Loader2, Lock, ShieldCheck, User, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8080"

type LoginResult = {
  userId: number
  username: string
  role: string
  accessToken: string
  refreshToken: string
}

type ApiResponse<T> = {
  code: number
  message?: string
  data: T
}

export default function LoginPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)
  const [status, setStatus] = useState("等待人脸识别")
  const [statusType, setStatusType] = useState<"idle" | "success" | "error" | "loading">("idle")
  const [message, setMessage] = useState<string | null>("请正对摄像头，保持面部清晰。")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setHasCamera(false)
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
        setStatusType("error")
        setStatus("摄像头不可用")
        setMessage("请允许浏览器访问摄像头，或使用账号密码登录。")
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

  const statusClass = useMemo(() => {
    if (statusType === "success") return "text-emerald-700"
    if (statusType === "error") return "text-red-700"
    if (statusType === "loading") return "text-cyan-700"
    return "text-zinc-600"
  }, [statusType])

  const nextPath = () => {
    const params = new URLSearchParams(window.location.search)
    return params.get("next") || "/home"
  }

  const saveSession = (data: LoginResult) => {
    window.localStorage.setItem("plantcloud_token", data.accessToken)
    window.localStorage.setItem("plantcloud_user", JSON.stringify({
      userId: data.userId,
      username: data.username,
      role: data.role,
    }))
  }

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

  const handleFaceLogin = async () => {
    setStatusType("loading")
    setStatus("正在识别人脸")
    setMessage("请保持正脸、光线均匀，系统正在比对底库。")
    setLoading(true)

    const faceImage = captureFace()
    if (!faceImage) {
      setStatusType("error")
      setStatus("采集失败")
      setMessage("没有拿到摄像头画面，请刷新页面后重试。")
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/auth/face-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceImage }),
      })
      const result = (await response.json()) as ApiResponse<LoginResult>

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message || "人脸识别未通过")
      }

      saveSession(result.data)
      setStatusType("success")
      setStatus("识别成功")
      setMessage(`欢迎 ${result.data.username}，正在进入 PlantCloud。`)
      setTimeout(() => router.push(nextPath()), 500)
    } catch (error) {
      console.error(error)
      setStatusType("error")
      setStatus("人脸识别未通过")
      setMessage(error instanceof Error ? error.message : "请重新对准摄像头，或使用密码登录。")
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatusType("loading")
    setStatus("正在验证账号")
    setMessage(null)
    setLoading(true)

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const result = (await response.json()) as ApiResponse<LoginResult>

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message || "账号或密码不正确")
      }

      saveSession(result.data)
      setStatusType("success")
      setStatus("登录成功")
      setMessage(`欢迎 ${result.data.username}，正在进入 PlantCloud。`)
      setTimeout(() => router.push(nextPath()), 400)
    } catch (error) {
      console.error(error)
      setStatusType("error")
      setStatus("密码登录失败")
      setMessage(error instanceof Error ? error.message : "请检查账号密码后重试。")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="grid min-h-screen lg:grid-cols-[1fr_480px]">
        <section className="relative flex min-h-[58vh] items-center justify-center overflow-hidden bg-zinc-950 px-5 py-20 text-white lg:min-h-screen">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1520412099551-62b6bafeb5bb?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center opacity-32" />
          <div className="absolute inset-0 bg-zinc-950/54" />
          <div className="relative w-full max-w-3xl">
            <Link href="/" className="mb-10 inline-flex items-center gap-3 text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-zinc-950">
                <Leaf className="h-5 w-5" />
              </span>
              <span className="text-lg font-semibold">PlantCloud</span>
            </Link>

            <div className="mx-auto max-w-2xl">
              <div className="mb-5 flex items-center justify-between gap-3 text-sm text-zinc-200">
                <span className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  SmartJavaAI 人脸登录
                </span>
                <span className="hidden rounded-lg bg-emerald-300/20 px-3 py-1 text-emerald-100 sm:inline-flex">
                  现场识别
                </span>
              </div>

              <div className="overflow-hidden rounded-lg border border-white/25 bg-zinc-950 shadow-2xl shadow-black/30">
                <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
              </div>

              <div className="mt-5 flex flex-col gap-4 rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={`text-sm font-semibold ${statusClass}`}>{status}</p>
                  {message ? <p className="mt-1 text-sm leading-6 text-zinc-200">{message}</p> : null}
                </div>
                <Button
                  className="h-11 rounded-lg bg-emerald-400 px-5 text-zinc-950 hover:bg-emerald-300"
                  onClick={handleFaceLogin}
                  disabled={!ready || loading || !hasCamera}
                >
                  {loading && statusType === "loading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                  人脸登录
                </Button>
              </div>

              {!hasCamera ? (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-300/40 bg-red-500/12 p-3 text-sm text-red-100">
                  <XCircle className="mt-0.5 h-4 w-4" />
                  摄像头不可用时，可以使用右侧账号密码登录。
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <p className="text-sm font-semibold text-emerald-700">备用入口</p>
              <h1 className="mt-3 text-3xl font-semibold">账号密码登录</h1>
              <p className="mt-3 leading-7 text-zinc-600">人脸未注册、摄像头不可用或识别失败时，可以使用账号密码进入系统。</p>
            </div>

            <form className="space-y-4" onSubmit={handlePasswordLogin}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">用户名</span>
                <span className="relative block">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input className="h-11 rounded-lg pl-10" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入用户名" />
                </span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">密码</span>
                <span className="relative block">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input className="h-11 rounded-lg pl-10" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" />
                </span>
              </label>
              <Button className="h-11 w-full rounded-lg bg-zinc-950 hover:bg-zinc-800" type="submit" disabled={loading || !username || !password}>
                {loading && statusType === "loading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                登录 PlantCloud
              </Button>
            </form>

            <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-600 shadow-sm">
              <div className="mb-2 flex items-center gap-2 font-medium text-zinc-950">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                第一次使用？
              </div>
              注册账号会同时采集人脸，后续可以直接刷脸进入。
              <Link href="/register" className="mt-3 inline-flex font-semibold text-emerald-700 hover:text-emerald-800">
                去注册账号与人脸
              </Link>
            </div>
          </div>
        </aside>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </main>
  )
}
