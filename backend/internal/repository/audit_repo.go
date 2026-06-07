package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type AuditLog struct {
	ID         uuid.UUID   `json:"id"`
	GroupID    *uuid.UUID  `json:"group_id,omitempty"`
	ActorID   int64       `json:"actor_id"`
	Action    string      `json:"action"`
	TargetType *string    `json:"target_type,omitempty"`
	TargetID   *string    `json:"target_id,omitempty"`
	OldValue   []byte     `json:"old_value,omitempty"`
	NewValue   []byte     `json:"new_value,omitempty"`
	Metadata   []byte     `json:"metadata,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

type AuditRepo struct {
	db *Database
}

func NewAuditRepo(db *Database) *AuditRepo {
	return &AuditRepo{db: db}
}

func (r *AuditRepo) Log(ctx context.Context, entry *AuditLog) error {
	query := `INSERT INTO audit_logs (group_id, actor_id, action, target_type, target_id, old_value, new_value, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`
	return r.db.Pool.QueryRow(ctx, query,
		entry.GroupID, entry.ActorID, entry.Action, entry.TargetType, entry.TargetID,
		entry.OldValue, entry.NewValue, entry.Metadata,
	).Scan(&entry.ID, &entry.CreatedAt)
}

func (r *AuditRepo) GetByGroup(ctx context.Context, groupID uuid.UUID, limit, offset int) ([]AuditLog, error) {
	query := `SELECT id, group_id, actor_id, action, target_type, target_id, old_value, new_value, metadata, created_at
		FROM audit_logs WHERE group_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.Pool.Query(ctx, query, groupID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var l AuditLog
		if err := rows.Scan(&l.ID, &l.GroupID, &l.ActorID, &l.Action, &l.TargetType, &l.TargetID,
			&l.OldValue, &l.NewValue, &l.Metadata, &l.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return logs, nil
}
