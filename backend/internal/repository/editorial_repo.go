package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ContentItem struct {
	ID                  uuid.UUID `json:"id"`
	ProjectID           uuid.UUID `json:"project_id"`
	SourceChatID        int64     `json:"source_chat_id"`
	SourceMessageID     int64     `json:"source_message_id"`
	SourceMediaGroupID  *string   `json:"source_media_group_id,omitempty"`
	Status              string    `json:"status"`
	CurrentRevisionID   *uuid.UUID `json:"current_revision_id,omitempty"`
	ReceivedAt          time.Time `json:"received_at"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type ContentRevision struct {
	ID              uuid.UUID       `json:"id"`
	ContentItemID   uuid.UUID       `json:"content_item_id"`
	Version         int             `json:"version"`
	Text            string          `json:"text"`
	Caption         string          `json:"caption"`
	Entities        json.RawMessage `json:"entities"`
	CaptionEntities json.RawMessage `json:"caption_entities"`
	MediaManifest   json.RawMessage `json:"media_manifest"`
	Buttons         json.RawMessage `json:"buttons"`
	Transformations json.RawMessage `json:"transformations"`
	CreatedBy       *int64          `json:"created_by,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

type ContentItemWithRevision struct {
	ContentItem
	Revision *ContentRevision `json:"revision,omitempty"`
}

type ApprovalRequest struct {
	ID            uuid.UUID  `json:"id"`
	ProjectID     uuid.UUID  `json:"project_id"`
	ContentItemID uuid.UUID  `json:"content_item_id"`
	RevisionID    *uuid.UUID `json:"revision_id,omitempty"`
	TokenHash     string     `json:"token_hash"`
	ExpiresAt     time.Time  `json:"expires_at"`
	Status        string     `json:"status"`
	CreatedAt     time.Time  `json:"created_at"`
}

type ApprovalDecision struct {
	ID             uuid.UUID `json:"id"`
	RequestID      uuid.UUID `json:"request_id"`
	ApproverUserID int64     `json:"approver_user_id"`
	Decision       string    `json:"decision"`
	Reason         string    `json:"reason,omitempty"`
	DecidedAt      time.Time `json:"decided_at"`
}

type Delivery struct {
	ID                uuid.UUID  `json:"id"`
	ProjectID         uuid.UUID  `json:"project_id"`
	ContentItemID     *uuid.UUID `json:"content_item_id,omitempty"`
	DestinationChatID int64      `json:"destination_chat_id"`
	TelegramMessageID *int64     `json:"telegram_message_id,omitempty"`
	RevisionID        *uuid.UUID `json:"revision_id,omitempty"`
	CreatedByBot      bool       `json:"created_by_bot"`
	Status            string     `json:"status"`
	IdempotencyKey    string     `json:"idempotency_key"`
	ErrorMessage      *string    `json:"error_message,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	PublishedAt       *time.Time `json:"published_at,omitempty"`
}

type ProjectMember struct {
	ID        uuid.UUID `json:"id"`
	ProjectID uuid.UUID `json:"project_id"`
	UserID    int64     `json:"user_id"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateContentItem creates a new content item
func (r *ChannelRepo) CreateContentItem(ctx context.Context, item *ContentItem) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `INSERT INTO content_items (
		project_id, source_chat_id, source_message_id, source_media_group_id, status, current_revision_id, received_at
	) VALUES ($1, $2, $3, $4, $5, $6, $7)
	ON CONFLICT (project_id, source_chat_id, source_message_id) DO NOTHING
	RETURNING id, created_at, updated_at`

	err := r.db.Pool.QueryRow(ctx, query,
		item.ProjectID, item.SourceChatID, item.SourceMessageID, item.SourceMediaGroupID, item.Status, item.CurrentRevisionID, item.ReceivedAt,
	).Scan(&item.ID, &item.CreatedAt, &item.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		// Already exists, fetch existing
		return r.db.Pool.QueryRow(ctx,
			`SELECT id, status, current_revision_id, created_at, updated_at FROM content_items WHERE project_id = $1 AND source_chat_id = $2 AND source_message_id = $3`,
			item.ProjectID, item.SourceChatID, item.SourceMessageID,
		).Scan(&item.ID, &item.Status, &item.CurrentRevisionID, &item.CreatedAt, &item.UpdatedAt)
	}
	return err
}

// CreateContentRevision inserts a new revision
func (r *ChannelRepo) CreateContentRevision(ctx context.Context, rev *ContentRevision) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	if rev.Entities == nil {
		rev.Entities = json.RawMessage("[]")
	}
	if rev.CaptionEntities == nil {
		rev.CaptionEntities = json.RawMessage("[]")
	}
	if rev.MediaManifest == nil {
		rev.MediaManifest = json.RawMessage("[]")
	}
	if rev.Buttons == nil {
		rev.Buttons = json.RawMessage("[]")
	}
	if rev.Transformations == nil {
		rev.Transformations = json.RawMessage("[]")
	}

	query := `INSERT INTO content_revisions (
		content_item_id, version, text, caption, entities, caption_entities, media_manifest, buttons, transformations, created_by
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	ON CONFLICT (content_item_id, version) DO UPDATE SET
		text = EXCLUDED.text,
		caption = EXCLUDED.caption,
		buttons = EXCLUDED.buttons,
		transformations = EXCLUDED.transformations
	RETURNING id, created_at`

	err := r.db.Pool.QueryRow(ctx, query,
		rev.ContentItemID, rev.Version, rev.Text, rev.Caption, rev.Entities, rev.CaptionEntities, rev.MediaManifest, rev.Buttons, rev.Transformations, rev.CreatedBy,
	).Scan(&rev.ID, &rev.CreatedAt)
	if err != nil {
		return err
	}

	// Update current_revision_id on content item
	_, _ = r.db.Pool.Exec(ctx, `UPDATE content_items SET current_revision_id = $1, updated_at = now() WHERE id = $2`, rev.ID, rev.ContentItemID)
	return nil
}

