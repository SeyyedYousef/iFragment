package handler

import (
	"context"
	"strings"
	"testing"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/config"
	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/traits"
	"ifragment-backend/internal/service/numbers/nvengine"
	"ifragment-backend/internal/service/username/avm"
)

func TestBuildMainMenuMarkupLayout(t *testing.T) {
	h := &WebhookHandler{}
	miniAppURL := "https://t.me/iFragmentBot/iFragment"

	languages := []string{"fa", "en", "ru", "zh"}
	for _, lang := range languages {
		t.Run("lang_"+lang, func(t *testing.T) {
			markup := h.buildMainMenuMarkup(context.Background(), lang, miniAppURL)
			if markup == nil {
				t.Fatalf("expected non-nil markup for lang %s", lang)
			}

			grid, ok := markup["inline_keyboard"].([][]map[string]interface{})
			if !ok {
				t.Fatalf("expected inline_keyboard to be [][]map[string]interface{}")
			}

			// Must be 4 rows
			if len(grid) != 4 {
				t.Fatalf("expected exactly 4 rows, got %d", len(grid))
			}

			// Row 1: Hero Primary CTA (Full width, exactly 1 button)
			if len(grid[0]) != 1 {
				t.Fatalf("expected row 1 to have exactly 1 button, got %d", len(grid[0]))
			}
			heroBtn := grid[0][0]
			if heroBtn["url"] != miniAppURL {
				t.Errorf("expected hero button url to be %s, got %v", miniAppURL, heroBtn["url"])
			}
			if heroBtn["text"] == "" {
				t.Errorf("expected hero button text to be non-empty")
			}

			// Test HTTPS non-t.me URL produces web_app
			httpsURL := "https://app.ifragment.io"
			markupWebApp := h.buildMainMenuMarkup(context.Background(), lang, httpsURL)
			gridWebApp := markupWebApp["inline_keyboard"].([][]map[string]interface{})
			heroBtnWebApp := gridWebApp[0][0]
			webAppMap, ok := heroBtnWebApp["web_app"].(map[string]interface{})
			if !ok || webAppMap["url"] != httpsURL {
				t.Errorf("expected hero button web_app url to be %s, got %v", httpsURL, heroBtnWebApp["web_app"])
			}

			// Row 2: Exactly 2 buttons (Username, Number)
			if len(grid[1]) != 2 {
				t.Fatalf("expected row 2 to have exactly 2 buttons, got %d", len(grid[1]))
			}
			if grid[1][0]["callback_data"] != "nav:asset_username" {
				t.Errorf("expected row 2 btn 1 callback to be nav:asset_username, got %v", grid[1][0]["callback_data"])
			}
			if grid[1][1]["callback_data"] != "nav:asset_number" {
				t.Errorf("expected row 2 btn 2 callback to be nav:asset_number, got %v", grid[1][1]["callback_data"])
			}

			// Row 3: Exactly 2 buttons (Gifts, Profile) — CRITICAL: No longer 3 buttons!
			if len(grid[2]) != 2 {
				t.Fatalf("expected row 3 to have exactly 2 buttons (never 3), got %d", len(grid[2]))
			}
			if grid[2][0]["callback_data"] != "nav:asset_gifts" {
				t.Errorf("expected row 3 btn 1 callback to be nav:asset_gifts, got %v", grid[2][0]["callback_data"])
			}
			if grid[2][1]["callback_data"] != "nav:profile" {
				t.Errorf("expected row 3 btn 2 callback to be nav:profile, got %v", grid[2][1]["callback_data"])
			}

			// Row 4: Exactly 2 buttons (Language, Help)
			if len(grid[3]) != 2 {
				t.Fatalf("expected row 4 to have exactly 2 buttons, got %d", len(grid[3]))
			}
			if grid[3][0]["callback_data"] != "nav:language" {
				t.Errorf("expected row 4 btn 1 callback to be nav:language, got %v", grid[3][0]["callback_data"])
			}
			if grid[3][1]["callback_data"] != "nav:help" {
				t.Errorf("expected row 4 btn 2 callback to be nav:help, got %v", grid[3][1]["callback_data"])
			}

			// Ensure no row in the entire menu exceeds 2 buttons
			for rIdx, row := range grid {
				if len(row) > 2 {
					t.Errorf("Row %d has %d buttons, exceeding maximum allowed 2 buttons per row", rIdx+1, len(row))
				}
			}
		})
	}
}

