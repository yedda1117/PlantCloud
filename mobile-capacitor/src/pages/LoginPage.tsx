import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Camera, CheckCircle2, KeyRound, Loader2, Lock, ShieldCheck, User, X, XCircle } from "lucide-react"
import { loginWithFace, loginWithPassword, saveAuthSession } from "../api"
import type { LoginResult } from "../types"
import { impact } from "../mobile-utils"

type LoginPageProps = {
  onLoggedIn: (session: LoginResult) => void
  onRegister: () => void
}

export function LoginPage({ onLoggedIn, onRegister }: LoginPageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [faceOpen, setFaceOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loadingMode, setLoadingMode] = useState<"face" | "password" | null>(null)
  const [statusType, setStatusType] = useState<"idle" | "success" | "error" | "loading">("idle")
  const [status, setStatus] = useState("准备就绪")
  const [message, setMessage] = useState("连接 PlantCloud 移动控制台")

  useEffect(() => {
    if (!faceOpen) return undefined

    let stream: MediaStream | null = null
    let cancelled = false
    setReady(false)
    setHasCamera(true)

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setHasCamera(false)
        setStatusType("error")
        setStatus("摄像头不可用")
        setMessage("当前浏览器无法访问摄像头，可以先使用账号密码登录。")
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
          await videoRef.current.play().catch(() => undefined)
        }
        setReady(true)
      } catch {
        setHasCamera(false)
        setStatusType("error")
        setStatus("摄像头不可用")
        setMessage("请允许浏览器访问摄像头，或使用账号密码登录。")
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      if (videoRef.current) videoRef.current.srcObject = null
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [faceOpen])

  const statusClass = useMemo(() => {
    if (statusType === "success") return "success"
    if (statusType === "error") return "error"
    if (statusType === "loading") return "loading"
    return ""
  }, [statusType])

  const captureFace = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return null
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext("2d")
    if (!context) return null
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.9)
  }

  const finishLogin = (session: LoginResult) => {
    saveAuthSession(session)
    setStatusType("success")
    setStatus("登录成功")
    setMessage(`欢迎 ${session.username}，正在进入 PlantCloud。`)
    window.setTimeout(() => onLoggedIn(session), 260)
  }

  const handleFaceLogin = async () => {
    impact()
    const faceImage = captureFace()
    if (!faceImage) {
      setStatusType("error")
      setStatus("采集失败")
      setMessage("没有拿到摄像头画面，请检查权限后重试。")
      return
    }

    try {
      setLoadingMode("face")
      setStatusType("loading")
      setStatus("正在识别人脸")
      setMessage("请保持正脸和稳定光线，系统正在比对后端人脸库。")
      finishLogin(await loginWithFace(faceImage))
    } catch (error) {
      setStatusType("error")
      setStatus("人脸登录失败")
      setMessage(error instanceof Error ? error.message : "人脸识别未通过，请使用密码登录或重新注册。")
    } finally {
      setLoadingMode(null)
    }
  }

  const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    impact()
    try {
      setLoadingMode("password")
      setStatusType("loading")
      setStatus("正在验证账号")
      setMessage("正在连接后端数据库验证账号密码。")
      finishLogin(await loginWithPassword(username.trim(), password))
    } catch (error) {
      setStatusType("error")
      setStatus("密码登录失败")
      setMessage(error instanceof Error ? error.message : "请检查账号密码后重试。")
    } finally {
      setLoadingMode(null)
    }
  }

  return (
    <main className="auth-screen compact-auth-screen">
      <section className="auth-panel auth-single-card">
        <div className="auth-product-hero">
          <div className="auth-orbit-logo" aria-hidden="true">
            <span className="auth-orbit auth-orbit-a" />
            <span className="auth-orbit auth-orbit-b" />
            <span className="auth-logo-glass" />
            <span className="auth-logo-stem" />
            <span className="auth-logo-leaf auth-logo-leaf-left" />
            <span className="auth-logo-leaf auth-logo-leaf-right" />
            <span className="auth-logo-leaf auth-logo-leaf-top" />
            <span className="auth-logo-base" />
          </div>
          <div>
            <p>PlantCloud</p>
            <h1>智慧植物云平台</h1>
            <span>Smart Growth Console</span>
          </div>
        </div>

        <div className="auth-signal-grid" aria-hidden="true">
          <span>
            <strong>LIVE</strong>
            环境监测
          </span>
          <span>
            <strong>AUTO</strong>
            策略联动
          </span>
          <span>
            <strong>IOT</strong>
            设备在线
          </span>
        </div>

        <div className="auth-title">
          <p>
            <ShieldCheck size={15} />
            安全入口
          </p>
          <h1>欢迎回来</h1>
        </div>

        <form className="auth-form" onSubmit={handlePasswordLogin}>
          <label>
            <span>用户名</span>
            <i>
              <User size={16} />
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入用户名" autoComplete="username" />
            </i>
          </label>
          <label>
            <span>密码</span>
            <i>
              <Lock size={16} />
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" type="password" autoComplete="current-password" />
            </i>
          </label>
          <button type="submit" disabled={Boolean(loadingMode) || !username.trim() || !password}>
            {loadingMode === "password" ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} />}
            登录 PlantCloud
          </button>
        </form>

        <div className={`auth-inline-status ${statusClass}`}>
          {statusType === "success" ? <CheckCircle2 size={16} /> : statusType === "error" ? <XCircle size={16} /> : <ShieldCheck size={16} />}
          <span>
            <strong>{status}</strong>
            <em>{message}</em>
          </span>
        </div>

        <div className="auth-actions-row">
          <button type="button" onClick={() => setFaceOpen(true)}>
            <Camera size={17} />
            人脸登录
          </button>
          <button type="button" onClick={onRegister}>
            注册账号
          </button>
        </div>
      </section>

      {faceOpen ? (
        <div className="auth-face-backdrop" onClick={() => setFaceOpen(false)}>
          <section className="auth-face-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setFaceOpen(false)}>
              <X size={18} />
            </button>
            <div className={`face-frame ${statusType}`}>
              {hasCamera ? <video ref={videoRef} playsInline muted /> : <Camera size={42} />}
              <span className="scan-line" />
            </div>
            <div className="auth-status-card">
              <div>
                <p className={statusClass}>{hasCamera ? "人脸登录" : "摄像头不可用"}</p>
                <span>{hasCamera ? "请将面部置于识别框中央，确认后开始比对。" : "当前环境无法打开摄像头，请使用账号密码登录。"}</span>
              </div>
              <button type="button" onClick={() => void handleFaceLogin()} disabled={!ready || !hasCamera || Boolean(loadingMode)}>
                {loadingMode === "face" ? <Loader2 size={17} className="spin" /> : <Camera size={17} />}
                开始识别
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <canvas ref={canvasRef} hidden />
    </main>
  )
}
