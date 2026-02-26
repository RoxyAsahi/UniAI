import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitAssessment } from '../api/uqa'
import './UqaQuestionnaire.css'

// ─── Question data ────────────────────────────────────────────────────────────

interface Dimension {
  name: string
  questions: string[]
}

const DIMENSIONS: Dimension[] = [
  {
    name: '学习能量与身体节律',
    questions: [
      '孩子在上课或学习时，能保持清醒和专注的状态',
      '孩子在完成作业或学习任务时，不容易感到疲惫',
      '孩子的睡眠质量良好，早晨起床后精力充沛',
      '孩子在运动或体育活动后，能较快恢复精力',
      '孩子在饮食方面有规律，不会因饥饿或暴饮暴食影响学习',
      '孩子能根据自身状态调整学习节奏，如在精力充沛时集中学习',
    ],
  },
  {
    name: '情绪体验与挫折复原力',
    questions: [
      '孩子在面对学习困难或失败时，能较快调整情绪，重新投入学习',
      '孩子在考试或重要任务前，能有效管理焦虑情绪',
      '孩子在受到批评或负面反馈时，不会长时间情绪低落',
      '孩子能识别并表达自己的情绪，如告诉家长或老师自己的感受',
      '孩子在遇到挫折时，会主动寻求帮助或解决方案',
      '孩子在学习中能体验到乐趣或成就感',
    ],
  },
  {
    name: '认知与思维方式',
    questions: [
      '孩子在学习新知识时，能将其与已有知识联系起来',
      '孩子在解决问题时，能尝试多种方法，而不是只用一种方式',
      '孩子在阅读或听讲时，能抓住重点和关键信息',
      '孩子能对所学内容进行总结和归纳',
      '孩子在面对复杂问题时，能将其分解为更小的步骤来解决',
      '孩子能从不同角度思考问题，而不是只有一种固定看法',
      '孩子在学习中能发现规律或模式',
      '孩子能对自己的学习方法进行反思和调整',
    ],
  },
  {
    name: '行动习惯与角色切换',
    questions: [
      '孩子能按时完成作业和学习任务，不需要家长反复催促',
      '孩子在开始学习任务时，不会拖延太长时间',
      '孩子能合理安排学习和娱乐时间',
      '孩子在课堂上能积极参与，如主动回答问题或参与讨论',
      '孩子在家庭学习环境中，能快速进入学习状态',
      '孩子能在不同场合（如课堂、家庭、课外活动）灵活切换角色',
      '孩子在完成长期任务（如项目或读书计划）时，能坚持执行',
      '孩子在学习中能保持良好的学习习惯，如整理笔记、复习等',
    ],
  },
  {
    name: '信念系统与学习身份感',
    questions: [
      '孩子相信通过努力可以提高自己的学习能力',
      '孩子在面对困难时，认为自己有能力克服',
      '孩子对自己的学习有积极的自我评价，如认为自己是一个好学生',
      '孩子在学习中有明确的目标，并为之努力',
      '孩子对学习有内在动力，而不仅仅是为了获得奖励或避免惩罚',
      '孩子在遇到失败时，认为这是学习和成长的机会',
      '孩子对自己的未来有积极的期望，如希望在某个领域取得成就',
      '孩子能将学习与自己的兴趣或价值观联系起来',
    ],
  },
  {
    name: '记忆、表达与呈现能力',
    questions: [
      '孩子能较好地记住所学的知识，并在需要时回忆起来',
      '孩子在口头表达时，能清晰地传达自己的想法',
      '孩子在书面表达时，能有条理地组织内容',
      '孩子在课堂上能有效地做笔记，记录重要信息',
      '孩子在展示或汇报时，能自信地表达自己的观点',
      '孩子能用多种方式（如图表、故事、例子）来解释或记忆知识',
      '孩子在学习外语或新词汇时，能较快记住并运用',
      '孩子能将所学知识应用到实际生活或其他学科中',
    ],
  },
  {
    name: '规则观与关系感',
    questions: [
      '孩子能遵守学校和课堂的规则，如按时上课、不打扰他人',
      '孩子在与同学合作时，能尊重他人的意见和贡献',
      '孩子能与老师建立良好的关系，如主动与老师沟通',
      '孩子在家庭中能遵守家规，如完成家务或按时就寝',
      '孩子在团队活动中，能承担自己的责任并支持团队目标',
      '孩子能理解并接受不同的规则在不同场合的重要性',
      '孩子在与他人发生冲突时，能以和平的方式解决',
      '孩子能感受到来自家人、老师和同学的支持与关爱',
    ],
  },
]

