package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cardgen"
	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/telegramnft"
	"ifragment-backend/internal/service/gifts/traits"
	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/numbers/nvengine"
	"ifragment-backend/internal/service/username/avm"

	"github.com/shopspring/decimal"
)

var (
	premiumGiftLinkRegex   = regexp.MustCompile(`(?i)(?:https?://)?(?:t\.me/nft/|telegram\.me/nft/|fragment\.com/gift/)([a-zA-Z0-9_\-]+)`)
	premiumNumberLinkRegex = regexp.MustCompile(`(?i)(?:https?://)?(?:www\.)?fragment\.com/number/([0-9]+)`)
)

// parsePremiumCommand checks if an incoming message invokes /premium (or /premium@BotUsername)
// and extracts the trimmed target argument.
func parsePremiumCommand(raw string) (bool, string) {
	trimmed := strings.TrimSpace(raw)
	if !strings.HasPrefix(trimmed, "/") {
		return false, ""
	}

	splitIdx := strings.IndexFunc(trimmed, unicode.IsSpace)
	var cmd, arg string
	if splitIdx == -1 {
		cmd = trimmed
	} else {
		cmd = trimmed[:splitIdx]
		arg = strings.TrimSpace(trimmed[splitIdx:])
	}

	cmd = strings.ToLower(cmd)
	if atIdx := strings.Index(cmd, "@"); atIdx != -1 {
		cmd = cmd[:atIdx]
	}
	if cmd != "/premium" {
		return false, ""
	}
	return true, arg
}

// stripInvisibleFormatChars removes hidden Unicode directional/zero-width markers often copied from Telegram.
func stripInvisibleFormatChars(s string) string {
	return strings.Map(func(r rune) rune {
		switch r {
		case '\u200B', '\u200C', '\u200D', '\u200E', '\u200F',
			'\u202A', '\u202B', '\u202C', '\u202D', '\u202E',
			'\u2066', '\u2067', '\u2068', '\u2069', '\uFEFF':
			return -1
		default:
			return r
		}
	}, s)
}

// parsePremiumTarget resolves an arbitrary /premium argument into a username, gift, or +888 number.
func parsePremiumTarget(rawArg string) *SmartSniffResult {
	clean := strings.TrimSpace(stripInvisibleFormatChars(rawArg))
	if clean == "" {
		return nil
	}

	// 1. Gift link (t.me/nft/..., telegram.me/nft/..., fragment.com/gift/...)
	if m := premiumGiftLinkRegex.FindStringSubmatch(clean); len(m) > 1 {
		return &SmartSniffResult{Type: "gift", Entity: m[1], Raw: rawArg}
	}

	// 2. Fragment number link (fragment.com/number/888...)
	if m := premiumNumberLinkRegex.FindStringSubmatch(clean); len(m) > 1 {
		if normNum, err := features.NormalizeNumber(m[1]); err == nil && normNum != "" {
			return &SmartSniffResult{Type: "number", Entity: normNum, Raw: rawArg}
		}
	}

	// 3. Direct +888 anonymous number (8 digits or 4-digit genesis)
	if normNum, err := features.NormalizeNumber(clean); err == nil && normNum != "" {
		return &SmartSniffResult{Type: "number", Entity: normNum, Raw: rawArg}
	}

	// 4. Direct gift slug or collection + serial (e.g. PlushPepe-42, Plush Pepe #42, plush_pepe 42)
	lowerClean := strings.ToLower(clean)
	if !strings.HasPrefix(clean, "@") &&
		!strings.Contains(lowerClean, "t.me/") &&
		!strings.Contains(lowerClean, "telegram.me/") &&
		!strings.Contains(lowerClean, "fragment.com/") {
		if ref, err := gvengine.NormalizeGiftIdentifier(clean); err == nil && ref != nil && ref.SerialNumber > 0 {
			if _, ok := traits.ResolveCollection(ref.ModelID); ok {
				return &SmartSniffResult{Type: "gift", Entity: ref.GiftID, Raw: rawArg}
			}
		}
		if giftSlugRegex.MatchString(clean) {
			return &SmartSniffResult{Type: "gift", Entity: clean, Raw: rawArg}
		}
	}

	// 5. Username from @mention, URL (t.me/user, t.me/s/user, telegram.me/user, fragment.com/username/user), or bare handle
	candidate := strings.TrimPrefix(clean, "@")
	if strings.Contains(candidate, "://") ||
		strings.HasPrefix(strings.ToLower(candidate), "t.me/") ||
		strings.HasPrefix(strings.ToLower(candidate), "telegram.me/") ||
		strings.HasPrefix(strings.ToLower(candidate), "fragment.com/") ||
		strings.HasPrefix(strings.ToLower(candidate), "www.fragment.com/") {
		urlStr := candidate
		if !strings.Contains(urlStr, "://") {
			urlStr = "https://" + urlStr
		}
		if u, err := url.Parse(urlStr); err == nil {
			host := strings.ToLower(u.Hostname())
			pathParts := strings.Split(strings.Trim(u.Path, "/"), "/")
			if host == "t.me" || host == "telegram.me" || strings.HasSuffix(host, ".t.me") {
				if len(pathParts) >= 2 && strings.EqualFold(pathParts[0], "s") && pathParts[1] != "" {
					candidate = pathParts[1]
				} else if len(pathParts) > 0 && pathParts[0] != "" {
					candidate = pathParts[0]
				}
			} else if host == "fragment.com" || host == "www.fragment.com" {
				if len(pathParts) >= 2 && strings.EqualFold(pathParts[0], "username") {
					candidate = pathParts[1]
				} else if len(pathParts) > 0 && pathParts[0] != "" {
					candidate = pathParts[0]
				}
			}
		}
	} else {
		candidate = strings.TrimRight(candidate, "/")
	}

	if usernameRe.MatchString(candidate) && !strings.HasPrefix(strings.ToLower(candidate), "888") {
		return &SmartSniffResult{Type: "username", Entity: strings.ToLower(candidate), Raw: rawArg}
	}

	return SniffAsset(clean)
}

