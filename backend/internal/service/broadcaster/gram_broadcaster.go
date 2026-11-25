package broadcaster

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net/url"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cardgen"
	"ifragment-backend/internal/service/cryptoprice"

	"github.com/redis/go-redis/v9"
)

const (
	redisKeyGramTicks       = "gram:broadcaster:ticks:24h"
	redisKeyGramLastRecap   = "gram:broadcaster:last_recap_date"
	redisKeyGramDailyCloses = "gram:broadcaster:daily_closes:7d"

	broadcastKind10Min      = "10min"
	broadcastKindDailyRecap = "daily_recap"

	slotCooldown10Min       = 7 * time.Minute
	slotLockTTL10Min        = 15 * time.Minute
	cooldownRedisTTL10Min   = 8 * time.Minute
	slotCooldownDailyRecap  = 12 * time.Hour
	slotLockTTLDailyRecap   = 36 * time.Hour
	maxTickStalenessForPost = 25 * time.Minute
)

type PriceTick struct {
	Price     float64   `json:"price"`
	Timestamp time.Time `json:"timestamp"`
}

type dailyCloseRecord struct {
	Date      string  `json:"date"`
	Close     float64 `json:"close"`
	PctChange float64 `json:"pct_change"`
}

type gramTelegramClient interface {
	Request(ctx context.Context, method string, payload interface{}) (json.RawMessage, error)
	RequestNoRetry(ctx context.Context, method string, payload interface{}) (json.RawMessage, error)
	RequestMultipartNoRetry(ctx context.Context, method string, fields map[string]string, files map[string][]byte) (json.RawMessage, error)
}

type GramBroadcaster struct {
	tgClient           gramTelegramClient
	cryptoSvc          cryptoPriceProvider
	cache              *repository.Cache
	db                 *repository.Database
	cardGen            *cardgen.CardGenerator
	target             string
	started            atomic.Bool
	mu                 sync.RWMutex
	priceHistory       []PriceTick
	dailyCloses        []dailyCloseRecord
	lastDailyRecapDate string
	lastBroadcastSlot  string
	lastBroadcastAt    time.Time
}

type cryptoPriceProvider interface {
	GetPrice(symbol string) string
	GetFloatPrice(symbol string) (float64, bool)
}

func NewGramBroadcaster(botToken string, cryptoSvc *cryptoprice.CryptoPriceService) *GramBroadcaster {
	targetChannel := strings.TrimSpace(os.Getenv("GRAM_CHANNEL_ID"))
	if targetChannel == "" {
		targetChannel = "@TheGramPrice"
	}
	return &GramBroadcaster{
		tgClient:     telegram.NewBotAPIClient(botToken),
		cryptoSvc:    cryptoSvc,
		cardGen:      cardgen.GetGenerator(),
		target:       targetChannel,
		priceHistory: make([]PriceTick, 0),
		dailyCloses:  make([]dailyCloseRecord, 0),
	}
}

func (b *GramBroadcaster) SetCache(cache *repository.Cache) {
	b.mu.Lock()
	b.cache = cache
	b.mu.Unlock()
	b.restoreHistoryFromRedis(context.Background())
}

func (b *GramBroadcaster) SetDB(db *repository.Database) {
	b.mu.Lock()
	b.db = db
	b.mu.Unlock()
	if db != nil && db.Pool != nil {
		b.ensureDedupTable(context.Background())
	}
}

func (b *GramBroadcaster) SetCardGenerator(cg *cardgen.CardGenerator) {
	b.mu.Lock()
	b.cardGen = cg
	b.mu.Unlock()
}

func (b *GramBroadcaster) ensureDedupTable(ctx context.Context) {
	b.mu.RLock()
	db := b.db
	b.mu.RUnlock()
	if db == nil || db.Pool == nil {
		return
	}
	tctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	_, err := db.Pool.Exec(tctx, `
		CREATE TABLE IF NOT EXISTS gram_broadcast_slots (
			channel_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			slot_key TEXT NOT NULL,
			price_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
			sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (channel_id, kind, slot_key)
		)
	`)
	if err != nil {
		slog.Warn("Gram Broadcaster failed to ensure gram_broadcast_slots table", "error", err)
	}
}

