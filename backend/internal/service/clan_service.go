package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"regexp"
	"strings"
	"time"

	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"

	"net/http"

	"github.com/PuerkitoBio/goquery"
	"github.com/google/uuid"
	"github.com/gotd/td/tg"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

var (
	ErrInvalidUsername  = errors.New("invalid_username")
	ErrChannelNotFound  = errors.New("channel_not_found")
	ErrNotChannelMember = errors.New("not_channel_member")
	ErrAlreadyInClan    = errors.New("already_in_clan")
	ErrCooldownActive   = errors.New("please wait before switching clans again")
)

type ClanService struct {
	db            *repository.Database
	cache         *repository.Cache
	mtprotoClient mtproto.Client
	botClient     *telegram.BotAPIClient
}

func NewClanService(db *repository.Database, cache *repository.Cache, mtprotoClient mtproto.Client, botClient *telegram.BotAPIClient) *ClanService {
	return &ClanService{db: db, cache: cache, mtprotoClient: mtprotoClient, botClient: botClient}
}

// scrapeChannelPhoto tries to get the photo URL from public telegram web preview
func scrapeChannelPhoto(username string) string {
	defaultPhoto := fmt.Sprintf("https://t.me/i/userpic/320/%s.jpg", username)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("https://t.me/" + username)
	if err != nil {
		return defaultPhoto
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return defaultPhoto
	}

	if img, exists := doc.Find("meta[property='og:image']").Attr("content"); exists {
		return img
	}

	return defaultPhoto
}

// GetOfficialChannelPhotoURL uses the Telegram Bot API to securely get the channel photo URL
func (s *ClanService) GetOfficialChannelPhotoURL(ctx context.Context, username string) (string, error) {
	if s.botClient == nil {
		return "", errors.New("bot client is not initialized")
	}
	// Telegram API requires @ prefix for usernames
	target := username
	if !strings.HasPrefix(target, "@") {
		target = "@" + target
	}
	return s.botClient.GetChatPhotoURL(ctx, target)
}

// GetClanDetails returns user's clan details (if any)
func (s *ClanService) GetClanDetails(ctx context.Context, userID int64) (*model.UserClanDetails, error) {
	if s.db == nil || s.db.Pool == nil {
		return &model.UserClanDetails{IsMember: false}, nil
	}

	query := `
		SELECT c.id, c.telegram_channel_id, c.channel_username, COALESCE(c.channel_photo, '') as channel_photo, c.chat_title, c.members_count, c.total_score, c.created_at, cm.joined_at,
		       (
		           SELECT COALESCE(rank, 1) FROM (
		               SELECT id, ROW_NUMBER() OVER (ORDER BY total_score DESC, members_count DESC) as rank
		               FROM clans
		           ) r WHERE r.id = c.id
		       ) as rank
		FROM clan_members cm
		JOIN clans c ON cm.clan_id = c.id
		WHERE cm.user_id = $1
	`
	var clan model.Clan
	var joinedAt time.Time

	err := s.db.Pool.QueryRow(ctx, query, userID).Scan(
		&clan.ID, &clan.TelegramChannelID, &clan.ChannelUsername, &clan.ChannelPhoto, &clan.ChatTitle, &clan.MembersCount, &clan.TotalScore, &clan.CreatedAt, &joinedAt, &clan.Rank,
	)
	if err == pgx.ErrNoRows {
		return &model.UserClanDetails{IsMember: false}, nil
	} else if err != nil {
		return nil, err
	}

	if clan.ChannelPhoto == "" || strings.Contains(clan.ChannelPhoto, "t.me/i/userpic/320") {
		clan.ChannelPhoto = scrapeChannelPhoto(clan.ChannelUsername)
		// Update DB in background
		if s.db != nil && s.db.Pool != nil {
			go func(id, photo string) {
				_, _ = s.db.Pool.Exec(context.Background(), "UPDATE clans SET channel_photo = $1 WHERE id = $2", photo, id)
			}(clan.ID, clan.ChannelPhoto)
		}
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

	// Reconcile members count atomically to prevent drift
	_, err = tx.Exec(ctx, "UPDATE clans SET members_count = members_count - 1 WHERE id = $1 AND members_count > 0", clanID)
	if err != nil {
		return err
	}

	// Clean up empty clans to avoid spam
	_, _ = tx.Exec(ctx, "DELETE FROM clans WHERE id = $1 AND members_count = 0", clanID)

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("user:clan:%d", userID))
	}

	return nil
}

