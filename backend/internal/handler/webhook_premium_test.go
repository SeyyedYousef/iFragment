package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"ifragment-backend/internal/crypto"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cardgen"
	"ifragment-backend/internal/service/gifts"
	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/traits"
	"ifragment-backend/internal/service/numbers"
	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/numbers/nvengine"
	"ifragment-backend/internal/service/username/avm"

	"github.com/shopspring/decimal"
)

func TestParsePremiumCommand(t *testing.T) {
	cases := []struct {
		raw      string
		wantHit  bool
		wantArg  string
	}{
		{"/premium @durov", true, "@durov"},
		{"/premium@iFragmentBot @durov", true, "@durov"},
		{"/PREMIUM https://t.me/nft/PlushPepe-42", true, "https://t.me/nft/PlushPepe-42"},
		{"/premium\n+888 8888 8888", true, "+888 8888 8888"},
		{"/premium   8888  ", true, "8888"},
		{"/premium", true, ""},
		{"/premium@iFragmentBot", true, ""},
		{"/premium_extra @durov", false, ""},
		{"/gift PlushPepe-42", false, ""},
		{"@durov", false, ""},
	}

	for _, tc := range cases {
		hit, arg := parsePremiumCommand(tc.raw)
		if hit != tc.wantHit || arg != tc.wantArg {
			t.Errorf("parsePremiumCommand(%q) = (%v, %q); want (%v, %q)", tc.raw, hit, arg, tc.wantHit, tc.wantArg)
		}
	}
}

func TestParsePremiumTarget(t *testing.T) {
	cases := []struct {
		arg        string
		wantType   string
		wantEntity string
	}{
		{"@durov", "username", "durov"},
		{"@Durov", "username", "durov"},
		{"usename", "username", "usename"},
		{"https://t.me/durov", "username", "durov"},
		{"https://t.me/s/durov", "username", "durov"},
		{"https://telegram.me/durov", "username", "durov"},
		{"https://fragment.com/username/crypto", "username", "crypto"},
		{"https://t.me/nft/PlushPepe-42", "gift", "PlushPepe-42"},
		{"https://t.me/nft/PlushPepe-42?single", "gift", "PlushPepe-42"},
		{"https://telegram.me/nft/PlushPepe-42", "gift", "PlushPepe-42"},
		{"https://fragment.com/gift/plushpepe-42", "gift", "plushpepe-42"},
		{"PlushPepe-42", "gift", "plush_pepe-42"},
		{"Plush Pepe #42", "gift", "plush_pepe-42"},
		{"plush_pepe 42", "gift", "plush_pepe-42"},
		{"+888 8888 8888", "number", "+88888888888"},
		{"+88801234567", "number", "+88801234567"},
		{"88801234567", "number", "+88801234567"},
		{"8888", "number", "+8888888"},
		{"https://fragment.com/number/88801234567", "number", "+88801234567"},
		{"\u200e+888 0123 4567\u200f", "number", "+88801234567"},
	}

	for _, tc := range cases {
		t.Run(tc.arg, func(t *testing.T) {
			res := parsePremiumTarget(tc.arg)
			if res == nil {
				t.Fatalf("expected non-nil target for %q", tc.arg)
			}
			if res.Type != tc.wantType {
				t.Errorf("Type = %q; want %q", res.Type, tc.wantType)
			}
			if res.Entity != tc.wantEntity {
				t.Errorf("Entity = %q; want %q", res.Entity, tc.wantEntity)
			}
		})
	}

	if res := parsePremiumTarget("not a valid !!! asset"); res != nil {
		t.Errorf("expected nil for invalid target, got %+v", res)
	}
}

