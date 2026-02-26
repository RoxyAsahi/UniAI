import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAssessmentDetail, AssessmentDetail } from '../api/uqa'
import './UqaResult.css'

// ─── Zone thresholds per dimension ───────────────────────────────────────────

interface DimMeta {
  key: string
  name: string
  max: number
  zones: [number, number, number] // 优势区下限, 发展区下限, 预警区下限 (风险区 = 0)
}

const DIM_META: DimMeta[] = [
  { key: '学习能量与身体节律',   name: '学习能量',   max: 30, zones: [24, 18, 12] },
  { key: '情绪体验与挫折复原力', name: '情绪复原力', max: 30, zones: [24, 18, 12] },
  { key: '认知与思维方式',       name: '认知思维',   max: 40, zones: [32, 24, 16] },
  { key: '行动习惯与角色切换',   name: '行动习惯',   max: 40, zones: [32, 24, 16] },
  { key: '信念系统与学习身份感', name: '信念系统',   max: 40, zones: [32, 24, 16] },
  { key: '记忆、表达与呈现能力', name: '记忆表达',   max: 40, zones: [32, 24, 16] },
  { key: '规则观与关系感',       name: '规则关系',   max: 40, zones: [32, 24, 16] },
]

function getZone(score: number, meta: DimMeta): { label: string; cls: string } {
  if (score >= meta.zones[0]) return { label: '优势区', cls: 'zone-a' }
  if (score >= meta.zones[1]) return { label: '发展区', cls: 'zone-b' }
  if (score >= meta.zones[2]) return { label: '预警区', cls: 'zone-c' }
  return { label: '风险区', cls: 'zone-d' }
}

const ZONE_DESC: Record<string, string> = {
  优势区: '该维度表现优秀，是孩子的核心优势，可进一步发挥和强化。',
  发展区: '该维度有良好基础，通过针对性练习可以进一步提升。',
  预警区: '该维度需要关注，建议制定专项改善计划。',
  风险区: '该维度存在明显不足，建议尽快寻求专业支持。',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UqaResult() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<AssessmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    getAssessmentDetail(Number(id))
      .then(setData)
      .catch(() => setError('加载报告失败'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="result-loading">加载中…</div>
  if (error || !data) return <div className="result-loading error">{error || '报告不存在'}</div>

  const totalMax = DIM_META.reduce((s, d) => s + d.max, 0) // 260

  return (
    <div className="result-page">
      {/* Header */}
      <header className="result-header">
        <div className="result-icon">📊</div>
        <h1>学能诊断报告</h1>
        <p className="result-date">
          {new Date(data.created_at).toLocaleDateString('zh-CN', {
            year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </header>

      {/* Total score */}
      <div className="score-card">
        <div className="total-score-wrap">
          <span className="total-score">{data.total_score}</span>
          <span className="total-max">/ {totalMax}</span>
        </div>
        <p className="total-label">综合学能得分</p>
        <div className="total-bar">
          <div
            className="total-fill"
            style={{ width: `${Math.round((data.total_score / totalMax) * 100)}%` }}
          />
        </div>
      </div>

      {/* Dimension breakdown */}
      <div className="section-card">
        <h2 className="section-title">七维度详细分析</h2>
        {DIM_META.map((meta) => {
          const score = data.scores_by_category?.[meta.key] ?? 0
          const pct = Math.round((score / meta.max) * 100)
          const zone = getZone(score, meta)
          return (
            <div key={meta.key} className="dim-row">
              <div className="dim-row-top">
                <span className="dim-name">{meta.name}</span>
                <div className="dim-right">
                  <span className={`zone-badge ${zone.cls}`}>{zone.label}</span>
                  <span className="dim-score">{score}<span className="dim-max">/{meta.max}</span></span>
                </div>
              </div>
              <div className="dim-bar">
                <div className={`dim-fill ${zone.cls}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="dim-zone-desc">{ZONE_DESC[zone.label]}</p>
            </div>
          )
        })}
      </div>

      {/* Suggestions */}
      {data.suggestions && (
        <div className="section-card">
          <h2 className="section-title">综合建议</h2>
          <p className="suggestions-text">{data.suggestions}</p>
        </div>
      )}

      {/* Actions */}
      <div className="result-actions">
        <button className="btn-outline" onClick={() => navigate('/uqa')}>返回首页</button>
        <button className="btn-primary" onClick={() => navigate('/uqa/questionnaire')}>再次诊断</button>
      </div>
    </div>
  )
}
