package channelmgmt

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"

	"github.com/google/uuid"
)

// ScrapedChannelPost represents a post parsed from t.me/s/{username}
type ScrapedChannelPost struct {
	ChannelUsername string
	MessageID       int64
	Text            string
	PhotoURL        string
	VideoURL        string
	ViewsCount      string
	PostDate        time.Time
}

// PublicChannelScraper handles sessionless monitoring of public Telegram channels via t.me/s/
type PublicChannelScraper struct {
	channelService *ChannelService
	channelRepo    *repository.ChannelRepo
	botRepo        *repository.BotRepo
	httpClient     *http.Client
	lastScrapedIDs sync.Map // map[string]int64
}

func NewPublicChannelScraper(svc *ChannelService, channelRepo *repository.ChannelRepo, botRepo *repository.BotRepo) *PublicChannelScraper {
	client := &http.Client{
		Timeout: 15 * time.Second,
	}
	return &PublicChannelScraper{
		channelService: svc,
		channelRepo:    channelRepo,
		botRepo:        botRepo,
		httpClient:     client,
	}
}

// CleanChannelUsername extracts clean username from URL or @-handle
func CleanChannelUsername(raw string) string {
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "https://")
	s = strings.TrimPrefix(s, "http://")
	s = strings.TrimPrefix(s, "t.me/s/")
	s = strings.TrimPrefix(s, "t.me/")
	s = strings.TrimPrefix(s, "@")
	parts := strings.Split(s, "/")
	if len(parts) > 0 {
		return strings.TrimSpace(parts[0])
	}
	return strings.TrimSpace(s)
}

