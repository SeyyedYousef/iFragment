package repository

import (
	"context"
	"encoding/json"
)

type DBReport struct {
	ID             string
	UserID         int64
	TargetUsername string
	ReportData     json.RawMessage
	CreatedAt      string
}

func (db *Database) SaveReport(ctx context.Context, userID int64, username string, data interface{}) error {
	jsonData, _ := json.Marshal(data)
	query := `
		INSERT INTO reports (user_id, target_username, report_data)
		VALUES ($1, $2, $3)
	`
	_, err := db.Pool.Exec(ctx, query, userID, username, jsonData)
	return err
}

func (db *Database) GetUserReports(ctx context.Context, userID int64) ([]DBReport, error) {
	query := `
		SELECT id, user_id, target_username, report_data, created_at
		FROM reports
		WHERE user_id = $1
		ORDER BY created_at DESC
	`
	rows, err := db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []DBReport
	for rows.Next() {
		var r DBReport
		if err := rows.Scan(&r.ID, &r.UserID, &r.TargetUsername, &r.ReportData, &r.CreatedAt); err != nil {
			return nil, err
		}
		reports = append(reports, r)
	}
	return reports, nil
}
