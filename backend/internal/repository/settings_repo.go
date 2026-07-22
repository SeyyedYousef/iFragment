package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/model"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var ErrOptimisticLockConflict = fmt.Errorf("settings have been modified by another user")

type GroupSettings struct {
	GroupID             uuid.UUID       `json:"group_id"`
	General             json.RawMessage `json:"general"`
	ContentRestrictions json.RawMessage `json:"content_restrictions"`
	Limits              json.RawMessage `json:"limits"`
	QuietHours          json.RawMessage `json:"quiet_hours"`
	MandatoryMembership json.RawMessage `json:"mandatory_membership"`
	CustomTexts         json.RawMessage `json:"custom_texts"`
	DynamicBio          json.RawMessage `json:"dynamic_bio"`
	Version             int             `json:"version"`
	UpdatedAt           time.Time       `json:"updated_at"`
	UpdatedBy           *int64          `json:"updated_by,omitempty"`
}

type SettingsGeneral struct {
	Language            string `json:"language"`
	Timezone            string `json:"timezone"`
	WelcomeMessage      bool   `json:"welcomeMessage"`
	WarningMessage      bool   `json:"warningMessage"`
	AutoDeleteBot       bool   `json:"autoDeleteBot"`
	AutoDeleteDelay     int    `json:"autoDeleteDelay"`
	TrackAdmin          bool   `json:"trackAdmin"`
	VerifyMembers       bool   `json:"verifyMembers"`
	PublicCommands      bool   `json:"publicCommands"`
	HideJoinLeave       bool   `json:"hideJoinLeave"`
	EphemeralWelcome    bool   `json:"ephemeralWelcome"`
	EphemeralWarnings   bool   `json:"ephemeralWarnings"`
	EphemeralCaptcha    bool   `json:"ephemeralCaptcha"`
	EphemeralAdminCmd   bool   `json:"ephemeralAdminCmd"`
	EphemeralAll        bool   `json:"ephemeralAll"`
	DefaultPenalty      string `json:"defaultPenalty"`
	AutoWarning         bool   `json:"autoWarning"`
	WarningThreshold    int    `json:"warningThreshold"`
	WarningRetention    int    `json:"warningRetention"`
	WarningFinalPenalty string `json:"warningFinalPenalty"`
	CasEnabled          bool   `json:"casEnabled"`
	AntiRaidThreshold   int    `json:"antiRaidThreshold"` // Joins per minute
	AntiRaidAction      string `json:"antiRaidAction"`    // lockdown, alert
	BotEnabled          *bool  `json:"botEnabled"`
}

type RestrictionDetail struct {
	Enabled bool   `json:"enabled"`
	Window  string `json:"window"`  // Always, QuietHours, Custom
	Start   string `json:"start"`   // HH:mm
	End     string `json:"end"`     // HH:mm
	Penalty string `json:"penalty"` // delete, mute_1h, mute_24h, kick, ban
}