func (h *WebhookHandler) resolveBotHandle(bot *repository.ManagedBot) string {
	if bot != nil && strings.TrimSpace(bot.BotUsername) != "" {
		return "@" + strings.TrimPrefix(strings.TrimSpace(bot.BotUsername), "@")
	}
	return "@iFragmentBot"
}

func (h *WebhookHandler) resolveMessageLang(ctx context.Context, m *Message) string {
	var rawLang string
	if m != nil && m.From != nil {
		if h.db != nil {
			if dbLang, err := h.db.GetUserLanguage(ctx, m.From.ID); err == nil && dbLang != "" {
				rawLang = dbLang
			}
		}
		if rawLang == "" {
			rawLang = m.From.LanguageCode
		}
	}
	return i18n.DetectLanguage(rawLang)
}

// handlePremiumCommand performs an instant, zero-credit valuation and sends a high-resolution
// promo valuation card photo directly without any paywall gate or credit deduction.
func (h *WebhookHandler) handlePremiumCommand(ctx context.Context, bot *repository.ManagedBot, m *Message, arg string) {
	if m == nil || m.Chat == nil {
		return
	}
	tg := h.getBotClient(bot)
	if tg == nil {
		return
	}

	var senderID int64
	if m.From != nil {
		senderID = m.From.ID
	} else if m.SenderChat != nil {
		senderID = m.SenderChat.ID
	}

	lang := h.resolveMessageLang(ctx, m)
	normLang := normalizeLang(lang)

	if strings.TrimSpace(arg) == "" {
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumUsageText(normLang), nil, m.MessageThreadID, "HTML")
		return
	}

	target := parsePremiumTarget(arg)
	if target == nil {
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumInvalidTargetText(normLang), nil, m.MessageThreadID, "HTML")
		return
	}

	// Pre-validate gift identifier before invoking valuation
	if target.Type == "gift" {
		ref, err := gvengine.NormalizeGiftIdentifier(target.Entity)
		if err != nil {
			_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumGiftNotFoundText(normLang), nil, m.MessageThreadID, "HTML")
			return
		}
		if _, ok := traits.ResolveCollection(ref.ModelID); !ok {
			_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumGiftNotFoundText(normLang), nil, m.MessageThreadID, "HTML")
			return
		}
		target.Entity = ref.GiftID
	}

	// Show "sending photo..." status in Telegram immediately
	_ = tg.SendChatAction(ctx, m.Chat.ID, "upload_photo", m.MessageThreadID)

	tonRate := h.resolveLiveTONRate(ctx)
	botHandle := h.resolveBotHandle(bot)
	miniAppURL := h.getMiniAppURL(bot)

	cg := h.cardGen
	if cg == nil {
		cg = cardgen.GetGenerator()
	}

	switch target.Type {
	case "username":
		h.deliverPremiumUsernamePhoto(ctx, tg, m, senderID, target.Entity, tonRate, botHandle, miniAppURL, normLang, cg)
	case "number":
		h.deliverPremiumNumberPhoto(ctx, tg, m, target.Entity, tonRate, botHandle, miniAppURL, normLang, cg)
	case "gift":
		h.deliverPremiumGiftPhoto(ctx, tg, m, target.Entity, tonRate, botHandle, miniAppURL, normLang, cg)
	default:
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumInvalidTargetText(normLang), nil, m.MessageThreadID, "HTML")
	}
}