// FetchRecentPosts fetches the HTML preview from https://t.me/s/{username} and extracts posts
func (s *PublicChannelScraper) FetchRecentPosts(ctx context.Context, username string) ([]ScrapedChannelPost, error) {
	cleanName := CleanChannelUsername(username)
	if cleanName == "" {
		return nil, fmt.Errorf("empty channel username")
	}

	url := fmt.Sprintf("https://t.me/s/%s", cleanName)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Telegram web preview expects browser headers
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9,fa;q=0.8")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch t.me/s/%s: %w", cleanName, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("t.me/s/%s returned status %d", cleanName, resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	return parseTelegramWebHTML(cleanName, string(bodyBytes))
}

var (
	msgWrapRegex   = regexp.MustCompile(`(?s)<div class="tgme_widget_message\s+[^"]*data-post="([^"/]+)/(\d+)"[^>]*>(.*?)</div>\s*</div>\s*</div>`)
	textRegex      = regexp.MustCompile(`(?s)<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>`)
	photoRegex     = regexp.MustCompile(`background-image:url\('([^']+)'\)`)
	videoRegex     = regexp.MustCompile(`<video[^>]+src="([^"]+)"`)
	viewsRegex     = regexp.MustCompile(`<span class="tgme_widget_message_views"[^>]*>([^<]+)</span>`)
	dateRegex      = regexp.MustCompile(`<time\s+datetime="([^"]+)"`)
	htmlTagRegex   = regexp.MustCompile(`<[^>]*>`)
	brTagRegex     = regexp.MustCompile(`(?i)<br\s*/?>`)
)

func parseTelegramWebHTML(channelUsername, htmlContent string) ([]ScrapedChannelPost, error) {
	var posts []ScrapedChannelPost

	// Chunking by data-post
	matches := msgWrapRegex.FindAllStringSubmatch(htmlContent, -1)
	if len(matches) == 0 {
		// Fallback regex if wrapper class has slightly different nesting
		simplePostRegex := regexp.MustCompile(`(?s)data-post="` + regexp.QuoteMeta(channelUsername) + `/(\d+)"[^>]*>(.*?)<div class="tgme_widget_message_footer`)
		simpleMatches := simplePostRegex.FindAllStringSubmatch(htmlContent, -1)
		for _, m := range simpleMatches {
			msgID, _ := strconv.ParseInt(m[1], 10, 64)
			postBlock := m[2]

			post := extractPostFields(channelUsername, msgID, postBlock)
			if post.MessageID > 0 {
				posts = append(posts, post)
			}
		}
		return posts, nil
	}

	for _, m := range matches {
		msgID, err := strconv.ParseInt(m[2], 10, 64)
		if err != nil {
			continue
		}
		postBlock := m[3]

		post := extractPostFields(channelUsername, msgID, postBlock)
		if post.MessageID > 0 {
			posts = append(posts, post)
		}
	}

	return posts, nil
}

func extractPostFields(channelUsername string, msgID int64, block string) ScrapedChannelPost {
	post := ScrapedChannelPost{
		ChannelUsername: channelUsername,
		MessageID:       msgID,
	}

	// 1. Text
	if textMatch := textRegex.FindStringSubmatch(block); len(textMatch) > 1 {
		rawText := textMatch[1]
		// Convert <br> to newline
		rawText = brTagRegex.ReplaceAllString(rawText, "\n")
		// Strip other HTML tags
		cleanText := htmlTagRegex.ReplaceAllString(rawText, "")
		post.Text = strings.TrimSpace(html.UnescapeString(cleanText))
	}

	// 2. Photo
	if photoMatch := photoRegex.FindStringSubmatch(block); len(photoMatch) > 1 {
		post.PhotoURL = photoMatch[1]
	}

	// 3. Video
	if videoMatch := videoRegex.FindStringSubmatch(block); len(videoMatch) > 1 {
		post.VideoURL = videoMatch[1]
	}

	// 4. Views
	if viewsMatch := viewsRegex.FindStringSubmatch(block); len(viewsMatch) > 1 {
		post.ViewsCount = strings.TrimSpace(viewsMatch[1])
	}

	// 5. Date
	if dateMatch := dateRegex.FindStringSubmatch(block); len(dateMatch) > 1 {
		if t, err := time.Parse(time.RFC3339, dateMatch[1]); err == nil {
			post.PostDate = t
		}
	}

	return post
}

// ScraperWorker runs periodically in background to check all active public channels
func (s *PublicChannelScraper) ScraperWorker(ctx context.Context) {
	ticker := time.NewTicker(45 * time.Second)
	defer ticker.Stop()

	slog.Info("Public Channel Scraper worker started (sessionless t.me/s/ monitor)")

	for {
		select {
		case <-ctx.Done():
			slog.Info("Public Channel Scraper worker stopped")
			return
		case <-ticker.C:
			s.runPollCycle(ctx)
		}
	}
}

func (s *PublicChannelScraper) runPollCycle(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("Recovered from panic in PublicChannelScraper", "panic", r)
		}
	}()

	// 1. Gather all unique channels to scrape from active projects
	channelsToScrape := make(map[string]struct{})

	// From Projects
	projects, err := s.channelRepo.GetAllActiveProjects(ctx)
	if err == nil {
		for _, p := range projects {
			username := CleanChannelUsername(p.SourceUsername)
			if username != "" && !strings.HasPrefix(username, "-100") {
				channelsToScrape[username] = struct{}{}
			}
			// Check pipeline_config source_channel_identifier
			var pCfg map[string]interface{}
			if len(p.PipelineConfig) > 0 && json.Unmarshal(p.PipelineConfig, &pCfg) == nil {
				if srcIdent, ok := pCfg["source_channel_identifier"].(string); ok && srcIdent != "" {
					u := CleanChannelUsername(srcIdent)
					if u != "" && !strings.HasPrefix(u, "-100") {
						channelsToScrape[u] = struct{}{}
					}
				}
			}
		}
	}

	// From Forwarding Rules
	rules, err := s.channelRepo.GetAllActiveForwardingRules(ctx)
	if err == nil {
		for _, r := range rules {
			if r.Direction == "inbound" || r.SourceChannel != "" {
				targetStr := r.SourceChannel
				if targetStr == "" {
					targetStr = r.Target
				}
				u := CleanChannelUsername(targetStr)
				if u != "" && !strings.HasPrefix(u, "-100") {
					channelsToScrape[u] = struct{}{}
				}
			}
		}
	}

	if len(channelsToScrape) == 0 {
		return
	}

	// 2. Poll each channel safely with rate-limit pacing
	for username := range channelsToScrape {
		select {
		case <-ctx.Done():
			return
		default:
		}

		s.pollChannel(ctx, username)
		time.Sleep(2 * time.Second) // courteous pacing between channels
	}
}