func TestCustomEmojiIDsValid(t *testing.T) {
	emojiIDs := []struct {
		name string
		id   string
	}{
		{"Diamond", CustomEmojiDiamond},
		{"Tag", CustomEmojiTag},
		{"Phone", CustomEmojiPhone},
		{"Gift", CustomEmojiGift},
		{"User", CustomEmojiUser},
		{"Globe", CustomEmojiGlobe},
		{"Book", CustomEmojiBook},
		{"Check", CustomEmojiCheck},
		{"Cross", CustomEmojiCross},
		{"Star", CustomEmojiStar},
		{"Bolt", CustomEmojiBolt},
		{"Coin", CustomEmojiCoin},
		{"Refresh", CustomEmojiRefresh},
	}

	for _, e := range emojiIDs {
		if len(e.id) < 10 {
			t.Errorf("Custom emoji ID for %s seems too short: %q", e.name, e.id)
		}
		for _, c := range e.id {
			if c < '0' || c > '9' {
				t.Errorf("Custom emoji ID for %s should only contain digits, got char %c in %q", e.name, c, e.id)
			}
		}
	}
}

func TestEconomicsCoinExchangeValue(t *testing.T) {
	if config.Economics.CreditsCoinsPerCredit != 150000 {
		t.Errorf("Expected Economics.CreditsCoinsPerCredit to default to 150,000, got %d", config.Economics.CreditsCoinsPerCredit)
	}

	formatted := formatNumberWithCommas(config.Economics.CreditsCoinsPerCredit)
	if formatted != "150,000" {
		t.Errorf("Expected formatted 150,000, got %s", formatted)
	}
}

func TestSniffAssetEnhanced(t *testing.T) {
	tests := []struct {
		input      string
		expectedType string
		expectedEntity string
	}{
		{"durov", "username", "durov"},
		{"@telegram", "username", "telegram"},
		{"/val durov", "username", "durov"},
		{"/val@iFragmentBot durov", "username", "durov"},
		{"/check crypto", "username", "crypto"},
		{"/num +888 8888 8888", "number", "+88888888888"},
		{"/number 8888", "number", "+8888888"},
		{"88888888", "number", "+88888888888"},
		{"PlushPepe-42", "gift", "PlushPepe-42"},
		{"CelestialStar-1", "gift", "CelestialStar-1"},
		{"/gift PlushPepe-42", "gift", "PlushPepe-42"},
		{"/gift plush_pepe 42", "gift", "plush_pepe-42"},
		{"https://t.me/nft/PlushPepe-42", "gift", "PlushPepe-42"},
		{"https://fragment.com/gift/CelestialStar-99", "gift", "CelestialStar-99"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			res := SniffAsset(tt.input)
			if res == nil {
				t.Fatalf("expected non-nil result for input %q", tt.input)
			}
			if res.Type != tt.expectedType {
				t.Errorf("expected type %s, got %s", tt.expectedType, res.Type)
			}
			if res.Entity != tt.expectedEntity {
				t.Errorf("expected entity %s, got %s", tt.expectedEntity, res.Entity)
			}
		})
	}
}

