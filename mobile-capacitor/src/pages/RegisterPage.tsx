import { FormEvent, useEffect, useRef, useState } from "react"
import { ArrowLeft, Camera, CheckCircle2, Loader2, Lock, User, X, XCircle } from "lucide-react"
import { registerWithFace } from "../api"
import { impact } from "../mobile-utils"

type RegisterPageProps = {
  onBackToLogin: () => void
  onRegistered: () => void
}

export function RegisterPage({ onBackToLogin, onRegistered }: RegisterPageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)
  const [faceImage, setFaceImage] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [messageType, setMessageType] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState("创建 PlantCloud 移动端身份")

  useEffect(() => {
    if (!captureOpen) return undefined

    let stream: MediaStream | null = null
    let cancelled = false
    setReady(false)
    setHasCamera(true)

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setHasCamera(false)
        setMessageType("error")
        setMessage("当前浏览器无法访问摄像头，注册需要人脸图像。")
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
        setMessageType("error")
        setMessage("摄像头启动失败，请允许访问摄像头后再注册。")
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      if (videoRef.current) videoRef.current.srcObject = null
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [captureOpen])

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

  const handleCapture = () => {
    impact()
    const image = captureFace()
    if (!image) {
      setMessageType("error")
      setMessage("没有采集到摄像头画面，请重新打开摄像头。")
      return
    }
    setFaceImage(image)
    setMessageType("success")
    setMessage("人脸采集完成，可以提交注册。")
    setCaptureOpen(false)
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    impact()

    if (password !== confirmPassword) {
      setMessageType("error")
      setMessage("两次输入的密码不一致。")
      return
    }

    if (!faceImage) {
      setMessageType("error")
      setMessage("请先完成人脸采集，注册接口需要 faceImage。")
      setCaptureOpen(true)
      return
    }

    try {
      setLoading(true)
      setMessageType("idle")
      setMessage("正在连接后端注册账号，并写入人脸特征库。")
      await registerWithFace(username.trim(), password, faceImage)
      setMessageType("success")
      setMessage("注册成功，账号已写入数据库。请返回登录。")
      window.setTimeout(onRegistered, 800)
    } catch (error) {
      setMessageType("error")
      setMessage(error instanceof Error ? error.message : "注册失败，请重新采集后再试。")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-screen compact-auth-screen">
      <section className="auth-panel auth-single-card register-single-card">
        <button type="button" className="auth-back" onClick={onBackToLogin}>
          <ArrowLeft size={17} />
          返回登录
        </button>

        <div className="auth-product-hero compact">
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

        <div className="auth-title">
          <p>账号与人脸注册</p>
          <h1>创建安全入口</h1>
        </div>

        <form className="auth-form" onSubmit={handleRegister}>
          <label>
            <span>用户名</span>
            <i>
              <User size={16} />
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="例如 user2" autoComplete="username" />
            </i>
          </label>
          <label>
            <span>密码</span>
            <i>
              <Lock size={16} />
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="设置密码" type="password" autoComplete="new-password" />
            </i>
          </label>
          <label>
            <span>确认密码</span>
            <i>
              <Lock size={16} />
              <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入" type="password" autoComplete="new-password" />
            </i>
          </label>

          <button type="button" className={faceImage ? "face-ready-button" : "face-capture-button"} onClick={() => setCaptureOpen(true)}>
            {faceImage ? <CheckCircle2 size={17} /> : <Camera size={17} />}
            {faceImage ? "已采集人脸，点击重拍" : "打开人脸采集"}
          </button>

          <button type="submit" disabled={loading || !username.trim() || !password || !confirmPassword}>
            {loading ? <Loader2 size={17} className="spin" /> : <CheckCircle2 size={17} />}
            提交注册
          </button>
        </form>

        <div className={`auth-inline-status ${messageType}`}>
          {messageType === "success" ? <CheckCircle2 size={16} /> : messageType === "error" ? <XCircle size={16} /> : <Camera size={16} />}
          <span>
            <strong>{messageType === "success" ? "已就绪" : messageType === "error" ? "需要处理" : "注册提示"}</strong>
            <em>{message}</em>
          </span>
        </div>
      </section>

      {captureOpen ? (
        <div className="auth-face-backdrop" onClick={() => setCaptureOpen(false)}>
          <section className="auth-face-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setCaptureOpen(false)}>
              <X size={18} />
            </button>
            <div className={`face-frame ${messageType}`}>
              {hasCamera ? <video ref={videoRef} playsInline muted /> : <Camera size={42} />}
              <span className="scan-line" />
            </div>
            <div className="auth-status-card">
              <div>
                <p className={hasCamera ? "" : "error"}>{hasCamera ? "采集人脸" : "摄像头不可用"}</p>
                <span>{hasCamera ? "请保持正脸、无遮挡、光线均匀，确认后保存本次采集。" : "注册需要 faceImage，请检查权限后重试。"}</span>
              </div>
              <button type="button" onClick={handleCapture} disabled={!ready || !hasCamera || loading}>
                <Camera size={17} />
                保存采集
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <canvas ref={canvasRef} hidden />
    </main>
  )
}