func (s *PublicChannelScraper) pollChannel(ctx context.Context, username string) {
	cache := s.channelRepo.GetCache()
	lastIDKey := fmt.Sprintf("tme_scrape:last_id:%s", strings.ToLower(username))

	var lastID int64
	if cache != nil && cache.Client != nil {
		if val, err := cache.Client.Get(ctx, lastIDKey).Result(); err == nil {
			lastID, _ = strconv.ParseInt(val, 10, 64)
		}
	}
	if lastID == 0 {
		if val, ok := s.lastScrapedIDs.Load(username); ok {
			lastID = val.(int64)
		}
	}

	posts, err := s.FetchRecentPosts(ctx, username)
	if err != nil {
		slog.Warn("Failed to scrape public channel", "username", username, "error", err)
		return
	}

	if len(posts) == 0 {
		return
	}

	// If first run, set checkpoint to newestID - 1 so the latest current post is captured and processed
	// while older historical backlog is not spammed
	if lastID == 0 {
		newestID := posts[len(posts)-1].MessageID
		lastID = newestID - 1
		s.lastScrapedIDs.Store(username, lastID)
		if cache != nil && cache.Client != nil {
			cache.Client.Set(ctx, lastIDKey, strconv.FormatInt(lastID, 10), 30*24*time.Hour)
		}
		slog.Info("Initialized scraper checkpoint for channel, capturing latest post", "username", username, "checkpoint_msg_id", lastID)
	}

	var maxID = lastID
	for _, post := range posts {
		if post.MessageID > lastID {
			slog.Info("Scraper detected new public post", "channel", username, "message_id", post.MessageID)
			s.channelService.DispatchScrapedPost(ctx, post)
			if post.MessageID > maxID {
				maxID = post.MessageID
			}
		}
	}

	if maxID > lastID {
		s.lastScrapedIDs.Store(username, maxID)
		if cache != nil && cache.Client != nil {
			cache.Client.Set(ctx, lastIDKey, strconv.FormatInt(maxID, 10), 30*24*time.Hour)
		}
	}
}

// DispatchScrapedPost routes posts discovered from public t.me/s/ scraper to matching Projects and Forwarding Rules
func (s *ChannelService) DispatchScrapedPost(ctx context.Context, post ScrapedChannelPost) {
	// Deduplication lock via Redis
	if cache := s.channelRepo.GetCache(); cache != nil && cache.Client != nil {
		lockKey := fmt.Sprintf("tme_dispatch_lock:%s:%d", strings.ToLower(post.ChannelUsername), post.MessageID)
		locked, err := cache.Client.SetNX(ctx, lockKey, "1", 2*time.Hour).Result()
		if err == nil && !locked {
			return // already dispatched
		}
	}

	// 1. Check Projects
	projects, err := s.channelRepo.GetAllActiveProjects(ctx)
	if err == nil && len(projects) > 0 {
		for _, p := range projects {
			if !matchProjectSource(p, post.ChannelUsername) {
				continue
			}
			if !isProjectSubscriptionValid(p) {
				continue
			}

			s.wg.Add(1)
			pCopy := p
			GoSafe(func() {
				defer s.wg.Done()
				bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
				defer cancel()
				s.processScrapedPostForProject(bgCtx, pCopy, post)
			})
		}
	}

	// 2. Check Inbound Forwarding Rules
	rules, err := s.channelRepo.GetAllActiveForwardingRules(ctx)
	if err == nil && len(rules) > 0 {
		for _, r := range rules {
			if !r.IsActive {
				continue
			}
			cleanSrc := CleanChannelUsername(r.SourceChannel)
			if cleanSrc == "" && r.Direction == "inbound" {
				cleanSrc = CleanChannelUsername(r.Target)
			}
			if strings.EqualFold(cleanSrc, post.ChannelUsername) {
				s.wg.Add(1)
				rCopy := r
				GoSafe(func() {
					defer s.wg.Done()
					bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
					defer cancel()
					s.processScrapedPostForForwardingRule(bgCtx, rCopy, post)
				})
			}
		}
	}
}

