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

func TestBuildUsernameRichHTML_AllLanguages(t *testing.T) {
	res := &avm.ValuationResult{
		Username:           "durov",
		InvestmentGrade:    "AAA",
		Brandability:       92,
		LowTON:             decimal.NewFromFloat(120.0),
		ExpectedTON:        decimal.NewFromFloat(245.3),
		HighTON:            decimal.NewFromFloat(380.5),
		ExpectedUSD:        decimal.NewFromFloat(612),
		Length:             5,
		LiquidityRating:    "High (A+)",
		EstimatedSellTime:  "1-3 days",
		TargetBuyerProfile: "Corporate / Brand",
		ComparableSales:    18,
		ConfidenceScore:    87,
	}

	tests := []struct {
		lang         string
		expectedTags []string
	}{
		{
			lang: "fa",
			expectedTags: []string{
				"<h1>🏷️ کارشناسی تحلیلی: @durov</h1>",
				"درجه سرمایه‌گذاری: <b>AAA</b>",
				"📉 کف ارزش",
				"💰 میانگین منصفانه",
				"🧬 تحلیل ساختاری و بازار عمیق",
				"موتور هوشمند AVM v7.0",
			},
		},
		{
			lang: "en",
			expectedTags: []string{
				"<h1>🏷️ Valuation Report: @durov</h1>",
				"Investment Grade: <b>AAA</b>",
				"📉 Floor Value",
				"💰 Fair Average",
				"🧬 Deep Market & Structural Anatomy",
				"AVM v7.0 Valuation Engine",
			},
		},
		{
			lang: "ru",
			expectedTags: []string{
				"<h1>🏷️ Аналитическая оценка: @%s</h1>",
				"Инвестиционный грейд: <b>AAA</b>",
				"📉 Нижняя граница",
				"💰 Справедливая цена",
				"🧬 Структурный и рыночный анализ",
			},
		},
		{
			lang: "zh",
			expectedTags: []string{
				"<h1>🏷️ 分析估值报告: @durov</h1>",
				"投资评级: <b>AAA</b>",
				"📉 底价估值",
				"💰 公允均价",
				"🧬 深度市场与结构解构",
			},
		},
	}

	for _, tt := range tests {
		t.Run("lang_"+tt.lang, func(t *testing.T) {
			html := buildUsernameRichHTML("durov", res, tt.lang)
			for _, tag := range tt.expectedTags {
				if strings.Contains(tag, "%s") {
					tag = strings.ReplaceAll(tag, "%s", "durov")
				}
				if !strings.Contains(html, tag) {
					t.Errorf("[%s] expected html to contain %q, but it didn't.\nHTML:\n%s", tt.lang, tag, html)
				}
			}
		})
	}
}

func TestBuildUsernameMarkup_AllLanguages(t *testing.T) {
	langs := []struct {
		code       string
		btnMiniApp string
		btnCopy    string
	}{
		{"fa", "📊 مشاهده تحلیل جامع در مینی‌اپ", "📋 کپی خلاصه تحلیل"},
		{"en", "📊 View Full Analysis in Mini App", "📋 Copy Summary"},
		{"ru", "📊 Открыть анализ в Mini App", "📋 Копировать отчёт"},
		{"zh", "📊 在小程序中查看完整分析", "📋 复制评估摘要"},
	}

	for _, l := range langs {
		t.Run("lang_"+l.code, func(t *testing.T) {
			markup := buildUsernameMarkup("durov", "https://t.me/iFragmentBot/iFragment?startapp=val_durov", "summary", l.code)
			kb, ok := markup["inline_keyboard"].([][]map[string]interface{})
			if !ok || len(kb) < 3 {
				t.Fatalf("[%s] expected at least 3 rows in keyboard", l.code)
			}
			if kb[0][0]["text"] != l.btnMiniApp {
				t.Errorf("[%s] expected mini app button %q, got %q", l.code, l.btnMiniApp, kb[0][0]["text"])
			}
			if kb[1][1]["text"] != l.btnCopy {
				t.Errorf("[%s] expected copy button %q, got %q", l.code, l.btnCopy, kb[1][1]["text"])
			}
		})
	}
}