func (s *ClanService) resolveChannelHybrid(ctx context.Context, username string) (int64, string, string, error) {
	// First, try the Bot API
	if s.botClient != nil {
		chat, err := s.botClient.GetChat(ctx, "@"+username)
		if err == nil && chat != nil && chat.Type == "channel" {
			photoURL := scrapeChannelPhoto(username)
			return chat.ID, chat.Title, photoURL, nil
		}
		slog.Warn("Bot API Resolve failed, falling back to MTProto", "username", username, "error", err)
	}

	// Fallback to MTProto userbot
	if s.mtprotoClient == nil {
		return 0, "", "", fmt.Errorf("neither botClient nor mtprotoClient configured")
	}

	peer, err := s.mtprotoClient.ResolveUsername(ctx, username)
	if err != nil || len(peer.Chats) == 0 {
		return 0, "", "", ErrChannelNotFound
	}

	var channel *tg.Channel
	for _, chat := range peer.Chats {
		if ch, ok := chat.(*tg.Channel); ok {
			channel = ch
			break
		}
	}

	if channel == nil {
		return 0, "", "", ErrChannelNotFound
	}

	photoURL := scrapeChannelPhoto(username)
	return channel.ID, channel.Title, photoURL, nil
}

var telegramUsernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]{3,32}$`)

// SearchAndJoinClan searches a clan by Telegram username (e.g. @durov).
// If found in DB, joins it. If not, queries Telegram API to auto-create and join.
func (s *ClanService) SearchAndJoinClan(ctx context.Context, userID int64, username string) (*model.Clan, error) {
	if s.db == nil || s.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	normalized := strings.TrimSpace(username)
	normalized = strings.TrimPrefix(normalized, "https://t.me/")
	normalized = strings.TrimPrefix(normalized, "http://t.me/")
	normalized = strings.TrimPrefix(normalized, "t.me/")
	normalized = strings.TrimPrefix(normalized, "@")

	// 1. Strict Username Validation
	if !telegramUsernameRegex.MatchString(normalized) {
		return nil, ErrInvalidUsername
	}

	// Dynamic Redis 10-minute cooldown on clan switching/joining
	if s.cache != nil && s.cache.Client != nil {
		key := fmt.Sprintf("clan:join:cooldown:%d", userID)
		exists, _ := s.cache.Client.Exists(ctx, key).Result()
		if exists > 0 {
			return nil, ErrCooldownActive
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
		isProd := os.Getenv("APP_ENV") == "production"

		// In development, mock known usernames immediately without calling API to avoid errors
		if !isProd && (strings.EqualFold(normalized, "durov") || strings.EqualFold(normalized, "telegram") || strings.EqualFold(normalized, "ifragment")) {
			channelID = 123456789
			chatTitle = "Durov's Clan"
			photoURL = "https://telegram.org/img/t_logo.png"
			if strings.EqualFold(normalized, "telegram") {
				chatTitle = "Telegram Official Clan"
			} else if strings.EqualFold(normalized, "ifragment") {
				chatTitle = "iFragment Clan"
			}
		} else {
			var err error
			channelID, chatTitle, photoURL, err = s.resolveChannelHybrid(ctx, normalized)
			if err != nil {
				return nil, err
			}
		}
	} else {
		channelID = existingClan.TelegramChannelID
	}

	// Check channel membership if botClient is configured
	if s.botClient != nil {
		status, err := s.botClient.GetChatMember(ctx, channelID, userID)
		if err == nil {
			if status == "left" || status == "kicked" {
				return nil, ErrNotChannelMember
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
		// Recount and reconcile members count for left clan atomically
		_, err = tx.Exec(ctx, "UPDATE clans SET members_count = members_count - 1 WHERE id = $1 AND members_count > 0", currentClanID)
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

	// Recount and reconcile members count for joined clan atomically
	_, err = tx.Exec(ctx, "UPDATE clans SET members_count = members_count + 1 WHERE id = $1", finalClan.ID)
	if err != nil {
		return nil, err
	}

	// Reload final clan members count and rank to return correct data
	err = tx.QueryRow(ctx, `
		SELECT members_count, total_score,
		       (
		           SELECT COALESCE(rank, 1) FROM (
		               SELECT id, ROW_NUMBER() OVER (ORDER BY total_score DESC, members_count DESC) as rank
		               FROM clans
		           ) r WHERE r.id = $1
		       ) as rank
		FROM clans WHERE id = $1
	`, finalClan.ID).Scan(&finalClan.MembersCount, &finalClan.TotalScore, &finalClan.Rank)
	if err != nil {
		return nil, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	if finalClan.ChannelPhoto == "" || strings.Contains(finalClan.ChannelPhoto, "t.me/i/userpic/320") {
		finalClan.ChannelPhoto = scrapeChannelPhoto(finalClan.ChannelUsername)
		if s.db != nil && s.db.Pool != nil && finalClan.ID != "" {
			go func(id, photo string) {
				_, _ = s.db.Pool.Exec(context.Background(), "UPDATE clans SET channel_photo = $1 WHERE id = $2", photo, id)
			}(finalClan.ID, finalClan.ChannelPhoto)
		}
	}

	if s.cache != nil && s.cache.Client != nil {
		key := fmt.Sprintf("clan:join:cooldown:%d", userID)
		_ = s.cache.Client.Set(ctx, key, 1, 10*time.Minute).Err()
		s.cache.Client.Del(ctx, fmt.Sprintf("user:clan:%d", userID))

		// Invalidate top clans cache to reflect new member count
		s.cache.Client.Del(ctx, "top_clans:100")
		s.cache.Client.Del(ctx, "top_clans:10")
	}

	return &finalClan, nil
}

// GetTopClans retrieves the top clans sorted by period score or overall total score.
func (s *ClanService) GetTopClans(ctx context.Context, limit int, period string) ([]model.Clan, error) {
	if s.db == nil || s.db.Pool == nil {
		return []model.Clan{}, nil
	}
	if period == "" {
		period = "day"
	}

	cacheKey := fmt.Sprintf("top_clans:%d:%s", limit, period)
	if s.cache != nil && s.cache.Client != nil {
		if val, err := s.cache.Client.Get(ctx, cacheKey).Result(); err == nil && val != "" {
			var cachedClans []model.Clan
			if err := json.Unmarshal([]byte(val), &cachedClans); err == nil {
				return cachedClans, nil
			}
		}
	}

	interval := "1 day"
	if period == "week" {
		interval = "7 days"
	}

	query := fmt.Sprintf(`
		SELECT c.id, c.telegram_channel_id, c.channel_username, COALESCE(c.channel_photo, '') as channel_photo, c.chat_title, c.members_count,
		       COALESCE(SUM(us.xp), c.total_score) as period_score, c.created_at
		FROM clans c
		LEFT JOIN clan_members cm ON cm.clan_id = c.id
		LEFT JOIN user_stats us ON us.user_id = cm.user_id AND us.last_active_at >= NOW() - INTERVAL '%s'
		GROUP BY c.id
		ORDER BY period_score DESC, c.members_count DESC, c.chat_title ASC
		LIMIT $1
	`, interval)

	rows, err := s.db.Pool.Query(ctx, query, limit)
	if err != nil {
		// Fallback query
		fallbackQuery := `
			SELECT c.id, c.telegram_channel_id, c.channel_username, COALESCE(c.channel_photo, '') as channel_photo, c.chat_title, c.members_count, c.total_score, c.created_at
			FROM clans c
			ORDER BY c.total_score DESC, c.members_count DESC, c.chat_title ASC
			LIMIT $1
		`
		rows, err = s.db.Pool.Query(ctx, fallbackQuery, limit)
		if err != nil {
			return nil, err
		}
	}
	defer rows.Close()

	clans := []model.Clan{}
	rank := 1
	for rows.Next() {
		var c model.Clan
		var channelPhoto sql.NullString
		err := rows.Scan(&c.ID, &c.TelegramChannelID, &c.ChannelUsername, &channelPhoto, &c.ChatTitle, &c.MembersCount, &c.TotalScore, &c.CreatedAt)
		if err != nil {
			return nil, err
		}
		c.ChannelPhoto = channelPhoto.String
		if c.ChannelPhoto == "" || strings.Contains(c.ChannelPhoto, "t.me/i/userpic/320") {
			c.ChannelPhoto = scrapeChannelPhoto(c.ChannelUsername)
			if s.db != nil && s.db.Pool != nil && c.ID != "" {
				go func(id, photo string) {
					_, _ = s.db.Pool.Exec(context.Background(), "UPDATE clans SET channel_photo = $1 WHERE id = $2", photo, id)
				}(c.ID, c.ChannelPhoto)
			}
		}
		c.Rank = rank
		rank++
		clans = append(clans, c)
	}

	if s.cache != nil && s.cache.Client != nil {
		if data, err := json.Marshal(clans); err == nil {
			s.cache.Client.Set(ctx, cacheKey, data, 60*time.Second)
		}
	}

	return clans, nil
}

// StartWeeklyUpdater runs a background worker that updates clan names and photos once a week.
func (s *ClanService) StartWeeklyUpdater(ctx context.Context) {
	if s.db == nil || s.mtprotoClient == nil {
		slog.Warn("Cannot start ClanService Weekly Updater: db or mtprotoClient missing")
		return
	}

	// Run once initially (after a small delay to not block startup) and then weekly
	ticker := time.NewTicker(7 * 24 * time.Hour)
	go func() {
		// Initial delay
		select {
		case <-time.After(5 * time.Minute):
			s.updateAllClans(ctx)
		case <-ctx.Done():
			ticker.Stop()
			return
		}

		for {
			select {
			case <-ticker.C:
				s.updateAllClans(ctx)
			case <-ctx.Done():
				ticker.Stop()
				return
			}
		}
	}()
}

// StartScoreFlusher runs a background worker that syncs clan_leaderboard from Redis to PostgreSQL every 5 minutes.
func (s *ClanService) StartScoreFlusher(ctx context.Context) {
	if s.db == nil || s.cache == nil || s.cache.Client == nil {
		slog.Warn("Cannot start ClanService Score Flusher: db or cache missing")
		return
	}

	ticker := time.NewTicker(5 * time.Minute)
	go func() {
		for {
			select {
			case <-ticker.C:
				s.flushScoresToDB(ctx)
			case <-ctx.Done():
				ticker.Stop()
				return
			}
		}
	}()
}

func (s *ClanService) flushScoresToDB(ctx context.Context) {
	slog.Info("Starting clan score aggregation and flush to DB")
	if s.db == nil || s.db.Pool == nil {
		return
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		slog.Error("Failed to start transaction for clan score flush", "error", err)
		return
	}
	defer tx.Rollback(ctx)

	// Update total_score in clans table based on the sum of member xp
	updateQuery := `
		UPDATE clans c
		SET total_score = COALESCE((
			SELECT SUM(us.xp)
			FROM clan_members cm
			JOIN user_stats us ON cm.user_id = us.user_id
			WHERE cm.clan_id = c.id
		), 0)
	`
	_, err = tx.Exec(ctx, updateQuery)
	if err != nil {
		slog.Error("Failed to aggregate clan scores in DB", "error", err)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		slog.Error("Failed to commit clan score flush", "error", err)
		return
	}

	// Sync to Redis ZSET
	if s.cache != nil && s.cache.Client != nil {
		rows, err := s.db.Pool.Query(ctx, "SELECT id, total_score FROM clans ORDER BY total_score DESC LIMIT 1000")
		if err != nil {
			slog.Error("Failed to fetch clans for Redis sync", "error", err)
			return
		}
		defer rows.Close()

		pipe := s.cache.Client.Pipeline()
		// Clear current leaderboard to remove empty clans
		pipe.Del(ctx, "clan_leaderboard")

		count := 0
		for rows.Next() {
			var id string
			var score float64
			if err := rows.Scan(&id, &score); err == nil {
				pipe.ZAdd(ctx, "clan_leaderboard", redis.Z{
					Score:  score,
					Member: id,
				})
				count++
			}
		}
		_, err = pipe.Exec(ctx)
		if err != nil {
			slog.Error("Failed to sync clan_leaderboard to Redis", "error", err)
		} else {
			slog.Info("Successfully synced clan scores to Redis", "count", count)
		}
	}
}

func (s *ClanService) updateAllClans(ctx context.Context) {
	slog.Info("Starting weekly clan info update")

	rows, err := s.db.Pool.Query(ctx, "SELECT id, channel_username FROM clans")
	if err != nil {
		slog.Error("Failed to fetch clans for update", "error", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var username string
		if err := rows.Scan(&id, &username); err != nil {
			continue
		}

		// Avoid spamming APIs
		time.Sleep(2 * time.Second)

		_, title, photoURL, err := s.resolveChannelHybrid(ctx, username)
		if err != nil {
			slog.Warn("Failed to update clan weekly info", "username", username, "error", err)
			continue
		}

		_, err = s.db.Pool.Exec(ctx, "UPDATE clans SET chat_title = $1, channel_photo = $2 WHERE id = $3", title, photoURL, id)
		if err != nil {
			slog.Error("Failed to update clan", "clan_id", id, "error", err)
		}
	}
	slog.Info("Finished weekly clan info update")
}

type ClanMemberInfo struct {
	TelegramID int64   `json:"telegram_id"`
	Username   string  `json:"username,omitempty"`
	FirstName  string  `json:"first_name"`
	LastName   string  `json:"last_name,omitempty"`
	Score      float64 `json:"score"`
	Level      int     `json:"level"`
	XP         int     `json:"xp"`
}

// GetClanMembers returns members of a clan ordered by score descending
func (s *ClanService) GetClanMembers(ctx context.Context, userID int64, clanID string, limit int) ([]ClanMemberInfo, error) {
	if s.db == nil || s.db.Pool == nil {
		return []ClanMemberInfo{}, nil
	}

	if clanID == "" {
		err := s.db.Pool.QueryRow(ctx, "SELECT clan_id FROM clan_members WHERE user_id = $1", userID).Scan(&clanID)
		if err == pgx.ErrNoRows {
			return []ClanMemberInfo{}, nil
		} else if err != nil {
			return nil, err
		}
	}

	query := `
		SELECT u.telegram_id, COALESCE(u.username, '') as username, u.first_name, COALESCE(u.last_name, '') as last_name, COALESCE(us.xp, 0) as score, COALESCE(us.level, 1) as level, COALESCE(us.xp, 0) as xp
		FROM clan_members cm
		JOIN users u ON cm.user_id = u.telegram_id
		LEFT JOIN user_stats us ON u.telegram_id = us.user_id
		WHERE cm.clan_id = $1
		ORDER BY score DESC
		LIMIT $2
	`
	rows, err := s.db.Pool.Query(ctx, query, clanID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := []ClanMemberInfo{}
	for rows.Next() {
		var m ClanMemberInfo
		err := rows.Scan(&m.TelegramID, &m.Username, &m.FirstName, &m.LastName, &m.Score, &m.Level, &m.XP)
		if err != nil {
			return nil, err
		}
		members = append(members, m)
	}

	return members, nil
}