func matchProjectSource(p *repository.Project, channelUsername string) bool {
	cleanName := CleanChannelUsername(channelUsername)
	if strings.EqualFold(CleanChannelUsername(p.SourceUsername), cleanName) {
		return true
	}
	var pCfg map[string]interface{}
	if len(p.PipelineConfig) > 0 && json.Unmarshal(p.PipelineConfig, &pCfg) == nil {
		if src, ok := pCfg["source_channel_identifier"].(string); ok {
			if strings.EqualFold(CleanChannelUsername(src), cleanName) {
				return true
			}
		}
	}
	return false
}

func isProjectSubscriptionValid(p *repository.Project) bool {
	now := time.Now()
	if p.StarsSubscriptionActive {
		if p.StarsExpiresAt == nil || p.StarsExpiresAt.After(now) {
			return true
		}
		return false
	}
	if p.TrialEndsAt != nil && p.TrialEndsAt.After(now) {
		return true
	}
	if !p.TrialUsed && p.TrialEndsAt == nil {
		return true
	}
	return false
}

func (s *ChannelService) processScrapedPostForProject(ctx context.Context, p *repository.Project, post ScrapedChannelPost) {
	var targetChatID int64
	var targetChannelID *uuid.UUID
	var botID uuid.UUID

	if p.TargetChatID != nil && *p.TargetChatID != 0 {
		targetChatID = *p.TargetChatID
	}
	if p.TargetChannelID != nil && *p.TargetChannelID != uuid.Nil {
		targetChannelID = p.TargetChannelID
		if tc, err := s.channelRepo.GetChannelByID(ctx, *p.TargetChannelID); err == nil && tc != nil {
			targetChatID = tc.ChatID
			botID = tc.BotID
		}
	}

	if targetChatID == 0 {
		slog.Warn("Scraped post has no valid target chat ID for project", "project_id", p.ID)
		return
	}

	var bot *repository.ManagedBot
	if botID != uuid.Nil {
		bot, _ = s.botRepo.GetBotByID(ctx, botID)
	}
	if bot == nil {
		bot, _ = s.botRepo.GetMainBot(ctx)
	}

	var token string
	if bot != nil && len(bot.BotTokenEncrypted) > 0 {
		token, _ = botmgmt.DecryptToken(bot.BotTokenEncrypted)
	}
	if token == "" {
		token = strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN"))
		if token == "" {
			token = strings.TrimSpace(os.Getenv("BOT_TOKEN"))
		}
	}
	if token == "" {
		slog.Error("Failed to resolve any bot token for scraped project dispatch", "project_id", p.ID)
		return
	}
	if bot == nil {
		bot = &repository.ManagedBot{
			ID:          uuid.New(),
			OwnerUserID: p.OwnerUserID,
			BotUsername: "iFragmentBot",
		}
	}
	tg := telegram.NewBotAPIClient(token)

	var pCfg struct {
		DropMedia      bool   `json:"drop_media"`
		RemoveAds      bool   `json:"remove_ads"`
		RemoveLinks    bool   `json:"remove_links"`
		RemoveHashtags bool   `json:"remove_hashtags"`
		AiRewrite      bool   `json:"ai_rewrite"`
		Watermark      string `json:"watermark"`
		AutoPublish    *bool  `json:"auto_publish"`
		AiProvider     string `json:"ai_provider"`
		AiModel        string `json:"ai_model"`
		CustomPrompt   string `json:"custom_prompt"`
	}
	if len(p.PipelineConfig) > 0 {
		_ = json.Unmarshal(p.PipelineConfig, &pCfg)
	}

	processedText := post.Text
	if pCfg.RemoveAds {
		processedText = strings.ReplaceAll(processedText, "#ad", "")
		processedText = strings.ReplaceAll(processedText, "#spon", "")
		processedText = strings.ReplaceAll(processedText, "#تبلیغ", "")
		processedText = strings.ReplaceAll(processedText, "#تبلیغات", "")
	}
	if pCfg.RemoveLinks {
		processedText = removeLinksHelper(processedText)
	}
	if pCfg.RemoveHashtags {
		processedText = removeHashtagsHelper(processedText)
	}

	if pCfg.AiRewrite && len(strings.TrimSpace(processedText)) > 0 {
		provider := pCfg.AiProvider
		if provider == "" {
			provider = "gemini"
		}
		model := pCfg.AiModel
		if model == "" {
			model = "gemini-3.8-flash"
		}
		apiKey := s.resolveChannelAPIKey(ctx, targetChannelID, provider)
		if apiKey != "" {
			prompt := "You are a professional Telegram channel editor. Rewrite the following post with an engaging, clear tone. Preserve all facts and dates. Respond ONLY with the revised text in the same language as the original."
			if pCfg.CustomPrompt != "" {
				prompt = pCfg.CustomPrompt
			}
			if rewritten, err := CallLLM(ctx, provider, apiKey, model, prompt, processedText, false); err == nil && len(strings.TrimSpace(rewritten)) > 0 {
				processedText = strings.TrimSpace(rewritten)
			}
		}
	}

	if pCfg.Watermark != "" && !strings.Contains(processedText, pCfg.Watermark) {
		processedText = processedText + "\n\n" + pCfg.Watermark
	}
	if targetChannelID != nil {
		processedText = s.ApplyWatermarkAndSignature(ctx, processedText, *targetChannelID)
	}

	var buttonsMarkup interface{}
	if targetChannelID != nil {
		if btns, err := s.channelRepo.GetChannelButtons(ctx, *targetChannelID); err == nil && len(btns) > 0 {
			buttonsMarkup = BuildInlineKeyboard(btns)
		}
	}

	autoPublish := false
	if pCfg.AutoPublish != nil {
		autoPublish = *pCfg.AutoPublish
	}

	if autoPublish {
		var pubMsgID int64
		var sendErr error

		if post.PhotoURL != "" && !pCfg.DropMedia {
			res, err := tg.SendPhotoWithMarkup(ctx, targetChatID, post.PhotoURL, processedText, buttonsMarkup, "HTML")
			if err != nil {
				res, err = tg.SendPhotoWithMarkup(ctx, targetChatID, post.PhotoURL, processedText, buttonsMarkup, "")
			}
			if err == nil && res != nil {
				pubMsgID = int64(res.MessageID)
			} else {
				sendErr = err
			}
		} else {
			res, err := tg.SendMessageWithMarkup(ctx, targetChatID, processedText, buttonsMarkup, nil, "HTML")
			if err != nil {
				res, err = tg.SendMessageWithMarkup(ctx, targetChatID, processedText, buttonsMarkup, nil, "")
			}
			if err == nil && res != nil {
				pubMsgID = int64(res.MessageID)
			} else {
				sendErr = err
			}
		}

		if sendErr != nil {
			slog.Error("Failed to publish scraped post to target channel", "project_id", p.ID, "target_chat", targetChatID, "error", sendErr)
			return
		}

		slog.Info("Successfully published scraped post to target channel", "project_id", p.ID, "target_chat", targetChatID, "msg_id", pubMsgID)

		if targetChannelID != nil {
			now := time.Now()
			cPost := repository.ChannelPost{
				ChannelID:         *targetChannelID,
				TelegramMessageID: pubMsgID,
				Text:              processedText,
				HasMedia:          post.PhotoURL != "" || post.VideoURL != "",
				PostedAt:          &now,
			}
			_ = s.channelRepo.CreatePost(ctx, &cPost)

			meta, _ := json.Marshal(map[string]interface{}{
				"source_channel":       post.ChannelUsername,
				"source_message_id":    post.MessageID,
				"published_message_id": pubMsgID,
				"project_id":           p.ID.String(),
			})
			_ = s.channelRepo.LogAudit(ctx, &repository.ChannelAuditLog{
				ChannelID: *targetChannelID,
				ActorID:   p.OwnerUserID,
				Action:    "project.scraped_post_published",
				Metadata:  meta,
			})
		}
	} else {
		buttonsRaw, _ := json.Marshal(buttonsMarkup)
		draft := repository.PendingFunnelPost{
			FunnelID:               p.ID,
			InputMessageID:         post.MessageID,
			OriginalAuthorName:     post.ChannelUsername,
			DraftText:              processedText,
			DraftButtons:           buttonsRaw,
			AiVariations:           []string{processedText},
			SelectedVariationIndex: 0,
			Status:                 "pending",
		}
		if post.PhotoURL != "" && !pCfg.DropMedia {
			draft.MediaPayload = []repository.FunnelMediaItem{
				{FileID: post.PhotoURL, Type: "photo"},
			}
		}
		_ = s.channelRepo.SavePendingFunnelPost(ctx, &draft)
		slog.Info("Scraped post saved as pending review draft", "project_id", p.ID, "draft_id", draft.ID)

		// Dispatch Review DM to Owner in the main bot (@iFragment)
		funnel := &repository.ChannelFunnel{
			ID:           p.ID,
			ProjectName:  p.Name,
			OwnerUserID:  p.OwnerUserID,
			OutputChatID: targetChatID,
			IsActive:     true,
		}
		destTitle := "Target Channel"
		if p.Name != "" {
			destTitle = p.Name
		}
		if targetChannelID != nil {
			if targetChan, err := s.channelRepo.GetChannelByID(ctx, *targetChannelID); err == nil && targetChan != nil && targetChan.ChatTitle != "" {
				destTitle = targetChan.ChatTitle
			}
		}
		if err := s.sendFunnelReviewToOwner(ctx, bot, funnel, &draft, destTitle); err != nil {
			slog.Error("Failed to send scraped post review to owner in main bot", "project_id", p.ID, "owner_id", p.OwnerUserID, "error", err)
		} else {
			slog.Info("Successfully sent scraped post review to owner in main bot", "project_id", p.ID, "owner_id", p.OwnerUserID)
		}
	}
}