func (h *WebhookHandler) deliverPremiumUsernamePhoto(
	ctx context.Context,
	tg *telegram.BotAPIClient,
	m *Message,
	_ int64,
	username string,
	tonRate float64,
	botHandle string,
	miniAppURL string,
	lang string,
	cg *cardgen.CardGenerator,
) {
	if h.avmService == nil {
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumFailureText(lang), nil, m.MessageThreadID, "HTML")
		return
	}

	normUser := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(username)), "@")
	res, err := h.avmService.Valuate(ctx, normUser, tonRate)
	if err != nil || res == nil || !res.ExpectedTON.GreaterThan(decimal.Zero) {
		slog.Warn("Premium username valuation failed", "username", normUser, "error", err)
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumFailureText(lang), nil, m.MessageThreadID, "HTML")
		return
	}
	ensureUsernameUSD(res, tonRate)

	params, caption, markup := buildPremiumUsernamePayload(normUser, res, tonRate, botHandle, miniAppURL, lang)
	pngBytes, err := cg.GeneratePremiumPromoCard(params)
	if err != nil {
		slog.Error("Failed to generate premium username card", "username", normUser, "error", err)
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumFailureText(lang), nil, m.MessageThreadID, "HTML")
		return
	}

	if sendErr := sendPremiumTwoPhotoAlbum(ctx, tg, m, pngBytes, caption, markup); sendErr != nil {
		slog.Error("Failed to send premium username album", "username", normUser, "error", sendErr)
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumFailureText(lang), nil, m.MessageThreadID, "HTML")
	}
}

func (h *WebhookHandler) deliverPremiumNumberPhoto(
	ctx context.Context,
	tg *telegram.BotAPIClient,
	m *Message,
	number string,
	tonRate float64,
	botHandle string,
	miniAppURL string,
	lang string,
	cg *cardgen.CardGenerator,
) {
	if h.numbersService == nil {
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumFailureText(lang), nil, m.MessageThreadID, "HTML")
		return
	}

	val, err := h.numbersService.ValuateNumber(ctx, 0, number)
	if err != nil || val == nil || !val.ExpectedTON.GreaterThan(decimal.Zero) {
		slog.Warn("Premium number valuation failed", "number", number, "error", err)
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumFailureText(lang), nil, m.MessageThreadID, "HTML")
		return
	}
	ensureNumberUSD(val, tonRate)

	params, caption, markup := buildPremiumNumberPayload(val, tonRate, botHandle, miniAppURL, lang)
	pngBytes, err := cg.GeneratePremiumPromoCard(params)
	if err != nil {
		slog.Error("Failed to generate premium number card", "number", val.DisplayNumber, "error", err)
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumFailureText(lang), nil, m.MessageThreadID, "HTML")
		return
	}

	if sendErr := sendPremiumTwoPhotoAlbum(ctx, tg, m, pngBytes, caption, markup); sendErr != nil {
		slog.Error("Failed to send premium number album", "number", val.DisplayNumber, "error", sendErr)
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumFailureText(lang), nil, m.MessageThreadID, "HTML")
	}
}