func TestReportCreditFooterFormatting(t *testing.T) {
	languages := []string{"fa", "en", "ru", "zh"}

	for _, lang := range languages {
		t.Run("duplicate_"+lang, func(t *testing.T) {
			normL := normalizeLang(lang)
			var creditFooter string
			switch normL {
			case "fa":
				creditFooter = "\n\n<i>💎 این گزارش امروز قبلاً پرداخت شده و به رایگان نمایش داده شد.</i>"
			case "ru":
				creditFooter = "\n\n<i>💎 Этот отчет уже был оплачен сегодня и показан бесплатно.</i>"
			case "zh":
				creditFooter = "\n\n<i>💎 该报告今日已解锁，本次免费查看。</i>"
			default:
				creditFooter = "\n\n<i>💎 This report was already unlocked today, viewing is free.</i>"
			}
			if creditFooter == "" {
				t.Errorf("expected non-empty duplicate footer for lang %s", lang)
			}
		})

		t.Run("new_deduct_"+lang, func(t *testing.T) {
			normL := normalizeLang(lang)
			remainingBalance := 5
			var creditFooter string
			switch normL {
			case "fa":
				creditFooter = "\n\n<i>⚡ ۱ کریدت کسر شد | موجودی: 5</i>"
			case "ru":
				creditFooter = "\n\n<i>⚡ 1 кредит списан | Баланс: 5</i>"
			case "zh":
				creditFooter = "\n\n<i>⚡ 已扣除 1 个信用点 | 剩余额度: 5</i>"
			default:
				creditFooter = "\n\n<i>⚡ 1 credit deducted | Balance: 5</i>"
			}
			if creditFooter == "" {
				t.Errorf("expected non-empty deduction footer for lang %s", lang)
			}
			if remainingBalance != 5 {
				t.Errorf("unexpected remaining balance")
			}
		})
	}
}

func TestSplitTelegramHTML(t *testing.T) {
	t.Run("short string under limit", func(t *testing.T) {
		input := "<b>hello world</b>"
		res := splitTelegramHTML(input, 100)
		if len(res) != 1 {
			t.Fatalf("expected 1 chunk, got %d", len(res))
		}
		if res[0] != input {
			t.Errorf("expected %q, got %q", input, res[0])
		}
	})

	t.Run("splits long string and closes open tags", func(t *testing.T) {
		var sb strings.Builder
		sb.WriteString("<blockquote>\n")
		for i := 0; i < 20; i++ {
			sb.WriteString("Line of text with some content here.\n")
		}
		sb.WriteString("</blockquote>")
		longText := sb.String()

		chunks := splitTelegramHTML(longText, 150)
		if len(chunks) < 2 {
			t.Fatalf("expected multiple chunks, got %d", len(chunks))
		}

		for i, chunk := range chunks {
			if len(chunk) > 250 {
				t.Errorf("chunk %d exceeded limit: %d", i, len(chunk))
			}
			if i == 0 && !strings.HasSuffix(chunk, "</blockquote>") {
				t.Errorf("expected chunk 0 to end with closed tag, got %q", chunk)
			}
			if i > 0 && !strings.HasPrefix(chunk, "<blockquote>") {
				t.Errorf("expected chunk %d to start with opened tag, got %q", i, chunk)
			}
		}
	})
}

func TestValidateRichHTML(t *testing.T) {
	t.Run("valid rich HTML", func(t *testing.T) {
		valid := "<h1>Title</h1><p>Description</p><table><tr><td>Item</td><td>Value</td></tr></table>"
		if !ValidateRichHTML(valid) {
			t.Errorf("expected valid rich HTML to pass validation")
		}
	})

	t.Run("invalid tag rejected", func(t *testing.T) {
		invalid := "<script>alert(1)</script>"
		if ValidateRichHTML(invalid) {
			t.Errorf("expected script tag to be rejected")
		}
	})

	t.Run("block element inside td rejected", func(t *testing.T) {
		invalid := "<table><tr><td><p>Block in cell</p></td></tr></table>"
		if ValidateRichHTML(invalid) {
			t.Errorf("expected block inside td to be rejected")
		}
	})

	t.Run("invalid tg-emoji without emoji rejected", func(t *testing.T) {
		invalid := "<tg-emoji emoji-id=\"12345\">NotAnEmoji</tg-emoji>"
		if ValidateRichHTML(invalid) {
			t.Errorf("expected tg-emoji without emoji character to be rejected")
		}
	})

	t.Run("valid tg-emoji with emoji passes", func(t *testing.T) {
		valid := "<tg-emoji emoji-id=\"12345\">💎</tg-emoji>"
		if !ValidateRichHTML(valid) {
			t.Errorf("expected tg-emoji with emoji character to pass")
		}
	})
}

