import { AlertTriangle, Sparkles } from "lucide-react"
import type { HomeRealtimeData, Plant, PlantAiAnalysis } from "../types"
import { formatTime } from "../mobile-utils"

export function DetailPage({
  plant,
  realtime,
  analysis,
  loadingAnalysis,
  onAnalyze,
}: {
  plant: Plant
  realtime: HomeRealtimeData | null
  analysis: PlantAiAnalysis | null
  loadingAnalysis: boolean
  onAnalyze: () => void
}) {
  const env = realtime?.environment

  return (
    <main className="screen detail-screen">
      <section className="detail-header">
        <p>植物详情</p>
        <h1>{plant.plantName}</h1>
        <span>最近采集：{formatTime(env?.collectedAt)}</span>
      </section>

      <section className="analysis-card">
        <div className="section-title">
          <div>
            <p>AI 风险分析</p>
            <h3>{analysis?.riskLevel ? `风险等级 ${analysis.riskLevel}` : "养护洞察"}</h3>
          </div>
          <button className="tiny-button" onClick={onAnalyze} disabled={loadingAnalysis}>
            {loadingAnalysis ? "分析中" : "刷新"}
          </button>
        </div>
        <p className="analysis-summary">{analysis?.summary || "点击刷新，调用当前项目的植物分析接口生成养护建议。"}</p>
        <div className="advice-list">
          {(analysis?.advice.length ? analysis.advice : ["保持稳定通风，观察叶片和土壤状态。"]).map((item) => (
            <span key={item}>
              <Sparkles size={14} />
              {item}
            </span>
          ))}
        </div>
        {analysis?.riskWarnings.length ? (
          <div className="warning-list">
            {analysis.riskWarnings.map((item) => (
              <span key={item}>
                <AlertTriangle size={14} />
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}