const OPEN_QUESTIONS = [
  '您认为孩子在学习上最大的优势是什么？',
  '您认为孩子在学习上面临的最大挑战是什么？',
  '您对孩子未来的学习和发展有什么期望？',
]

const SCALE_LABELS = ['完全不符合', '不太符合', '一般', '比较符合', '完全符合']

// ─── Component ────────────────────────────────────────────────────────────────

export default function UqaQuestionnaire() {
  const navigate = useNavigate()

  // step: 0..6 = dimension pages, 7 = open questions, 8 = submitting
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[]>(Array(52).fill(0))
  const [openAnswers, setOpenAnswers] = useState<string[]>(['', '', ''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Compute global question index offset for current dimension
  const dimOffset = DIMENSIONS.slice(0, step).reduce((s, d) => s + d.questions.length, 0)

  const setAnswer = (globalIdx: number, val: number) => {
    setAnswers(prev => {
      const next = [...prev]
      next[globalIdx] = val
      return next
    })
  }

  const currentDimAnswered = () => {
    if (step >= DIMENSIONS.length) return true
    const dim = DIMENSIONS[step]
    for (let i = 0; i < dim.questions.length; i++) {
      if (answers[dimOffset + i] === 0) return false
    }
    return true
  }

  const handleNext = () => {
    if (!currentDimAnswered()) {
      setError('请完成本页所有题目后继续')
      return
    }
    setError('')
    setStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    for (const a of openAnswers) {
      if (!a.trim()) { setError('请填写所有开放性问题'); return }
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await submitAssessment({ answers, open_answers: openAnswers })
      navigate(`/uqa/result/${res.id}`)
    } catch (e: any) {
      setError(e?.message ?? '提交失败，请重试')
      setSubmitting(false)
    }
  }

  const totalSteps = DIMENSIONS.length + 1 // 7 dims + 1 open page
  const progress = Math.round((step / totalSteps) * 100)

  // ── Open questions page ──
  if (step === DIMENSIONS.length) {
    return (
      <div className="q-page">
        <ProgressBar value={progress} step={step} total={totalSteps} />
        <div className="q-card">
          <h2 className="dim-title">开放性问题</h2>
          <p className="dim-subtitle">请根据您对孩子的了解，认真填写以下问题</p>
          {OPEN_QUESTIONS.map((q, i) => (
            <div key={i} className="open-item">
              <label className="open-label">{i + 1}. {q}</label>
              <textarea
                className="open-textarea"
                rows={4}
                placeholder="请在此输入您的回答…"
                value={openAnswers[i]}
                onChange={e => {
                  const next = [...openAnswers]
                  next[i] = e.target.value
                  setOpenAnswers(next)
                }}
              />
            </div>
          ))}
          {error && <p className="q-error">{error}</p>}
          <div className="q-nav">
            <button className="btn-back" onClick={() => setStep(s => s - 1)}>上一步</button>
            <button className="btn-next" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '提交中…' : '提交诊断'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Dimension question page ──
  const dim = DIMENSIONS[step]
  return (
    <div className="q-page">
      <ProgressBar value={progress} step={step} total={totalSteps} />
      <div className="q-card">
        <div className="dim-badge">维度 {step + 1} / {DIMENSIONS.length}</div>
        <h2 className="dim-title">{dim.name}</h2>
        <p className="dim-subtitle">请根据孩子的实际情况，为每道题选择最符合的选项</p>

        {dim.questions.map((q, i) => {
          const globalIdx = dimOffset + i
          const val = answers[globalIdx]
          return (
            <div key={i} className="question-item">
              <p className="question-text">{dimOffset + i + 1}. {q}</p>
              <div className="scale-row">
                {SCALE_LABELS.map((label, score) => (
                  <button
                    key={score}
                    className={`scale-btn ${val === score + 1 ? 'selected' : ''}`}
                    onClick={() => setAnswer(globalIdx, score + 1)}
                  >
                    <span className="scale-num">{score + 1}</span>
                    <span className="scale-label">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        {error && <p className="q-error">{error}</p>}

        <div className="q-nav">
          {step > 0 && (
            <button className="btn-back" onClick={() => { setError(''); setStep(s => s - 1); window.scrollTo({ top: 0 }) }}>
              上一步
            </button>
          )}
          <button className="btn-next" onClick={handleNext}>
            {step === DIMENSIONS.length - 1 ? '下一步（开放问题）' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProgressBar({ value, step, total }: { value: number; step: number; total: number }) {
  return (
    <div className="progress-wrap">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="progress-text">{step} / {total} 完成</span>
    </div>
  )
}
