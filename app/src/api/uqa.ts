import axios from "axios";

const api = axios.create({ baseURL: "/api" });

// Attach JWT from localStorage — match main app format (raw token, no "Bearer " prefix)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers["Authorization"] = token;
  return config;
});

export interface AssessmentReport {
  scoresByCategory: Record<string, number>;
  suggestions: string;
}

export interface Assessment {
  id: number;
  user_id: number;
  total_score: number;
  report: string; // JSON string of AssessmentReport
  created_at: string;
}

export interface AssessmentListItem {
  id: number;
  total_score: number;
  created_at: string;
}

export interface CreateAssessmentPayload {
  total_score: number;
  report: AssessmentReport;
}

export async function createAssessment(
  payload: CreateAssessmentPayload,
): Promise<{ id: number }> {
  const res = await api.post<{ id: number }>("/uqa/assessments", payload);
  return res.data;
}

export async function listAssessments(): Promise<AssessmentListItem[]> {
  const res = await api.get<AssessmentListItem[]>("/uqa/assessments");
  return res.data;
}

export async function getAssessmentDetail(id: number): Promise<Assessment> {
  const res = await api.get<Assessment>(`/uqa/assessments/${id}`);
  return res.data;
}
