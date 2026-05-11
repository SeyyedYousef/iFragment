package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type GroupSettings struct {
	GroupID             uuid.UUID       `json:"group_id"`
	General             json.RawMessage `json:"general"`
	ContentRestrictions json.RawMessage `json:"content_restrictions"`
	Limits              json.RawMessage `json:"limits"`
	QuietHours          json.RawMessage `json:"quiet_hours"`
	MandatoryMembership json.RawMessage `json:"mandatory_membership"`
	CustomTexts         json.RawMessage `json:"custom_texts"`
	Version             int             `json:"version"`
	UpdatedAt           time.Time       `json:"updated_at"`
	UpdatedBy           *int64          `json:"updated_by,omitempty"`
}

type SettingsGeneral struct {
	Timezone            string `json:"timezone"`
	WelcomeMessage      bool   `json:"welcomeMessage"`
	WarningMessage      bool   `json:"warningMessage"`
	AutoDeleteBot       bool   `json:"autoDeleteBot"`
	AutoDeleteDelay     int    `json:"autoDeleteDelay"`
	TrackAdmin          bool   `json:"trackAdmin"`
	VerifyMembers       bool   `json:"verifyMembers"`
	PublicCommands      bool   `json:"publicCommands"`
	HideJoinLeave       bool   `json:"hideJoinLeave"`
	DefaultPenalty      string `json:"defaultPenalty"`
	AutoWarning         bool   `json:"autoWarning"`
	WarningThreshold    int    `json:"warningThreshold"`
	WarningRetention    int    `json:"warningRetention"`
	WarningFinalPenalty string `json:"warningFinalPenalty"`
}

type SettingsContentRestrictions struct {
	RemoveLinks               bool     `json:"removeLinks"`
	BlockBots                 bool     `json:"blockBots"`
	RemoveBotInviters         bool     `json:"removeBotInviters"`
	BlockDomains              bool     `json:"blockDomains"`
	BlockUsernames            bool     `json:"blockUsernames"`
	BlockHashtags             bool     `json:"blockHashtags"`
	BlockTextPatterns         bool     `json:"blockTextPatterns"`
	BlockEmojis               bool     `json:"blockEmojis"`
	BlockEmojiOnly            bool     `json:"blockEmojiOnly"`
	BlockPhoneNumbers         bool     `json:"blockPhoneNumbers"`
	BlockPhotos               bool     `json:"blockPhotos"`
	BlockStickers             bool     `json:"blockStickers"`
	BlockLocations            bool     `json:"blockLocations"`
	BlockAudio                bool     `json:"blockAudio"`
	BlockVoiceMessages        bool     `json:"blockVoiceMessages"`
	BlockFiles                bool     `json:"blockFiles"`
	BlockGifs                 bool     `json:"blockGifs"`
	BlockCaptionless          bool     `json:"blockCaptionless"`
	BlockForwards             bool     `json:"blockForwards"`
	RestrictChannelForwards   bool     `json:"restrictChannelForwards"`
	BlockAppMessages          bool     `json:"blockAppMessages"`
	BlockPolls                bool     `json:"blockPolls"`
	BlockInlineKeyboards      bool     `json:"blockInlineKeyboards"`
	BlockGames                bool     `json:"blockGames"`
	BlockSlashCommands        bool     `json:"blockSlashCommands"`
	BlockUserReplies          bool     `json:"blockUserReplies"`
	BlockCrossChatReplies     bool     `json:"blockCrossChatReplies"`
	BlockLatinLetters         bool     `json:"blockLatinLetters"`
	BlockPersianArabicLetters bool     `json:"blockPersianArabicLetters"`
	BlockCyrillicLetters      bool     `json:"blockCyrillicLetters"`
	BlockChineseCharacters    bool     `json:"blockChineseCharacters"`
	BannedKeywords            []string `json:"bannedKeywords"`
	RequiredKeywords          []string `json:"requiredKeywords"`
}

type SettingsLimits struct {
	MinLen    int `json:"minMessageLength"`
	MaxLen    int `json:"maxMessageLength"`
	FloodMsgs int `json:"floodMessages"`
	FloodWin  int `json:"floodWindow"`
	DupCount  int `json:"duplicateCount"`
	DupWin    int `json:"duplicateWindow"`
}

type QuietPeriod struct {
	ID    string `json:"id"`
	Start string `json:"start"` // HH:mm
	End   string `json:"end"`   // HH:mm
}

type SettingsQuietHours struct {
	EmergencyLock    bool           `json:"emergencyLock"`
	AdminOverride    bool           `json:"adminOverride"`
	SendNotifications bool          `json:"sendNotifications"`
	Periods          []QuietPeriod  `json:"periods"`
}

type SettingsMandatoryMembership struct {
	ForcedAddEnabled   bool     `json:"forced_add_enabled"`
	ForcedAddCount     int      `json:"forced_add_count"`
	ForceJoinEnabled   bool     `json:"force_join_enabled"`
	RequiredChannels   []string `json:"required_channels"`
	VerificationEnabled bool     `json:"verification_enabled"`
	Exemptions         []string `json:"exemptions"`
}