func (h *WebhookHandler) deliverPremiumGiftPhoto(
	ctx context.Context,
	tg *telegram.BotAPIClient,
	m *Message,
	giftSlug string,
	tonRate float64,
	botHandle string,
	miniAppURL string,
	lang string,
	cg *cardgen.CardGenerator,
) {
	if h.giftsService == nil {
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumFailureText(lang), nil, m.MessageThreadID, "HTML")
		return
	}

	val, err := h.giftsService.GetBotGiftAppraisal(ctx, giftSlug)
	if err != nil || val == nil || (val.Pillars.FairValueGRAM <= 0 && !val.ExpectedGRAM.GreaterThan(decimal.Zero)) {
		slog.Warn("Premium gift valuation failed", "gift", giftSlug, "error", err)
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumGiftNotFoundText(lang), nil, m.MessageThreadID, "HTML")
		return
	}
	ensureGiftUSD(val, tonRate)

	params, caption, markup := buildPremiumGiftPayload(val, tonRate, botHandle, miniAppURL, lang)
	pngBytes, err := cg.GeneratePremiumPromoCard(params)
	if err != nil {
		slog.Error("Failed to generate premium gift card", "gift", giftSlug, "error", err)
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumFailureText(lang), nil, m.MessageThreadID, "HTML")
		return
	}

	if sendErr := sendPremiumTwoPhotoAlbum(ctx, tg, m, pngBytes, caption, markup); sendErr != nil {
		slog.Error("Failed to send premium gift album", "gift", giftSlug, "error", sendErr)
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, buildPremiumFailureText(lang), nil, m.MessageThreadID, "HTML")
	}
}

func sendPremiumTwoPhotoAlbum(ctx context.Context, tg *telegram.BotAPIClient, m *Message, cardPNG []byte, caption string, markup map[string]interface{}) error {
	if len(premiumWhalesProofPNG) > 0 {
		if _, err := tg.SendTwoPhotosMediaGroupBytes(ctx, m.Chat.ID, cardPNG, premiumWhalesProofPNG, caption, m.MessageThreadID); err == nil {
			return nil
		} else {
			slog.Warn("sendMediaGroup failed for /premium; falling back to single photo", "error", err)
		}
	}
	_, err := tg.SendPhotoBytesWithMarkup(ctx, m.Chat.ID, cardPNG, caption, markup, m.MessageThreadID)
	return err
}

func ensureNumberUSD(val *nvengine.NumberValuation, tonRate float64) {
	if val == nil {
		return
	}
	if tonRate <= 0 {
		tonRate = 1.00
	}
	if val.ExpectedUSD <= 0 && val.ExpectedTON.GreaterThan(decimal.Zero) {
		val.ExpectedUSD = val.ExpectedTON.InexactFloat64() * tonRate
	}
	if val.LowUSD <= 0 && val.LowTON.GreaterThan(decimal.Zero) {
		val.LowUSD = val.LowTON.InexactFloat64() * tonRate
	}
	if val.HighUSD <= 0 && val.HighTON.GreaterThan(decimal.Zero) {
		val.HighUSD = val.HighTON.InexactFloat64() * tonRate
	}
}

func ensureGiftUSD(val *gvengine.GiftValuation, tonRate float64) {
	if val == nil {
		return
	}
	if tonRate <= 0 {
		tonRate = 1.00
	}
	fairGRAM := val.Pillars.FairValueGRAM
	if fairGRAM <= 0 {
		fairGRAM = val.ExpectedGRAM.InexactFloat64()
		val.Pillars.FairValueGRAM = fairGRAM
	}
	if val.ExpectedUSD <= 0 && fairGRAM > 0 {
		val.ExpectedUSD = fairGRAM * tonRate
	}
	if val.LowUSD <= 0 && val.LowGRAM.GreaterThan(decimal.Zero) {
		val.LowUSD = val.LowGRAM.InexactFloat64() * tonRate
	}
	if val.HighUSD <= 0 && val.HighGRAM.GreaterThan(decimal.Zero) {
		val.HighUSD = val.HighGRAM.InexactFloat64() * tonRate
	}
}

