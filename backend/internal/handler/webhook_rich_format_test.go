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
				"🧬 آناتومی ساختاری، سئو و کمیابی",
				"AVM v7.0 Valuation Engine",
			},
		},
		{
			lang: "en",
			expectedTags: []string{
				"<h1>🏷️ Valuation Report: @durov</h1>",
				"Investment Grade: <b>AAA</b>",
				"📉 Floor Value",
				"💰 Fair Average",
				"🧬 Structural Anatomy, SEO & Rarity",
				"AVM v7.0 Valuation Engine",
			},
		},
		{
			lang: "ru",
			expectedTags: []string{
				"<h1>🏷️ Аналитическая оценка: @durov</h1>",
				"Инвестиционный грейд: <b>AAA</b>",
				"📉 Нижняя граница",
				"💰 Справедливая цена",
				"🧬 Структурный анализ, SEO и редкость",
			},
		},
		{
			lang: "zh",
			expectedTags: []string{
				"<h1>🏷️ 估值深度报告: @durov</h1>",
				"投资评级: <b>AAA</b>",
				"📉 底价估值",
				"💰 公允均价",
				"🧬 结构属性、SEO 与稀缺度",
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
		"وضعیت بازار و طیف قیمت:",
		"محاسبات مالی، استراتژی و اجاره:",
		"ساختار، مالکیت و اصالت هوشمند:",
		"ریسک حقوقی، امنیت و شفافیت مدل:",
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
		"Market Status & Price Spectrum:",
		"Transaction Economics, Strategy & Yield:",
		"Structure, Provenance & Ownership:",
		"Legal TOS, Risk & Model Transparency:",
		"CERT-AVM-2026-TEST",
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
		"اصالت آن‌چین و ممیزی ریسک (Risk Audit):",
		"GV-CERT-2026-TEST",
	}
	for _, req := range requiredFa {
		if !strings.Contains(htmlFa, req) {
			t.Errorf("[fa] expected gift standard HTML to contain %q, but it didn't.\nGot:\n%s", req, htmlFa)
		}
	}
}

