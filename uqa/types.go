package uqa

// SubmitRequest is the payload sent by the frontend.
// The frontend computes scores per dimension and sends them directly.
type SubmitRequest struct {
	TotalScore int        `json:"total_score"`
	Report     ReportBody `json:"report"`
}

// ReportBody mirrors the frontend's report object.
type ReportBody struct {
	ScoresByCategory map[string]int `json:"scoresByCategory"`
	Suggestions      string         `json:"suggestions"`
}

// Assessment is the database row returned to the client.
type Assessment struct {
	ID         int    `json:"id"`
	UserID     int    `json:"user_id"`
	TotalScore int    `json:"total_score"`
	Report     string `json:"report"` // raw JSON string
	CreatedAt  string `json:"created_at"`
}

// AssessmentListItem is the lightweight row used in list responses.
type AssessmentListItem struct {
	ID         int    `json:"id"`
	TotalScore int    `json:"total_score"`
	CreatedAt  string `json:"created_at"`
}