func buildPremiumUsernamePayload(normUser string, res *avm.ValuationResult, tonRate float64, botHandle, miniAppURL, lang string) (cardgen.PromoCardParams, string, map[string]interface{}) {
	tier := strings.TrimSpace(res.Rarity.Tier)
	if tier == "" {
		tier = strings.TrimSpace(res.InvestmentGrade)
	}
	if tier == "" {
		tier = "Standard"
	}
	grade := strings.TrimSpace(res.InvestmentGrade)
	if grade == "" {
		grade = strings.ToUpper(tier)
	}

	fairTON := res.ExpectedTON.StringFixed(1)
	fairUSD := res.ExpectedUSD.StringFixed(0)
	lowTON := res.LowTON.StringFixed(1)
	lowUSD := res.LowUSD.StringFixed(0)
	highTON := res.HighTON.StringFixed(1)
	highUSD := res.HighUSD.StringFixed(0)

	if res.ExpectedUSD.LessThanOrEqual(decimal.Zero) && tonRate > 0 {
		fairUSD = res.ExpectedTON.Mul(decimal.NewFromFloat(tonRate)).StringFixed(0)
	}

	var chips []string
	if grade != "" {
		chips = append(chips, fmt.Sprintf("GRADE %s", strings.ToUpper(grade)))
	}
	if res.Brandability > 0 {
		chips = append(chips, fmt.Sprintf("BRAND %d/100", res.Brandability))
	}
	charLen := res.Length
	if charLen <= 0 {
		charLen = len(normUser)
	}
	if liq := formatCompactLiquidityASCII(res.LiquidityRating); liq != "" {
		chips = append(chips, fmt.Sprintf("%d CHARS · %s", charLen, liq))
	} else {
		chips = append(chips, fmt.Sprintf("%d CHARS", charLen))
	}

	conf := int(res.ConfidenceScore)
	if conf <= 0 {
		conf = 86
	}

	params := cardgen.PromoCardParams{
		AssetType:  "username",
		Title:      "@" + normUser,
		Eyebrow:    "TELEGRAM DIGITAL USERNAME",
		Badge:      tier,
		FairTON:    fairTON,
		FairUSD:    fairUSD,
		LowTON:     lowTON,
		LowUSD:     lowUSD,
		HighTON:    highTON,
		HighUSD:    highUSD,
		Confidence: conf,
		SpecChips:  chips,
		BotHandle:  botHandle,
		CertRef:    fmt.Sprintf("AVM %s | %s", nonEmptyStr(res.ModelVersion, "v7.0"), time.Now().UTC().Format("2006-01-02")),
	}

	appURL := appendStartParam(miniAppURL, fmt.Sprintf("val_%s", normUser))
	fragURL := fmt.Sprintf("https://fragment.com/username/%s", normUser)
	targetHTML := fmt.Sprintf("<b>%s</b>", telegram.EscapeHTML("@"+normUser))
	caption := buildPremiumPromoCaption(targetHTML, botHandle)
	markup := buildPremiumActionMarkup(appURL, fragURL, false, lang)
	return params, caption, markup
}