func TestUsernameFormatters_NilSafetyAndFullCoverage(t *testing.T) {
	langs := []string{"fa", "en", "ru", "zh", "ar"}

	t.Run("nil result safety", func(t *testing.T) {
		for _, l := range langs {
			// Must not panic
			rich := buildUsernameRichHTML("testuser", nil, l)
			if !strings.Contains(rich, "testuser") {
				t.Errorf("[%s] rich html for nil res should contain username", l)
			}
			std := buildUsernameStandardHTML("testuser", nil, l)
			if !strings.Contains(std, "testuser") {
				t.Errorf("[%s] standard html for nil res should contain username", l)
			}
		}
	})

	t.Run("empty struct safety (no certificate, no rent)", func(t *testing.T) {
		emptyRes := &avm.ValuationResult{
			Username: "emptyval",
		}
		for _, l := range langs {
			rich := buildUsernameRichHTML("emptyval", emptyRes, l)
			std := buildUsernameStandardHTML("emptyval", emptyRes, l)

			// Certificate should NOT be rendered when CertificateID == ""
			if strings.Contains(rich, "CERT-") || strings.Contains(std, "CERT-") {
				t.Errorf("[%s] certificate should not be rendered when CertificateID is empty", l)
			}
			// Rent should not be rendered when RentYield is nil
			if strings.Contains(rich, "APY") || strings.Contains(std, "APY") {
				t.Errorf("[%s] APY/Rent should not be rendered when RentYield is nil", l)
			}
		}
	})

	t.Run("fully populated fields across all languages", func(t *testing.T) {
		now := time.Now()
		fullRes := &avm.ValuationResult{
			Username:        "premium",
			InvestmentGrade: "AAA",
			QualityGrade:    "A+",
			Brandability:    98,
			ExpectedTON:     decimal.NewFromFloat(500.0),
			ExpectedUSD:     decimal.NewFromFloat(1500.0),
			LowTON:          decimal.NewFromFloat(400.0),
			LowUSD:          decimal.NewFromFloat(1200.0),
			HighTON:         decimal.NewFromFloat(650.0),
			HighUSD:         decimal.NewFromFloat(1950.0),
			TONUSDRate:      3.0,
			LiveMarket: &avm.LiveMarketDto{
				Status:        "auction",
				CurrentBidTON: 420.0,
				BuyNowTON:     600.0,
				AuctionEndsAt: now.Add(24 * time.Hour).Format(time.RFC3339),
			},
			FragmentMarketStatus: "active_auction",
			TelegramStatus:       "taken",
			Comparables: []avm.ComparableSaleDto{
				{Username: "alpha", Price: 480.0, Date: "2026-08-15"},
				{Username: "beta", Price: 450.0, Date: "2026-08-10"},
			},
			PriceTrend: []avm.PriceTrendDto{
				{Label: "3M", Value: 25.0},
			},
			ProjectedGrowth: avm.ProjectedGrowthDto{
				BullTON: 750.0,
				BaseTON: 550.0,
				BearTON: 380.0,
			},
			OwnerProfile: &avm.OwnerProfileDto{
				FirstName: "Pavel",
				LastName:  "Durov",
			},
			WalletInfo: &avm.WalletInfoDto{
				Balance:  12500.0,
				NFTCount: 14,
			},
			TelemintProvenance: &avm.TelemintProvenanceDto{
				ItemAddress: "EQDTelemint1234567890",
				IsAuthentic: true,
			},
			Portfolio: &avm.PortfolioDto{
				TotalCount:       8,
				TotalEstValueTON: 3200.0,
			},
			AuctionPlaybook: &avm.AuctionPlaybookDto{
				StartPriceTON: 350.0,
				BidStepTON:    10.0,
				BestDay:       "Thursday",
				BestHourUTC:   "18:00",
			},
			TransactionEconomics: &avm.TransactionEconomicsDto{
				FragmentFeePct: 5.0,
				FragmentFeeTON: 25.0,
				NetPayoutTON:   475.0,
			},
			NetSellerProceedsTON: decimal.NewFromFloat(475.0),
			RentYield: &avm.RentYieldDto{
				MonthlyMedianTON: 22.5,
				RentFloorTON:     15.0,
			},
			TrademarkRisk: avm.TrademarkRiskDto{
				RiskLevel: "LOW",
				Brand:     "None",
			},
			PhishingThreat: &avm.PhishingThreatDto{
				HasThreat: false,
			},
			HomoglyphTwins: []avm.HomoglyphTwinDto{
				{Twin: "prеmium", RiskLevel: "high"},
			},
			FearGreedIndex: 65,
			FearGreedLabel: "Greed",
			Length:         7,
			Rarity: avm.ValuationRarity{
				Tier:  "Rare",
				Stars: "⭐⭐⭐",
			},
			Tags: []string{"web3", "crypto", "defi"},
			Dictionary: avm.DictionaryData{
				IsWord:     true,
				Definition: "High grade or value",
			},
			WikipediaSummary: "Premium concepts in finance and economics.",
			SEO: avm.ValuationSEO{
				Score:   90,
				Verdict: "High",
			},
			SearchTrend: &avm.SearchTrendDto{
				Status: "Rising",
			},
			Similar: []avm.ValuationSimilar{
				{Username: "premiums", SalePrice: 320.0},
			},
			ConfidenceScore: 94,
			ModelAccuracy: &avm.ModelAccuracyDto{
				MedianErrorPct: 4.8,
				WithinBandPct:  92.5,
			},
			BandMethod:           "Empirical Comps Regression",
			DataFreshness:        now.Add(-2 * time.Hour),
			IsFallbackUsed:       false,
			CertificateID:        "CERT-VAL-2026-9999",
			CertificateSignature: "hmac-valid-signature",
		}

		for _, l := range langs {
			rich := buildUsernameRichHTML("premium", fullRes, l)
			std := buildUsernameStandardHTML("premium", fullRes, l)

			// Check rich has details
			if !strings.Contains(rich, "<details>") {
				t.Errorf("[%s] rich html should contain <details>", l)
			}
			// Check standard has blockquote expandable
			if !strings.Contains(std, "<blockquote expandable>") {
				t.Errorf("[%s] standard html should contain <blockquote expandable>", l)
			}
			// Check CertificateID rendered in both
			if !strings.Contains(rich, "CERT-VAL-2026-9999") || !strings.Contains(std, "CERT-VAL-2026-9999") {
				t.Errorf("[%s] expected CertificateID in report", l)
			}
			// Check Rent is rendered when present
			if !strings.Contains(rich, "22.5") || !strings.Contains(std, "22.5") {
				t.Errorf("[%s] expected monthly rent yield in report", l)
			}
		}
	})

	t.Run("NumberValuation_AllEngineFields", func(t *testing.T) {
		val := &nvengine.NumberValuation{
			DisplayNumber:      "+888 7777 8888",
			CategoryClub:       "Octet Prime",
			CategoryClubFa:     "اکتت طلایی",
			GlobalRank:         15,
			ConfidenceScore:    96,
			ExpectedTON:        decimal.NewFromFloat(1250.0),
			ExpectedUSD:        6250.0,
			LowTON:             decimal.NewFromFloat(950.0),
			LowUSD:             4750.0,
			HighTON:            decimal.NewFromFloat(1600.0),
			HighUSD:            8000.0,
			SuggestedAskTON:    decimal.NewFromFloat(1450.0),
			SuggestedAskUSD:    7250.0,
			LiquidationTON:     decimal.NewFromFloat(850.0),
			LiquidationUSD:     4250.0,
			BasePriceTON:       decimal.NewFromFloat(1000.0),
			CollateralValueTON: 560.0,
			CollateralValueUSD: 2800.0,
			FragmentDirectURL:  "https://fragment.com/number/88877778888",
			Color: registry.ColorInfo{
				Name: "Obsidian Black",
			},
			PriceBasis:    "direct_sales",
			CertificateID: "NV-CERT-2026-8888",
			RarityDNA: []nvengine.RarityBar{
				{
					Key:        "distinct_digits",
					LabelEn:    "Distinct Digits",
					LabelFa:    "ارقام یکتا",
					Value:      "2 digits",
					Percentile: 70.0,
				},
				{
					Key:        "max_run",
					LabelEn:    "Max Run Length",
					LabelFa:    "بیشترین توالی ارقام",
					Value:      "4 repeats",
					Percentile: 50.0,
				},
			},
			Comps: []nvengine.ComparableSale{
				{
					Number:   "+888 7777 9999",
					PriceTON: 1100.0,
					PriceUSD: 5500.0,
				},
			},
			PatternAnatomy: nvengine.PatternAnatomy{
				PatternTypeFa:  "الگوی دودویی متقارن",
				PatternTypeEn:  "Binary Symmetrical",
				MaxRun:         4,
				DistinctDigits: 2,
			},
			RentalYield: nvengine.RentalYield{
				MonthlyYieldTON: 45.0,
				EstApy:          48.5,
			},
			Liquidity: nvengine.LiquidityMetrics{
				LiquidityRating:    "A+",
				EstimatedSellDays:  "1-3 days",
				TargetBuyerProfile: "High Net Worth Collectors",
			},
			TelemintProvenance: nvengine.TelemintProvenance{
				CollectionAddress: "EQD_telemint_contract_collection_address",
			},
			OnChainAudit: nvengine.OnChainAudit{
				MintDate:      "2022-12-14",
				TransferCount: 3,
			},
			Recommendation: nvengine.ActionRecommendation{
				Verdict:   "HOLD",
				SummaryFa: "ارزش ذاتی در حال افزایش است، نگه‌داری توصیه می‌شود",
				SummaryEn: "Strong upward valuation momentum, recommended to hold",
			},
			Projection: nvengine.GrowthProjection{
				BullTON: 2100.0,
				BullUSD: 10500.0,
				BaseTON: 1600.0,
				BaseUSD: 8000.0,
				BearTON: 1100.0,
				BearUSD: 5500.0,
			},
			Playbook: nvengine.ActionablePlaybook{
				SuggestedAuctionStartTON: 1000.0,
				BidStepTON:               50.0,
			},
		}

		// Test buildNumberMarkup with FragmentDirectURL
		markup := buildNumberMarkup("88877778888", val.DisplayNumber, "https://t.me/iFragmentBot", "summary", "fa", val.FragmentDirectURL)
		kb, ok := markup["inline_keyboard"].([][]map[string]interface{})
		if !ok || len(kb) < 2 {
			t.Fatalf("expected keyboard layout")
		}
		fragBtnURL := kb[1][0]["url"]
		if fragBtnURL != val.FragmentDirectURL {
			t.Errorf("expected direct Fragment URL %q, got %v", val.FragmentDirectURL, fragBtnURL)
		}

		// Test rich HTML across all languages
		for _, l := range []string{"fa", "en", "ru", "zh"} {
			rich := buildNumberRichHTML(val, l)
			std := buildNumberStandardHTML(val, val.DisplayNumber, l)

			// Progress bar check
			if !strings.Contains(rich, "▰") {
				t.Errorf("[%s] rich HTML missing filled progress bar block. Got:\n%s", l, rich)
			}
			if !strings.Contains(rich, "▱") {
				t.Errorf("[%s] rich HTML missing empty progress bar block. Got:\n%s", l, rich)
			}
			// Closed Collection / TotalSupply check
			if !strings.Contains(rich, "136566") && !strings.Contains(rich, "136,566") {
				t.Errorf("[%s] expected TotalNumbersSupply (136,566) in rich. Got:\n%s", l, rich)
			}
			if !strings.Contains(std, "136566") && !strings.Contains(std, "136,566") {
				t.Errorf("[%s] expected TotalNumbersSupply (136,566) in std. Got:\n%s", l, std)
			}
			if !strings.Contains(std, "136566") && !strings.Contains(std, "136,566") {
				t.Errorf("[%s] expected TotalNumbersSupply (136,566) in std. Got:\n%s", l, std)
			}
			// Certificate check
			if !strings.Contains(std, "NV-CERT-2026-8888") {
				t.Errorf("[%s] expected CertificateID in standard HTML", l)
			}
			// OnChain contract check in FA
			if l == "fa" && !strings.Contains(std, "EQD_telemint_contract_collection_address") {
				t.Errorf("[fa] expected Telemint collection contract address in standard HTML")
			}
		}
	})
}



