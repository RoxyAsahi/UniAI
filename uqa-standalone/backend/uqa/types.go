package uqa

import "time"

// Assessment is the DB model for uqa_assessments.
type Assessment struct {
	Id         int64     `json:"id"`
	UserId     int64     `json:"user_id"`
	TotalScore int       `json:"total_score"`
	Report     string    `json:"report"` // JSON string of ReportData
	CreatedAt  time.Time `json:"created_at"`
}

// ReportData is the structured content stored in Assessment.Report.
type ReportData struct {
	ScoresByCategory map[string]int `json:"scoresByCategory"`
	Suggestions      string         `json:"suggestions"`
}

// CreateAssessmentRequest is the POST body for creating an assessment.
type CreateAssessmentRequest struct {
	TotalScore int        `json:"total_score"`
	Report     ReportData `json:"report"`
}