func buildPremiumNumberPayload(val *nvengine.NumberValuation, tonRate float64, botHandle, miniAppURL, lang string) (cardgen.PromoCardParams, string, map[string]interface{}) {
	displayNum := nonEmptyStr(val.DisplayNumber, val.Number)
	cleanNum := strings.TrimPrefix(features.CleanNumber(displayNum), "+")

	eyebrow := "TELEGRAM ANONYMOUS NUMBER"
	if val.Features.IsGenesis4Digit {
		eyebrow = "GENESIS 4-DIGIT NUMBER"
	}

	badge := nonEmptyStr(val.CategoryClub, "COLLECTIBLE")
	if val.GlobalRank > 0 && val.GlobalRank <= 500 {
		badge = fmt.Sprintf("RANK #%d", val.GlobalRank)
	}

	var chips []string
	if val.GlobalRank > 0 {
		chips = append(chips, fmt.Sprintf("RANK #%d / 136K", val.GlobalRank))
	}
	if club := strings.TrimSpace(val.CategoryClub); club != "" {
		if len(club) > 18 {
			club = club[:18]
		}
		chips = append(chips, strings.ToUpper(club))
	}
	if liq := formatCompactLiquidityASCII(val.Liquidity.LiquidityRating); liq != "" {
		chips = append(chips, liq)
	}

	conf := int(val.ConfidenceScore)
	if conf <= 0 {
		conf = 90
	}

	expectedUSD := val.ExpectedUSD
	if expectedUSD <= 0 && tonRate > 0 {
		expectedUSD = val.ExpectedTON.InexactFloat64() * tonRate
	}

	params := cardgen.PromoCardParams{
		AssetType:  "number",
		Title:      displayNum,
		Eyebrow:    eyebrow,
		Badge:      badge,
		FairTON:    val.ExpectedTON.StringFixed(1),
		FairUSD:    fmt.Sprintf("%.0f", expectedUSD),
		LowTON:     val.LowTON.StringFixed(1),
		LowUSD:     fmt.Sprintf("%.0f", val.LowUSD),
		HighTON:    val.HighTON.StringFixed(1),
		HighUSD:    fmt.Sprintf("%.0f", val.HighUSD),
		Confidence: conf,
		SpecChips:  chips,
		BotHandle:  botHandle,
		CertRef:    fmt.Sprintf("NV ENGINE | %s", time.Now().UTC().Format("2006-01-02")),
	}

	appURL := appendStartParam(miniAppURL, fmt.Sprintf("num_%s", cleanNum))
	fragURL := val.FragmentDirectURL
	if fragURL == "" {
		fragURL = fmt.Sprintf("https://fragment.com/number/%s", cleanNum)
	}
	targetHTML := fmt.Sprintf("<b><a href=\"%s\">%s</a></b>", telegram.EscapeHTML(fragURL), telegram.EscapeHTML(displayNum))
	caption := buildPremiumPromoCaption(targetHTML, botHandle)
	markup := buildPremiumActionMarkup(appURL, fragURL, false, lang)
	return params, caption, markup
}

func buildPremiumGiftPayload(val *gvengine.GiftValuation, tonRate float64, botHandle, miniAppURL, lang string) (cardgen.PromoCardParams, string, map[string]interface{}) {
	gp := buildGiftCardParams(val, lang)

	fairGRAM := val.Pillars.FairValueGRAM
	if fairGRAM <= 0 {
		fairGRAM = val.ExpectedGRAM.InexactFloat64()
	}
	lowGRAM := val.LowGRAM.InexactFloat64()
	if lowGRAM <= 0 {
		lowGRAM = val.Pillars.LiquidationValueGRAM
	}
	if lowGRAM <= 0 && fairGRAM > 0 {
		lowGRAM = fairGRAM * 0.80
	}
	highGRAM := val.HighGRAM.InexactFloat64()
	if highGRAM <= 0 {
		highGRAM = val.Pillars.SuggestedAskGRAM
	}
	if highGRAM <= 0 && fairGRAM > 0 {
		highGRAM = fairGRAM * 1.25
	}

	if tonRate <= 0 {
		tonRate = 1.00
	}
	fairUSD := val.ExpectedUSD
	if fairUSD <= 0 {
		fairUSD = fairGRAM * tonRate
	}
	lowUSD := val.LowUSD
	if lowUSD <= 0 {
		lowUSD = lowGRAM * tonRate
	}
	highUSD := val.HighUSD
	if highUSD <= 0 {
		highUSD = highGRAM * tonRate
	}

	conf := int(val.ConfidenceScore)
	if conf <= 0 {
		conf = 88
	}

	var chips []string
	if val.SerialNumber > 0 {
		chips = append(chips, fmt.Sprintf("SERIAL #%d", val.SerialNumber))
	}
	chips = append(chips, strings.ToUpper(gp.RarityTier))

	params := cardgen.PromoCardParams{
		AssetType:      "gift",
		Title:          gp.Title,
		Eyebrow:        "TELEGRAM COLLECTIBLE GIFT",
		Badge:          gp.RarityTier,
		FairTON:        fmt.Sprintf("%.1f", fairGRAM),
		FairUSD:        fmt.Sprintf("%.0f", fairUSD),
		LowTON:         fmt.Sprintf("%.1f", lowGRAM),
		LowUSD:         fmt.Sprintf("%.0f", lowUSD),
		HighTON:        fmt.Sprintf("%.1f", highGRAM),
		HighUSD:        fmt.Sprintf("%.0f", highUSD),
		Confidence:     conf,
		SpecChips:      chips,
		BotHandle:      botHandle,
		CertRef:        fmt.Sprintf("GV ENGINE | %s", time.Now().UTC().Format("2006-01-02")),
		ImageURL:       gp.ImageURL,
		BackdropCenter: gp.BackdropCenter,
		BackdropEdge:   gp.BackdropEdge,
		ModelName:      gp.ModelName,
		BackdropName:   gp.BackdropName,
		SymbolName:     gp.SymbolName,
		SerialNumber:   gp.SerialNumber,
	}

	appURL := appendStartParam(miniAppURL, fmt.Sprintf("gift_%s", val.GiftID))
	pascalName := telegramnft.FormatPascalName(val.ModelID)
	tgNFTURL := fmt.Sprintf("https://t.me/nft/%s-%d", pascalName, val.SerialNumber)
	targetHTML := fmt.Sprintf("<b>%s</b>", telegram.EscapeHTML(tgNFTURL))
	caption := buildPremiumPromoCaption(targetHTML, botHandle)
	markup := buildPremiumActionMarkup(appURL, tgNFTURL, true, lang)
	return params, caption, markup
}

