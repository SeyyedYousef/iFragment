package repository

import (
	"context"
)

type User struct {
	TelegramID   int64
	Username     string
	FirstName    string
	LastName     string
	LanguageCode string
}

func (db *Database) UpsertUser(ctx context.Context, u User) error {
	query := `
		INSERT INTO users (telegram_id, username, first_name, last_name, language_code)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (telegram_id) DO UPDATE SET
			username = EXCLUDED.username,
			first_name = EXCLUDED.first_name,
			last_name = EXCLUDED.last_name,
			language_code = EXCLUDED.language_code,
			updated_at = CURRENT_TIMESTAMP
	`
	_, err := db.Pool.Exec(ctx, query, u.TelegramID, u.Username, u.FirstName, u.LastName, u.LanguageCode)
	return err
}