// GetContentItemByID gets item by ID along with current revision
func (r *ChannelRepo) GetContentItemByID(ctx context.Context, id uuid.UUID) (*ContentItemWithRevision, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT 
		ci.id, ci.project_id, ci.source_chat_id, ci.source_message_id, ci.source_media_group_id, ci.status, ci.current_revision_id, ci.received_at, ci.created_at, ci.updated_at,
		cr.id, cr.content_item_id, cr.version, cr.text, cr.caption, cr.entities, cr.caption_entities, cr.media_manifest, cr.buttons, cr.transformations, cr.created_by, cr.created_at
	FROM content_items ci
	LEFT JOIN content_revisions cr ON cr.id = ci.current_revision_id
	WHERE ci.id = $1`

	var item ContentItemWithRevision
	var rev ContentRevision
	var revID *uuid.UUID

	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&item.ID, &item.ProjectID, &item.SourceChatID, &item.SourceMessageID, &item.SourceMediaGroupID, &item.Status, &item.CurrentRevisionID, &item.ReceivedAt, &item.CreatedAt, &item.UpdatedAt,
		&revID, &rev.ContentItemID, &rev.Version, &rev.Text, &rev.Caption, &rev.Entities, &rev.CaptionEntities, &rev.MediaManifest, &rev.Buttons, &rev.Transformations, &rev.CreatedBy, &rev.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if revID != nil {
		rev.ID = *revID
		item.Revision = &rev
	}
	return &item, nil
}

// GetContentItemsByProject retrieves paged items for inbox
func (r *ChannelRepo) GetContentItemsByProject(ctx context.Context, projectID uuid.UUID, status string, limit int, offset int) ([]ContentItemWithRevision, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := `SELECT 
		ci.id, ci.project_id, ci.source_chat_id, ci.source_message_id, ci.source_media_group_id, ci.status, ci.current_revision_id, ci.received_at, ci.created_at, ci.updated_at,
		cr.id, cr.content_item_id, cr.version, cr.text, cr.caption, cr.entities, cr.caption_entities, cr.media_manifest, cr.buttons, cr.transformations, cr.created_by, cr.created_at
	FROM content_items ci
	LEFT JOIN content_revisions cr ON cr.id = ci.current_revision_id
	WHERE ci.project_id = $1 AND ($2 = '' OR ci.status = $2)
	ORDER BY ci.created_at DESC
	LIMIT $3 OFFSET $4`

	rows, err := r.db.Pool.Query(ctx, query, projectID, status, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ContentItemWithRevision
	for rows.Next() {
		var item ContentItemWithRevision
		var rev ContentRevision
		var revID *uuid.UUID

		if err := rows.Scan(
			&item.ID, &item.ProjectID, &item.SourceChatID, &item.SourceMessageID, &item.SourceMediaGroupID, &item.Status, &item.CurrentRevisionID, &item.ReceivedAt, &item.CreatedAt, &item.UpdatedAt,
			&revID, &rev.ContentItemID, &rev.Version, &rev.Text, &rev.Caption, &rev.Entities, &rev.CaptionEntities, &rev.MediaManifest, &rev.Buttons, &rev.Transformations, &rev.CreatedBy, &rev.CreatedAt,
		); err != nil {
			return nil, err
		}
		if revID != nil {
			rev.ID = *revID
			item.Revision = &rev
		}
		list = append(list, item)
	}
	return list, nil
}

// UpdateContentItemStatus updates status atomically
func (r *ChannelRepo) UpdateContentItemStatus(ctx context.Context, id uuid.UUID, status string) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	_, err := r.db.Pool.Exec(ctx, `UPDATE content_items SET status = $1, updated_at = now() WHERE id = $2`, status, id)
	return err
}

// CreateApprovalRequest stores an approval token
func (r *ChannelRepo) CreateApprovalRequest(ctx context.Context, req *ApprovalRequest) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `INSERT INTO approval_requests (
		project_id, content_item_id, revision_id, token_hash, expires_at, status
	) VALUES ($1, $2, $3, $4, $5, $6)
	RETURNING id, created_at`
	return r.db.Pool.QueryRow(ctx, query,
		req.ProjectID, req.ContentItemID, req.RevisionID, req.TokenHash, req.ExpiresAt, req.Status,
	).Scan(&req.ID, &req.CreatedAt)
}

// GetApprovalRequestByToken gets request by token hash
func (r *ChannelRepo) GetApprovalRequestByToken(ctx context.Context, tokenHash string) (*ApprovalRequest, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT id, project_id, content_item_id, revision_id, token_hash, expires_at, status, created_at
	FROM approval_requests
	WHERE token_hash = $1`

	var req ApprovalRequest
	err := r.db.Pool.QueryRow(ctx, query, tokenHash).Scan(
		&req.ID, &req.ProjectID, &req.ContentItemID, &req.RevisionID, &req.TokenHash, &req.ExpiresAt, &req.Status, &req.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &req, nil
}

// RecordApprovalDecisionAtomic records a decision with an advisory lock, preventing race conditions
func (r *ChannelRepo) RecordApprovalDecisionAtomic(ctx context.Context, reqID uuid.UUID, approverID int64, decision string, reason string) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Check current status
	var status string
	var expiresAt time.Time
	var contentItemID uuid.UUID
	err = tx.QueryRow(ctx, `SELECT status, expires_at, content_item_id FROM approval_requests WHERE id = $1 FOR UPDATE`, reqID).Scan(&status, &expiresAt, &contentItemID)
	if err != nil {
		return err
	}
	if status != "pending" {
		return fmt.Errorf("request already %s", status)
	}
	if time.Now().After(expiresAt) {
		_, _ = tx.Exec(ctx, `UPDATE approval_requests SET status = 'expired' WHERE id = $1`, reqID)
		return fmt.Errorf("request expired")
	}

	// Insert decision
	_, err = tx.Exec(ctx, `INSERT INTO approval_decisions (request_id, approver_user_id, decision, reason) VALUES ($1, $2, $3, $4)`,
		reqID, approverID, decision, reason)
	if err != nil {
		return fmt.Errorf("decision already recorded: %w", err)
	}

	// Update request status
	_, err = tx.Exec(ctx, `UPDATE approval_requests SET status = 'decided' WHERE id = $1`, reqID)
	if err != nil {
		return err
	}

	// Update content item status
	var targetItemStatus string
	switch decision {
	case "approved":
		targetItemStatus = "approved"
	case "rejected":
		targetItemStatus = "rejected"
	case "scheduled":
		targetItemStatus = "scheduled"
	default:
		targetItemStatus = "editing"
	}
	_, err = tx.Exec(ctx, `UPDATE content_items SET status = $1, updated_at = now() WHERE id = $2`, targetItemStatus, contentItemID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// CreateDelivery registers a publication attempt with an idempotency key
func (r *ChannelRepo) CreateDelivery(ctx context.Context, d *Delivery) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `INSERT INTO deliveries (
		project_id, content_item_id, destination_chat_id, telegram_message_id, revision_id, created_by_bot, status, idempotency_key
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	ON CONFLICT (idempotency_key) DO UPDATE SET
		status = EXCLUDED.status,
		error_message = EXCLUDED.error_message
	RETURNING id, created_at`

	return r.db.Pool.QueryRow(ctx, query,
		d.ProjectID, d.ContentItemID, d.DestinationChatID, d.TelegramMessageID, d.RevisionID, d.CreatedByBot, d.Status, d.IdempotencyKey,
	).Scan(&d.ID, &d.CreatedAt)
}

// UpdateDeliveryPublished marks delivery as published
func (r *ChannelRepo) UpdateDeliveryPublished(ctx context.Context, id uuid.UUID, telegramMsgID int64) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	now := time.Now()
	_, err := r.db.Pool.Exec(ctx, `UPDATE deliveries SET status = 'published', telegram_message_id = $1, published_at = $2 WHERE id = $3`, telegramMsgID, now, id)
	return err
}