// buildPremiumPromoCaption formats the high-CTR Inner Circle promotional caption with the
// dynamically substituted target (@username, collectible +888 number, or t.me/nft/... gift link).
func buildPremiumPromoCaption(targetHTML, botHandle string) string {
	cleanBot := strings.TrimSpace(botHandle)
	if cleanBot == "" {
		cleanBot = "@iFragmentbot"
	} else if !strings.HasPrefix(cleanBot, "@") {
		cleanBot = "@" + cleanBot
	}
	escBot := telegram.EscapeHTML(cleanBot)

	return fmt.Sprintf(
		"💎 The true anatomy and market worth of %s aren’t meant for ordinary buyers.\n\n"+
			"Inside @FragmentInvestors, you deal directly with the 1%% who actually price, collect, and move rare Telegram assets. "+
			"Don’t take our word for it — <b>step inside and check the admin list</b> to see which heavy-hitting whales and serious collectors run the room.\n\n"+
			"🏛 <b>Enter the Inner Circle:</b> @FragmentInvestors\n\n"+
			"<blockquote>📊 <i>Analytical poster gifted by %s — chat or boost the group to earn free credits and keep the live Fragment pricing radar right in your hands.</i></blockquote>",
		targetHTML,
		escBot,
	)
}

func buildPremiumActionMarkup(appURL, externalURL string, isGift bool, _ string) map[string]interface{} {
	btnExt := "🌐 View on Fragment"
	if isGift {
		btnExt = "🔗 View Collectible"
	}

	return map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": "🏛 Join @FragmentInvestors", "url": "https://t.me/FragmentInvestors"},
			},
			{
				{"text": "📊 Live Valuation Radar", "url": appURL},
				{"text": btnExt, "url": externalURL},
			},
		},
	}
}

func formatCompactLiquidityASCII(raw string) string {
	l := strings.ToLower(strings.TrimSpace(raw))
	switch {
	case l == "":
		return ""
	case strings.Contains(l, "ultra") || strings.Contains(l, "very high"):
		return "ULTRA LIQ"
	case strings.Contains(l, "high"):
		return "HIGH LIQ"
	case strings.Contains(l, "med") || strings.Contains(l, "moderate"):
		return "MED LIQ"
	case strings.Contains(l, "low"):
		return "LOW LIQ"
	default:
		return ""
	}
}

func formatInt64WithCommas(n int64) string {
	in := strconv.FormatInt(n, 10)
	if len(in) <= 3 {
		return in
	}
	out := make([]byte, 0, len(in)+len(in)/3)
	j := len(in) % 3
	if j == 0 {
		j = 3
	}
	out = append(out, in[:j]...)
	for i := j; i < len(in); i += 3 {
		out = append(out, ',')
		out = append(out, in[i:i+3]...)
	}
	return string(out)
}

func formatCommaNumberStr(v float64) string {
	if v <= 0 {
		return "0"
	}
	rounded := int64(v + 0.5)
	if v >= 100 || mathAbsZero(v-float64(rounded)) {
		return formatInt64WithCommas(rounded)
	}
	return fmt.Sprintf("%.1f", v)
}

func formatCommaIntStr(v float64) string {
	if v <= 0 {
		return "0"
	}
	return formatInt64WithCommas(int64(v + 0.5))
}