type SettingsContentRestrictions struct {
	RemoveLinks               RestrictionDetail `json:"removeLinks"`
	BlockBots                 RestrictionDetail `json:"blockBots"`
	RemoveBotInviters         RestrictionDetail `json:"removeBotInviters"`
	BlockDomains              RestrictionDetail `json:"blockDomains"`
	BlockUsernames            RestrictionDetail `json:"blockUsernames"`
	BlockHashtags             RestrictionDetail `json:"blockHashtags"`
	BlockTextPatterns         RestrictionDetail `json:"blockTextPatterns"`
	BlockEmojis               RestrictionDetail `json:"blockEmojis"`
	BlockEmojiOnly            RestrictionDetail `json:"blockEmojiOnly"`
	BlockPhoneNumbers         RestrictionDetail `json:"blockPhoneNumbers"`
	BlockPhotos               RestrictionDetail `json:"blockPhotos"`
	BlockStickers             RestrictionDetail `json:"blockStickers"`
	BlockLocations            RestrictionDetail `json:"blockLocations"`
	BlockAudio                RestrictionDetail `json:"blockAudio"`
	BlockVoiceMessages        RestrictionDetail `json:"blockVoiceMessages"`
	BlockFiles                RestrictionDetail `json:"blockFiles"`
	BlockGifs                 RestrictionDetail `json:"blockGifs"`
	BlockCaptionless          RestrictionDetail `json:"blockCaptionless"`
	BlockForwards             RestrictionDetail `json:"blockForwards"`
	RestrictChannelForwards   RestrictionDetail `json:"restrictChannelForwards"`
	BlockAppMessages          RestrictionDetail `json:"blockAppMessages"`
	BlockPolls                RestrictionDetail `json:"blockPolls"`
	BlockInlineKeyboards      RestrictionDetail `json:"blockInlineKeyboards"`
	BlockGames                RestrictionDetail `json:"blockGames"`
	BlockSlashCommands        RestrictionDetail `json:"blockSlashCommands"`
	BlockUserReplies          RestrictionDetail `json:"blockUserReplies"`
	BlockCrossChatReplies     RestrictionDetail `json:"blockCrossChatReplies"`
	BlockLatinLetters         RestrictionDetail `json:"blockLatinLetters"`
	BlockPersianArabicLetters RestrictionDetail `json:"blockPersianArabicLetters"`
	BlockCyrillicLetters      RestrictionDetail `json:"blockCyrillicLetters"`
	BlockChineseCharacters    RestrictionDetail `json:"blockChineseCharacters"`
	ForwardWhitelist          []string          `json:"forwardWhitelist"`
	BannedKeywords            []string          `json:"bannedKeywords"`
	RequiredKeywords          []string          `json:"requiredKeywords"`
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
	EmergencyLock     bool          `json:"emergencyLock"`
	AdminOverride     bool          `json:"adminOverride"`
	SendNotifications bool          `json:"sendNotifications"`
	Periods           []QuietPeriod `json:"periods"`
}

type SettingsMandatoryMembership struct {
	ForcedAddEnabled    bool     `json:"forced_add_enabled"`
	ForcedAddCount      int      `json:"forced_add_count"`
	ForceJoinEnabled    bool     `json:"force_join_enabled"`
	RequiredChannels    []string `json:"required_channels"`
	VerificationEnabled bool     `json:"verification_enabled"`
	Exemptions          []string `json:"exemptions"`
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
	db         *Database
	cache      *Cache
	localCache sync.Map
}

func NewSettingsRepo(db *Database, cache *Cache) *SettingsRepo {
	return &SettingsRepo{db: db, cache: cache, localCache: sync.Map{}}
}

func (r *SettingsRepo) ClearCacheKey(ctx context.Context, key string) {
	if r.cache != nil && r.cache.Client != nil {
		r.cache.Client.Del(ctx, key)
	}
}

func populateGeneralDefaults(raw json.RawMessage) json.RawMessage {
	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil || m == nil {
		m = make(map[string]interface{})
	}

	defaults := map[string]interface{}{
		"language":            "en",
		"timezone":            "UTC",
		"welcomeMessage":      true,
		"warningMessage":      true,
		"autoDeleteBot":       true,
		"autoDeleteDelay":     60,
		"trackAdmin":          false,
		"verifyMembers":       false,
		"publicCommands":      false,
		"hideJoinLeave":       false,
		"ephemeralWelcome":    false,
		"ephemeralWarnings":   false,
		"ephemeralCaptcha":    false,
		"ephemeralAdminCmd":   false,
		"ephemeralAll":        false,
		"defaultPenalty":      "delete",
		"autoWarning":         false,
		"warningThreshold":    0,
		"warningRetention":    0,
		"warningFinalPenalty": "",
		"casEnabled":          false,
		"antiRaidThreshold":   0,
		"antiRaidAction":      "none",
		"botEnabled":          true,
	}

	changed := false
	for k, v := range defaults {
		val, exists := m[k]
		if !exists || val == nil {
			m[k] = v
			changed = true
			continue
		}
		if str, ok := val.(string); ok && str == "" {
			m[k] = v
			changed = true
		}
	}

	if changed || len(raw) <= 2 { // empty or "{}"
		newData, err := json.Marshal(m)
		if err == nil {
			return json.RawMessage(newData)
		}
	}
	return raw
}