func TestBuildNumberRichHTML_AllLanguages(t *testing.T) {
	val := &nvengine.NumberValuation{
		DisplayNumber:      "+888 0000 1234",
		CategoryClub:       "4-Digit Genesis",
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
		PriceBasis: "direct_sales",
	}

	tests := []struct {
		lang string
		key  string
	}{
		{"fa", "📱 کارشناسی تحلیلی شماره: +888 0000 1234"},
		{"en", "📱 Number Valuation Report: +888 0000 1234"},
		{"ru", "📱 Аналитическая оценка номера: +888 0000 1234"},
		{"zh", "📱 匿名号码估值报告: +888 0000 1234"},
	}

	for _, tt := range tests {
		t.Run("lang_"+tt.lang, func(t *testing.T) {
			html := buildNumberRichHTML(val, tt.lang)
			if !strings.Contains(html, tt.key) {
				t.Errorf("[%s] expected html to contain %q, but it didn't", tt.lang, tt.key)
			}
		})
	}
}

func TestBuildGiftRichHTML_AllLanguages(t *testing.T) {
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
				LabelEn:    "3D Model",
				LabelFa:    "مدل سه‌بعدی",
				Value:      "Plush Pepe",
				Percentile: 2.3,
			},
		},
		EvaluatedAt: time.Now(),
	}

	tests := []struct {
		lang string
		key  string
	}{
		{"fa", "🎁 کارشناسی گیفت: Plush Pepe #42"},
		{"en", "🎁 Gift Valuation Report: Plush Pepe #42"},
		{"ru", "🎁 Оценка подарка: Plush Pepe #42"},
		{"zh", "🎁 礼物估值报告: Plush Pepe #42"},
	}

	for _, tt := range tests {
		t.Run("lang_"+tt.lang, func(t *testing.T) {
			html := buildGiftRichHTML(val, tt.lang)
			if !strings.Contains(html, tt.key) {
				t.Errorf("[%s] expected html to contain %q, but it didn't", tt.lang, tt.key)
			}
		})
	}
}

func TestBuildCopySummary_AllLanguages(t *testing.T) {
	langs := []struct {
		code string
		val  string
	}{
		{"fa", "ارزش منصفانه: ~245.3 TON"},
		{"en", "Fair Value: ~245.3 TON"},
		{"ru", "Справедливая цена: ~245.3 TON"},
		{"zh", "公允价值: ~245.3 TON"},
	}

	for _, l := range langs {
		t.Run("lang_"+l.code, func(t *testing.T) {
			summary := buildCopySummary("🏷️", "@durov", "245.3", "612", "", l.code)
			if !strings.Contains(summary, l.val) {
				t.Errorf("[%s] expected summary to contain %q, got: %s", l.code, l.val, summary)
			}
		})
	}
}

func TestBuildUsernameStandardHTML_RichExpandableBlocks(t *testing.T) {
	res := &avm.ValuationResult{
		Username:        "durov",
		InvestmentGrade: "AAA",
		Brandability:    92,
		LowTON:          decimal.NewFromFloat(120.0),
		ExpectedTON:     decimal.NewFromFloat(245.3),
		HighTON:         decimal.NewFromFloat(380.5),
		ExpectedUSD:     decimal.NewFromFloat(612),
		Length:          5,
		Structure: avm.ValuationStructure{
			LettersOnly: true,
		},
		Dictionary: avm.DictionaryData{
			IsWord:     true,
			Definition: "Telegram founder and visionary",
		},
		LiquidityRating:   "High (A+)",
		EstimatedSellTime: "1-3 days",
		TelemintProvenance: &avm.TelemintProvenanceDto{
			ItemAddress: "EQD1234567890abcdef",
		},
		ConfidenceScore: 92,
		CertificateID:   "CERT-AVM-2026-TEST",
	}

	htmlFa := buildUsernameStandardHTML("durov", res, "fa")
	requiredFa := []string{
		"🏷️ <b>کارشناسی تحلیلی نام کاربری: @durov</b>",
		"<blockquote expandable>",
		"ماتریس ارزش‌گذاری و طیف قیمت:",
		"محاسبات مالی معامله و درآمد اجاره:",
		"آناتومی ساختاری و تحلیل لغوی:",
		"ریسک حقوقی، امنیت و جو بازار:",
		"اصالت هوشمند و پیش‌بینی ۱۲ ماهه:",
		"CERT-AVM-2026-TEST",
	}
	for _, req := range requiredFa {
		if !strings.Contains(htmlFa, req) {
			t.Errorf("[fa] expected standard HTML to contain %q, but it didn't.\nGot:\n%s", req, htmlFa)
		}
	}

	htmlEn := buildUsernameStandardHTML("durov", res, "en")
	requiredEn := []string{
		"🏷️ <b>Valuation Report: @durov</b>",
		"<blockquote expandable>",
		"Price Spectrum & Valuation Matrix:",
		"Transaction Economics & Yield:",
		"Structural & Linguistic Anatomy:",
		"Legal TOS, Risk & Market Sentiment:",
		"On-Chain Provenance & Projections:",
	}
	for _, req := range requiredEn {
		if !strings.Contains(htmlEn, req) {
			t.Errorf("[en] expected standard HTML to contain %q, but it didn't.\nGot:\n%s", req, htmlEn)
		}
	}
}

