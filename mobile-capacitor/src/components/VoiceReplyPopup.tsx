import { AnimatePresence, motion } from "framer-motion"

export function VoiceReplyPopup({
  open,
  text,
  speaking,
  error = false,
  onClose,
}: {
  open: boolean
  text: string
  speaking: boolean
  error?: boolean
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="voice-reply-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.section
            className={`voice-reply-popup ${error ? "voice-reply-popup-error" : ""}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="voice-reply-head">
              <div className={`voice-reply-dot ${speaking ? "active" : ""} ${error ? "error" : ""}`} />
              <strong>{error ? "我刚刚没连上" : speaking ? "我慢慢说给你听" : "这是我想说的话"}</strong>
              <button type="button" onClick={onClose} aria-label="关闭语音回复">
                关闭
              </button>
            </div>
            <div className="voice-reply-body">
              <p>{text || "..."}</p>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
