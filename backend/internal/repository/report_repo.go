package repository

import (
	"context"
	"encoding/json"
)

type DBReport struct {
	ID             int64           `json:"id"`
	UserID         int64           `json:"user_id"`
	TargetUsername string          `json:"username"`
	Status         string          `json:"status"`
	RarityScore    int             `json:"rarity_score"`
	ReportData     json.RawMessage `json:"report_data"`
	CreatedAt      string          `json:"created_at"`
}

func (db *Database) SaveReport(ctx context.Context, userID int64, username string, status string, score int, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	query := `
		INSERT INTO username_reports (user_id, username, status, rarity_score, report_data)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err = db.Pool.Exec(ctx, query, userID, username, status, score, jsonData)
	return err
}

func (db *Database) GetUserReports(ctx context.Context, userID int64) ([]DBReport, error) {
	query := `
		SELECT id, user_id, username, status, rarity_score, report_data, generated_at
		FROM username_reports
		WHERE user_id = $1
		ORDER BY generated_at DESC
	`
	rows, err := db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []DBReport
	for rows.Next() {
		var r DBReport
		if err := rows.Scan(&r.ID, &r.UserID, &r.TargetUsername, &r.Status, &r.RarityScore, &r.ReportData, &r.CreatedAt); err != nil {
			return nil, err
		}
		reports = append(reports, r)
	}
	return reports, nil
}
