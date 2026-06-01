package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"regexp"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrInvalidUsername  = errors.New("invalid_username")
	ErrChannelNotFound  = errors.New("channel_not_found")
	ErrNotChannelMember = errors.New("not_channel_member")
	ErrAlreadyInClan    = errors.New("already_in_clan")
)

type ClanService struct {
	db    *repository.Database
	cache *repository.Cache
}

func NewClanService(db *repository.Database, cache *repository.Cache) *ClanService {
	return &ClanService{db: db, cache: cache}
}

func (s *ClanService) getBotAPIClient(ctx context.Context) (*telegram.BotAPIClient, error) {
	if s.db == nil || s.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	// Try first from DB
	var encryptedToken []byte
	err := s.db.Pool.QueryRow(ctx, "SELECT bot_token_encrypted FROM managed_bots WHERE status = 'active' LIMIT 1").Scan(&encryptedToken)
	if err == nil && len(encryptedToken) > 0 {
		token, err := botmgmt.DecryptToken(encryptedToken)
		if err == nil {
			return telegram.NewBotAPIClient(token), nil
		}
	}

	// Try from env variable
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token != "" {
		return telegram.NewBotAPIClient(token), nil
	}

	return nil, fmt.Errorf("no active telegram bot client found or configured")
}

// GetClanDetails returns user's clan details (if any)
func (s *ClanService) GetClanDetails(ctx context.Context, userID int64) (*model.UserClanDetails, error) {
	if s.db == nil || s.db.Pool == nil {
		return &model.UserClanDetails{IsMember: false}, nil
	}

	query := `
		SELECT c.id, c.telegram_channel_id, c.channel_username, COALESCE(c.channel_photo, '') as channel_photo, c.chat_title, c.members_count, c.created_at, cm.joined_at
		FROM clan_members cm
		JOIN clans c ON cm.clan_id = c.id
		WHERE cm.user_id = $1
	`
	var clan model.Clan
	var joinedAt time.Time

	err := s.db.Pool.QueryRow(ctx, query, userID).Scan(
		&clan.ID, &clan.TelegramChannelID, &clan.ChannelUsername, &clan.ChannelPhoto, &clan.ChatTitle, &clan.MembersCount, &clan.CreatedAt, &joinedAt,
	)
	if err == pgx.ErrNoRows {
		return &model.UserClanDetails{IsMember: false}, nil
	} else if err != nil {
		return nil, err
	}

	return &model.UserClanDetails{
		Clan:     &clan,
		IsMember: true,
		JoinedAt: &joinedAt,
	}, nil
}

