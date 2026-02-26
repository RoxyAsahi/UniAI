import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAssessmentList, AssessmentListItem } from '../api/uqa'
import './UqaLanding.css'

export default function UqaLanding() {
  const navigate = useNavigate()
  const [list, setList] = useState<AssessmentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAssessmentList()
      .then(setList)
      .catch(() => setError('加载历史记录失败，请检查登录状态'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="header-icon">🧠</div>
        <h1>UQA 学能诊断</h1>
        <p className="subtitle">全面了解孩子的学习能量与成长潜力</p>
      </header>

      <div className="landing-card intro-card">
        <h2>什么是学能诊断？</h2>
        <p>
          UQA 学能诊断通过 52 道科学题目，从七个维度全面评估孩子的学习状态，
          包括学习能量、情绪复原力、认知思维、行动习惯、信念系统、记忆表达和规则关系感。
        </p>
        <div className="dimension-tags">
          {['学习能量', '情绪复原力', '认知思维', '行动习惯', '信念系统', '记忆表达', '规则关系'].map(d => (
            <span key={d} className="dim-tag">{d}</span>
          ))}
        </div>
        <button className="btn-primary" onClick={() => navigate('/uqa/questionnaire')}>
          开始新的诊断
        </button>
      </div>

      <div className="landing-card history-card">
        <h2>历史诊断记录</h2>
        {loading && <p className="hint">加载中…</p>}
        {error && <p className="hint error">{error}</p>}
        {!loading && !error && list.length === 0 && (
          <p className="hint">暂无历史记录，完成第一次诊断后将在此显示。</p>
        )}
        {list.map(item => (
          <div
            key={item.id}
            className="history-item"
            onClick={() => navigate(`/uqa/result/${item.id}`)}
          >
            <div className="history-left">
              <span className="history-date">
                {new Date(item.created_at).toLocaleDateString('zh-CN', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
            </div>
            <div className="history-right">
              <span className="history-score">{item.total_score} 分</span>
              <span className="history-arrow">›</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