func (b *GramBroadcaster) restoreHistoryFromRedis(ctx context.Context) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.cache == nil || b.cache.Client == nil {
		return
	}
	if raw, err := b.cache.Client.Get(ctx, redisKeyGramTicks).Result(); err == nil && raw != "" {
		var saved []PriceTick
		if json.Unmarshal([]byte(raw), &saved) == nil && len(saved) > 0 {
			cutoff := time.Now().UTC().Add(-24 * time.Hour)
			filtered := make([]PriceTick, 0, len(saved))
			for _, tk := range saved {
				if tk.Timestamp.After(cutoff) || tk.Timestamp.Equal(cutoff) {
					filtered = append(filtered, tk)
				}
			}
			b.priceHistory = filtered
		}
	}
	if lastDate, err := b.cache.Client.Get(ctx, redisKeyGramLastRecap).Result(); err == nil && lastDate != "" {
		b.lastDailyRecapDate = lastDate
	}
	if rawCloses, err := b.cache.Client.Get(ctx, redisKeyGramDailyCloses).Result(); err == nil && rawCloses != "" {
		var savedCloses []dailyCloseRecord
		if json.Unmarshal([]byte(rawCloses), &savedCloses) == nil && len(savedCloses) > 0 {
			b.dailyCloses = savedCloses
		}
	}
}

func (b *GramBroadcaster) persistHistoryToRedis(ctx context.Context) {
	if b.cache == nil || b.cache.Client == nil {
		return
	}
	if data, err := json.Marshal(b.priceHistory); err == nil {
		_ = b.cache.Client.Set(ctx, redisKeyGramTicks, string(data), 36*time.Hour).Err()
	}
	if b.lastDailyRecapDate != "" {
		_ = b.cache.Client.Set(ctx, redisKeyGramLastRecap, b.lastDailyRecapDate, 48*time.Hour).Err()
	}
	if len(b.dailyCloses) > 0 {
		if data, err := json.Marshal(b.dailyCloses); err == nil {
			_ = b.cache.Client.Set(ctx, redisKeyGramDailyCloses, string(data), 14*24*time.Hour).Err()
		}
	}
}

func formatCleanGramPrice(p float64) string {
	if p <= 0 {
		return "N/A"
	}
	if p >= 1.0 {
		return fmt.Sprintf("$%.2f", p)
	} else if p >= 0.01 {
		return fmt.Sprintf("$%.4f", p)
	}
	return fmt.Sprintf("$%.5f", p)
}

func formatRecapDisplayPrice(p float64) string {
	if p <= 0 {
		return "N/A"
	}
	if p >= 100.0 {
		return fmt.Sprintf("$%.2f", p)
	}
	if p >= 1.0 {
		return fmt.Sprintf("$%.3f", p)
	}
	if p >= 0.01 {
		return fmt.Sprintf("$%.4f", p)
	}
	return fmt.Sprintf("$%.5f", p)
}

func formatSignedDollarDelta(delta float64) string {
	sign := "+"
	absVal := delta
	if delta < 0 {
		sign = "-"
		absVal = -delta
	}
	if absVal >= 1.0 {
		return fmt.Sprintf("%s$%.2f", sign, absVal)
	}
	if absVal >= 0.01 {
		return fmt.Sprintf("%s$%.3f", sign, absVal)
	}
	return fmt.Sprintf("%s$%.4f", sign, absVal)
}

func formatSignedPct(pct float64) string {
	if pct > 0 {
		return fmt.Sprintf("+%.2f%%", pct)
	}
	return fmt.Sprintf("%.2f%%", pct)
}

func slotKeyFor10Min(now time.Time) string {
	return now.UTC().Round(10 * time.Minute).Format("200601021504")
}

func nextBroadcasterSlot(now time.Time) time.Time {
	utc := now.UTC()
	// Fire 1 second past every 10-minute boundary (:00:01, :10:01, ...) to eliminate
	// clock-boundary jitter (e.g. :09:59.998 vs :10:00.002) and ticker drift.
	next := utc.Truncate(10 * time.Minute).Add(10 * time.Minute).Add(1 * time.Second)
	if !next.After(utc) {
		next = next.Add(10 * time.Minute)
	}
	return next
}

func (b *GramBroadcaster) resolveLiveGramPrice() (float64, bool) {
	if b.cryptoSvc == nil {
		return 0, false
	}
	// Always use official TON (The Open Network / Gram) rate
	if p, ok := b.cryptoSvc.GetFloatPrice("the-open-network"); ok && p > 0 {
		return p, true
	}
	return 0, false
}