func mathAbsZero(d float64) bool {
	if d < 0 {
		d = -d
	}
	return d < 0.05
}

func nonEmptyStr(s, def string) string {
	if strings.TrimSpace(s) == "" {
		return def
	}
	return strings.TrimSpace(s)
}

func buildPremiumUsageText(lang string) string {
	switch normalizeLang(lang) {
	case "fa":
		return "💎 <b>تولید تصویر کارشناسی پرمیوم</b>\n\n" +
			"لطفاً یکی از موارد زیر را پس از دستور ارسال کنید:\n" +
			"• <code>/premium @username</code>\n" +
			"• <code>/premium https://t.me/nft/PlushPepe-42</code>\n" +
			"• <code>/premium +888 8888 8888</code>"
	case "ru":
		return "💎 <b>Мгновенная генерация карточки оценки</b>\n\n" +
			"Отправьте актив после команды:\n" +
			"• <code>/premium @username</code>\n" +
			"• <code>/premium https://t.me/nft/PlushPepe-42</code>\n" +
			"• <code>/premium +888 8888 8888</code>"
	case "zh":
		return "💎 <b>免费生成专业资产估值卡</b>\n\n" +
			"请在指令后输入要评估的资产：\n" +
			"• <code>/premium @username</code>\n" +
			"• <code>/premium https://t.me/nft/PlushPepe-42</code>\n" +
			"• <code>/premium +888 8888 8888</code>"
	default:
		return "💎 <b>Instant Valuation Card Generator</b>\n\n" +
			"Provide an asset after the command:\n" +
			"• <code>/premium @username</code>\n" +
			"• <code>/premium https://t.me/nft/PlushPepe-42</code>\n" +
			"• <code>/premium +888 8888 8888</code>"
	}
}

func buildPremiumInvalidTargetText(lang string) string {
	switch normalizeLang(lang) {
	case "fa":
		return "⚠️ <b>فرمت ورودی شناسایی نشد.</b>\n\nنمونه‌های معتبر:\n• <code>/premium @durov</code>\n• <code>/premium https://t.me/nft/PlushPepe-42</code>\n• <code>/premium +888 8888 8888</code>"
	case "ru":
		return "⚠️ <b>Неверный формат актива.</b>\n\nПримеры:\n• <code>/premium @durov</code>\n• <code>/premium https://t.me/nft/PlushPepe-42</code>\n• <code>/premium +888 8888 8888</code>"
	case "zh":
		return "⚠️ <b>无法识别资产格式。</b>\n\n有效示例：\n• <code>/premium @durov</code>\n• <code>/premium https://t.me/nft/PlushPepe-42</code>\n• <code>/premium +888 8888 8888</code>"
	default:
		return "⚠️ <b>Unrecognized asset format.</b>\n\nValid examples:\n• <code>/premium @durov</code>\n• <code>/premium https://t.me/nft/PlushPepe-42</code>\n• <code>/premium +888 8888 8888</code>"
	}
}

func buildPremiumGiftNotFoundText(lang string) string {
	switch normalizeLang(lang) {
	case "fa":
		return "🎁 <b>این گیفت پیدا نشد یا شماره سریال آن نامعتبر است، لینک را چک کنید.</b>"
	case "ru":
		return "🎁 <b>Подарок не найден или неверный серийный номер, проверьте ссылку.</b>"
	case "zh":
		return "🎁 <b>未找到该礼物或编号无效，请检查链接。</b>"
	default:
		return "🎁 <b>Gift not found or invalid serial number, please check the link.</b>"
	}
}

func buildPremiumFailureText(lang string) string {
	switch normalizeLang(lang) {
	case "fa":
		return "⚠️ <b>امکان دریافت تحلیل در این لحظه وجود ندارد.</b> لطفاً ورودی را بررسی کرده و دوباره تلاش کنید."
	case "ru":
		return "⚠️ <b>Не удалось выполнить оценку.</b> Проверьте данные и повторите попытку."
	case "zh":
		return "⚠️ <b>暂时无法获取估值结果。</b> 请检查输入后重试。"
	default:
		return "⚠️ <b>Unable to complete valuation right now.</b> Please verify the input and try again."
	}
}