func TestBuildNumberStandardHTML_RichExpandableBlocks(t *testing.T) {
	val := &nvengine.NumberValuation{
		DisplayNumber:      "+888 0000 1234",
		CategoryClub:       "4-Digit Genesis",
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
		PriceBasis:    "direct_sales",
		CertificateID: "NV-CERT-2026-TEST",
	}

	htmlFa := buildNumberStandardHTML(val, "+888 0000 1234", "fa")
	requiredFa := []string{
		"📱 <b>کارشناسی تحلیلی شماره: +888 0000 1234</b>",
		"<blockquote expandable>",
		"ماتریس ۴ سطحی قیمت و نقدشوندگی:",
		"امور مالی دیفای و بازده اجاره:",
		"آناتومی الگو، تقارن و رادار فرهنگی:",
		"محاسبات مالی معامله و اصالت هوشمند:",
		"پیش‌بینی ۱۲ ماهه و توصیه عملیاتی:",
		"NV-CERT-2026-TEST",
	}
	for _, req := range requiredFa {
		if !strings.Contains(htmlFa, req) {
			t.Errorf("[fa] expected number standard HTML to contain %q, but it didn't.\nGot:\n%s", req, htmlFa)
		}
	}
}

func TestBuildGiftStandardHTML_RichExpandableBlocks(t *testing.T) {
	val := &gvengine.GiftValuation{
		DisplayTitle: "Plush Pepe #42",
		SerialNumber: 42,
		OwnerName:    "SeyyedYousef",
		ExpectedUSD:  375.0,
		Pillars: gvengine.ValuationPillars{
			FairValueGRAM:        150.2,
			ObservedFloorGRAM:    120.0,
			LiquidationValueGRAM: 100.0,
			SuggestedAskGRAM:     180.0,
		},
		JointRarity: traits.JointRarityAnalysis{
			RarityClass:   "Legendary",
			DescriptionFa: "افسانه‌ای (Legendary)",
		},
		TraitDNA: []gvengine.TraitDNABar{
			{
				LabelEn:    "3D Model",
				LabelFa:    "مدل سه‌بعدی",
				Value:      "Plush Pepe",
				Percentile: 2.3,
				RarityTier: "افسانه‌ای",
			},
		},
		CertificateID: "GV-CERT-2026-TEST",
	}

	htmlFa := buildGiftStandardHTML(val, "fa")
	requiredFa := []string{
		"🎁 <b>کارشناسی تحلیلی گیفت: Plush Pepe #42</b>",
		"<blockquote expandable>",
		"۴ ستون ارزش‌گذاری مستقل (4-Pillars):",
		"ویژگی‌های ژنتیکی و دی‌ان‌ای گیفت (Trait DNA):",
		"گرانش سریال و پرستیژ پروفایل:",
		"محاسبات مالی معامله و خالص دریافتی:",
		"اصالت آن‌چین، مشاوره و پیش‌بینی:",
		"GV-CERT-2026-TEST",
	}
	for _, req := range requiredFa {
		if !strings.Contains(htmlFa, req) {
			t.Errorf("[fa] expected gift standard HTML to contain %q, but it didn't.\nGot:\n%s", req, htmlFa)
		}
	}
}

