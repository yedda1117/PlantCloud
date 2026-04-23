import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

export function IntroPage({ onEnter }: { onEnter: () => void }) {
  return (
    <motion.main className="intro-screen" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.28 }}>
      <div className="intro-visual">
        <div className="orbital-ring ring-one" />
        <div className="orbital-ring ring-two" />
        <motion.div className="living-plant" animate={{ y: [0, -8, 0], rotate: [-1, 1, -1] }} transition={{ duration: 5, repeat: Infinity }}>
          <span className="leaf leaf-a" />
          <span className="leaf leaf-b" />
          <span className="leaf leaf-c" />
          <span className="stem" />
          <span className="pot" />
        </motion.div>
        <div className="signal-chip chip-a">温湿光同步</div>
        <div className="signal-chip chip-b">AI 养护推理</div>
      </div>

      <section className="intro-copy">
        <p className="eyebrow">PlantCloud Mobile</p>
        <h1>把植物状态，装进随身的智能温室。</h1>
        <p>移动端保留网页端的清新高级感，直接进入看首页、植物详情、日历记录和 AI 问答。</p>
        <button className="primary-action" onClick={onEnter}>
          进入植物云端
          <ArrowRight size={18} />
        </button>
      </section>
    </motion.main>
  )
}