func (b *GramBroadcaster) Start(ctx context.Context) {
	if !b.started.CompareAndSwap(false, true) {
		slog.Warn("Gram Broadcaster Start() called more than once — ignoring duplicate worker")
		return
	}
	defer b.started.Store(false)

	slog.Info("Starting Gram Broadcaster Worker (10-min interval, PostgreSQL + Redis dedup, visual daily recap)...", "target", b.target)

	b.ensureDedupTable(ctx)
	b.restoreHistoryFromRedis(ctx)

	for {
		nextRun := nextBroadcasterSlot(time.Now().UTC())
		sleepDuration := time.Until(nextRun)
		slog.Info("Gram Broadcaster scheduled next run", "utc_time", nextRun.Format(time.RFC3339), "sleeping", sleepDuration)

		timer := time.NewTimer(sleepDuration)
		select {
		case <-ctx.Done():
			timer.Stop()
			slog.Info("Gram Broadcaster stopped")
			return
		case <-timer.C:
		}

		b.processCycle(ctx)
	}
}

func (b *GramBroadcaster) processCycle(ctx context.Context) {
	now := time.Now().UTC()

	// 1. Record current price & clean data older than 24h (persisted in Redis)
	b.recordPriceAndCleanup(now)

	// 2. Broadcast regular 10-minute post (minimal clean price only, zero additions)
	b.broadcast10MinPost(ctx, now)

	// 3. Check if 00:00 UTC daily recap should be sent
	b.checkAndSendDailyRecap(ctx, now)
}

func (b *GramBroadcaster) recordPriceAndCleanup(now time.Time) {
	b.mu.Lock()
	defer b.mu.Unlock()

	price, ok := b.resolveLiveGramPrice()
	if ok && price > 0 {
		b.priceHistory = append(b.priceHistory, PriceTick{
			Price:     price,
			Timestamp: now,
		})
	}

	// Auto-purge records older than 24 hours (properly handles all-expired history)
	cutoff := now.Add(-24 * time.Hour)
	validIdx := len(b.priceHistory)
	for i, tick := range b.priceHistory {
		if tick.Timestamp.After(cutoff) || tick.Timestamp.Equal(cutoff) {
			validIdx = i
			break
		}
	}
	if validIdx > 0 {
		b.priceHistory = b.priceHistory[validIdx:]
	}

	b.persistHistoryToRedis(context.Background())
}

// claimBroadcastSlot enforces atomic single-send deduplication across PostgreSQL and Redis.
// It fails CLOSED when the primary lock store returns an error so transient outages never cause double-posts.
func (b *GramBroadcaster) claimBroadcastSlot(
	ctx context.Context,
	kind string,
	slotKey string,
	priceUSD float64,
	dbCooldown time.Duration,
	redisSlotTTL time.Duration,
	redisCooldownTTL time.Duration,
) bool {
	b.mu.RLock()
	db := b.db
	cache := b.cache
	target := b.target
	b.mu.RUnlock()

	// Layer 1: Durable PostgreSQL slot + cooldown lock (survives Redis/Dragonfly restarts & flushes)
	if db != nil && db.Pool != nil {
		claimed, err := b.claimSlotInDB(ctx, db, target, kind, slotKey, priceUSD, dbCooldown)
		if err != nil {
			slog.Error("Gram Broadcaster skipped: PostgreSQL dedup lock failed (fail-closed)",
				"kind", kind,
				"slot", slotKey,
				"error", err,
			)
			return false
		}
		if !claimed {
			slog.Warn("Gram Broadcaster skipped: slot already claimed in PostgreSQL",
				"kind", kind,
				"slot", slotKey,
			)
			return false
		}
	}

	// Layer 2: Redis/Dragonfly slot lock + cooldown lock
	if cache != nil && cache.Client != nil {
		redisLockKey := fmt.Sprintf("gram:broadcaster:slot_lock:%s:%s:%s", target, kind, slotKey)
		acquired, err := tryAcquireRedisLock(ctx, cache.Client, redisLockKey, "1", redisSlotTTL)
		if err != nil {
			if db == nil || db.Pool == nil {
				slog.Error("Gram Broadcaster skipped: Redis slot lock error with no DB lock (fail-closed)",
					"kind", kind,
					"slot", slotKey,
					"error", err,
				)
				return false
			}
			slog.Warn("Gram Broadcaster Redis slot lock error (continuing with PostgreSQL lock)",
				"kind", kind,
				"slot", slotKey,
				"error", err,
			)
		} else if !acquired {
			slog.Warn("Gram Broadcaster skipped: slot already claimed in Redis",
				"kind", kind,
				"slot", slotKey,
			)
			return false
		}

		if redisCooldownTTL > 0 {
			cooldownKey := fmt.Sprintf("gram:broadcaster:cooldown:%s:%s", target, kind)
			coolAcquired, coolErr := tryAcquireRedisLock(ctx, cache.Client, cooldownKey, slotKey, redisCooldownTTL)
			if coolErr == nil && !coolAcquired {
				slog.Warn("Gram Broadcaster skipped: Redis cooldown active",
					"kind", kind,
					"slot", slotKey,
				)
				return false
			}
		}
	}

	return true
}

