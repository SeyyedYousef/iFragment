package handler

import (
	"strings"
	"testing"
	"time"

	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/traits"
	"ifragment-backend/internal/service/numbers/nvengine"
	"ifragment-backend/internal/service/numbers/registry"
	"ifragment-backend/internal/service/username/avm"

	"github.com/shopspring/decimal"
)

func TestBuildUsernameRichHTML(t *testing.T) {
	res := &avm.ValuationResult{
		Username:           "durov",
		InvestmentGrade:    "AAA",
		Brandability:       92,
		LowTON:             decimal.NewFromFloat(120.0),
		ExpectedTON:        decimal.NewFromFloat(245.3),
		HighTON:            decimal.NewFromFloat(380.5),
		ExpectedUSD:        decimal.NewFromFloat(612),
		Length:             5,
		LiquidityRating:    "بسیار بالا (A+)",
		EstimatedSellTime:  "۱ الی ۳ روز",
		TargetBuyerProfile: "شرکتی / برندینگ",
		ComparableSales:    18,
		ConfidenceScore:    87,
	}

	html := buildUsernameRichHTML("durov", res)

	// Check for Bot API 10.1+ Rich Message elements
	expectedTags := []string{
		"<h1>🏷️ کارشناسی تحلیلی: @durov</h1>",
		"<table>",
		"<tr><td><b>📉 کف ارزش</b></td><td><code>120.0 TON</code></td></tr>",
		"<tr><td><b>💰 میانگین منصفانه</b></td><td><code>245.3 TON</code></td></tr>",
		"<tr><td><b>📈 سقف ارزش</b></td><td><code>380.5 TON</code></td></tr>",
		"<details>",
		"<summary>🧬 تحلیل ساختاری و بازار عمیق</summary>",
		"طول شناسه",
		"5 کاراکتر",
		"18 فروش ثبت‌شده",
		"<blockquote>⚡ موتور هوشمند AVM v7.0",
	}

	for _, tag := range expectedTags {
		if !strings.Contains(html, tag) {
			t.Errorf("expected html to contain %q, but it didn't.\nHTML:\n%s", tag, html)
		}
	}
}

func TestBuildUsernameMarkup(t *testing.T) {
	markup := buildUsernameMarkup("durov", "https://t.me/iFragmentBot/iFragment?startapp=val_durov", "📋 summary text")

	kb, ok := markup["inline_keyboard"].([][]map[string]interface{})
	if !ok {
		t.Fatalf("expected inline_keyboard to be [][]map[string]interface{}, got: %T", markup["inline_keyboard"])
	}

	if len(kb) < 3 {
		t.Fatalf("expected at least 3 rows in keyboard, got: %d", len(kb))
	}

	// Verify copy_text button exists
	var foundCopyText bool
	for _, row := range kb {
		for _, btn := range row {
			if copyObj, hasCopy := btn["copy_text"].(map[string]string); hasCopy {
				if copyObj["text"] == "📋 summary text" {
					foundCopyText = true
				}
			}
		}
	}
	if !foundCopyText {
		t.Errorf("expected copy_text button with summary text, none found in %v", kb)
	}
}

func TestBuildNumberRichHTML(t *testing.T) {
	val := &nvengine.NumberValuation{
		DisplayNumber:      "+888 0000 1234",
		CategoryClubFa:     "۴ رقمی رند جنسیس",
		GlobalRank:         42,
		ConfidenceScore:    91,
		ExpectedTON:        decimal.NewFromFloat(85.2),
		ExpectedUSD:        213,
		LowTON:             decimal.NewFromFloat(62.0),
		HighTON:            decimal.NewFromFloat(120.0),
		HighUSD:            300,
		BasePriceTON:       decimal.NewFromFloat(70.0),
		CollateralValueTON: 45.0,
		CollateralValueUSD: 112.5,
		Color: registry.ColorInfo{
			Name: "Royal Blue",
		},
		PriceBasis: "direct_sales_of_this_number",
	}

	html := buildNumberRichHTML(val)

	expectedTags := []string{
		"<h1>📱 کارشناسی تحلیلی شماره: +888 0000 1234</h1>",
		"۴ رقمی رند جنسیس",
		"#42 از ۱۳۶,۵۶۶",
		"<table>",
		"<tr><td><b>💧 کف نقدشوندگی</b></td><td><code>62.0 TON</code></td></tr>",
		"<tr><td><b>💰 قیمت منصفانه (Fair)</b></td><td><code>85.2 TON (~$213)</code></td></tr>",
		"<tr><td><b>🏦 ارزش وثیقه DeFi</b></td><td><code>45.0 TON (~$112)</code></td></tr>",
		"<details>",
		"<summary>🎨 آناتومی الگو و تحلیل عمیق</summary>",
		"Royal Blue",
		"<blockquote>⚡ موتور هوشمند NV Engine v3.0",
	}

	for _, tag := range expectedTags {
		if !strings.Contains(html, tag) {
			t.Errorf("expected html to contain %q, but it didn't.\nHTML:\n%s", tag, html)
		}
	}
}

func TestBuildGiftRichHTML(t *testing.T) {
	val := &gvengine.GiftValuation{
		GiftID:       "plush_pepe-42",
		ModelID:      "plush_pepe",
		ModelName:    "Plush Pepe",
		DisplayTitle: "Plush Pepe #42",
		SerialNumber: 42,
		OwnerName:    "UQOwnerWallet123",
		ExpectedUSD:  375.0,
		Pillars: gvengine.ValuationPillars{
			FairValueGRAM:        150.2,
			ObservedFloorGRAM:    120.0,
			LiquidationValueGRAM: 100.0,
			SuggestedAskGRAM:     180.0,
		},
		JointRarity: traits.JointRarityAnalysis{
			RarityClass:   "Legendary",
			DescriptionFa: "اسطوره‌ای (Legendary)",
		},
		TraitDNA: []gvengine.TraitDNABar{
			{
				LabelFa:    "مدل سه‌بعدی",
				Value:      "Plush Pepe",
				Percentile: 2.3,
			},
			{
				LabelFa:    "نماد پترن",
				Value:      "Golden Star",
				Percentile: 1.1,
			},
		},
		EvaluatedAt: time.Now(),
	}

	html := buildGiftRichHTML(val)

	expectedTags := []string{
		"<h1>🎁 کارشناسی گیفت: Plush Pepe #42</h1>",
		"اسطوره‌ای (Legendary)",
		"150.20 TON",
		"UQOwnerWallet123",
		"<table>",
		"120.00 TON",
		"180.00 TON",
		"<details>",
		"<summary>🧬 ویژگی‌های ژنتیکی و کمیابی (Trait DNA)</summary>",
		"مدل سه‌بعدی",
		"Golden Star",
		"دو رقمی (Double Digit)",
		"<blockquote>⚡ موتور هوشمند GV Engine v2.0",
	}

	for _, tag := range expectedTags {
		if !strings.Contains(html, tag) {
			t.Errorf("expected html to contain %q, but it didn't.\nHTML:\n%s", tag, html)
		}
	}
}

func TestBuildCopySummary(t *testing.T) {
	summary := buildCopySummary("🏷️", "@durov", "245.3", "612", "درجه: AAA")
	if !strings.Contains(summary, "@durov") || !strings.Contains(summary, "245.3 TON") || !strings.Contains(summary, "@iFragmentBot") {
		t.Errorf("unexpected copy summary: %s", summary)
	}
}