func IsLegacyText(val string) bool {
	return strings.Contains(val, "We are delighted to have you join") ||
		strings.Contains(val, "Official Warning") ||
		strings.Contains(val, "Group Lockdown Initiated") ||
		strings.Contains(val, "Group Lockdown Lifted") ||
		strings.Contains(val, "Community Guidelines for") ||
		strings.Contains(val, "Action Required: Channel Membership") ||
		strings.Contains(val, "Action Required: Community Contribution") ||
		strings.Contains(val, "Welcome {user} to") ||
		strings.Contains(val, "Quiet Hours Active") ||
		strings.Contains(val, "Chat Open") ||
		strings.Contains(val, "No Spam, Ads, or Unauthorized Links") ||
		strings.Contains(val, "join required channels to chat in") ||
		strings.Contains(val, "invite {remainadd} member(s) to chat in") ||
		strings.Contains(val, "Warning <b>{count}") ||
		strings.Contains(val, "حالت سکوت") ||
		strings.Contains(val, "خوش‌آمدید")
}

func populateCustomTextsDefaults(raw json.RawMessage, lang ...string) json.RawMessage {
	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil || m == nil {
		m = make(map[string]interface{})
	}

	defaults := map[string]interface{}{
		"welcomeText":      "👋 Welcome {user}",
		"warningText":      "⚠️ {user} | Warning {count}/{threshold} ▫️ {reason}",
		"silenceStartText": "🔒 Quiet mode activated",
		"silenceEndText":   "🔓 Quiet mode deactivated",
		"rulesText":        "📜 <b>Rules</b>: Respect others • No spam or links",
		"forceJoinText":    "📢 {user}, join required channels to chat:\n{channel_names}",
		"forceAddText":     "👥 {user}, invite {remainadd} member(s) to chat ({added}/{number})",
		"inlineButtons":    []interface{}{},
	}

	changed := false
	for k, v := range defaults {
		val, exists := m[k]
		if !exists || val == nil {
			m[k] = v
			changed = true
			continue
		}
		if str, ok := val.(string); ok && (str == "" || IsLegacyText(str)) {
			m[k] = v
			changed = true
		}
	}

	if changed || len(raw) <= 2 { // empty or "{}"
		newData, err := json.Marshal(m)
		if err == nil {
			return json.RawMessage(newData)
		}
	}
	return raw
}

func (r *SettingsRepo) GetSettings(ctx context.Context, groupID uuid.UUID) (*GroupSettings, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database connection not available")
	}

	// 0. Try local memory cache first for zero-latency
	if val, ok := r.localCache.Load(groupID); ok {
		return val.(*GroupSettings), nil
	}

	// 1. Try cache
	if r.cache != nil && r.cache.Client != nil {
		cacheKey := fmt.Sprintf("settings:%s", groupID.String())
		val, err := r.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var s GroupSettings
			if json.Unmarshal([]byte(val), &s) == nil {
				s.General = populateGeneralDefaults(s.General)
				var gen SettingsGeneral
				json.Unmarshal(s.General, &gen)
				s.CustomTexts = populateCustomTextsDefaults(s.CustomTexts, gen.Language)
				r.localCache.Store(groupID, &s)
				return &s, nil
			}
		}
	}

	query := `SELECT group_id, general, content_restrictions, limits, quiet_hours, mandatory_membership, custom_texts, dynamic_bio, version, updated_at, updated_by
		FROM group_settings WHERE group_id = $1`
	var s GroupSettings
	err := r.db.Pool.QueryRow(ctx, query, groupID).Scan(
		&s.GroupID, &s.General, &s.ContentRestrictions, &s.Limits, &s.QuietHours,
		&s.MandatoryMembership, &s.CustomTexts, &s.DynamicBio, &s.Version, &s.UpdatedAt, &s.UpdatedBy,
	)
	if err == pgx.ErrNoRows {
		return r.initSettings(ctx, groupID)
	}

	if err == nil {
		s.General = populateGeneralDefaults(s.General)
		var gen SettingsGeneral
		json.Unmarshal(s.General, &gen)
		s.CustomTexts = populateCustomTextsDefaults(s.CustomTexts, gen.Language)
		r.localCache.Store(groupID, &s)
		if r.cache != nil && r.cache.Client != nil {
			// Set cache
			cacheKey := fmt.Sprintf("settings:%s", groupID.String())
			data, _ := json.Marshal(s)
			r.cache.Client.Set(ctx, cacheKey, data, 1*time.Hour)
		}
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
		DynamicBio:          empty,
		Version:             1,
	}
	s.General = populateGeneralDefaults(s.General)
	var gen SettingsGeneral
	json.Unmarshal(s.General, &gen)
	s.CustomTexts = populateCustomTextsDefaults(s.CustomTexts, gen.Language)
	query := `INSERT INTO group_settings (group_id, general, content_restrictions, limits, quiet_hours, mandatory_membership, custom_texts, dynamic_bio)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (group_id) DO NOTHING
		RETURNING updated_at`
	err := r.db.Pool.QueryRow(ctx, query, groupID, s.General, empty, empty, empty, empty, s.CustomTexts, empty).Scan(&s.UpdatedAt)
	if err == pgx.ErrNoRows {
		return r.GetSettings(ctx, groupID)
	}
	if err == nil {
		r.localCache.Store(groupID, s)
	}
	return s, err
}