type InlineButton struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	URL   string `json:"url"`
}

type SettingsCustomTexts struct {
	WelcomeText      string         `json:"welcomeText"`
	WarningText      string         `json:"warningText"`
	SilenceStartText string         `json:"silenceStartText"`
	SilenceEndText   string         `json:"silenceEndText"`
	RulesText        string         `json:"rulesText"`
	ForceJoinText    string         `json:"forceJoinText"`
	ForceAddText     string         `json:"forceAddText"`
	InlineButtons    []InlineButton `json:"inlineButtons"`
}

type SettingsRepo struct {
	db    *Database
	cache *Cache
}

func NewSettingsRepo(db *Database, cache *Cache) *SettingsRepo {
	return &SettingsRepo{db: db, cache: cache}
}

func (r *SettingsRepo) GetSettings(ctx context.Context, groupID uuid.UUID) (*GroupSettings, error) {
	if r.db == nil || r.db.Pool == nil {
		empty := json.RawMessage(`{}`)
		return &GroupSettings{
			GroupID: groupID,
			General: empty,
			ContentRestrictions: empty,
			Limits: empty,
			QuietHours: empty,
			MandatoryMembership: empty,
			CustomTexts: empty,
			Version: 1,
			UpdatedAt: time.Now(),
		}, nil
	}

	// 1. Try cache
	if r.cache != nil && r.cache.Client != nil {
		cacheKey := fmt.Sprintf("settings:%s", groupID.String())
		val, err := r.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var s GroupSettings
			if json.Unmarshal([]byte(val), &s) == nil {
				return &s, nil
			}
		}
	}

	query := `SELECT group_id, general, content_restrictions, limits, quiet_hours, mandatory_membership, custom_texts, version, updated_at, updated_by
		FROM group_settings WHERE group_id = $1`
	var s GroupSettings
	err := r.db.Pool.QueryRow(ctx, query, groupID).Scan(
		&s.GroupID, &s.General, &s.ContentRestrictions, &s.Limits, &s.QuietHours,
		&s.MandatoryMembership, &s.CustomTexts, &s.Version, &s.UpdatedAt, &s.UpdatedBy,
	)
	if err == pgx.ErrNoRows {
		return r.initSettings(ctx, groupID)
	}

	if err == nil && r.cache != nil {
		// Set cache
		cacheKey := fmt.Sprintf("settings:%s", groupID.String())
		data, _ := json.Marshal(s)
		r.cache.Client.Set(ctx, cacheKey, data, 1*time.Hour)
	}

	return &s, err
}

func (r *SettingsRepo) initSettings(ctx context.Context, groupID uuid.UUID) (*GroupSettings, error) {
	empty := json.RawMessage(`{}`)
	s := &GroupSettings{
		GroupID:             groupID,
		General:             empty,
		ContentRestrictions: empty,
		Limits:              empty,
		QuietHours:          empty,
		MandatoryMembership: empty,
		CustomTexts:         empty,
		Version:             1,
	}
	query := `INSERT INTO group_settings (group_id, general, content_restrictions, limits, quiet_hours, mandatory_membership, custom_texts)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (group_id) DO NOTHING
		RETURNING updated_at`
	err := r.db.Pool.QueryRow(ctx, query, groupID, empty, empty, empty, empty, empty, empty).Scan(&s.UpdatedAt)
	if err == pgx.ErrNoRows {
		return r.GetSettings(ctx, groupID)
	}
	return s, err
}

func (r *SettingsRepo) UpdateCategory(ctx context.Context, groupID uuid.UUID, category string, data json.RawMessage, userID int64, currentVersion int) (*GroupSettings, error) {
	validCategories := map[string]bool{
		"general": true, "content_restrictions": true, "limits": true,
		"quiet_hours": true, "mandatory_membership": true, "custom_texts": true,
	}
	if !validCategories[category] {
		return nil, fmt.Errorf("invalid settings category: %s", category)
	}

	if r.db == nil || r.db.Pool == nil {
		return r.GetSettings(ctx, groupID)
	}

	query := fmt.Sprintf(`UPDATE group_settings SET %s = $1, version = version + 1, updated_at = now(), updated_by = $2
		WHERE group_id = $3 AND version = $4
		RETURNING version, updated_at`, category)

	var version int
	var updatedAt time.Time
	err := r.db.Pool.QueryRow(ctx, query, data, userID, groupID, currentVersion).Scan(&version, &updatedAt)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("settings have been modified by another user (optimistic lock conflict)")
	}
	if err != nil {
		return nil, err
	}

	if r.cache != nil {
		cacheKey := fmt.Sprintf("settings:%s", groupID.String())
		r.cache.Client.Del(ctx, cacheKey)
	}

	return r.GetSettings(ctx, groupID)
}