func TestPremiumPayloadsAndCards(t *testing.T) {
	cg := cardgen.NewCardGenerator()
	langs := []string{"fa", "en", "ru", "zh"}

	uRes := &avm.ValuationResult{
		Username:        "crypto",
		ModelVersion:    "v7.0",
		InvestmentGrade: "AAA",
		Brandability:    96,
		Length:          6,
		LiquidityRating: "High",
		ConfidenceScore: 93,
		LowTON:          decimal.NewFromFloat(1150),
		ExpectedTON:     decimal.NewFromFloat(1500),
		HighTON:         decimal.NewFromFloat(2100),
		LowUSD:          decimal.NewFromFloat(4002),
		ExpectedUSD:     decimal.NewFromFloat(5220),
		HighUSD:         decimal.NewFromFloat(7308),
		Rarity:          avm.ValuationRarity{Tier: "Legendary"},
	}

	nVal := &nvengine.NumberValuation{
		Number:          "+88888888888",
		DisplayNumber:   "+888 8888 8888",
		CategoryClub:    "Grail Monodigit",
		CategoryClubFa:  "تک‌رقم اسطوره‌ای",
		GlobalRank:      1,
		ConfidenceScore: 97,
		LowTON:          decimal.NewFromFloat(80000),
		ExpectedTON:     decimal.NewFromFloat(100000),
		HighTON:         decimal.NewFromFloat(125000),
		LowUSD:          278400,
		ExpectedUSD:     348000,
		HighUSD:         435000,
		Features:        features.FeatureVector{IsGenesis4Digit: false},
		Liquidity:       nvengine.LiquidityMetrics{LiquidityRating: "High"},
	}

	gVal := &gvengine.GiftValuation{
		GiftID:          "plush_pepe-42",
		ModelID:         "plush_pepe",
		ModelName:       "Plush Pepe",
		SerialNumber:    42,
		DisplayTitle:    "Plush Pepe #42",
		ConfidenceScore: 91,
		LowGRAM:         decimal.NewFromFloat(350),
		ExpectedGRAM:    decimal.NewFromFloat(420),
		HighGRAM:        decimal.NewFromFloat(540),
		LowUSD:          1218,
		ExpectedUSD:     1462,
		HighUSD:         1879,
		Pillars:         gvengine.ValuationPillars{FairValueGRAM: 420},
		JointRarity:     traits.JointRarityAnalysis{RarityClass: "Epic"},
		TraitDNA: []gvengine.TraitDNABar{
			{AxisKey: "model", Value: "Pepe Classic"},
			{AxisKey: "backdrop", Value: "Emerald Glow", Colors: &traits.BackdropColorSet{CenterHex: "#10B981", EdgeHex: "#042F2E"}},
			{AxisKey: "symbol", Value: "Golden Star"},
		},
	}

	for _, lang := range langs {
		t.Run("username_"+lang, func(t *testing.T) {
			params, caption, markup := buildPremiumUsernamePayload("crypto", uRes, 3.48, "@iFragmentBot", "https://t.me/iFragmentBot/iFragment", lang)
			if err := ValidateTelegramHTML(caption); err != nil {
				t.Fatalf("invalid caption HTML: %v\n%s", err, caption)
			}
			if strings.Contains(strings.ToLower(caption), "/premium") {
				t.Errorf("caption should not expose /premium command: %s", caption)
			}
			if !strings.Contains(caption, "@crypto") || !strings.Contains(caption, "@FragmentInvestors") || !strings.Contains(caption, "@iFragmentBot") {
				t.Errorf("caption missing expected target/CTA handles: %s", caption)
			}
			if markup == nil {
				t.Errorf("expected non-nil markup")
			}
			pngBytes, err := cg.GeneratePremiumPromoCard(params)
			if err != nil {
				t.Fatalf("card gen failed: %v", err)
			}
			img, err := png.Decode(bytes.NewReader(pngBytes))
			if err != nil || img.Bounds().Dx() != 1080 || img.Bounds().Dy() != 1080 {
				t.Fatalf("expected 1080x1080 PNG, got err=%v bounds=%v", err, img)
			}
		})

		t.Run("number_"+lang, func(t *testing.T) {
			params, caption, _ := buildPremiumNumberPayload(nVal, 3.48, "@iFragmentBot", "https://t.me/iFragmentBot/iFragment", lang)
			if err := ValidateTelegramHTML(caption); err != nil {
				t.Fatalf("invalid caption HTML: %v", err)
			}
			if !strings.Contains(caption, "+888 8888 8888") || !strings.Contains(caption, "@FragmentInvestors") {
				t.Errorf("number caption missing expected number or @FragmentInvestors: %s", caption)
			}
			pngBytes, err := cg.GeneratePremiumPromoCard(params)
			if err != nil {
				t.Fatalf("card gen failed: %v", err)
			}
			img, err := png.Decode(bytes.NewReader(pngBytes))
			if err != nil || img.Bounds().Dx() != 1080 || img.Bounds().Dy() != 1080 {
				t.Fatalf("expected 1080x1080 PNG, got err=%v", err)
			}
		})

		t.Run("gift_"+lang, func(t *testing.T) {
			params, caption, _ := buildPremiumGiftPayload(gVal, 3.48, "@iFragmentBot", "https://t.me/iFragmentBot/iFragment", lang)
			if err := ValidateTelegramHTML(caption); err != nil {
				t.Fatalf("invalid caption HTML: %v", err)
			}
			if !strings.Contains(caption, "https://t.me/nft/PlushPepe-42") || !strings.Contains(caption, "@FragmentInvestors") {
				t.Errorf("gift caption missing expected gift link or @FragmentInvestors: %s", caption)
			}
			pngBytes, err := cg.GeneratePremiumPromoCard(params)
			if err != nil {
				t.Fatalf("card gen failed: %v", err)
			}
			img, err := png.Decode(bytes.NewReader(pngBytes))
			if err != nil || img.Bounds().Dx() != 1080 || img.Bounds().Dy() != 1080 {
				t.Fatalf("expected 1080x1080 PNG, got err=%v", err)
			}
		})
	}
}