func (r *SettingsRepo) UpdateCategory(ctx context.Context, groupID uuid.UUID, category string, data json.RawMessage, userID int64, currentVersion int) (*GroupSettings, error) {
	validCategories := map[string]bool{
		"general": true, "content_restrictions": true, "limits": true,
		"quiet_hours": true, "mandatory_membership": true, "custom_texts": true,
		"dynamic_bio": true,
	}
	if !validCategories[category] {
		return nil, fmt.Errorf("invalid settings category: %s", category)
	}

	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database connection not available")
	}

	query := fmt.Sprintf(`UPDATE group_settings SET %s = $1, version = version + 1, updated_at = now(), updated_by = $2
		WHERE group_id = $3 AND version = $4
		RETURNING version, updated_at`, category)

	var version int
	var updatedAt time.Time
	err := r.db.Pool.QueryRow(ctx, query, data, userID, groupID, currentVersion).Scan(&version, &updatedAt)
	if err == pgx.ErrNoRows {
		return nil, ErrOptimisticLockConflict
	}
	if err != nil {
		return nil, err
	}

	if r.cache != nil && r.cache.Client != nil {
		cacheKey := fmt.Sprintf("settings:%s", groupID.String())
		r.cache.Client.Del(ctx, cacheKey)
	}
	r.localCache.Delete(groupID)

	return r.GetSettings(ctx, groupID)
}

func (r *SettingsRepo) ForceUpdateQuietHours(ctx context.Context, groupID uuid.UUID, data json.RawMessage) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database connection not available")
	}
	query := `UPDATE group_settings SET quiet_hours = $1, version = version + 1, updated_at = now() WHERE group_id = $2`
	_, err := r.db.Pool.Exec(ctx, query, data, groupID)
	if err == nil {
		if r.cache != nil && r.cache.Client != nil {
			cacheKey := fmt.Sprintf("settings:%s", groupID.String())
			r.cache.Client.Del(ctx, cacheKey)
		}
		r.localCache.Delete(groupID)
	}
	return err
}