func tryAcquireRedisLock(ctx context.Context, client *redis.Client, key, val string, ttl time.Duration) (bool, error) {
	res, err := client.SetArgs(ctx, key, val, redis.SetArgs{
		Mode: "NX",
		TTL:  ttl,
	}).Result()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return res == "OK", nil
}

func (b *GramBroadcaster) claimSlotInDB(
	ctx context.Context,
	db *repository.Database,
	channelID string,
	kind string,
	slotKey string,
	priceUSD float64,
	cooldown time.Duration,
) (bool, error) {
	tctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(tctx)
	if err != nil {
		return false, err
	}
	defer func() {
		_ = tx.Rollback(tctx)
	}()

	// Serialize concurrent claims per (channel, kind) across containers
	if _, err := tx.Exec(tctx, "SELECT pg_advisory_xact_lock(hashtext($1))", channelID+":"+kind); err != nil {
		return false, err
	}

	if cooldown > 0 {
		var recentCount int
		err = tx.QueryRow(tctx, `
			SELECT COUNT(1)
			FROM gram_broadcast_slots
			WHERE channel_id = $1
			  AND kind = $2
			  AND sent_at > NOW() - ($3 * INTERVAL '1 second')
		`, channelID, kind, int(cooldown.Seconds())).Scan(&recentCount)
		if err != nil {
			return false, err
		}
		if recentCount > 0 {
			return false, nil
		}
	}

	tag, err := tx.Exec(tctx, `
		INSERT INTO gram_broadcast_slots (channel_id, kind, slot_key, price_usd)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (channel_id, kind, slot_key) DO NOTHING
	`, channelID, kind, slotKey, priceUSD)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 0 {
		return false, nil
	}

	// Best-effort cleanup of entries older than 30 days
	_, _ = tx.Exec(tctx, `DELETE FROM gram_broadcast_slots WHERE sent_at < NOW() - INTERVAL '30 days'`)

	if err := tx.Commit(tctx); err != nil {
		return false, err
	}
	return true, nil
}

func (b *GramBroadcaster) broadcast10MinPost(ctx context.Context, now time.Time) {
	slotKey := slotKeyFor10Min(now)

	b.mu.Lock()
	if b.lastBroadcastSlot == slotKey {
		b.mu.Unlock()
		slog.Warn("Gram Broadcaster skipped duplicate in-memory slot", "slot", slotKey)
		return
	}
	if !b.lastBroadcastAt.IsZero() && now.Sub(b.lastBroadcastAt) < slotCooldown10Min {
		b.mu.Unlock()
		slog.Warn("Gram Broadcaster skipped: in-memory cooldown active", "slot", slotKey, "since_last", now.Sub(b.lastBroadcastAt).String())
		return
	}
	if len(b.priceHistory) == 0 {
		b.mu.Unlock()
		slog.Warn("Gram Broadcaster skipped: no price history available")
		return
	}
	currentTick := b.priceHistory[len(b.priceHistory)-1]
	if now.Sub(currentTick.Timestamp) > maxTickStalenessForPost {
		b.mu.Unlock()
		slog.Warn("Gram Broadcaster skipped: latest price tick is stale", "tick_age", now.Sub(currentTick.Timestamp).String())
		return
	}
	currentPrice := currentTick.Price
	b.mu.Unlock()

	// Distributed durable lock across PostgreSQL + Redis
	if !b.claimBroadcastSlot(ctx, broadcastKind10Min, slotKey, currentPrice, slotCooldown10Min, slotLockTTL10Min, cooldownRedisTTL10Min) {
		return
	}

	b.mu.Lock()
	b.lastBroadcastSlot = slotKey
	b.lastBroadcastAt = now
	b.mu.Unlock()

	// Keep 10-minute post strictly minimal: ONLY the clean price string, nothing added.
	priceStr := formatCleanGramPrice(currentPrice)
	if b.cryptoSvc != nil {
		if rawStr := b.cryptoSvc.GetPrice("the-open-network"); rawStr != "" && rawStr != "N/A" {
			clean := strings.TrimSpace(strings.TrimSuffix(rawStr, "(stale)"))
			if clean != "" {
				priceStr = clean
			}
		}
	}

	payload := map[string]interface{}{
		"chat_id": b.target,
		"text":    priceStr,
	}

	if b.tgClient == nil {
		return
	}

	// Single-attempt non-retried sendMessage so network read timeouts never cause duplicate channel posts.
	_, err := b.tgClient.RequestNoRetry(ctx, "sendMessage", payload)
	if err != nil {
		slog.Error("Failed to broadcast 10-min Gram price", "target", b.target, "slot", slotKey, "error", err)
	} else {
		slog.Info("Successfully broadcasted 10-min Gram price", "target", b.target, "slot", slotKey, "price", currentPrice)
	}
}

