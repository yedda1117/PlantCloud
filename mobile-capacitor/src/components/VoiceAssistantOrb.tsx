import { motion } from "framer-motion"
import type { VoiceAssistantState } from "../hooks/useVoiceAssistant"

export function VoiceAssistantOrb({
  state,
  liveTranscript,
  lastHeard,
}: {
  state: VoiceAssistantState
  liveTranscript: string
  lastHeard: string
}) {
  const visibleTranscript = liveTranscript || lastHeard
  const title = state === "processing" || state === "speaking" || Boolean(visibleTranscript) ? "我在听哦" : "要和我聊聊吗？"

  return (
    <div className={`voice-assistant voice-assistant-${state}`} aria-live="polite">
      <motion.div
        className="voice-assistant-orb"
        animate={{
          scale: state === "listening" || state === "processing" ? [1, 1.06, 1] : state === "speaking" ? [1, 1.12, 1] : 1,
          opacity: state === "idle" ? 0.86 : 1,
        }}
        transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      >
        <span className="voice-assistant-core" />
        <span className="voice-assistant-ring voice-assistant-ring-a" />
        <span className="voice-assistant-ring voice-assistant-ring-b" />
      </motion.div>
      <div className="voice-assistant-copy">
        <strong>{title}</strong>
        {visibleTranscript ? <span>{visibleTranscript}</span> : null}
      </div>
    </div>
  )
}