// UpdateDeliveryFailed marks delivery as failed
func (r *ChannelRepo) UpdateDeliveryFailed(ctx context.Context, id uuid.UUID, errMsg string) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	_, err := r.db.Pool.Exec(ctx, `UPDATE deliveries SET status = 'failed', error_message = $1 WHERE id = $2`, errMsg, id)
	return err
}

// IsBotDeliveryMessage returns true ONLY if the given message in the output channel was created by the bot
// HARD RULE: If this returns false, the message is an admin's manual post and must NOT be touched.
func (r *ChannelRepo) IsBotDeliveryMessage(ctx context.Context, destinationChatID int64, telegramMsgID int64) (bool, error) {
	if r.db == nil || r.db.Pool == nil {
		return false, fmt.Errorf("database pool is not initialized")
	}
	var exists bool
	query := `SELECT EXISTS(
		SELECT 1 FROM deliveries 
		WHERE destination_chat_id = $1 
		  AND telegram_message_id = $2 
		  AND created_by_bot = true
	)`
	err := r.db.Pool.QueryRow(ctx, query, destinationChatID, telegramMsgID).Scan(&exists)
	return exists, err
}

// GetDeliveriesByProject gets recent deliveries
func (r *ChannelRepo) GetDeliveriesByProject(ctx context.Context, projectID uuid.UUID, limit int, offset int) ([]Delivery, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	query := `SELECT id, project_id, content_item_id, destination_chat_id, telegram_message_id, revision_id, created_by_bot, status, idempotency_key, error_message, created_at, published_at
	FROM deliveries
	WHERE project_id = $1
	ORDER BY created_at DESC
	LIMIT $2 OFFSET $3`

	rows, err := r.db.Pool.Query(ctx, query, projectID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Delivery
	for rows.Next() {
		var d Delivery
		if err := rows.Scan(
			&d.ID, &d.ProjectID, &d.ContentItemID, &d.DestinationChatID, &d.TelegramMessageID, &d.RevisionID, &d.CreatedByBot, &d.Status, &d.IdempotencyKey, &d.ErrorMessage, &d.CreatedAt, &d.PublishedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, d)
	}
	return list, nil
}

// GetProjectMembers lists members
func (r *ChannelRepo) GetProjectMembers(ctx context.Context, projectID uuid.UUID) ([]ProjectMember, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT id, project_id, user_id, role, created_at FROM project_members WHERE project_id = $1 ORDER BY created_at ASC`
	rows, err := r.db.Pool.Query(ctx, query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ProjectMember
	for rows.Next() {
		var m ProjectMember
		if err := rows.Scan(&m.ID, &m.ProjectID, &m.UserID, &m.Role, &m.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, nil
}

// AddProjectMember adds or updates member role
func (r *ChannelRepo) AddProjectMember(ctx context.Context, projectID uuid.UUID, userID int64, role string) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `INSERT INTO project_members (project_id, user_id, role)
	VALUES ($1, $2, $3)
	ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`
	_, err := r.db.Pool.Exec(ctx, query, projectID, userID, role)
	return err
}

// RemoveProjectMember removes a member
func (r *ChannelRepo) RemoveProjectMember(ctx context.Context, projectID uuid.UUID, userID int64) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`, projectID, userID)
	return err
}

// GetUserProjectRole returns user role in project
func (r *ChannelRepo) GetUserProjectRole(ctx context.Context, projectID uuid.UUID, userID int64) (string, error) {
	if r.db == nil || r.db.Pool == nil {
		return "", fmt.Errorf("database pool is not initialized")
	}
	var role string
	err := r.db.Pool.QueryRow(ctx, `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`, projectID, userID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return role, err
}