type dailyRecapMetrics struct {
	DateLabel   string
	OpenPrice   float64
	HighPrice   float64
	HighTime    time.Time
	LowPrice    float64
	LowTime     time.Time
	ClosePrice  float64
	AvgPrice    float64
	NetChange   float64
	PctChange   float64
	SpreadPct   float64
	RangePosPct float64
	TicksCount  int
	Has7DChange bool
	Change7DPct float64
	StreakDays  int
	Verdict     string
}

func classifyDailySession(pctChange, rangePosPct, spreadPct float64) string {
	switch {
	case pctChange >= 5.0 && rangePosPct >= 75.0:
		return "Breakout Rally"
	case pctChange >= 2.0 && rangePosPct >= 65.0:
		return "Strong Bullish Close"
	case pctChange > 0.5 && rangePosPct >= 55.0:
		return "Buyers in Control"
	case pctChange > 0.15:
		return "Steady Green Session"
	case pctChange <= -5.0 && rangePosPct <= 25.0:
		return "Heavy Sell-Off"
	case pctChange <= -2.0 && rangePosPct <= 35.0:
		return "Bearish Pressure"
	case pctChange < -0.5 && rangePosPct >= 55.0:
		return "Dip Bought Late"
	case pctChange < -0.15:
		return "Mild Pullback"
	case spreadPct >= 4.0:
		return "Volatile Chop, Flat Close"
	default:
		return "Tight Consolidation"
	}
}

func computeStreakAnd7D(prevCloses []dailyCloseRecord, todayDate string, todayClose, todayPct float64) (updated []dailyCloseRecord, has7D bool, change7D float64, streak int) {
	// Deduplicate by date and append today's close
	updated = make([]dailyCloseRecord, 0, len(prevCloses)+1)
	for _, rec := range prevCloses {
		if rec.Date != "" && rec.Date != todayDate && rec.Close > 0 {
			updated = append(updated, rec)
		}
	}
	updated = append(updated, dailyCloseRecord{
		Date:      todayDate,
		Close:     todayClose,
		PctChange: todayPct,
	})
	if len(updated) > 8 {
		updated = updated[len(updated)-8:]
	}

	// 7D rolling change when we have at least 2 daily closes
	if len(updated) >= 2 {
		baseIdx := 0
		if len(updated) > 7 {
			baseIdx = len(updated) - 7
		}
		baseClose := updated[baseIdx].Close
		if baseClose > 0 {
			has7D = true
			change7D = ((todayClose - baseClose) / baseClose) * 100.0
		}
	}

	// Consecutive green/red streak ending today
	if todayPct > 0.05 {
		streak = 1
		for i := len(updated) - 2; i >= 0; i-- {
			if updated[i].PctChange > 0.05 {
				streak++
			} else {
				break
			}
		}
	} else if todayPct < -0.05 {
		streak = -1
		for i := len(updated) - 2; i >= 0; i-- {
			if updated[i].PctChange < -0.05 {
				streak--
			} else {
				break
			}
		}
	}

	return updated, has7D, change7D, streak
}

