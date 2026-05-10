package repository

import (
	"context"
)

// LogSearch records a username search for popularity tracking
func (db *Database) LogSearch(ctx context.Context, username string, userID int64) error {
	query := `INSERT INTO search_logs (username, user_id) VALUES ($1, $2)`
	_, err := db.Pool.Exec(ctx, query, username, userID)
	return err
}

// GetSearchPopularity returns how many times a username has been searched
func (db *Database) GetSearchPopularity(ctx context.Context, username string) (int, error) {
	query := `SELECT COUNT(*) FROM search_logs WHERE username = $1`
	var count int
	err := db.Pool.QueryRow(ctx, query, username).Scan(&count)
	return count, err
}