func (s *ChannelService) processScrapedPostForForwardingRule(ctx context.Context, rule repository.ChannelForwardingRule, post ScrapedChannelPost) {
	destChan, err := s.channelRepo.GetChannelByID(ctx, rule.ChannelID)
	if err != nil || destChan == nil {
		return
	}
	if err := s.checkSubscription(destChan); err != nil {
		return
	}

	bot, err := s.botRepo.GetBotByID(ctx, destChan.BotID)
	if err != nil {
		return
	}
	token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	if err != nil || token == "" {
		return
	}
	tg := telegram.NewBotAPIClient(token)

	targetIdentifier := rule.TargetChannel
	if targetIdentifier == "" && rule.Direction == "outbound" {
		targetIdentifier = rule.Target
	}
	if targetIdentifier == "" {
		targetIdentifier = strconv.FormatInt(destChan.ChatID, 10)
	}

	parsedTarget := parseChatIDOrUsername(targetIdentifier)
	var targetChatID int64
	if val, ok := parsedTarget.(int64); ok {
		targetChatID = val
	} else {
		chatRes, err := tg.GetChat(ctx, parsedTarget)
		if err != nil {
			return
		}
		targetChatID = chatRes.ID
	}

	text := ApplyTextFilters(post.Text, ChannelPostFilter{
		Mode:           rule.Mode,
		Watermark:      rule.Watermark,
		RemoveAds:      rule.RemoveAds,
		RemoveHashtags: rule.RemoveHashtags,
		RemoveLinks:    rule.RemoveLinks,
	})

	if post.PhotoURL != "" {
		_, _ = tg.SendPhoto(ctx, targetChatID, post.PhotoURL, text, "HTML")
	} else {
		_ = tg.SendMessage(ctx, targetChatID, text, nil, nil)
	}
}

func (s *ChannelService) resolveChannelAPIKey(ctx context.Context, channelID *uuid.UUID, provider string) string {
	if channelID != nil {
		settings, err := s.channelRepo.GetChannelSettings(ctx, *channelID)
		if err == nil && settings != nil && len(settings.Posting) > 0 {
			var posting PostingSettingsSchema
			if json.Unmarshal(settings.Posting, &posting) == nil && posting.ApiKey != "" {
				return resolveEncryptedKey(posting.ApiKey)
			}
		}
	}
	switch strings.ToLower(provider) {
	case "gemini":
		return os.Getenv("GEMINI_API_KEY")
	case "groq":
		return os.Getenv("GROQ_API_KEY")
	case "openai":
		return os.Getenv("OPENAI_API_KEY")
	case "anthropic":
		return os.Getenv("ANTHROPIC_API_KEY")
	default:
		key := os.Getenv("GEMINI_API_KEY")
		if key == "" {
			key = os.Getenv("GROQ_API_KEY")
		}
		return key
	}
}