func buildDailyRecapMetrics(history []PriceTick, prevCloses []dailyCloseRecord, now time.Time) (dailyRecapMetrics, []dailyCloseRecord) {
	openPrice := history[0].Price
	closePrice := history[len(history)-1].Price
	highPrice := openPrice
	lowPrice := openPrice
	highTime := history[0].Timestamp
	lowTime := history[0].Timestamp
	sumPrice := 0.0

	for _, tick := range history {
		sumPrice += tick.Price
		if tick.Price > highPrice {
			highPrice = tick.Price
			highTime = tick.Timestamp
		}
		if tick.Price < lowPrice {
			lowPrice = tick.Price
			lowTime = tick.Timestamp
		}
	}

	avgPrice := sumPrice / float64(len(history))
	netChange := closePrice - openPrice
	pctChange := 0.0
	if openPrice > 0 {
		pctChange = (netChange / openPrice) * 100.0
	}
	spreadPct := 0.0
	if lowPrice > 0 {
		spreadPct = ((highPrice - lowPrice) / lowPrice) * 100.0
	}
	rangePosPct := 50.0
	if highPrice > lowPrice {
		rangePosPct = ((closePrice - lowPrice) / (highPrice - lowPrice)) * 100.0
		rangePosPct = math.Max(0, math.Min(100, rangePosPct))
	}

	recapDate := now.UTC().Add(-12 * time.Hour)
	dateKey := recapDate.Format("2006-01-02")
	updatedCloses, has7D, change7D, streak := computeStreakAnd7D(prevCloses, dateKey, closePrice, pctChange)

	m := dailyRecapMetrics{
		DateLabel:   strings.ToUpper(recapDate.Format("02 Jan 2006")),
		OpenPrice:   openPrice,
		HighPrice:   highPrice,
		HighTime:    highTime.UTC(),
		LowPrice:    lowPrice,
		LowTime:     lowTime.UTC(),
		ClosePrice:  closePrice,
		AvgPrice:    avgPrice,
		NetChange:   netChange,
		PctChange:   pctChange,
		SpreadPct:   spreadPct,
		RangePosPct: rangePosPct,
		TicksCount:  len(history),
		Has7DChange: has7D,
		Change7DPct: change7D,
		StreakDays:  streak,
		Verdict:     classifyDailySession(pctChange, rangePosPct, spreadPct),
	}
	return m, updatedCloses
}

func publicChannelHandle(target string) string {
	trimmed := strings.TrimSpace(target)
	if strings.HasPrefix(trimmed, "@") && len(trimmed) > 1 {
		return trimmed
	}
	return "@TheGramPrice"
}

func buildDailyRecapCaption(m dailyRecapMetrics, channelHandle string) string {
	moodDot := "⚪"
	trendEmoji := "📊"
	if m.PctChange > 0.05 {
		moodDot = "🟢"
		trendEmoji = "📈"
	} else if m.PctChange < -0.05 {
		moodDot = "🔴"
		trendEmoji = "📉"
	}

	handle := publicChannelHandle(channelHandle)

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%s <b>TONCOIN DAILY RECAP</b> · <code>%s</code>\n\n", moodDot, m.DateLabel))
	sb.WriteString(fmt.Sprintf("💎 <b>Close:</b> <code>%s</code>  (<b>%s</b> · <code>%s</code>)\n\n",
		formatRecapDisplayPrice(m.ClosePrice),
		formatSignedPct(m.PctChange),
		formatSignedDollarDelta(m.NetChange),
	))
	sb.WriteString(fmt.Sprintf(
		"<blockquote><b>Open:</b>  <code>%s</code>\n<b>High:</b>  <code>%s</code>  <i>(%s UTC)</i>\n<b>Low:</b>   <code>%s</code>  <i>(%s UTC)</i>\n<b>Avg:</b>   <code>%s</code>  ·  <b>Volatility:</b> <code>%.2f%%</code></blockquote>\n",
		formatRecapDisplayPrice(m.OpenPrice),
		formatRecapDisplayPrice(m.HighPrice), m.HighTime.Format("15:04"),
		formatRecapDisplayPrice(m.LowPrice), m.LowTime.Format("15:04"),
		formatRecapDisplayPrice(m.AvgPrice), m.SpreadPct,
	))

	var highlights []string
	if m.Has7DChange {
		highlights = append(highlights, fmt.Sprintf("%s <b>7D:</b> <code>%s</code>", trendEmoji, formatSignedPct(m.Change7DPct)))
	}
	if m.StreakDays >= 2 {
		highlights = append(highlights, fmt.Sprintf("🔥 <b>%d-Day Green Streak</b>", m.StreakDays))
	} else if m.StreakDays <= -2 {
		highlights = append(highlights, fmt.Sprintf("❄️ <b>%d-Day Red Streak</b>", -m.StreakDays))
	}
	if len(highlights) > 0 {
		sb.WriteString(strings.Join(highlights, "  ·  ") + "\n")
	}

	sb.WriteString(fmt.Sprintf("🎯 <b>Session:</b> %s (<code>%.0f%%</code> of daily range)\n\n", m.Verdict, m.RangePosPct))
	sb.WriteString(fmt.Sprintf("⚡ Live TON price every 10 min → %s", handle))
	return sb.String()
}

