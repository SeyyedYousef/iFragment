package repository

import (
	"context"
	"encoding/json"
	"fmt"
)

type DBReport struct {
	ID             string          `json:"id"`
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
	prefix := fmt.Sprintf("report_pay:%d:%s:", userID, username)
	query := `
		INSERT INTO username_reports (user_id, username, status, rarity_score, report_data, order_id)
		VALUES ($1, $2, $3, $4, $5, (
			SELECT id FROM orders
			WHERE starts_with(payload, $6) AND status = 'paid'
			ORDER BY created_at DESC LIMIT 1
		))
	`
	_, err = db.Pool.Exec(ctx, query, userID, username, status, score, jsonData, prefix)
	return err
}

func (db *Database) GetUserReports(ctx context.Context, userID int64) ([]DBReport, error) {
	query := `
		SELECT id, user_id, username, status, rarity_score, report_data, generated_at
		FROM username_reports
		WHERE user_id = $1
		ORDER BY generated_at DESC
		LIMIT 100
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