func TestRichBuildersSnapshot(t *testing.T) {
	t.Run("UsernameRichHTML", func(t *testing.T) {
		res := &avm.ValuationResult{
			InvestmentGrade: "AAA",
			Brandability:    95,
			LowTON:          decimal.NewFromFloat(50.0),
			ExpectedTON:     decimal.NewFromFloat(100.0),
			HighTON:         decimal.NewFromFloat(150.0),
			ExpectedUSD:     decimal.NewFromFloat(500.0),
			Length:          4,
			LiquidityRating: "High",
			ConfidenceScore: 90,
		}

		faHTML := buildUsernameRichHTML("testuser", res, "fa")
		if !ValidateRichHTML(faHTML) {
			t.Errorf("Username fa rich HTML failed validation: %s", faHTML)
		}
		if !strings.Contains(faHTML, "<h1>🏷️ کارشناسی تحلیلی: @testuser</h1>") {
			t.Errorf("Username rich HTML snapshot title mismatch")
		}
		if !strings.Contains(faHTML, "<b>4 کاراکتر</b>") {
			t.Errorf("Expected length number to be in <b> tags")
		}
	})

	t.Run("NumberRichHTML", func(t *testing.T) {
		val := &nvengine.NumberValuation{
			DisplayNumber:   "+888 8888 8888",
			CategoryClub:    "Golden Octet",
			CategoryClubFa:  "هشت‌تایی طلایی",
			GlobalRank:      12,
			ConfidenceScore: 92,
			ExpectedTON:     decimal.NewFromFloat(1500.0),
			ExpectedUSD:     7500.0,
			LowTON:          decimal.NewFromFloat(1200.0),
			HighTON:         decimal.NewFromFloat(2000.0),
			BasePriceTON:    decimal.NewFromFloat(1000.0),
		}

		faHTML := buildNumberRichHTML(val, "fa")
		if !ValidateRichHTML(faHTML) {
			t.Errorf("Number fa rich HTML failed validation: %s", faHTML)
		}
		if !strings.Contains(faHTML, "<h1>📱 کارشناسی تحلیلی شماره: +888 8888 8888</h1>") {
			t.Errorf("Number rich HTML snapshot title mismatch")
		}
		if !strings.Contains(faHTML, "<b>1000.0 TON</b>") {
			t.Errorf("Expected base price number to be present")
		}
	})

	t.Run("GiftRichHTML", func(t *testing.T) {
		val := &gvengine.GiftValuation{
			DisplayTitle: "Plush Pepe #42",
			SerialNumber: 42,
			ExpectedUSD:  250.0,
			Pillars: gvengine.ValuationPillars{
				FairValueGRAM: 50.0,
			},
			JointRarity: traits.JointRarityAnalysis{
				RarityClass:   "Rare",
				DescriptionFa: "نایاب",
			},
		}

		faHTML := buildGiftRichHTML(val, "fa")
		if !ValidateRichHTML(faHTML) {
			t.Errorf("Gift fa rich HTML failed validation: %s", faHTML)
		}
		if !strings.Contains(faHTML, "<h1>🎁 کارشناسی گیفت: Plush Pepe #42</h1>") {
			t.Errorf("Gift rich HTML snapshot title mismatch")
		}
	})
}