// LeaveClan removes the user from their current clan
func (s *ClanService) LeaveClan(ctx context.Context, userID int64) error {
	if s.db == nil || s.db.Pool == nil {
		return nil
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Get current clan ID
	var clanID string
	err = tx.QueryRow(ctx, "SELECT clan_id FROM clan_members WHERE user_id = $1", userID).Scan(&clanID)
	if err == pgx.ErrNoRows {
		return fmt.Errorf("user is not a member of any clan")
	} else if err != nil {
		return err
	}

	// Remove membership
	_, err = tx.Exec(ctx, "DELETE FROM clan_members WHERE user_id = $1", userID)
	if err != nil {
		return err
	}

	// Reconcile members count by direct recount to prevent drift
	_, err = tx.Exec(ctx, "UPDATE clans c SET members_count = (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) WHERE c.id = $1", clanID)
	if err != nil {
		return err
	}

	// Clean up empty clans to avoid spam
	_, _ = tx.Exec(ctx, "DELETE FROM clans WHERE id = $1 AND members_count = 0", clanID)

	return tx.Commit(ctx)
}

var telegramUsernameRegex = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]{4,31}$`)

// SearchAndJoinClan searches a clan by Telegram username (e.g. @durov).
// If found in DB, joins it. If not, queries Telegram API to auto-create and join.
func (s *ClanService) SearchAndJoinClan(ctx context.Context, userID int64, username string) (*model.Clan, error) {
	if s.db == nil || s.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	normalized := strings.TrimPrefix(strings.TrimSpace(username), "@")
	
	// 1. Strict Username Validation
	if !telegramUsernameRegex.MatchString(normalized) {
		return nil, ErrInvalidUsername
	}

	// Dynamic Redis 10-minute cooldown on clan switching/joining
	if s.cache != nil && s.cache.Client != nil {
		key := fmt.Sprintf("clan:join:cooldown:%d", userID)
		ok, _ := s.cache.Client.SetNX(ctx, key, 1, 10*time.Minute).Result()
		if !ok {
			return nil, fmt.Errorf("please wait before switching clans again")
		}
	}

	// 2. Look up if clan already exists in DB *before* calling external Telegram HTTP calls
	var existingClan model.Clan
	var existingChannelPhoto sql.NullString
	queryExists := `
		SELECT id, telegram_channel_id, channel_username, COALESCE(channel_photo, '') as channel_photo, chat_title, members_count, created_at
		FROM clans WHERE LOWER(channel_username) = LOWER($1)
	`
	err := s.db.Pool.QueryRow(ctx, queryExists, normalized).Scan(
		&existingClan.ID, &existingClan.TelegramChannelID, &existingClan.ChannelUsername, &existingChannelPhoto, &existingClan.ChatTitle, &existingClan.MembersCount, &existingClan.CreatedAt,
	)
	
	var channelID int64
	var chatTitle string
	var photoURL string
	clanExists := (err == nil)

	if !clanExists {
		// Clan does not exist, fetch from Telegram Bot API OUTSIDE database transaction to prevent long locks (C9)
		tg, tgErr := s.getBotAPIClient(ctx)
		isProd := os.Getenv("APP_ENV") == "production"

		if tgErr != nil {
			if isProd {
				return nil, ErrChannelNotFound
			}
			// Only allow mock fallback in development
			slog.Warn("Using mock clan in non-prod environment due to client error", "username", normalized, "error", tgErr)
			if strings.EqualFold(normalized, "durov") || strings.EqualFold(normalized, "telegram") || strings.EqualFold(normalized, "ifragment") {
				channelID = 123456789
				chatTitle = "Durov's Clan"
				photoURL = "https://telegram.org/img/t_logo.png"
				if strings.EqualFold(normalized, "telegram") {
					chatTitle = "Telegram Official Clan"
				} else if strings.EqualFold(normalized, "ifragment") {
					chatTitle = "iFragment Clan"
				}
			} else {
				return nil, ErrChannelNotFound
			}
		} else {
			// Query live Telegram Chat
			chat, err := tg.GetChat(ctx, "@"+normalized)
			if err != nil {
				return nil, ErrChannelNotFound
			}
			if chat.Type != "channel" {
				return nil, ErrChannelNotFound
			}
			
			// Verify that the user is actually a member/admin of this channel (C2)
			status, err := tg.GetChatMember(ctx, chat.ID, userID)
			if err != nil {
				return nil, ErrNotChannelMember
			}
			if status == "left" || status == "kicked" {
				return nil, ErrNotChannelMember
			}

			channelID = chat.ID
			chatTitle = chat.Title
			photoURL = "https://telegram.org/img/t_logo.png" // Default fallback

			// Fetch exact member count to populate the clan
			if _, err := tg.GetChatMemberCount(ctx, chat.ID); err == nil {
				photoURL = "https://telegram.org/img/t_logo.png"
			}
		}
	}

	// 3. Perform database modifications inside a single quick database transaction (C9)
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Check if user is already a member of any clan, and leave it first
	var currentClanID string
	err = tx.QueryRow(ctx, "SELECT clan_id FROM clan_members WHERE user_id = $1", userID).Scan(&currentClanID)
	if err == nil {
		if clanExists && currentClanID == existingClan.ID {
			return nil, ErrAlreadyInClan
		}
		// Leave current clan
		_, err = tx.Exec(ctx, "DELETE FROM clan_members WHERE user_id = $1", userID)
		if err != nil {
			return nil, err
		}
		// Recount and reconcile members count for left clan
		_, err = tx.Exec(ctx, "UPDATE clans c SET members_count = (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) WHERE c.id = $1", currentClanID)
		if err != nil {
			return nil, err
		}
		_, _ = tx.Exec(ctx, "DELETE FROM clans WHERE id = $1 AND members_count = 0", currentClanID)
	}

	var finalClan model.Clan
	if !clanExists {
		// Insert new clan
		newClanID := uuid.NewString()
		insertQuery := `
			INSERT INTO clans (id, telegram_channel_id, channel_username, channel_photo, chat_title, members_count)
			VALUES ($1, $2, $3, $4, $5, 0)
			RETURNING id, telegram_channel_id, channel_username, COALESCE(channel_photo, '') as channel_photo, chat_title, members_count, created_at
		`
		var channelPhoto sql.NullString
		err = tx.QueryRow(ctx, insertQuery, newClanID, channelID, normalized, photoURL, chatTitle).Scan(
			&finalClan.ID, &finalClan.TelegramChannelID, &finalClan.ChannelUsername, &channelPhoto, &finalClan.ChatTitle, &finalClan.MembersCount, &finalClan.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		finalClan.ChannelPhoto = channelPhoto.String
	} else {
		finalClan = existingClan
		finalClan.ChannelPhoto = existingChannelPhoto.String
	}

	// Add membership record
	_, err = tx.Exec(ctx, "INSERT INTO clan_members (clan_id, user_id) VALUES ($1, $2)", finalClan.ID, userID)
	if err != nil {
		return nil, err
	}

	// Recount and reconcile members count for joined clan
	_, err = tx.Exec(ctx, "UPDATE clans c SET members_count = (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) WHERE c.id = $1", finalClan.ID)
	if err != nil {
		return nil, err
	}

	// Reload final clan members count to return correct data
	err = tx.QueryRow(ctx, "SELECT members_count FROM clans WHERE id = $1", finalClan.ID).Scan(&finalClan.MembersCount)
	if err != nil {
		return nil, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return &finalClan, nil
}

// GetTopClans retrieves the top clans by member count from database.
func (s *ClanService) GetTopClans(ctx context.Context, limit int) ([]model.Clan, error) {
	if s.db == nil || s.db.Pool == nil {
		return []model.Clan{}, nil
	}

	query := `
		SELECT id, telegram_channel_id, channel_username, COALESCE(channel_photo, '') as channel_photo, chat_title, members_count, created_at
		FROM clans
		ORDER BY members_count DESC, chat_title ASC
		LIMIT $1
	`
	rows, err := s.db.Pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clans []model.Clan
	for rows.Next() {
		var c model.Clan
		var channelPhoto sql.NullString
		err := rows.Scan(&c.ID, &c.TelegramChannelID, &c.ChannelUsername, &channelPhoto, &c.ChatTitle, &c.MembersCount, &c.CreatedAt)
		if err != nil {
			return nil, err
		}
		c.ChannelPhoto = channelPhoto.String
		clans = append(clans, c)
	}
	return clans, nil
}
