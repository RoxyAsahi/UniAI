package uqa

import (
	"database/sql"
	"encoding/json"
	"fmt"
)

// SaveAssessment persists a completed assessment and returns the new row ID.
func SaveAssessment(db *sql.DB, userID int64, req SubmitRequest) (int64, error) {
	reportJSON, err := json.Marshal(req.Report)
	if err != nil {
		return 0, fmt.Errorf("marshal report: %w", err)
	}

	res, err := db.Exec(
		`INSERT INTO uqa_assessments (user_id, total_score, report) VALUES (?, ?, ?)`,
		userID, req.TotalScore, string(reportJSON),
	)
	if err != nil {
		return 0, fmt.Errorf("insert assessment: %w", err)
	}
	return res.LastInsertId()
}

// ListAssessments returns lightweight rows for the given user.
func ListAssessments(db *sql.DB, userID int64) ([]AssessmentListItem, error) {
	rows, err := db.Query(
		`SELECT id, total_score, created_at FROM uqa_assessments WHERE user_id = ? ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []AssessmentListItem
	for rows.Next() {
		var item AssessmentListItem
		if err := rows.Scan(&item.ID, &item.TotalScore, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if items == nil {
		items = []AssessmentListItem{}
	}
	return items, nil
}

// GetAssessment returns the full assessment row for the given user and ID.
func GetAssessment(db *sql.DB, userID int64, id int64) (*Assessment, error) {
	var a Assessment
	err := db.QueryRow(
		`SELECT id, user_id, total_score, report, created_at FROM uqa_assessments WHERE id = ? AND user_id = ?`,
		id, userID,
	).Scan(&a.ID, &a.UserID, &a.TotalScore, &a.Report, &a.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}