func TestHandlePremiumCommand_EndToEndZeroCredit(t *testing.T) {
	type capturedCall struct {
		Method      string
		ChatID      string
		Text        string
		Caption     string
		MediaJSON   string
		PhotoBytes  []byte
		Photo1Bytes []byte
		Photo2Bytes []byte
	}

	var mu sync.Mutex
	var calls []capturedCall

	mockTG := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/"), "/")
		method := parts[len(parts)-1]

		c := capturedCall{Method: method}
		if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
			mr, err := r.MultipartReader()
			if err == nil {
				for {
					part, err := mr.NextPart()
					if err == io.EOF {
						break
					}
					if err != nil {
						break
					}
					data, _ := io.ReadAll(part)
					switch part.FormName() {
					case "chat_id":
						c.ChatID = string(data)
					case "caption":
						c.Caption = string(data)
					case "media":
						c.MediaJSON = string(data)
						var mediaItems []struct {
							Caption string `json:"caption"`
						}
						if json.Unmarshal(data, &mediaItems) == nil && len(mediaItems) > 0 {
							c.Caption = mediaItems[0].Caption
						}
					case "photo":
						c.PhotoBytes = data
					case "photo1":
						c.Photo1Bytes = data
					case "photo2":
						c.Photo2Bytes = data
					}
					_ = part.Close()
				}
			}
		} else {
			var payload map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&payload)
			if txt, ok := payload["text"].(string); ok {
				c.Text = txt
			}
		}

		mu.Lock()
		calls = append(calls, c)
		mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		if method == "sendChatAction" {
			_, _ = w.Write([]byte(`{"ok":true,"result":true}`))
			return
		}
		if method == "sendMediaGroup" {
			_, _ = w.Write([]byte(`{"ok":true,"result":[{"message_id":777},{"message_id":778}]}`))
			return
		}
		_, _ = w.Write([]byte(`{"ok":true,"result":{"message_id":777}}`))
	}))
	defer mockTG.Close()

	t.Setenv("TELEGRAM_API_URL", mockTG.URL)

	encToken, err := crypto.EncryptToken("123456:TEST_TOKEN")
	if err != nil {
		t.Fatalf("EncryptToken failed: %v", err)
	}
	bot := &repository.ManagedBot{
		BotUsername:       "iFragmentBot",
		BotTokenEncrypted: encToken,
	}

	h := &WebhookHandler{
		avmService:     avm.NewValuationService(nil, nil, nil),
		numbersService: numbers.NewNumbersService(nil, nil, nil, nil),
		giftsService:   gifts.NewGiftsService(nil, nil, nil),
		cardGen:        cardgen.NewCardGenerator(),
		// Intentionally nil intelCreditService and nil db: proves 0 credit checks/deductions!
	}

	ctx := context.Background()

	tests := []struct {
		name string
		text string
	}{
		{"Username", "/premium @durov"},
		{"GiftLink_NotHijackedByPrecheckGate", "/premium https://t.me/nft/PlushPepe-42"},
		{"CollectibleNumber", "/premium +888 8888 8888"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			mu.Lock()
			calls = nil
			mu.Unlock()

			msg := &Message{
				MessageID: 101,
				From: &User{
					ID:           99887766, // arbitrary non-owner ad account!
					FirstName:    "AdAccount",
					LanguageCode: "fa",
				},
				Chat: &Chat{
					ID:   99887766,
					Type: "private",
				},
				Text: tc.text,
			}

			h.handleRegularMessageUpdate(ctx, bot, msg, false)

			mu.Lock()
			captured := append([]capturedCall(nil), calls...)
			mu.Unlock()

			var albumCall *capturedCall
			for i := range captured {
				if captured[i].Method == "sendMediaGroup" && len(captured[i].Photo1Bytes) > 0 && len(captured[i].Photo2Bytes) > 0 {
					albumCall = &captured[i]
					break
				}
				// Ensure the precheck gate text was NEVER sent!
				if strings.Contains(captured[i].Text, "تحلیل اولیه") || strings.Contains(captured[i].Text, "unlock:") {
					t.Fatalf("unexpected pre-check gate message sent for %q: %s", tc.text, captured[i].Text)
				}
			}

			if albumCall == nil {
				t.Fatalf("expected sendMediaGroup with 2 photos for %q, got calls: %+v", tc.text, captured)
			}
			img, err := png.Decode(bytes.NewReader(albumCall.Photo1Bytes))
			if err != nil {
				t.Fatalf("sent photo1 bytes are not valid PNG: %v", err)
			}
			if img.Bounds().Dx() != 1080 || img.Bounds().Dy() != 1080 {
				t.Fatalf("expected 1080x1080 PNG for photo1, got %dx%d", img.Bounds().Dx(), img.Bounds().Dy())
			}
			if len(albumCall.Photo2Bytes) != len(premiumWhalesProofPNG) || len(albumCall.Photo2Bytes) == 0 {
				t.Fatalf("expected photo2 to match embedded whales proof image (%d bytes), got %d bytes", len(premiumWhalesProofPNG), len(albumCall.Photo2Bytes))
			}
			if albumCall.Caption == "" {
				t.Errorf("expected non-empty album caption")
			}
		})
	}

	// Empty and invalid /premium commands should return helpful guidance without paywall
	for _, tc := range []struct {
		name string
		text string
	}{
		{"EmptyArg", "/premium"},
		{"InvalidArg", "/premium invalid_target_!!!"},
		{"UnknownGift", "/premium https://t.me/nft/DoesNotExistCollection-1"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mu.Lock()
			calls = nil
			mu.Unlock()

			msg := &Message{
				MessageID: 102,
				From: &User{
					ID:           99887766,
					FirstName:    "AdAccount",
					LanguageCode: "fa",
				},
				Chat: &Chat{
					ID:   99887766,
					Type: "private",
				},
				Text: tc.text,
			}

			h.handleRegularMessageUpdate(ctx, bot, msg, false)

			mu.Lock()
			captured := append([]capturedCall(nil), calls...)
			mu.Unlock()

			if len(captured) == 0 {
				t.Fatalf("expected error/usage reply for %q", tc.text)
			}
			for _, c := range captured {
				if strings.Contains(c.Text, "unlock:") || strings.Contains(c.Text, "تحلیل اولیه") {
					t.Fatalf("unexpected pre-check gate message for %q: %s", tc.text, c.Text)
				}
			}
		})
	}
}
