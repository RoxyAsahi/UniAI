import request from '../utils/request'

export interface AssessmentListItem {
  id: number
  total_score: number
  created_at: string
}

export interface DimensionScore {
  name: string
  score: number
  max: number
  zone: string // 优势区 | 发展区 | 预警区 | 风险区
}

export interface AssessmentDetail {
  id: number
  total_score: number
  scores_by_category: Record<string, number>
  suggestions: string
  created_at: string
}

export interface SubmitPayload {
  answers: number[]          // 52 integers, each 1-5
  open_answers: string[]     // 3 open-ended answers
}

export const submitAssessment = (payload: SubmitPayload): Promise<{ id: number }> =>
  request.post('/uqa/assessments', payload) as any

export const getAssessmentList = (): Promise<AssessmentListItem[]> =>
  request.get('/uqa/assessments') as any

export const getAssessmentDetail = (id: number): Promise<AssessmentDetail> =>
  request.get(`/uqa/assessments/${id}`) as any