func (r *SettingsRepo) GetMultipleSettings(ctx context.Context, groupIDs []uuid.UUID) (map[uuid.UUID]*GroupSettings, error) {
	result := make(map[uuid.UUID]*GroupSettings)
	if len(groupIDs) == 0 {
		return result, nil
	}

	// 0. Try local cache first
	var cacheMisses []uuid.UUID
	for _, id := range groupIDs {
		if val, ok := r.localCache.Load(id); ok {
			result[id] = val.(*GroupSettings)
		} else {
			cacheMisses = append(cacheMisses, id)
		}
	}

	if len(cacheMisses) == 0 {
		return result, nil
	}

	keys := make([]string, len(cacheMisses))
	for i, id := range cacheMisses {
		keys[i] = fmt.Sprintf("settings:%s", id.String())
	}

	// 1. Try cache (Redis MGET)
	var redisMisses []uuid.UUID
	if r.cache != nil && r.cache.Client != nil {
		vals, err := r.cache.Client.MGet(ctx, keys...).Result()
		if err == nil {
			for i, v := range vals {
				gID := cacheMisses[i]
				if v != nil {
					if str, ok := v.(string); ok {
						var s GroupSettings
						if json.Unmarshal([]byte(str), &s) == nil {
							r.localCache.Store(gID, &s)
							result[gID] = &s
							continue
						}
					}
				}
				redisMisses = append(redisMisses, gID)
			}
		} else {
			redisMisses = cacheMisses
		}
	} else {
		redisMisses = cacheMisses
	}

	// 2. Load misses from DB
	if len(redisMisses) > 0 {
		if r.db == nil || r.db.Pool == nil {
			return nil, fmt.Errorf("database connection not available")
		}

		query := `SELECT group_id, general, content_restrictions, limits, quiet_hours, mandatory_membership, custom_texts, dynamic_bio, version, updated_at, updated_by
			FROM group_settings WHERE group_id = ANY($1)`

		rows, err := r.db.Pool.Query(ctx, query, redisMisses)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		foundMap := make(map[uuid.UUID]bool)
		for rows.Next() {
			var s GroupSettings
			err := rows.Scan(
				&s.GroupID, &s.General, &s.ContentRestrictions, &s.Limits, &s.QuietHours,
				&s.MandatoryMembership, &s.CustomTexts, &s.DynamicBio, &s.Version, &s.UpdatedAt, &s.UpdatedBy,
			)
			if err == nil {
				result[s.GroupID] = &s
				foundMap[s.GroupID] = true
				r.localCache.Store(s.GroupID, &s)
				if r.cache != nil && r.cache.Client != nil {
					cacheKey := fmt.Sprintf("settings:%s", s.GroupID.String())
					data, _ := json.Marshal(s)
					r.cache.Client.Set(ctx, cacheKey, data, 1*time.Hour)
				}
			}
		}

		if err := rows.Err(); err != nil {
			return nil, err
		}

		// Init missing from DB (if they don't exist yet)
		for _, id := range redisMisses {
			if !foundMap[id] {
				s, err := r.GetSettings(ctx, id)
				if err == nil && s != nil {
					result[id] = s
				}
			}
		}
	}

	return result, nil
}

// System Settings Management
func (r *SettingsRepo) GetSystemSettings(ctx context.Context) (*model.SystemSettings, error) {
	// Try Cache first
	cacheKey := "system_settings:global"
	if r.cache != nil && r.cache.Client != nil {
		val, err := r.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var s model.SystemSettings
			if json.Unmarshal([]byte(val), &s) == nil {
				return &s, nil
			}
		}
	}

	query := `SELECT value FROM system_settings WHERE key = 'global'`
	var b []byte
	err := r.db.Pool.QueryRow(ctx, query).Scan(&b)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Return defaults if not set
			return &model.SystemSettings{
				MaintenanceMode: false,
				TapMultiplier:   1.0,
				ReferralBonus:   1000,
				DailyRewardBase: 500,
			}, nil
		}
		return nil, err
	}

	var s model.SystemSettings
	if err := json.Unmarshal(b, &s); err != nil {
		return nil, err
	}

	// Store in cache
	if r.cache != nil && r.cache.Client != nil {
		r.cache.Client.Set(ctx, cacheKey, string(b), 5*time.Minute)
	}

	return &s, nil
}

func (r *SettingsRepo) UpdateSystemSettings(ctx context.Context, settings *model.SystemSettings) error {
	b, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	query := `
		INSERT INTO system_settings (key, value)
		VALUES ('global', $1)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
	`
	_, err = r.db.Pool.Exec(ctx, query, b)
	if err == nil && r.cache != nil && r.cache.Client != nil {
		r.cache.Client.Del(ctx, "system_settings:global")
	}
	return err
}
