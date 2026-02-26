package uqa

import (
	"database/sql"
	"encoding/json"
	"time"

	"uqa-standalone/globals"
)

func InitTable(db *sql.DB) error {
	_, err := globals.ExecDb(db, `
		CREATE TABLE IF NOT EXISTS uqa_assessments (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			user_id BIGINT NOT NULL,
			total_score INT NOT NULL,
			report JSON,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX(user_id)
		)
	`)
	return err
}

func CreateAssessment(db *sql.DB, userID int64, data CreateAssessmentRequest) (Assessment, error) {
	reportJSON, err := json.Marshal(data.Report)
	if err != nil {
		return Assessment{}, err
	}

	res, err := globals.ExecDb(db,
		`INSERT INTO uqa_assessments (user_id, total_score, report, created_at) VALUES (?, ?, ?, ?)`,
		userID, data.TotalScore, string(reportJSON), time.Now(),
	)
	if err != nil {
		return Assessment{}, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return Assessment{}, err
	}

	return GetAssessmentDetail(db, userID, id)
}

func GetAssessmentList(db *sql.DB, userID int64) ([]Assessment, error) {
	rows, err := globals.QueryDb(db,
		`SELECT id, user_id, total_score, report, created_at FROM uqa_assessments WHERE user_id = ? ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Assessment
	for rows.Next() {
		var a Assessment
		var reportJSON []byte
		if err := rows.Scan(&a.Id, &a.UserId, &a.TotalScore, &reportJSON, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.Report = string(reportJSON)
		list = append(list, a)
	}
	return list, nil
}

func GetAssessmentDetail(db *sql.DB, userID int64, id int64) (Assessment, error) {
	var a Assessment
	var reportJSON []byte
	err := globals.QueryRowDb(db,
		`SELECT id, user_id, total_score, report, created_at FROM uqa_assessments WHERE user_id = ? AND id = ?`,
		userID, id,
	).Scan(&a.Id, &a.UserId, &a.TotalScore, &reportJSON, &a.CreatedAt)
	if err != nil {
		return Assessment{}, err
	}
	a.Report = string(reportJSON)
	return a, nil
}