func buildDailyRecapShareMarkup(m dailyRecapMetrics, channelHandle string) map[string]interface{} {
	handle := strings.TrimPrefix(publicChannelHandle(channelHandle), "@")
	channelURL := "https://t.me/" + handle
	shareSummary := fmt.Sprintf(
		"💎 TONCOIN Daily Recap (%s): Close %s (%s) | High %s · Low %s — Live 10-min feed on @%s",
		m.DateLabel,
		formatRecapDisplayPrice(m.ClosePrice),
		formatSignedPct(m.PctChange),
		formatRecapDisplayPrice(m.HighPrice),
		formatRecapDisplayPrice(m.LowPrice),
		handle,
	)
	shareURL := "https://t.me/share/url?url=" + url.QueryEscape(channelURL) + "&text=" + url.QueryEscape(shareSummary)

	return map[string]interface{}{
		"inline_keyboard": [][]map[string]string{
			{
				{
					"text": "📤 Share / Forward Recap",
					"url":  shareURL,
				},
			},
		},
	}
}

func (b *GramBroadcaster) checkAndSendDailyRecap(ctx context.Context, now time.Time) {
	// Daily Recap triggers at 00:00 UTC
	utcNow := now.UTC()
	todayStr := utcNow.Format("2006-01-02")
	if utcNow.Hour() != 0 {
		return
	}

	b.mu.Lock()
	if b.lastDailyRecapDate == todayStr {
		b.mu.Unlock()
		return
	}
	if len(b.priceHistory) == 0 {
		b.mu.Unlock()
		slog.Warn("Daily recap skipped: insufficient data")
		return
	}
	historyCopy := make([]PriceTick, len(b.priceHistory))
	copy(historyCopy, b.priceHistory)
	prevCloses := make([]dailyCloseRecord, len(b.dailyCloses))
	copy(prevCloses, b.dailyCloses)
	cg := b.cardGen
	target := b.target
	b.mu.Unlock()

	metrics, updatedCloses := buildDailyRecapMetrics(historyCopy, prevCloses, utcNow)

	// Durable PostgreSQL + Redis deduplication for Daily Recap
	if !b.claimBroadcastSlot(ctx, broadcastKindDailyRecap, todayStr, metrics.ClosePrice, slotCooldownDailyRecap, slotLockTTLDailyRecap, 0) {
		return
	}

	b.mu.Lock()
	b.lastDailyRecapDate = todayStr
	b.dailyCloses = updatedCloses
	b.persistHistoryToRedis(ctx)
	b.mu.Unlock()

	if b.tgClient == nil {
		return
	}

	displayHandle := publicChannelHandle(target)
	captionHTML := buildDailyRecapCaption(metrics, displayHandle)
	replyMarkup := buildDailyRecapShareMarkup(metrics, displayHandle)

	// Render 1200x900 visual editorial Daily Recap PNG card
	var cardBytes []byte
	if cg == nil {
		cg = cardgen.GetGenerator()
	}
	if cg != nil {
		cardTicks := make([]cardgen.DailyRecapTick, len(historyCopy))
		for i, tk := range historyCopy {
			cardTicks[i] = cardgen.DailyRecapTick{
				Price:     tk.Price,
				Timestamp: tk.Timestamp,
			}
		}
		var genErr error
		cardBytes, genErr = cg.GenerateDailyRecapCard(cardgen.DailyRecapCardParams{
			DateLabel:     metrics.DateLabel,
			ChannelHandle: displayHandle,
			OpenPrice:     metrics.OpenPrice,
			HighPrice:     metrics.HighPrice,
			HighTimeUTC:   metrics.HighTime.Format("15:04"),
			LowPrice:      metrics.LowPrice,
			LowTimeUTC:    metrics.LowTime.Format("15:04"),
			ClosePrice:    metrics.ClosePrice,
			AvgPrice:      metrics.AvgPrice,
			NetChange:     metrics.NetChange,
			PctChange:     metrics.PctChange,
			SpreadPct:     metrics.SpreadPct,
			RangePosPct:   metrics.RangePosPct,
			TicksCount:    metrics.TicksCount,
			Has7DChange:   metrics.Has7DChange,
			Change7DPct:   metrics.Change7DPct,
			StreakDays:    metrics.StreakDays,
			Ticks:         cardTicks,
		})
		if genErr != nil {
			slog.Warn("Failed to render Daily Recap PNG card, falling back to rich HTML text", "error", genErr)
		}
	}

	// Step 1: Unpin all previous pinned messages
	_, _ = b.tgClient.Request(ctx, "unpinAllChatMessages", map[string]interface{}{
		"chat_id": target,
	})

	// Step 2: Send Visual Daily Recap Photo without automatic retry.
	// Only fall back to sendMessage if card rendering failed OR Telegram returned an explicit API rejection
	// (never on ambiguous network timeouts where Telegram may have already published the photo).
	var resp json.RawMessage
	var err error
	shouldFallbackToText := len(cardBytes) == 0
	if len(cardBytes) > 0 {
		fields := map[string]string{
			"chat_id":    target,
			"caption":    captionHTML,
			"parse_mode": "HTML",
		}
		if markupBytes, mErr := json.Marshal(replyMarkup); mErr == nil {
			fields["reply_markup"] = string(markupBytes)
		}
		resp, err = b.tgClient.RequestMultipartNoRetry(ctx, "sendPhoto", fields, map[string][]byte{
			"photo": cardBytes,
		})
		if err != nil {
			var apiErr *telegram.APIError
			if errors.As(err, &apiErr) {
				slog.Warn("Telegram rejected Daily Recap photo, falling back to HTML text", "target", target, "code", apiErr.Code, "error", err)
				shouldFallbackToText = true
			} else {
				slog.Error("Failed to send Daily Recap photo (network/timeout; skipping fallback to prevent duplicate)", "target", target, "error", err)
				return
			}
		}
	}

	if shouldFallbackToText {
		resp, err = b.tgClient.RequestNoRetry(ctx, "sendMessage", map[string]interface{}{
			"chat_id":                  target,
			"text":                     captionHTML,
			"parse_mode":               "HTML",
			"disable_web_page_preview": true,
			"reply_markup":             replyMarkup,
		})
		if err != nil {
			slog.Error("Failed to send Daily Recap", "target", target, "error", err)
			return
		}
	}

	// Step 3: Pin the new Daily Recap exclusively
	msgID := extractMessageID(resp)
	if msgID > 0 {
		_, errPin := b.tgClient.Request(ctx, "pinChatMessage", map[string]interface{}{
			"chat_id":              target,
			"message_id":           msgID,
			"disable_notification": false,
		})
		if errPin != nil {
			slog.Error("Failed to pin Daily Recap", "msg_id", msgID, "error", errPin)
		} else {
			slog.Info("Successfully sent & pinned Daily Recap", "target", target, "msg_id", msgID)
		}
	}
}

// extractMessageID supports both the unwrapped Telegram Message JSON returned by BotAPIClient
// ({"message_id": 123}) and the raw Bot API envelope ({"ok": true, "result": {"message_id": 123}}).
func extractMessageID(resp []byte) int64 {
	if len(resp) == 0 {
		return 0
	}
	var direct struct {
		MessageID int64 `json:"message_id"`
	}
	if err := json.Unmarshal(resp, &direct); err == nil && direct.MessageID > 0 {
		return direct.MessageID
	}
	var envelope struct {
		Ok     bool `json:"ok"`
		Result struct {
			MessageID int64 `json:"message_id"`
		} `json:"result"`
	}
	if err := json.Unmarshal(resp, &envelope); err == nil && envelope.Ok && envelope.Result.MessageID > 0 {
		return envelope.Result.MessageID
	}
	return 0
}
