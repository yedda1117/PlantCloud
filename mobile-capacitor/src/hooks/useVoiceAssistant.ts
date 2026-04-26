import { Capacitor } from "@capacitor/core"
import { SpeechRecognition } from "@capacitor-community/speech-recognition"
import { useEffect, useRef, useState } from "react"
import type { PluginListenerHandle } from "@capacitor/core"
import { askPlantAi } from "../api"
import { buildMobilePlantContext } from "../mobile-utils"
import type { HomeRealtimeData, Plant } from "../types"

export type VoiceAssistantState = "unsupported" | "idle" | "arming" | "listening" | "processing" | "speaking" | "error"

type UseVoiceAssistantOptions = {
  enabled: boolean
  plant: Plant
  realtime: HomeRealtimeData | null
  onRefresh?: () => Promise<void> | void
}

const WAKE_PHRASES = ["hi", "hi plant", "嗨", "嘿"]
const FOLLOW_UP_WINDOW_MS = 8000
const RESTART_DELAY_MS = 320

function isNativeApp() {
  return Capacitor.getPlatform() !== "web"
}

function canUseSpeechSynthesis() {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

function normalizeSpeech(text: string) {
  return text
    .toLowerCase()
    .replace(/[，。！？、,.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function stripWakePhrase(text: string) {
  for (const phrase of WAKE_PHRASES) {
    const index = text.indexOf(phrase)
    if (index >= 0) {
      return `${text.slice(0, index)} ${text.slice(index + phrase.length)}`.trim()
    }
  }
  return null
}

function statusLabel(status: string | null | undefined, normalText: string) {
  switch ((status || "").toUpperCase()) {
    case "NORMAL":
      return normalText
    case "LOW":
      return "偏低"
    case "HIGH":
      return "偏高"
    default:
      return "暂未判定"
  }
}

function buildStatusReply(plant: Plant, realtime: HomeRealtimeData | null) {
  if (!realtime) {
    return `${plant.plantName} 的实时数据还没有加载完成，你可以稍后再问我一次。`
  }

  const temperature = realtime.environment.temperature == null ? "暂时没有数据" : `${realtime.environment.temperature.toFixed(1)} 度`
  const humidity = realtime.environment.humidity == null ? "暂时没有数据" : `${Math.round(realtime.environment.humidity)}%`
  const light = realtime.environment.lightLux == null ? "暂时没有数据" : `${Math.round(realtime.environment.lightLux)} lux`
  const dangerCount = realtime.abnormal.count + realtime.tilt.count
  const warningLine = dangerCount > 0 ? `目前有 ${dangerCount} 条需要关注的异常提醒。` : "目前没有新的异常提醒。"

  return `${plant.plantName} 当前状态如下。温度 ${temperature}，${statusLabel(realtime.environment.temperatureStatus, "温度正常")}。湿度 ${humidity}，${statusLabel(realtime.environment.humidityStatus, "湿度正常")}。光照 ${light}，${statusLabel(realtime.environment.lightStatus, "光照正常")}。${warningLine}`
}

function resolveIntent(command: string) {
  if (/刷新|更新|reload|refresh/.test(command)) return "refresh"
  if (/状态|怎么样|如何|好吗|情况|温度|湿度|光照|亮度|健康|异常|告警/.test(command)) return "status"
  return "unknown"
}

export function useVoiceAssistant({ enabled, plant, realtime, onRefresh }: UseVoiceAssistantOptions) {
  const [state, setState] = useState<VoiceAssistantState>("idle")
  const [hint, setHint] = useState("有什么想问我的吗")
  const [lastHeard, setLastHeard] = useState("")
  const [liveTranscript, setLiveTranscript] = useState("")
  const [popupOpen, setPopupOpen] = useState(false)
  const [popupText, setPopupText] = useState("")
  const [popupSpeaking, setPopupSpeaking] = useState(false)
  const [popupError, setPopupError] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const shouldListenRef = useRef(false)
  const speakingRef = useRef(false)
  const permissionCheckedRef = useRef(false)
  const nativeAvailableRef = useRef(false)
  const followUpUntilRef = useRef(0)
  const plantRef = useRef(plant)
  const realtimeRef = useRef(realtime)
  const onRefreshRef = useRef(onRefresh)
  const historyRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([])
  const nativePartialRef = useRef("")
  const nativeStartingRef = useRef(false)
  const listenerHandlesRef = useRef<PluginListenerHandle[]>([])
  const nativeFinalizeTimerRef = useRef<number | null>(null)
  const transcriptClearTimerRef = useRef<number | null>(null)

  useEffect(() => {
    plantRef.current = plant
    realtimeRef.current = realtime
    onRefreshRef.current = onRefresh
  }, [onRefresh, plant, realtime])

  useEffect(() => {
    historyRef.current = []
  }, [plant.plantId])

  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition

    function clearSpeechOutput() {
      if (canUseSpeechSynthesis()) {
        window.speechSynthesis.cancel()
      }
      speakingRef.current = false
      setPopupSpeaking(false)
    }

    function clearNativeFinalizeTimer() {
      if (nativeFinalizeTimerRef.current) {
        window.clearTimeout(nativeFinalizeTimerRef.current)
        nativeFinalizeTimerRef.current = null
      }
    }

    function clearTranscriptSoon(delay = 3200) {
      if (transcriptClearTimerRef.current) {
        window.clearTimeout(transcriptClearTimerRef.current)
      }
      transcriptClearTimerRef.current = window.setTimeout(() => {
        transcriptClearTimerRef.current = null
        setLiveTranscript("")
        setLastHeard("")
      }, delay)
    }

    async function removeNativeListeners() {
      clearNativeFinalizeTimer()
      await Promise.all(listenerHandlesRef.current.map((handle) => handle.remove().catch(() => undefined)))
      listenerHandlesRef.current = []
      await SpeechRecognition.removeAllListeners().catch(() => undefined)
    }

    async function stopRecognition() {
      const webRecognition = recognitionRef.current
      if (webRecognition) {
        webRecognition.onstart = null
        webRecognition.onend = null
        webRecognition.onresult = null
        webRecognition.onerror = null
        webRecognition.abort()
        recognitionRef.current = null
      }

      if (isNativeApp() && nativeAvailableRef.current) {
        await SpeechRecognition.stop().catch(() => undefined)
      }
    }

    function scheduleRestart() {
      if (!shouldListenRef.current || speakingRef.current || document.visibilityState !== "visible") return
      window.setTimeout(() => {
        void startRecognition()
      }, RESTART_DELAY_MS)
    }

    function resetPopupSoon() {
      window.setTimeout(() => {
        if (!speakingRef.current) {
          setPopupOpen(false)
          setPopupText("")
          setPopupSpeaking(false)
          setPopupError(false)
        }
      }, 2600)
    }

    function finishSpeaking() {
      speakingRef.current = false
      setPopupSpeaking(false)
      setState("idle")
      setHint("有什么想问我的吗")
      resetPopupSoon()
      scheduleRestart()
    }

    async function speak(text: string) {
      await stopRecognition()
      clearSpeechOutput()
      speakingRef.current = true
      setState("speaking")
      setHint("有什么想问我的吗")
      setPopupOpen(true)
      setPopupSpeaking(true)
      setPopupError(false)
      setPopupText(text)

      if (!canUseSpeechSynthesis()) {
        finishSpeaking()
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "zh-CN"
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.onend = () => {
        setPopupText(text)
        finishSpeaking()
      }
      utterance.onerror = () => {
        setState("error")
        setHint("语音播报失败，请重试")
        speakingRef.current = false
        setPopupSpeaking(false)
        resetPopupSoon()
        scheduleRestart()
      }
      window.speechSynthesis.speak(utterance)
    }

    function showErrorPopup(text: string) {
      clearSpeechOutput()
      setState("error")
      setHint("AI 接口请求失败")
      setPopupOpen(true)
      setPopupSpeaking(false)
      setPopupError(true)
      setPopupText(text)
      setLastHeard("")
      setLiveTranscript("")
    }

    function showInfoPopup(text: string) {
      setPopupOpen(true)
      setPopupSpeaking(false)
      setPopupError(false)
      setPopupText(text)
    }

    async function handleCommand(commandText: string) {
      setState("processing")
      setHint("我在听哦")
      const intent = resolveIntent(commandText)

      if (intent === "refresh") {
        await onRefreshRef.current?.()
        await speak("我已经帮你刷新实时数据了，你可以继续问我植物状态。")
        return
      }

      try {
        const context = buildMobilePlantContext(plantRef.current, realtimeRef.current)
        const history = historyRef.current.slice(-8)
        historyRef.current = [...history, { role: "user", content: commandText }]
        const result = await askPlantAi(commandText, context.contextText, history)
        const answer = result.answer?.trim() || buildStatusReply(plantRef.current, realtimeRef.current)
        historyRef.current = [...historyRef.current.slice(-8), { role: "assistant", content: answer }]
        await speak(answer)
      } catch (error) {
        if (intent === "status") {
          await speak(buildStatusReply(plantRef.current, realtimeRef.current))
          return
        }
        showErrorPopup(error instanceof Error ? error.message : "AI 服务暂时不可用，请稍后再试。")
      }
    }

    async function processTranscript(rawText: string) {
      const normalized = normalizeSpeech(rawText)
      if (!normalized) return
      setLastHeard(rawText)
      setLiveTranscript(rawText)
      clearTranscriptSoon()

      const stripped = stripWakePhrase(normalized)
      if (stripped !== null) {
        followUpUntilRef.current = Date.now() + FOLLOW_UP_WINDOW_MS
        setHint("我在听哦")
        if (stripped) {
          await handleCommand(stripped)
          return
        }
        showInfoPopup("我在，请继续说你的问题，比如：今天植物状态怎么样。")
        scheduleRestart()
        return
      }

      if (Date.now() < followUpUntilRef.current) {
        setHint("我在听哦")
        await handleCommand(normalized)
        return
      }

      scheduleRestart()
    }

    async function ensurePermission() {
      if (permissionCheckedRef.current) return true

      if (isNativeApp()) {
        const availability = await SpeechRecognition.available().catch(() => ({ available: false }))
        nativeAvailableRef.current = availability.available
        if (!availability.available) {
          setState("unsupported")
          setHint("当前设备不支持语音识别")
          return false
        }

        setState("arming")
        setHint("正在请求麦克风权限")
        const permissions = await SpeechRecognition.requestPermissions().catch(() => ({ speechRecognition: "denied" as const }))
        if (permissions.speechRecognition !== "granted") {
          setState("error")
          setHint("麦克风权限未开启")
          return false
        }

        permissionCheckedRef.current = true
        setHint("有什么想问我的吗")
        return true
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unsupported")
        setHint("当前设备无法访问麦克风")
        return false
      }

      try {
        setState("arming")
        setHint("正在请求麦克风权限")
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        permissionCheckedRef.current = true
        setHint("有什么想问我的吗")
        return true
      } catch {
        setState("error")
        setHint("麦克风权限未开启")
        return false
      }
    }

    async function startNativeRecognition() {
      const listening = await SpeechRecognition.isListening().catch(() => ({ listening: false }))
      if (listening.listening || nativeStartingRef.current) return

      nativeStartingRef.current = true
      nativePartialRef.current = ""

      const partialHandle = await SpeechRecognition.addListener("partialResults", (data) => {
        const transcript = (data.matches || []).join(" ").trim()
        clearNativeFinalizeTimer()
        nativePartialRef.current = transcript
        if (transcriptClearTimerRef.current) {
          window.clearTimeout(transcriptClearTimerRef.current)
          transcriptClearTimerRef.current = null
        }
        setLiveTranscript(transcript)
      })

      const stateHandle = await SpeechRecognition.addListener("listeningState", ({ status }) => {
        if (status === "started") {
          clearNativeFinalizeTimer()
          nativeStartingRef.current = false
          setState("listening")
          setHint("有什么想问我的吗")
          return
        }

        if (!shouldListenRef.current || speakingRef.current) return

        clearNativeFinalizeTimer()
        nativeFinalizeTimerRef.current = window.setTimeout(() => {
          nativeFinalizeTimerRef.current = null
          const finalTranscript = nativePartialRef.current.trim()
          nativePartialRef.current = ""
          setLiveTranscript("")
          void removeNativeListeners()

          if (!shouldListenRef.current || speakingRef.current) return

          if (finalTranscript) {
            void processTranscript(finalTranscript)
            return
          }

          setState("idle")
          setHint("有什么想问我的吗")
          scheduleRestart()
        }, 700)
      })

      listenerHandlesRef.current = [partialHandle, stateHandle]

      await SpeechRecognition.start({
        language: "zh-CN",
        maxResults: 3,
        partialResults: true,
        popup: false,
      }).catch((error: unknown) => {
        nativeStartingRef.current = false
        void removeNativeListeners()
        setState("error")
        setHint(error instanceof Error ? `语音识别异常：${error.message}` : "语音识别启动失败")
      })
    }

    function startWebRecognition() {
      if (!SpeechRecognitionCtor || recognitionRef.current) return

      const recognition = new SpeechRecognitionCtor()
      recognition.lang = "zh-CN"
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 3

      recognition.onstart = () => {
        setState("listening")
        setHint("有什么想问我的吗")
        setLiveTranscript("")
      }
      recognition.onerror = (event) => {
        recognitionRef.current = null
        setLiveTranscript("")
        if (!shouldListenRef.current) return
        if (event.error === "no-speech" || event.error === "aborted") {
          setState("idle")
          setHint("有什么想问我的吗")
          scheduleRestart()
          return
        }
        setState("error")
        setHint(`语音识别异常：${event.error}`)
      }
      recognition.onend = () => {
        recognitionRef.current = null
        setLiveTranscript("")
        if (!shouldListenRef.current || speakingRef.current) return
        setState("idle")
        setHint("有什么想问我的吗")
        scheduleRestart()
      }
      recognition.onresult = (event) => {
        const results = Array.from(event.results).slice(event.resultIndex)
        const interimTranscript = results
          .filter((result) => !result.isFinal)
          .map((result) => result[0]?.transcript || "")
          .join(" ")
          .trim()
        const finalTranscript = results
          .filter((result) => result.isFinal)
          .map((result) => result[0]?.transcript || "")
          .join(" ")
          .trim()

        setLiveTranscript(interimTranscript)

        if (finalTranscript) {
          void processTranscript(finalTranscript)
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    }

    async function startRecognition() {
      if (!shouldListenRef.current || speakingRef.current || document.visibilityState !== "visible") return
      if (!(await ensurePermission())) return

      if (isNativeApp()) {
        await startNativeRecognition()
        return
      }

      if (!SpeechRecognitionCtor) {
        setState("unsupported")
        setHint("当前设备不支持语音识别")
        return
      }

      startWebRecognition()
    }

    async function teardown() {
      shouldListenRef.current = false
      clearNativeFinalizeTimer()
      if (transcriptClearTimerRef.current) {
        window.clearTimeout(transcriptClearTimerRef.current)
        transcriptClearTimerRef.current = null
      }
      await stopRecognition()
      await removeNativeListeners()
      clearSpeechOutput()
      followUpUntilRef.current = 0
      nativePartialRef.current = ""
      nativeStartingRef.current = false
      setState("idle")
      setHint("有什么想问我的吗")
      setPopupOpen(false)
      setPopupText("")
      setPopupSpeaking(false)
      setPopupError(false)
      setLastHeard("")
      setLiveTranscript("")
    }

    function handleVisibilityChange() {
      if (!enabled) return
      if (document.visibilityState === "visible") {
        shouldListenRef.current = true
        void startRecognition()
      } else {
        void stopRecognition()
        setState("idle")
        setHint("有什么想问我的吗")
      }
    }

    if (enabled) {
      shouldListenRef.current = true
      void startRecognition()
    } else {
      void teardown()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      void teardown()
    }
  }, [enabled])

  return {
    state,
    hint,
    lastHeard,
    popupOpen,
    popupText,
    popupSpeaking,
    popupError,
    closePopup: () => {
      if (canUseSpeechSynthesis()) {
        window.speechSynthesis.cancel()
      }
      setPopupOpen(false)
      setPopupText("")
      setPopupSpeaking(false)
      setPopupError(false)
      setState("idle")
      setHint("有什么想问我的吗")
      setLastHeard("")
      setLiveTranscript("")
    },
    liveTranscript,
  }
}
