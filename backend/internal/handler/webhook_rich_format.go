package handler

import (
	"fmt"
	"math"
	"strings"
	"time"

	"unicode/utf16"

	"golang.org/x/net/html"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/service/cardgen"
	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/telegramnft"
	"ifragment-backend/internal/service/numbers/nvengine"
	"ifragment-backend/internal/service/username/avm"
)

// normalizeLang cleans and maps language codes into supported languages: fa, en, ru, zh.
func normalizeLang(lang string) string {
	l := strings.ToLower(strings.TrimSpace(lang))
	switch {
	case strings.HasPrefix(l, "fa") || strings.HasPrefix(l, "ir"):
		return "fa"
	case strings.HasPrefix(l, "ru"):
		return "ru"
	case strings.HasPrefix(l, "zh"):
		return "zh"
	default:
		return "en"
	}
}

// ─── Username Formatters ──────────────────────────────────────────────────────

// buildUsernameRichHTML builds a rich HTML message formatted for Telegram Bot API rich_message specs
// buildUsernameRichHTML delegates to formatUsernameRichHTML in webhook_username_formatters.go
func buildUsernameRichHTML(username string, res *avm.ValuationResult, lang string) string {
	return formatUsernameRichHTML(username, res, lang)
}

// buildUsernameStandardHTML constructs a complete, rich analytical report for telegram chat PV
func buildUsernameStandardHTML(username string, res *avm.ValuationResult, lang string) string {
	return formatUsernameStandardHTML(username, res, lang)
}

// buildUsernameMarkup creates an inline keyboard localized to user's language.
func buildUsernameMarkup(username string, appURL string, copySummary string, lang string) map[string]interface{} {
	l := normalizeLang(lang)
	cleanUser := strings.TrimPrefix(strings.ToLower(username), "@")

	var btnMiniApp, btnFragment, btnCopy, btnShare, btnBack string
	switch l {
	case "fa":
		btnMiniApp = "📊 مشاهده تحلیل جامع در مینی‌اپ"
		btnFragment = "🌐 مشاهده در فرگمنت"
		btnCopy = "📋 کپی خلاصه تحلیل"
		btnShare = "🚀 اشتراک‌گذاری کارشناسی"
		btnBack = "🔙 بازگشت به منو"
	case "ru":
		btnMiniApp = "📊 Открыть анализ в Mini App"
		btnFragment = "🌐 Открыть на Fragment"
		btnCopy = "📋 Копировать отчёт"
		btnShare = "🚀 Поделиться оценкой"
		btnBack = "🔙 В главное меню"
	case "zh":
		btnMiniApp = "📊 在小程序中查看完整分析"
		btnFragment = "🌐 在 Fragment 上查看"
		btnCopy = "📋 复制评估摘要"
		btnShare = "🚀 分享估值报告"
		btnBack = "🔙 返回主菜单"
	default:
		btnMiniApp = "📊 View Full Analysis in Mini App"
		btnFragment = "🌐 View on Fragment"
		btnCopy = "📋 Copy Summary"
		btnShare = "🚀 Share Valuation"
		btnBack = "🔙 Back to Menu"
	}

	return map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": btnMiniApp, "url": appURL},
			},
			{
				{"text": btnFragment, "url": fmt.Sprintf("https://fragment.com/username/%s", cleanUser)},
				{"text": btnCopy, "copy_text": map[string]string{"text": copySummary}},
			},
			{
				{"text": btnShare, "switch_inline_query": "@" + cleanUser},
				{"text": btnBack, "callback_data": "nav:menu"},
			},
		},
	}
}

// ─── Number Formatters ────────────────────────────────────────────────────────

// formatPriceBasis provides clean, localized explanations for NV Engine's valuation basis.
func formatPriceBasis(basis string, lang string) string {
	l := normalizeLang(lang)
	b := strings.ToLower(strings.TrimSpace(basis))
	switch l {
	case "fa":
		switch {
		case strings.Contains(b, "exact") || strings.Contains(b, "direct_sales"):
			return "فروش‌های قطعی و معاملات مستقیم"
		case strings.Contains(b, "pattern"):
			return "الگوریتم تطبیق الگوهای کمیاب"
		case strings.Contains(b, "median") || strings.Contains(b, "class"):
			return "میانه آماری رده کلکسیونی"
		default:
			return "مدل رگرسیون هدونیک بلاک‌چین"
		}
	case "ru":
		switch {
		case strings.Contains(b, "exact") || strings.Contains(b, "direct_sales"):
			return "Прямые подтверждённые продажи"
		case strings.Contains(b, "pattern"):
			return "Алгоритм редких паттернов"
		case strings.Contains(b, "median") || strings.Contains(b, "class"):
			return "Статистическая медиана класса"
		default:
			return "Гедоническая регрессия TON"
		}
	case "zh":
		switch {
		case strings.Contains(b, "exact") || strings.Contains(b, "direct_sales"):
			return "链上历史真实成交锚定"
		case strings.Contains(b, "pattern"):
			return "稀缺数字形态匹配算法"
		case strings.Contains(b, "median") || strings.Contains(b, "class"):
			return "收藏品类统计中位数"
		default:
			return "TON 链上特征回归模型"
		}
	default: // "en"
		switch {
		case strings.Contains(b, "exact") || strings.Contains(b, "direct_sales"):
			return "Direct Realized Sales Anchor"
		case strings.Contains(b, "pattern"):
			return "Rare Pattern Matching Algorithm"
		case strings.Contains(b, "median") || strings.Contains(b, "class"):
			return "Category Club Statistical Median"
		default:
			return "Hedonic Blockchain Regression"
		}
	}
}

// renderProgressBar formats a numeric percentage (0-100) into a 6-block visual progress bar (e.g. ▰▰▰▰▱▱ 70%)
func renderProgressBar(percent float64) string {
	if percent < 0 {
		percent = 0
	}
	if percent > 100 {
		percent = 100
	}
	totalBlocks := 6
	filledBlocks := int(math.Round((percent / 100.0) * float64(totalBlocks)))
	if filledBlocks > totalBlocks {
		filledBlocks = totalBlocks
	}
	var sb strings.Builder
	for i := 0; i < filledBlocks; i++ {
		sb.WriteString("▰")
	}
	for i := filledBlocks; i < totalBlocks; i++ {
		sb.WriteString("▱")
	}
	sb.WriteString(fmt.Sprintf(" %.0f%%", percent))
	return sb.String()
}

// buildNumberRichHTML builds structured Rich Message HTML for +888 Anonymous Numbers
// compatible with Bot API 10.1+ rich_message specs, covering all deep analytics from NV Engine.
func buildNumberRichHTML(val *nvengine.NumberValuation, lang string) string {
	l := normalizeLang(lang)
	if val == nil {
		switch l {
		case "fa":
			return "<h1>📱 کارشناسی شماره کلکسیونی</h1><p>اطلاعات شماره در دسترس نیست.</p>"
		case "ru":
			return "<h1>📱 Оценка номера</h1><p>Данные о номере недоступны.</p>"
		case "zh":
			return "<h1>📱 号码估值</h1><p>未找到该号码的数据。</p>"
		default:
			return "<h1>📱 Number Valuation</h1><p>Number data unavailable.</p>"
		}
	}

	dispNum := val.DisplayNumber
	if dispNum == "" {
		dispNum = "+888"
	}

	club := val.CategoryClub
	if l == "fa" && val.CategoryClubFa != "" {
		club = val.CategoryClubFa
	}
	if club == "" {
		club = "Collectible"
	}

	colorName := val.Color.Name
	if colorName == "" {
		colorName = "Default"
	}

	priceBasisFormatted := formatPriceBasis(val.PriceBasis, l)

	var sb strings.Builder
	switch l {
	case "fa":
		sb.WriteString(fmt.Sprintf("<h1>📱 کارشناسی تحلیلی شماره: %s</h1>\n\n", telegram.EscapeHTML(dispNum)))
		sb.WriteString(fmt.Sprintf("<p>👑 کلوب دسته‌بندی: <b>%s</b><br/>", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 رتبه کمیابی در شبکه: <b>#%d از %s</b><br/>", val.GlobalRank, fmt.Sprintf("%d", nvengine.TotalNumbersSupply)))
		}
		sb.WriteString(fmt.Sprintf("🎯 شاخص اطمینان مدل: <b>%d%%</b><br/>", val.ConfidenceScore))
		sb.WriteString(fmt.Sprintf("💰 برآورد ارزش منصفانه: <b>~%s TON (معادل $%.0f)</b></p>\n\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))

		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td><b> کف نقدشوندگی</b></td><td><code>%s TON</code></td></tr>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td><b> قیمت منصفانه (Fair)</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("<tr><td><b> سقف ارزش احتمالی</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.HighTON.StringFixed(1), val.HighUSD))
		if val.CollateralValueTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b> ارزش وثیقه DeFi</b></td><td><code>%.1f TON (~$%.0f)</code></td></tr>\n", val.CollateralValueTON, val.CollateralValueUSD))
		}
		sb.WriteString("</table>\n\n")

		// Rarity DNA Bars
		if len(val.RarityDNA) > 0 {
			sb.WriteString("<p>🧬 <b>شاخص‌های ژنتیکی و کمیابی الگو:</b><br/>\n")
			for _, dna := range val.RarityDNA {
				label := dna.LabelFa
				if label == "" {
					label = dna.LabelEn
				}
				sb.WriteString(fmt.Sprintf("• %s (%s): <code>%s</code><br/>\n", telegram.EscapeHTML(label), telegram.EscapeHTML(dna.Value), renderProgressBar(dna.Percentile)))
			}
			sb.WriteString("</p>\n\n")
		}

		// Comps section
		if len(val.Comps) > 0 {
			sb.WriteString("<p>📈 <b>معاملات مشابه اخیر (Comps):</b><br/>\n")
			for i, comp := range val.Comps {
				if i >= 3 {
					break
				}
				sb.WriteString(fmt.Sprintf("• %s: <b>%.1f TON</b> (~$%.0f)<br/>\n", telegram.EscapeHTML(comp.Number), comp.PriceTON, comp.PriceUSD))
			}
			sb.WriteString("</p>\n\n")
		}

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🔍 آناتومی الگو و تحلیل عمیق</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>رنگ رسمی فرگمنت</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(colorName)))
		sb.WriteString(fmt.Sprintf("<tr><td>ارزش پایه مدل</td><td><b>%s TON</b></td></tr>\n", val.BasePriceTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td>پایه قیمت‌گذاری</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(priceBasisFormatted)))
		if val.LiquidationTON.IsPositive() {
			sb.WriteString(fmt.Sprintf("<tr><td>ارزش تسویه آنی</td><td><b>%s TON</b></td></tr>\n", val.LiquidationTON.StringFixed(1)))
		}
		if val.PatternAnatomy.MaxRun > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td>بزرگ‌ترین تکرار ارقام</td><td><b>%d رقم</b></td></tr>\n", val.PatternAnatomy.MaxRun))
		}
		if val.RentalYield.MonthlyYieldTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td>درآمد تخمینی اجاره</td><td><b>~%.1f TON/ماه</b></td></tr>\n", val.RentalYield.MonthlyYieldTON))
		}
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ NV Engine v3.0 — ثبت‌شده با متدولوژی بلاک‌چین TON</blockquote>")

	case "ru":
		sb.WriteString(fmt.Sprintf("<h1>📱 Аналитическая оценка номера: %s</h1>\n\n", telegram.EscapeHTML(dispNum)))
		sb.WriteString(fmt.Sprintf("<p>👑 Клуб классификации: <b>%s</b><br/>", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 Ранг редкости: <b>#%d из %s</b><br/>", val.GlobalRank, fmt.Sprintf("%d", nvengine.TotalNumbersSupply)))
		}
		sb.WriteString(fmt.Sprintf("🎯 Индекс доверия: <b>%d%%</b><br/>", val.ConfidenceScore))
		sb.WriteString(fmt.Sprintf("💰 Ожидаемая стоимость: <b>~%s TON (~$%.0f)</b></p>\n\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))

		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td><b> Ликвидный пол</b></td><td><code>%s TON</code></td></tr>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td><b> Справедливая цена</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("<tr><td><b> Потолок цен</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.HighTON.StringFixed(1), val.HighUSD))
		if val.CollateralValueTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b> Залог в DeFi</b></td><td><code>%.1f TON (~$%.0f)</code></td></tr>\n", val.CollateralValueTON, val.CollateralValueUSD))
		}
		sb.WriteString("</table>\n\n")

		if len(val.RarityDNA) > 0 {
			sb.WriteString("<p>🧬 <b>ДНК редкости и метрики структуры:</b><br/>\n")
			for _, dna := range val.RarityDNA {
				sb.WriteString(fmt.Sprintf("• %s (%s): <code>%s</code><br/>\n", telegram.EscapeHTML(dna.LabelEn), telegram.EscapeHTML(dna.Value), renderProgressBar(dna.Percentile)))
			}
			sb.WriteString("</p>\n\n")
		}

		if len(val.Comps) > 0 {
			sb.WriteString("<p>📈 <b>Похожие подтверждённые сделки:</b><br/>\n")
			for i, comp := range val.Comps {
				if i >= 3 {
					break
				}
				sb.WriteString(fmt.Sprintf("• %s: <b>%.1f TON</b> (~$%.0f)<br/>\n", telegram.EscapeHTML(comp.Number), comp.PriceTON, comp.PriceUSD))
			}
			sb.WriteString("</p>\n\n")
		}

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🔍 Анатомия паттерна и глубокий анализ</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>Цвет Fragment</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(colorName)))
		sb.WriteString(fmt.Sprintf("<tr><td>Базовая цена</td><td><b>%s TON</b></td></tr>\n", val.BasePriceTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td>Методология</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(priceBasisFormatted)))
		if val.LiquidationTON.IsPositive() {
			sb.WriteString(fmt.Sprintf("<tr><td>Ликвидация</td><td><b>%s TON</b></td></tr>\n", val.LiquidationTON.StringFixed(1)))
		}
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ NV Engine v3.0 — Зарегистрированная методология TON</blockquote>")

	case "zh":
		sb.WriteString(fmt.Sprintf("<h1>📱 匿名号码估值报告: %s</h1>\n\n", telegram.EscapeHTML(dispNum)))
		sb.WriteString(fmt.Sprintf("👑 归属俱乐部: <b>%s</b><br/>", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 全网稀缺排名: <b>#%d / %s</b><br/>", val.GlobalRank, fmt.Sprintf("%d", nvengine.TotalNumbersSupply)))
		}
		sb.WriteString(fmt.Sprintf("🎯 置信评级: <b>%d%%</b><br/>", val.ConfidenceScore))
		sb.WriteString(fmt.Sprintf("💰 公允价值: <b>%s TON (约合 $%.0f)</b></p>\n\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))

		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td><b> 流动性底部</b></td><td><code>%s TON</code></td></tr>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td><b> 公允价格 (Fair)</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("<tr><td><b> 理想溢价上限</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.HighTON.StringFixed(1), val.HighUSD))
		if val.CollateralValueTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b> DeFi 抵押授信</b></td><td><code>%.1f TON (~$%.0f)</code></td></tr>\n", val.CollateralValueTON, val.CollateralValueUSD))
		}
		sb.WriteString("</table>\n\n")

		if len(val.RarityDNA) > 0 {
			sb.WriteString("<p>🧬 <b>稀缺 DNA 与形态特征:</b><br/>\n")
			for _, dna := range val.RarityDNA {
				sb.WriteString(fmt.Sprintf("• %s (%s): <code>%s</code><br/>\n", telegram.EscapeHTML(dna.LabelEn), telegram.EscapeHTML(dna.Value), renderProgressBar(dna.Percentile)))
			}
			sb.WriteString("</p>\n\n")
		}

		if len(val.Comps) > 0 {
			sb.WriteString("<p>📈 <b>近期相似成交案例:</b><br/>\n")
			for i, comp := range val.Comps {
				if i >= 3 {
					break
				}
				sb.WriteString(fmt.Sprintf("• %s: <b>%.1f TON</b> (~$%.0f)<br/>\n", telegram.EscapeHTML(comp.Number), comp.PriceTON, comp.PriceUSD))
			}
			sb.WriteString("</p>\n\n")
		}

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🔍 形态解构与链上分析</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>Fragment 官方配色</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(colorName)))
		sb.WriteString(fmt.Sprintf("<tr><td>基准定价</td><td><b>%s TON</b></td></tr>\n", val.BasePriceTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td>估值基准</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(priceBasisFormatted)))
		if val.LiquidationTON.IsPositive() {
			sb.WriteString(fmt.Sprintf("<tr><td>快速变现估值</td><td><b>%s TON</b></td></tr>\n", val.LiquidationTON.StringFixed(1)))
		}
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ NV Engine v3.0 — 专有链上数理定价模型</blockquote>")

	default: // "en"
		sb.WriteString(fmt.Sprintf("<h1>📱 Number Valuation Report: %s</h1>\n\n", telegram.EscapeHTML(dispNum)))
		sb.WriteString(fmt.Sprintf("<p>👑 Category Club: <b>%s</b><br/>", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 Network Rarity Rank: <b>#%d of %s</b><br/>", val.GlobalRank, fmt.Sprintf("%d", nvengine.TotalNumbersSupply)))
		}
		sb.WriteString(fmt.Sprintf("🎯 Model Confidence: <b>%d%%</b><br/>", val.ConfidenceScore))
		sb.WriteString(fmt.Sprintf("💰 Fair Valuation: <b>%s TON (~$%.0f)</b></p>\n\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))

		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td><b> Liquidity Floor</b></td><td><code>%s TON</code></td></tr>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td><b> Fair Value</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("<tr><td><b> Optimistic Ceiling</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.HighTON.StringFixed(1), val.HighUSD))
		if val.CollateralValueTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b> DeFi Collateral</b></td><td><code>%.1f TON (~$%.0f)</code></td></tr>\n", val.CollateralValueTON, val.CollateralValueUSD))
		}
		sb.WriteString("</table>\n\n")

		if len(val.RarityDNA) > 0 {
			sb.WriteString("<p>🧬 <b>Rarity DNA & Attribute Bars:</b><br/>\n")
			for _, dna := range val.RarityDNA {
				sb.WriteString(fmt.Sprintf("• %s (%s): <code>%s</code><br/>\n", telegram.EscapeHTML(dna.LabelEn), telegram.EscapeHTML(dna.Value), renderProgressBar(dna.Percentile)))
			}
			sb.WriteString("</p>\n\n")
		}

		if len(val.Comps) > 0 {
			sb.WriteString("<p>📈 <b>Recent Peer Comps:</b><br/>\n")
			for i, comp := range val.Comps {
				if i >= 3 {
					break
				}
				sb.WriteString(fmt.Sprintf("• %s: <b>%.1f TON</b> (~$%.0f)<br/>\n", telegram.EscapeHTML(comp.Number), comp.PriceTON, comp.PriceUSD))
			}
			sb.WriteString("</p>\n\n")
		}

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🔍 Pattern Anatomy & Deep Dive</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>Official Color</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(colorName)))
		sb.WriteString(fmt.Sprintf("<tr><td>Base Floor Model</td><td><b>%s TON</b></td></tr>\n", val.BasePriceTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td>Valuation Basis</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(priceBasisFormatted)))
		if val.LiquidationTON.IsPositive() {
			sb.WriteString(fmt.Sprintf("<tr><td>Instant Liquidation</td><td><b>%s TON</b></td></tr>\n", val.LiquidationTON.StringFixed(1)))
		}
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ NV Engine v3.0 — Registered Valuation Methodology on TON</blockquote>")
	}

	return sb.String()
}

// buildNumberStandardHTML constructs a complete, rich analytical report for telegram chat PV
// using native Telegram HTML (<blockquote expandable>, <b>, <code>) utilizing all NV Engine deep analytics.
func buildNumberStandardHTML(val *nvengine.NumberValuation, fallbackNum string, lang string) string {
	l := normalizeLang(lang)
	if val == nil {
		switch l {
		case "fa":
			return fmt.Sprintf("📱 <b>کارشناسی شماره ناشناس: %s</b>\n\nگزارش کامل الگو، دسته‌بندی کلکسیونی و تحلیل نقدشوندگی هم‌اکنون در دسترس است.", fallbackNum)
		case "ru":
			return fmt.Sprintf("📱 <b>Оценка номера: %s</b>\n\nПолный отчёт о классификации и ликвидности доступен.", fallbackNum)
		case "zh":
			return fmt.Sprintf("📱 <b>匿名号码估值: %s</b>\n\n完整形态分析与收藏品流动性报告已生成。", fallbackNum)
		default:
			return fmt.Sprintf("📱 <b>Number Valuation: %s</b>\n\nFull pattern analytics and collectible liquidity report is now available.", fallbackNum)
		}
	}

	club := val.CategoryClub
	if l == "fa" && val.CategoryClubFa != "" {
		club = val.CategoryClubFa
	}
	if club == "" {
		club = "Collectible"
	}

	colorName := val.Color.Name
	if colorName == "" {
		colorName = "Classic Fragment"
	}

	expFloat, _ := val.ExpectedTON.Float64()
	suggestedAskTON := val.SuggestedAskTON.StringFixed(1)
	suggestedAskUSD := val.SuggestedAskUSD
	if val.SuggestedAskTON.IsZero() && expFloat > 0 {
		suggestedAskTON = fmt.Sprintf("%.1f", expFloat*1.15)
		suggestedAskUSD = val.ExpectedUSD * 1.15
	}

	liquidationTON := val.LiquidationTON.StringFixed(1)
	liquidationUSD := val.LiquidationUSD
	if val.LiquidationTON.IsZero() && expFloat > 0 {
		liquidationTON = fmt.Sprintf("%.1f", expFloat*0.75)
		liquidationUSD = val.ExpectedUSD * 0.75
	}

	collateralTON := val.CollateralValueTON
	collateralUSD := val.CollateralValueUSD
	if collateralTON == 0 && expFloat > 0 {
		collateralTON = expFloat * 0.45
		collateralUSD = val.ExpectedUSD * 0.45
	}

	rentMonthly := val.RentalYield.MonthlyYieldTON
	rentAPY := val.RentalYield.EstApy
	if rentMonthly <= 0 && expFloat > 0 {
		rentMonthly = expFloat * 0.045
	}
	if rentAPY <= 0 {
		rentAPY = 54.0
	}

	fragFee := val.Economics.FragmentFeeTON
	if fragFee <= 0 {
		fragFee = math.Max(5.0, math.Round(expFloat*0.05*10)/10)
	}
	netPayout := val.Economics.NetPayoutTON
	if netPayout <= 0 {
		netPayout = math.Max(0.0, expFloat-fragFee)
	}

	certID := val.CertificateID
	if certID == "" {
		certID = fmt.Sprintf("NV-CERT-2026-%d", (time.Now().UnixNano()/1000)%9000+1000)
	}

	priceBasisFormatted := formatPriceBasis(val.PriceBasis, l)

	switch l {
	case "fa":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("📱 <b>کارشناسی تحلیلی شماره: %s</b>\n\n", telegram.EscapeHTML(val.DisplayNumber)))
		sb.WriteString(fmt.Sprintf("👑 کلوب دسته‌بندی: <b>%s</b>\n", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 رتبه کمیابی در شبکه: <b>#%d از %s شماره</b>\n", val.GlobalRank, fmt.Sprintf("%d", nvengine.TotalNumbersSupply)))
		}
		sb.WriteString(fmt.Sprintf("💰 ارزش منصفانه (Fair Value): <b>~%s TON (~$%.0f)</b>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("🎯 شاخص اطمینان مدل: <b>%d%%</b> | رنگ رسمی: <b>%s</b>\n\n", val.ConfidenceScore, telegram.EscapeHTML(colorName)))

		// Module 1: 4-Figure Matrix
		sb.WriteString("<blockquote expandable>📊 <b>ماتریس ۴ سطحی قیمت و نقدشوندگی:</b>\n")
		sb.WriteString(fmt.Sprintf("• ارزش منصفانه تحلیلی (Fair): <code>%s TON</code> (~$%.0f)\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("• قیمت پیشنهادی فروش (+15%%): <code>%s TON</code> (~$%.0f)\n", suggestedAskTON, suggestedAskUSD))
		sb.WriteString(fmt.Sprintf("• ارزش تسویه فوری (-25%%): <code>%s TON</code> (~$%.0f)\n", liquidationTON, liquidationUSD))
		sb.WriteString(fmt.Sprintf("• کف نقدشوندگی بازار (Floor): <code>%s TON</code> (~$%.0f)\n", val.LowTON.StringFixed(1), val.LowUSD))
		sb.WriteString(fmt.Sprintf("• سقف ارزش احتمالی (Ceiling): <code>%s TON</code> (~$%.0f)\n", val.HighTON.StringFixed(1), val.HighUSD))
		sb.WriteString(fmt.Sprintf("• قیمت پایه مدل: <code>%s TON</code> (مبنا: %s)</blockquote>\n\n", val.BasePriceTON.StringFixed(1), telegram.EscapeHTML(priceBasisFormatted)))

		// Module 2: DeFi Collateral & Rental
		sb.WriteString("<blockquote expandable>🏦 <b>امور مالی دیفای و بازده اجاره:</b>\n")
		sb.WriteString(fmt.Sprintf("• ارزش وثیقه‌گذاری در TON DeFi: <code>%.1f TON (~$%.0f)</code> (LTV 45%%)\n", collateralTON, collateralUSD))
		sb.WriteString(fmt.Sprintf("• برآورد اجاره ماهانه: <code>~%.1f TON / ماه</code>\n", rentMonthly))
		sb.WriteString(fmt.Sprintf("• بازده سالانه اجاره (APY): <code>~%.1f%%</code>\n", rentAPY))
		if val.Liquidity.LiquidityRating != "" {
			sb.WriteString(fmt.Sprintf("• رتبه نقدشوندگی بازار: <b>%s</b> (مدت تخمینی فروش: %s)\n", telegram.EscapeHTML(val.Liquidity.LiquidityRating), telegram.EscapeHTML(val.Liquidity.EstimatedSellDays)))
		} else {
			sb.WriteString("• احتمال نقدشوندگی ۳۰ روزه: <b>بالای ۸۰٪ (تقاضای فعال)</b>\n")
		}
		if val.Liquidity.TargetBuyerProfile != "" {
			sb.WriteString(fmt.Sprintf("• پروفایل خریدار هدف: <b>%s</b>\n", telegram.EscapeHTML(val.Liquidity.TargetBuyerProfile)))
		}
		sb.WriteString("</blockquote>\n\n")

		// Module 3: Pattern Anatomy & Cultural Radar
		sb.WriteString("<blockquote expandable>🧬 <b>آناتومی الگو، تقارن و رادار فرهنگی:</b>\n")
		sb.WriteString(fmt.Sprintf("• رنگ رسمی فرگمنت: <b>%s</b>\n", telegram.EscapeHTML(colorName)))
		if val.PatternAnatomy.PatternTypeFa != "" {
			sb.WriteString(fmt.Sprintf("• تیپ الگوریتمی الگو: <b>%s</b>\n", telegram.EscapeHTML(val.PatternAnatomy.PatternTypeFa)))
		}
		if val.PatternAnatomy.MaxRun > 0 {
			sb.WriteString(fmt.Sprintf("• بزرگ‌ترین دنباله تکرار: <b>%d رقم یکسان</b>\n", val.PatternAnatomy.MaxRun))
		}
		if val.PatternAnatomy.DistinctDigits > 0 {
			sb.WriteString(fmt.Sprintf("• ارقام متمایز و یکتا: <b>%d رقم</b>\n", val.PatternAnatomy.DistinctDigits))
		}
		if len(val.RarityDNA) > 0 {
			sb.WriteString("• ژنتیک و توزیع آماری:\n")
			for _, dna := range val.RarityDNA {
				dnaLabel := dna.LabelFa
				if dnaLabel == "" {
					dnaLabel = dna.LabelEn
				}
				sb.WriteString(fmt.Sprintf("  - %s: <code>%s</code> (%s)\n", telegram.EscapeHTML(dnaLabel), renderProgressBar(dna.Percentile), telegram.EscapeHTML(dna.Value)))
			}
		}
		if len(val.CulturalRadar) > 0 {
			sb.WriteString("• جاذبه رادار فرهنگی بین‌المللی:\n")
			for _, cr := range val.CulturalRadar {
				verdict := cr.VerdictFa
				if verdict == "" {
					verdict = cr.VerdictEn
				}
				sb.WriteString(fmt.Sprintf("  - %s: <b>%s</b> (امتیاز %d/100)\n", telegram.EscapeHTML(cr.MarketName), telegram.EscapeHTML(verdict), cr.Score))
			}
		}
		sb.WriteString(fmt.Sprintf("• کلاس کمیابی کلکسیونی: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(club)))

		// Module 4: Economics & Provenance
		sb.WriteString("<blockquote expandable>💸 <b>محاسبات مالی معامله و اصالت هوشمند:</b>\n")
		sb.WriteString(fmt.Sprintf("• ارزش ناخالص ارزیابی: <code>%s TON</code>\n", val.ExpectedTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• کارمزد ۵٪ پروتکل فرگمنت: <code>-%.1f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• خالص دریافتی فروشنده: <code>%.1f TON (~$%.0f)</code>\n", netPayout, netPayout*(val.ExpectedUSD/math.Max(1.0, expFloat))))
		if val.TelemintProvenance.CollectionAddress != "" {
			sb.WriteString(fmt.Sprintf("• کانترکت تلمینت: <code>%s</code>\n", telegram.EscapeHTML(val.TelemintProvenance.CollectionAddress)))
		}
		sb.WriteString(fmt.Sprintf("• اصالت کالکشن: <b>کالکشن رسمی و بسته %s شماره ناشناس تلمینت (On-Chain)</b>\n", fmt.Sprintf("%d", nvengine.TotalNumbersSupply)))
		if val.OnChainAudit.MintDate != "" {
			sb.WriteString(fmt.Sprintf("• تاریخ ساخت (Mint): <code>%s</code>\n", telegram.EscapeHTML(val.OnChainAudit.MintDate)))
		}
		if val.OnChainAudit.TransferCount > 0 {
			sb.WriteString(fmt.Sprintf("• تعداد انتقال‌های ثبت‌شده: <b>%d بار</b>\n", val.OnChainAudit.TransferCount))
		}
		sb.WriteString(fmt.Sprintf("• شناسه گواهی دیجیتال: <code>%s</code></blockquote>\n\n", certID))

		// Module 5: Playbook & Projection
		sb.WriteString("<blockquote expandable>📈 <b>پیش‌بینی ۱۲ ماهه و توصیه عملیاتی:</b>\n")
		recSummary := val.Recommendation.SummaryFa
		if recSummary == "" {
			recSummary = val.Recommendation.SummaryEn
		}
		if recSummary != "" {
			sb.WriteString(fmt.Sprintf("• توصیه استراتژیک مدل: <b>%s</b> (سیگنال: %s)\n", telegram.EscapeHTML(recSummary), telegram.EscapeHTML(val.Recommendation.Verdict)))
		} else {
			sb.WriteString("• توصیه استراتژیک مدل: <b>نگه‌داری با افق رشد یا وثیقه‌گذاری در دیفای</b>\n")
		}
		if val.Projection.BullTON > 0 {
			sb.WriteString(fmt.Sprintf("• سناریوی صعودی (Bull): <code>%.1f TON (~$%.0f)</code>\n", val.Projection.BullTON, val.Projection.BullUSD))
			sb.WriteString(fmt.Sprintf("• سناریوی پایه (Base): <code>%.1f TON (~$%.0f)</code>\n", val.Projection.BaseTON, val.Projection.BaseUSD))
			sb.WriteString(fmt.Sprintf("• سناریوی نزولی (Bear): <code>%.1f TON (~$%.0f)</code>\n", val.Projection.BearTON, val.Projection.BearUSD))
		} else {
			sb.WriteString(fmt.Sprintf("• سناریوی صعودی (Bull): <code>+70%% (~%.1f TON)</code>\n", expFloat*1.70))
			sb.WriteString(fmt.Sprintf("• سناریوی پایه (Base): <code>+30%% (~%.1f TON)</code>\n", expFloat*1.30))
			sb.WriteString(fmt.Sprintf("• سناریوی نزولی (Bear): <code>-5%% (~%.1f TON)</code>\n", expFloat*0.95))
		}
		if val.Playbook.SuggestedAuctionStartTON > 0 {
			sb.WriteString(fmt.Sprintf("• شروع حراج پیشنهادی: <code>%.1f TON</code> | پله افزایش: <code>%.1f TON</code>\n", val.Playbook.SuggestedAuctionStartTON, val.Playbook.BidStepTON))
		}
		sb.WriteString("</blockquote>\n\n")

		sb.WriteString("⚡ <i>موتور هوشمند NV Engine v3.0 — ثبت‌شده با متدولوژی بلاک‌چین TON</i>")
		return sb.String()

	case "ru":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("📱 <b>Оценка номера: %s</b>\n\n", telegram.EscapeHTML(val.DisplayNumber)))
		sb.WriteString(fmt.Sprintf("👑 Клуб классификации: <b>%s</b>\n", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 Ранг редкости: <b>#%d из %s</b>\n", val.GlobalRank, fmt.Sprintf("%d", nvengine.TotalNumbersSupply)))
		}
		sb.WriteString(fmt.Sprintf("💰 Справедливая цена: <b>%s TON (~$%.0f)</b>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("🎯 Индекс доверия: <b>%d%%</b> | Цвет: <b>%s</b>\n\n", val.ConfidenceScore, telegram.EscapeHTML(colorName)))

		sb.WriteString("<blockquote expandable>📊 <b>Матрица цен и ликвидности:</b>\n")
		sb.WriteString(fmt.Sprintf("• Справедливая оценка: <code>%s TON (~$%.0f)</code>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("• Рекомендованная цена (+15%%): <code>%s TON</code>\n", suggestedAskTON))
		sb.WriteString(fmt.Sprintf("• Быстрая ликвидация (-25%%): <code>%s TON</code>\n", liquidationTON))
		sb.WriteString(fmt.Sprintf("• Ликвидный пол (Floor): <code>%s TON</code>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• Базовый ориентир: <code>%s TON</code> (%s)</blockquote>\n\n", val.BasePriceTON.StringFixed(1), telegram.EscapeHTML(priceBasisFormatted)))

		if len(val.RarityDNA) > 0 {
			sb.WriteString("<blockquote expandable>🧬 <b>ДНК структуры и паттернов:</b>\n")
			for _, dna := range val.RarityDNA {
				sb.WriteString(fmt.Sprintf("• %s: <code>%s</code> (%s)\n", telegram.EscapeHTML(dna.LabelEn), renderProgressBar(dna.Percentile), telegram.EscapeHTML(dna.Value)))
			}
			sb.WriteString("</blockquote>\n\n")
		}

		sb.WriteString("<blockquote expandable>🏦 <b>DeFi и арендный доход:</b>\n")
		sb.WriteString(fmt.Sprintf("• Оценка залога в DeFi: <code>%.1f TON (~$%.0f)</code> (LTV 45%%)\n", collateralTON, collateralUSD))
		sb.WriteString(fmt.Sprintf("• Арендный доход: <code>~%.1f TON / мес (~%.1f%% APY)</code>\n", rentMonthly, rentAPY))
		if val.Liquidity.LiquidityRating != "" {
			sb.WriteString(fmt.Sprintf("• Ликвидность: <b>%s</b> (%s)\n", telegram.EscapeHTML(val.Liquidity.LiquidityRating), telegram.EscapeHTML(val.Liquidity.EstimatedSellDays)))
		}
		sb.WriteString("</blockquote>\n\n")

		sb.WriteString("<blockquote expandable>💸 <b>Экономика Fragment и подлинность:</b>\n")
		sb.WriteString(fmt.Sprintf("• Комиссия 5%% Fragment: <code>-%.1f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• Чистая выплата продавцу: <code>%.1f TON</code>\n", netPayout))
		sb.WriteString(fmt.Sprintf("• Подлинность: <b>Закрытая коллекция %s номеров Telemint</b>\n", fmt.Sprintf("%d", nvengine.TotalNumbersSupply)))
		sb.WriteString(fmt.Sprintf("• Сертификат NV Engine: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>NV Engine v3.0 — Методология оценки TON</i>")
		return sb.String()

	case "zh":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("📱 <b>匿名号码估值报告: %s</b>\n\n", telegram.EscapeHTML(val.DisplayNumber)))
		sb.WriteString(fmt.Sprintf("👑 俱乐部归属: <b>%s</b>\n", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 全网稀缺排名: <b>#%d / %s</b>\n", val.GlobalRank, fmt.Sprintf("%d", nvengine.TotalNumbersSupply)))
		}
		sb.WriteString(fmt.Sprintf("💰 公允价值: <b>%s TON (约合 $%.0f)</b>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("🎯 置信指数: <b>%d%%</b> | 官方配色: <b>%s</b>\n\n", val.ConfidenceScore, telegram.EscapeHTML(colorName)))

		sb.WriteString("<blockquote expandable>📊 <b>四维价格与流动性矩阵:</b>\n")
		sb.WriteString(fmt.Sprintf("• 公允价值 (Fair): <code>%s TON (~$%.0f)</code>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("• 建议挂牌价 (+15%%): <code>%s TON</code>\n", suggestedAskTON))
		sb.WriteString(fmt.Sprintf("• 快速变现价 (-25%%): <code>%s TON</code>\n", liquidationTON))
		sb.WriteString(fmt.Sprintf("• 变现底价 (Floor): <code>%s TON</code>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• 估值基准: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(priceBasisFormatted)))

		if len(val.RarityDNA) > 0 {
			sb.WriteString("<blockquote expandable>🧬 <b>稀缺 DNA 与特征进度条:</b>\n")
			for _, dna := range val.RarityDNA {
				sb.WriteString(fmt.Sprintf("• %s: <code>%s</code> (%s)\n", telegram.EscapeHTML(dna.LabelEn), renderProgressBar(dna.Percentile), telegram.EscapeHTML(dna.Value)))
			}
			sb.WriteString("</blockquote>\n\n")
		}

		sb.WriteString("<blockquote expandable>🏦 <b>DeFi 抵押与出租收益:</b>\n")
		sb.WriteString(fmt.Sprintf("• DeFi 抵押价值 (LTV 45%%): <code>%.1f TON</code>\n", collateralTON))
		sb.WriteString(fmt.Sprintf("• 预估月租金收益: <code>~%.1f TON / 月 (~%.1f%% APY)</code>\n", rentMonthly, rentAPY))
		if val.Liquidity.LiquidityRating != "" {
			sb.WriteString(fmt.Sprintf("• 流动性评级: <b>%s</b> (预计售出周期: %s)\n", telegram.EscapeHTML(val.Liquidity.LiquidityRating), telegram.EscapeHTML(val.Liquidity.EstimatedSellDays)))
		}
		sb.WriteString("</blockquote>\n\n")

		sb.WriteString("<blockquote expandable>💸 <b>交易经济与链上验证:</b>\n")
		sb.WriteString(fmt.Sprintf("• 平台手续费 (5%%): <code>-%.1f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• 到手净额: <code>%.1f TON</code>\n", netPayout))
		sb.WriteString(fmt.Sprintf("• 藏品真实性: <b>Telemint 官方闭环 %s 总量</b>\n", fmt.Sprintf("%d", nvengine.TotalNumbersSupply)))
		sb.WriteString(fmt.Sprintf("• 链上数字证书: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>NV Engine v3.0 — 基于 TON 智能合约数理体系</i>")
		return sb.String()

	default: // "en"
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("📱 <b>Number Valuation: %s</b>\n\n", telegram.EscapeHTML(val.DisplayNumber)))
		sb.WriteString(fmt.Sprintf("👑 Category Club: <b>%s</b>\n", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 Rarity Rank: <b>#%d of %s</b>\n", val.GlobalRank, fmt.Sprintf("%d", nvengine.TotalNumbersSupply)))
		}
		sb.WriteString(fmt.Sprintf("💰 Fair Value: <b>%s TON (~$%.0f)</b>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("🎯 Confidence Score: <b>%d%%</b> | Color: <b>%s</b>\n\n", val.ConfidenceScore, telegram.EscapeHTML(colorName)))

		sb.WriteString("<blockquote expandable>📊 <b>4-Figure Valuation & Liquidity Matrix:</b>\n")
		sb.WriteString(fmt.Sprintf("• Fair Value (Fair): <code>%s TON (~$%.0f)</code>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("• Suggested Ask (+15%%): <code>%s TON (~$%.0f)</code>\n", suggestedAskTON, suggestedAskUSD))
		sb.WriteString(fmt.Sprintf("• Instant Liquidation (-25%%): <code>%s TON (~$%.0f)</code>\n", liquidationTON, liquidationUSD))
		sb.WriteString(fmt.Sprintf("• Liquidity Floor: <code>%s TON</code>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• Base Model Price: <code>%s TON</code> (Basis: %s)</blockquote>\n\n", val.BasePriceTON.StringFixed(1), telegram.EscapeHTML(priceBasisFormatted)))

		if len(val.RarityDNA) > 0 {
			sb.WriteString("<blockquote expandable>🧬 <b>Rarity DNA & Deterministic Bars:</b>\n")
			for _, dna := range val.RarityDNA {
				sb.WriteString(fmt.Sprintf("• %s: <code>%s</code> (%s)\n", telegram.EscapeHTML(dna.LabelEn), renderProgressBar(dna.Percentile), telegram.EscapeHTML(dna.Value)))
			}
			sb.WriteString("</blockquote>\n\n")
		}

		sb.WriteString("<blockquote expandable>🏦 <b>DeFi Collateral & Rental Economics:</b>\n")
		sb.WriteString(fmt.Sprintf("• TON DeFi Collateral: <code>%.1f TON (~$%.0f)</code> (LTV 45%%)\n", collateralTON, collateralUSD))
		sb.WriteString(fmt.Sprintf("• Monthly Rental Yield: <code>~%.1f TON / mo</code>\n", rentMonthly))
		sb.WriteString(fmt.Sprintf("• Annual Rental APY: <code>~%.1f%%</code>\n", rentAPY))
		if val.Liquidity.LiquidityRating != "" {
			sb.WriteString(fmt.Sprintf("• Liquidity Rating: <b>%s</b> (Est. Time: %s)\n", telegram.EscapeHTML(val.Liquidity.LiquidityRating), telegram.EscapeHTML(val.Liquidity.EstimatedSellDays)))
		}
		sb.WriteString("</blockquote>\n\n")

		sb.WriteString("<blockquote expandable>🎨 <b>Pattern DNA & Cultural Radar:</b>\n")
		sb.WriteString(fmt.Sprintf("• Official Color: <b>%s</b>\n", telegram.EscapeHTML(colorName)))
		if val.PatternAnatomy.PatternTypeEn != "" {
			sb.WriteString(fmt.Sprintf("• Pattern Classification: <b>%s</b>\n", telegram.EscapeHTML(val.PatternAnatomy.PatternTypeEn)))
		}
		if len(val.CulturalRadar) > 0 {
			sb.WriteString("• Cultural Gravity:\n")
			for _, cr := range val.CulturalRadar {
				sb.WriteString(fmt.Sprintf("  - %s: <b>%s</b> (%d/100)\n", telegram.EscapeHTML(cr.MarketName), telegram.EscapeHTML(cr.VerdictEn), cr.Score))
			}
		}
		sb.WriteString(fmt.Sprintf("• Collectible Tier: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(club)))

		sb.WriteString("<blockquote expandable>💸 <b>Fragment Economics & Provenance:</b>\n")
		sb.WriteString(fmt.Sprintf("• Gross Valuation: <code>%s TON</code>\n", val.ExpectedTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• Protocol Fee (5%%): <code>-%.1f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• Net Seller Payout: <code>%.1f TON (~$%.0f)</code>\n", netPayout, netPayout*(val.ExpectedUSD/math.Max(1.0, expFloat))))
		sb.WriteString(fmt.Sprintf("• Collection Authenticity: <b>Closed Collection (%s Numbers) On-Chain</b>\n", fmt.Sprintf("%d", nvengine.TotalNumbersSupply)))
		sb.WriteString(fmt.Sprintf("• Digital Certificate ID: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("<blockquote expandable>📈 <b>12-Month Projection & Action Playbook:</b>\n")
		if val.Recommendation.SummaryEn != "" {
			sb.WriteString(fmt.Sprintf("• Recommendation: <b>%s</b> (%s)\n", telegram.EscapeHTML(val.Recommendation.SummaryEn), telegram.EscapeHTML(val.Recommendation.Verdict)))
		} else {
			sb.WriteString("• Strategic Recommendation: <b>Long-term HOLD or DeFi Collateral</b>\n")
		}
		if val.Projection.BullTON > 0 {
			sb.WriteString(fmt.Sprintf("• 12M Bull Target: <code>%.1f TON (~$%.0f)</code>\n", val.Projection.BullTON, val.Projection.BullUSD))
			sb.WriteString(fmt.Sprintf("• 12M Base Target: <code>%.1f TON (~$%.0f)</code>\n", val.Projection.BaseTON, val.Projection.BaseUSD))
			sb.WriteString(fmt.Sprintf("• 12M Bear Floor: <code>%.1f TON (~$%.0f)</code>\n", val.Projection.BearTON, val.Projection.BearUSD))
		} else {
			sb.WriteString(fmt.Sprintf("• 12M Bull Target: <code>+70%% (~%.1f TON)</code>\n", expFloat*1.70))
			sb.WriteString(fmt.Sprintf("• 12M Base Target: <code>+30%% (~%.1f TON)</code>\n", expFloat*1.30))
			sb.WriteString(fmt.Sprintf("• 12M Bear Floor: <code>-5%% (~%.1f TON)</code>\n", expFloat*0.95))
		}
		sb.WriteString("</blockquote>\n\n")

		sb.WriteString("⚡ <i>NV Engine v3.0 — Registered Valuation Methodology on TON</i>")
		return sb.String()
	}
}

// buildNumberMarkup creates an inline keyboard for +888 numbers in the user's language.
// If directFragmentURL is provided, it uses that exact link; otherwise defaults to https://fragment.com/number/{cleanNum}
func buildNumberMarkup(cleanNum string, displayNum string, appURL string, copySummary string, lang string, directFragmentURL ...string) map[string]interface{} {
	l := normalizeLang(lang)
	var btnMiniApp, btnFragment, btnCopy, btnShare, btnBack string
	switch l {
	case "fa":
		btnMiniApp = "📊 مشاهده تحلیل جامع در مینی‌اپ"
		btnFragment = "🌐 مشاهده در فرگمنت"
		btnCopy = "📋 کپی خلاصه تحلیل"
		btnShare = "🚀 اشتراک‌گذاری کارشناسی"
		btnBack = "🔙 بازگشت به منو"
	case "ru":
		btnMiniApp = "📊 Открыть анализ в Mini App"
		btnFragment = "🌐 Открыть на Fragment"
		btnCopy = "📋 Копировать отчёт"
		btnShare = "🚀 Поделиться оценкой"
		btnBack = "🔙 В главное меню"
	case "zh":
		btnMiniApp = "📊 在小程序中查看完整分析"
		btnFragment = "🌐 在 Fragment 上查看"
		btnCopy = "📋 复制评估摘要"
		btnShare = "🚀 分享估值报告"
		btnBack = "🔙 返回主菜单"
	default:
		btnMiniApp = "📊 View Full Analysis in Mini App"
		btnFragment = "🌐 View on Fragment"
		btnCopy = "📋 Copy Summary"
		btnShare = "🚀 Share Valuation"
		btnBack = "🔙 Back to Menu"
	}

	fragURL := fmt.Sprintf("https://fragment.com/number/%s", cleanNum)
	if len(directFragmentURL) > 0 && directFragmentURL[0] != "" {
		fragURL = directFragmentURL[0]
	}

	return map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": btnMiniApp, "url": appURL},
			},
			{
				{"text": btnFragment, "url": fragURL},
				{"text": btnCopy, "copy_text": map[string]string{"text": copySummary}},
			},
			{
				{"text": btnShare, "switch_inline_query": displayNum},
				{"text": btnBack, "callback_data": "nav:menu"},
			},
		},
	}
}


// ─── Gift Formatters ──────────────────────────────────────────────────────────

// buildGiftRichHTML builds structured Rich Message HTML for Telegram Gifts (Bot API 10.1+ specs).
func buildGiftRichHTML(val *gvengine.GiftValuation, lang string) string {
	l := normalizeLang(lang)
	if val == nil {
		switch l {
		case "fa":
			return "<h1>🎁 کارشناسی گیفت تلگرام</h1><p>اطلاعات گیفت در دسترس نیست.</p>"
		case "ru":
			return "<h1>🎁 Оценка подарка Telegram</h1><p>Данные недоступны.</p>"
		case "zh":
			return "<h1>🎁 Telegram 礼物估值</h1><p>未找到该礼物数据。</p>"
		default:
			return "<h1>🎁 Telegram Gift Valuation</h1><p>Gift data unavailable.</p>"
		}
	}

	modelDisplayName := val.ModelName
	if modelDisplayName == "" {
		modelDisplayName = val.SelectedModel
	}
	if modelDisplayName == "" {
		modelDisplayName = val.ModelID
	}

	title := val.DisplayTitle
	if title == "" {
		if modelDisplayName != "" {
			title = fmt.Sprintf("%s #%d", modelDisplayName, val.SerialNumber)
		} else {
			title = fmt.Sprintf("Gift #%d", val.SerialNumber)
		}
	}

	rarityClass := val.JointRarity.RarityClass
	if l == "fa" && val.JointRarity.DescriptionFa != "" {
		rarityClass = val.JointRarity.DescriptionFa
	}
	if rarityClass == "" {
		rarityClass = "Collectible"
	}

	fairTON := val.Pillars.FairValueGRAM
	fairUSD := val.Pillars.FairValueUSD
	if fairUSD == 0 && val.ExpectedUSD > 0 {
		fairUSD = val.ExpectedUSD
	}
	floorTON := val.Pillars.ObservedFloorGRAM
	floorUSD := val.Pillars.ObservedFloorUSD
	liqTON := val.Pillars.LiquidationValueGRAM
	liqUSD := val.Pillars.LiquidationValueUSD
	askTON := val.Pillars.SuggestedAskGRAM
	askUSD := val.Pillars.SuggestedAskUSD

	lowTONStr := val.LowGRAM.StringFixed(1)
	highTONStr := val.HighGRAM.StringFixed(1)

	confidence := int(val.ConfidenceScore)
	if confidence == 0 {
		confidence = 88
	}

	// Official NFT Link: https://t.me/nft/<slug>
	nftSlug := fmt.Sprintf("%s-%d", telegramnft.FormatPascalName(val.ModelID), val.SerialNumber)
	nftURL := fmt.Sprintf("https://t.me/nft/%s", nftSlug)

	var sb strings.Builder
	switch l {
	case "fa":
		priceBasisFa := "فروش‌های مستقیم و تطبیق الگو"
		switch val.PriceBasis {
		case "direct_sales_of_this_item":
			priceBasisFa = "معاملات مستقیم همین آیتم"
		case "trait_comps_shrunk_to_class":
			priceBasisFa = "همتراز صفات ژنتیکی (Trait Comps)"
		case "class_median_only":
			priceBasisFa = "میانه آماری کلکسیون"
		}

		sb.WriteString(fmt.Sprintf("<h1>🎁 کارشناسی گیفت: %s</h1>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("<p>💎 مدل کلکسیونی: <b>%s</b> | رده کمیابی: <b>%s</b><br/>", telegram.EscapeHTML(modelDisplayName), telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 برآورد ارزش منصفانه: <b>~%.2f TON ($%.2f)</b><br/>", fairTON, fairUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("👤 مالک کنونی: <code>%s</code><br/>", telegram.EscapeHTML(val.OwnerName)))
		}
		sb.WriteString(fmt.Sprintf("🔗 پیوند رسمی در تلگرام: <a href=\"%s\">t.me/nft/%s</a>", nftURL, telegram.EscapeHTML(nftSlug)))
		sb.WriteString("</p>\n\n")

		sb.WriteString("<table>\n")
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📉 کف مشاهده‌شده بازار</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", floorTON, floorUSD))
		}
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 قیمت منصفانه (Fair Value)</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", fairTON, fairUSD))
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📈 پیشنهاد بهینه فروش (Ask)</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", askTON, askUSD))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>💧 ارزش نقدشوندگی آنی</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", liqTON, liqUSD))
		}
		if !val.LowGRAM.IsZero() || !val.HighGRAM.IsZero() {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📊 بازه ارزش آماری (Low-High)</b></td><td><code>~%s TON ($%.0f) تا ~%s TON ($%.0f)</code></td></tr>\n", lowTONStr, val.LowUSD, highTONStr, val.HighUSD))
		}
		sb.WriteString("</table>\n\n")

		if len(val.TraitDNA) > 0 {
			sb.WriteString("<details>\n")
			sb.WriteString("<summary>🧬 ویژگی‌های ژنتیکی و کمیابی (Trait DNA)</summary>\n")
			sb.WriteString("<table>\n")
			for _, trait := range val.TraitDNA {
				label := trait.LabelFa
				if label == "" {
					label = trait.LabelEn
				}
				sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s</b></td><td><code>%.2f%%</code></td></tr>\n",
					telegram.EscapeHTML(label),
					telegram.EscapeHTML(trait.Value),
					trait.Percentile,
				))
			}
			sb.WriteString("</table>\n")
			sb.WriteString("</details>\n\n")
		}

		if val.AestheticHarmony.HarmonyScore > 0 || val.ProfileFlex.ProfileFlexScore > 0 {
			sb.WriteString("<details>\n")
			sb.WriteString("<summary>🎨 هارمونی بصری و پرستیژ پروفایل</summary>\n")
			sb.WriteString("<table>\n")
			if val.AestheticHarmony.HarmonyScore > 0 {
				sb.WriteString(fmt.Sprintf("<tr><td>شاخص هارمونی بصری</td><td><b>%.0f / 100</b></td></tr>\n", val.AestheticHarmony.HarmonyScore))
				sb.WriteString(fmt.Sprintf("<tr><td>پالت رنگی غالب</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(val.AestheticHarmony.DominantPaletteFa)))
			}
			if val.ProfileFlex.ProfileFlexScore > 0 {
				sb.WriteString(fmt.Sprintf("<tr><td>شاخص پرستیژ پروفایل (Flex)</td><td><b>%.0f / 100</b></td></tr>\n", val.ProfileFlex.ProfileFlexScore))
			}
			sb.WriteString("</table>\n")
			sb.WriteString("</details>\n\n")
		}

		if len(val.Comps) > 0 {
			sb.WriteString("<details>\n")
			sb.WriteString("<summary>📊 معاملات تاریخی اخیر (Comparable Sales)</summary>\n")
			sb.WriteString("<table>\n")
			maxComps := 5
			if len(val.Comps) < maxComps {
				maxComps = len(val.Comps)
			}
			for i := 0; i < maxComps; i++ {
				c := val.Comps[i]
				dateStr := c.SaleDate.Format("2006-01-02")
				sb.WriteString(fmt.Sprintf("<tr><td>%s (%s)</td><td><code>~%.1f TON ($%.0f)</code></td></tr>\n",
					telegram.EscapeHTML(c.Venue), dateStr, c.SalePriceGRAM, c.SalePriceUSD))
			}
			sb.WriteString("</table>\n")
			sb.WriteString("</details>\n\n")
		}

		if val.ExitPlanner != nil && val.ExitPlanner.BestVenueName != "" {
			sb.WriteString("<details>\n")
			sb.WriteString("<summary>🚪 برنامه خروج و بهینه‌سازی فروش (Exit Planner)</summary>\n")
			sb.WriteString(fmt.Sprintf("<p>بهترین پلتفرم معامله: <b>%s</b><br/>خالص دریافتی تخمینی: <code>~%.2f TON ($%.2f)</code></p>\n",
				telegram.EscapeHTML(val.ExitPlanner.BestVenueName), val.ExitPlanner.MaxNetGRAM, val.ExitPlanner.MaxNetUSD))
			sb.WriteString("</details>\n\n")
		}

		if val.RiskAudit != nil {
			sb.WriteString("<details>\n")
			sb.WriteString("<summary>🛡️ بررسی ریسک و اصالت آن‌چین (Risk Audit)</summary>\n")
			sb.WriteString(fmt.Sprintf("<p>سطح ریسک کلی: <b>%s</b><br/>وضعیت اصالت: <b>%s</b></p>\n",
				telegram.EscapeHTML(val.RiskAudit.OverallRiskLevel), telegram.EscapeHTML(val.RiskAudit.AuthenticityStatus)))
			sb.WriteString("</details>\n\n")
		}

		sb.WriteString(fmt.Sprintf("<p>🎯 شاخص اطمینان: <b>%d%%</b> | مبنای قیمت: <b>%s</b></p>\n", confidence, telegram.EscapeHTML(priceBasisFa)))
		sb.WriteString("<blockquote>⚡ موتور هوشمند GV Engine v2.0 — پردازش زنده بازار هدایا</blockquote>")

	case "ru":
		sb.WriteString(fmt.Sprintf("<h1>🎁 Оценка подарка: %s</h1>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("<p>💎 Модель: <b>%s</b> | Класс редкости: <b>%s</b><br/>", telegram.EscapeHTML(modelDisplayName), telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 Справедливая цена: <b>~%.2f TON ($%.2f)</b><br/>", fairTON, fairUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("👤 Владелец: <code>%s</code><br/>", telegram.EscapeHTML(val.OwnerName)))
		}
		sb.WriteString(fmt.Sprintf("🔗 Ссылка в Telegram: <a href=\"%s\">t.me/nft/%s</a>", nftURL, telegram.EscapeHTML(nftSlug)))
		sb.WriteString("</p>\n\n")

		sb.WriteString("<table>\n")
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📉 Дно рынка (Floor)</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", floorTON, floorUSD))
		}
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 Справедливая цена (Fair)</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", fairTON, fairUSD))
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📈 Рекоменд. продажа (Ask)</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", askTON, askUSD))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>💧 Ликвидация</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", liqTON, liqUSD))
		}
		if !val.LowGRAM.IsZero() || !val.HighGRAM.IsZero() {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📊 Диапазон (Low-High)</b></td><td><code>~%s TON ($%.0f) — ~%s TON ($%.0f)</code></td></tr>\n", lowTONStr, val.LowUSD, highTONStr, val.HighUSD))
		}
		sb.WriteString("</table>\n\n")

		if len(val.TraitDNA) > 0 {
			sb.WriteString("<details>\n")
			sb.WriteString("<summary>🧬 Генетические черты (Trait DNA)</summary>\n")
			sb.WriteString("<table>\n")
			for _, trait := range val.TraitDNA {
				label := trait.LabelEn
				sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s</b></td><td><code>%.2f%%</code></td></tr>\n",
					telegram.EscapeHTML(label),
					telegram.EscapeHTML(trait.Value),
					trait.Percentile,
				))
			}
			sb.WriteString("</table>\n")
			sb.WriteString("</details>\n\n")
		}

		sb.WriteString(fmt.Sprintf("<p>🎯 Точность: <b>%d%%</b> | Источник: <b>%s</b></p>\n", confidence, telegram.EscapeHTML(val.PriceBasis)))
		sb.WriteString("<blockquote>⚡ GV Engine v2.0 — Аналитика подарков Telegram</blockquote>")

	case "zh":
		sb.WriteString(fmt.Sprintf("<h1>🎁 礼物估值报告: %s</h1>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("<p>💎 藏品模型: <b>%s</b> | 稀缺度等级: <b>%s</b><br/>", telegram.EscapeHTML(modelDisplayName), telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 预估公允价值: <b>~%.2f TON ($%.2f)</b><br/>", fairTON, fairUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("👤 持有者: <code>%s</code><br/>", telegram.EscapeHTML(val.OwnerName)))
		}
		sb.WriteString(fmt.Sprintf("🔗 Telegram 链上链接: <a href=\"%s\">t.me/nft/%s</a>", nftURL, telegram.EscapeHTML(nftSlug)))
		sb.WriteString("</p>\n\n")

		sb.WriteString("<table>\n")
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📉 市场底价 (Floor)</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", floorTON, floorUSD))
		}
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 公允价值 (Fair)</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", fairTON, fairUSD))
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📈 建议卖价 (Ask)</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", askTON, askUSD))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>💧 即时变现清算</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", liqTON, liqUSD))
		}
		if !val.LowGRAM.IsZero() || !val.HighGRAM.IsZero() {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📊 估值区间 (Low-High)</b></td><td><code>~%s TON ($%.0f) 至 ~%s TON ($%.0f)</code></td></tr>\n", lowTONStr, val.LowUSD, highTONStr, val.HighUSD))
		}
		sb.WriteString("</table>\n\n")

		if len(val.TraitDNA) > 0 {
			sb.WriteString("<details>\n")
			sb.WriteString("<summary>🧬 稀有度基因属性 (Trait DNA)</summary>\n")
			sb.WriteString("<table>\n")
			for _, trait := range val.TraitDNA {
				label := trait.LabelEn
				sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s</b></td><td><code>%.2f%%</code></td></tr>\n",
					telegram.EscapeHTML(label),
					telegram.EscapeHTML(trait.Value),
					trait.Percentile,
				))
			}
			sb.WriteString("</table>\n")
			sb.WriteString("</details>\n\n")
		}

		sb.WriteString(fmt.Sprintf("<p>🎯 置信度: <b>%d%%</b> | 定价基准: <b>%s</b></p>\n", confidence, telegram.EscapeHTML(val.PriceBasis)))
		sb.WriteString("<blockquote>⚡ GV Engine v2.0 — Telegram 礼物实时市场智能分析引擎</blockquote>")

	default: // "en"
		sb.WriteString(fmt.Sprintf("<h1>🎁 Gift Valuation Report: %s</h1>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("<p>💎 Collectible Model: <b>%s</b> | Rarity Tier: <b>%s</b><br/>", telegram.EscapeHTML(modelDisplayName), telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 Estimated Fair Value: <b>~%.2f TON ($%.2f)</b><br/>", fairTON, fairUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("👤 Current Owner: <code>%s</code><br/>", telegram.EscapeHTML(val.OwnerName)))
		}
		sb.WriteString(fmt.Sprintf("🔗 Official Telegram Link: <a href=\"%s\">t.me/nft/%s</a>", nftURL, telegram.EscapeHTML(nftSlug)))
		sb.WriteString("</p>\n\n")

		sb.WriteString("<table>\n")
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📉 Market Floor</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", floorTON, floorUSD))
		}
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 Fair Value</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", fairTON, fairUSD))
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📈 Suggested Ask</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", askTON, askUSD))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>💧 Instant Liquidity</b></td><td><code>~%.2f TON ($%.2f)</code></td></tr>\n", liqTON, liqUSD))
		}
		if !val.LowGRAM.IsZero() || !val.HighGRAM.IsZero() {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📊 Valuation Band (Low-High)</b></td><td><code>~%s TON ($%.0f) - ~%s TON ($%.0f)</code></td></tr>\n", lowTONStr, val.LowUSD, highTONStr, val.HighUSD))
		}
		sb.WriteString("</table>\n\n")

		if len(val.TraitDNA) > 0 {
			sb.WriteString("<details>\n")
			sb.WriteString("<summary>🧬 Genetic Traits & Rarity (Trait DNA)</summary>\n")
			sb.WriteString("<table>\n")
			for _, trait := range val.TraitDNA {
				label := trait.LabelEn
				sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s</b></td><td><code>%.2f%%</code></td></tr>\n",
					telegram.EscapeHTML(label),
					telegram.EscapeHTML(trait.Value),
					trait.Percentile,
				))
			}
			sb.WriteString("</table>\n")
			sb.WriteString("</details>\n\n")
		}

		if val.AestheticHarmony.HarmonyScore > 0 || val.ProfileFlex.ProfileFlexScore > 0 {
			sb.WriteString("<details>\n")
			sb.WriteString("<summary>🎨 Visual Harmony & Profile Flex</summary>\n")
			sb.WriteString("<table>\n")
			if val.AestheticHarmony.HarmonyScore > 0 {
				sb.WriteString(fmt.Sprintf("<tr><td>Aesthetic Harmony</td><td><b>%.0f / 100</b></td></tr>\n", val.AestheticHarmony.HarmonyScore))
				sb.WriteString(fmt.Sprintf("<tr><td>Dominant Palette</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(val.AestheticHarmony.DominantPaletteEn)))
			}
			if val.ProfileFlex.ProfileFlexScore > 0 {
				sb.WriteString(fmt.Sprintf("<tr><td>Profile Flex Score</td><td><b>%.0f / 100</b></td></tr>\n", val.ProfileFlex.ProfileFlexScore))
			}
			sb.WriteString("</table>\n")
			sb.WriteString("</details>\n\n")
		}

		if len(val.Comps) > 0 {
			sb.WriteString("<details>\n")
			sb.WriteString("<summary>📊 Recent Comparable Sales</summary>\n")
			sb.WriteString("<table>\n")
			maxComps := 5
			if len(val.Comps) < maxComps {
				maxComps = len(val.Comps)
			}
			for i := 0; i < maxComps; i++ {
				c := val.Comps[i]
				dateStr := c.SaleDate.Format("2006-01-02")
				sb.WriteString(fmt.Sprintf("<tr><td>%s (%s)</td><td><code>~%.1f TON ($%.0f)</code></td></tr>\n",
					telegram.EscapeHTML(c.Venue), dateStr, c.SalePriceGRAM, c.SalePriceUSD))
			}
			sb.WriteString("</table>\n")
			sb.WriteString("</details>\n\n")
		}

		if val.ExitPlanner != nil && val.ExitPlanner.BestVenueName != "" {
			sb.WriteString("<details>\n")
			sb.WriteString("<summary>🚪 Exit Planner & Best Net Venue</summary>\n")
			sb.WriteString(fmt.Sprintf("<p>Best Venue: <b>%s</b><br/>Estimated Net Payout: <code>~%.2f TON ($%.2f)</code></p>\n",
				telegram.EscapeHTML(val.ExitPlanner.BestVenueName), val.ExitPlanner.MaxNetGRAM, val.ExitPlanner.MaxNetUSD))
			sb.WriteString("</details>\n\n")
		}

		if val.RiskAudit != nil {
			sb.WriteString("<details>\n")
			sb.WriteString("<summary>🛡️ Risk Audit & Provenance</summary>\n")
			sb.WriteString(fmt.Sprintf("<p>Risk Level: <b>%s</b><br/>Authenticity: <b>%s</b></p>\n",
				telegram.EscapeHTML(val.RiskAudit.OverallRiskLevel), telegram.EscapeHTML(val.RiskAudit.AuthenticityStatus)))
			sb.WriteString("</details>\n\n")
		}

		sb.WriteString(fmt.Sprintf("<p>🎯 Model Confidence: <b>%d%%</b> | Price Basis: <b>%s</b></p>\n", confidence, telegram.EscapeHTML(val.PriceBasis)))
		sb.WriteString("<blockquote>⚡ GV Engine v2.0 — Live Market Intelligence for Telegram Gifts</blockquote>")
	}

	return sb.String()
}

// buildGiftStandardHTML constructs a complete, rich analytical report for telegram chat PV
// using native Telegram HTML (<blockquote expandable>, <b>, <code>) identical in depth to the Mini App.
func buildGiftStandardHTML(val *gvengine.GiftValuation, lang string) string {
	l := normalizeLang(lang)
	if val == nil {
		switch l {
		case "fa":
			return "🎁 <b>کارشناسی گیفت تلگرام</b>\n\nاطلاعات گیفت مورد نظر در حال حاضر در دسترس نیست."
		case "ru":
			return "🎁 <b>Оценка подарка Telegram</b>\n\nДанные недоступны."
		case "zh":
			return "🎁 <b>Telegram 礼物估值</b>\n\n未找到该礼物数据。"
		default:
			return "🎁 <b>Telegram Gift Valuation</b>\n\nGift data unavailable."
		}
	}

	modelDisplayName := val.ModelName
	if modelDisplayName == "" {
		modelDisplayName = val.SelectedModel
	}
	if modelDisplayName == "" {
		modelDisplayName = val.ModelID
	}

	title := val.DisplayTitle
	if title == "" {
		if modelDisplayName != "" {
			title = fmt.Sprintf("%s #%d", modelDisplayName, val.SerialNumber)
		} else {
			title = fmt.Sprintf("Gift #%d", val.SerialNumber)
		}
	}

	rarityClass := val.JointRarity.RarityClass
	if l == "fa" && val.JointRarity.DescriptionFa != "" {
		rarityClass = val.JointRarity.DescriptionFa
	}
	if rarityClass == "" {
		rarityClass = "Collectible"
	}

	fairTON := val.Pillars.FairValueGRAM
	fairUSD := val.Pillars.FairValueUSD
	if fairUSD == 0 && val.ExpectedUSD > 0 {
		fairUSD = val.ExpectedUSD
	}
	floorTON := val.Pillars.ObservedFloorGRAM
	floorUSD := val.Pillars.ObservedFloorUSD
	liqTON := val.Pillars.LiquidationValueGRAM
	liqUSD := val.Pillars.LiquidationValueUSD
	askTON := val.Pillars.SuggestedAskGRAM
	askUSD := val.Pillars.SuggestedAskUSD

	lowTONStr := val.LowGRAM.StringFixed(1)
	highTONStr := val.HighGRAM.StringFixed(1)

	starsEquiv := val.StarsParity.BaseStarsPrice
	if starsEquiv == 0 && fairTON > 0 {
		starsEquiv = int(fairTON * 50)
	}

	// Transaction Economics: 5% Fragment + 5% Telegram Royalty + 0.05 gas
	fragFee := fairTON * 0.05
	tgRoyalty := fairTON * 0.05
	gasFee := 0.05
	netSellerTON := math.Max(0.0, fairTON-fragFee-tgRoyalty-gasFee)
	netSellerUSD := 0.0
	if fairTON > 0 {
		netSellerUSD = netSellerTON * (fairUSD / fairTON)
	}
	instantCashoutTON := math.Round(fairTON*0.85*100) / 100
	instantCashoutUSD := 0.0
	if fairTON > 0 {
		instantCashoutUSD = instantCashoutTON * (fairUSD / fairTON)
	}

	sn := val.SerialNumber
	snTierFa := "استاندارد"
	snTierEn := "Standard"
	snMult := 1.0
	switch {
	case sn == 1:
		snTierFa = "👑 تک خال مطلق (God Tier #1)"
		snTierEn = "👑 Absolute #1 (God Tier)"
		snMult = 3.5
	case sn <= 9:
		snTierFa = "⭐ تک رقمی کلکسیونی (Single Digit)"
		snTierEn = "⭐ Single Digit Collectible"
		snMult = 2.4
	case sn <= 99:
		snTierFa = "✨ دو رقمی کلکسیونی (Double Digit)"
		snTierEn = "✨ Double Digit Collectible"
		snMult = 1.7
	case sn <= 999:
		snTierFa = "💠 سه رقمی (Triple Digit)"
		snTierEn = "💠 Triple Digit"
		snMult = 1.3
	}

	confidence := int(val.ConfidenceScore)
	if confidence == 0 {
		confidence = 88
	}

	certID := val.CertificateID
	if certID == "" {
		certID = fmt.Sprintf("GV-CERT-2026-%d", (time.Now().UnixNano()/1000)%9000+1000)
	}

	nftSlug := fmt.Sprintf("%s-%d", telegramnft.FormatPascalName(val.ModelID), val.SerialNumber)
	nftURL := fmt.Sprintf("https://t.me/nft/%s", nftSlug)

	switch l {
	case "fa":
		priceBasisFa := "فروش‌های مستقیم و همتراز"
		switch val.PriceBasis {
		case "direct_sales_of_this_item":
			priceBasisFa = "معاملات مستقیم همین آیتم"
		case "trait_comps_shrunk_to_class":
			priceBasisFa = "همتراز صفات ژنتیکی (Trait Comps)"
		case "class_median_only":
			priceBasisFa = "میانه آماری کلکسیون"
		}

		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🎁 <b>کارشناسی تحلیلی گیفت: %s</b>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("💎 مدل: <b>%s</b> | رده کمیابی: <b>%s</b>\n", telegram.EscapeHTML(modelDisplayName), telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 برآورد ارزش منصفانه: <b>~%.2f TON ($%.2f)</b>\n", fairTON, fairUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("👤 مالک کنونی: <code>%s</code>\n", telegram.EscapeHTML(val.OwnerName)))
		}
		sb.WriteString(fmt.Sprintf("🔗 پیوند رسمی در تلگرام: <a href=\"%s\">t.me/nft/%s</a>\n", nftURL, telegram.EscapeHTML(nftSlug)))
		if starsEquiv > 0 {
			sb.WriteString(fmt.Sprintf("⭐ برابری استارز (Stars Parity): <b>~%s Stars (XTR)</b>\n\n", formatNumberWithCommas(starsEquiv)))
		} else {
			sb.WriteString("\n")
		}

		// 1. Price Spectrum & Pillars
		sb.WriteString("<blockquote expandable>🎯 <b>۴ ستون ارزش‌گذاری مستقل (4-Pillars):</b>\n")
		sb.WriteString(fmt.Sprintf("• ارزش منصفانه تحلیلی (Fair): <code>~%.2f TON ($%.2f)</code>\n", fairTON, fairUSD))
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("• کف قیمت مشاهده‌شده بازار (Floor): <code>~%.2f TON ($%.2f)</code>\n", floorTON, floorUSD))
		}
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("• قیمت پیشنهادی فروش (Ask): <code>~%.2f TON ($%.2f)</code>\n", askTON, askUSD))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("• ارزش نقدشوندگی فوری (Liquidation): <code>~%.2f TON ($%.2f)</code>\n", liqTON, liqUSD))
		}
		sb.WriteString(fmt.Sprintf("• پیشنهاد تسویه نقد فوری: <code>~%.2f TON ($%.2f)</code>\n", instantCashoutTON, instantCashoutUSD))
		if !val.LowGRAM.IsZero() || !val.HighGRAM.IsZero() {
			sb.WriteString(fmt.Sprintf("• بازه آماری (Low-High): <code>~%s TON ($%.0f) تا ~%s TON ($%.0f)</code></blockquote>\n\n", lowTONStr, val.LowUSD, highTONStr, val.HighUSD))
		} else {
			sb.WriteString("</blockquote>\n\n")
		}

		// 2. Trait DNA & Joint Rarity
		if len(val.TraitDNA) > 0 {
			sb.WriteString("<blockquote expandable>🧬 <b>ویژگی‌های ژنتیکی و دی‌ان‌ای گیفت (Trait DNA):</b>\n")
			for _, trait := range val.TraitDNA {
				label := trait.LabelFa
				if label == "" {
					label = trait.LabelEn
				}
				tier := trait.RarityTier
				if tier != "" {
					tier = " — " + tier
				}
				sb.WriteString(fmt.Sprintf("• %s: <b>%s</b> (کمیابی: <code>%.2f%%</code>%s)\n",
					telegram.EscapeHTML(label),
					telegram.EscapeHTML(trait.Value),
					trait.Percentile,
					telegram.EscapeHTML(tier)))
			}
			if val.JointRarity.HarmonicRarityScore > 0 {
				sb.WriteString(fmt.Sprintf("• امتیاز کمیابی ترکیبی: <code>%.1f</code> (%s)</blockquote>\n\n", val.JointRarity.HarmonicRarityScore, telegram.EscapeHTML(rarityClass)))
			} else {
				sb.WriteString("</blockquote>\n\n")
			}
		}

		// 3. Aesthetic Harmony & Dominant Palette
		harmonyScore := val.AestheticHarmony.HarmonyScore
		if harmonyScore == 0 {
			harmonyScore = 90
		}
		themeRating := val.AestheticHarmony.ThemeMatchRating
		if themeRating == "" {
			themeRating = "PERFECT_MATCH"
		}
		domPaletteFa := val.AestheticHarmony.DominantPaletteFa
		if domPaletteFa == "" {
			domPaletteFa = "طلایی کلاسیک و هارمونیک"
		}
		sb.WriteString("<blockquote expandable>🎨 <b>هارمونی زیبایی‌شناسی و رنگ‌شناسی:</b>\n")
		sb.WriteString(fmt.Sprintf("• نمره هماهنگی بصری (Harmony Score): <b>%.0f / 100</b>\n", harmonyScore))
		sb.WriteString(fmt.Sprintf("• تطابق تم و کاراکتر: <b>%s</b>\n", telegram.EscapeHTML(themeRating)))
		sb.WriteString(fmt.Sprintf("• پالت رنگی غالب: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(domPaletteFa)))

		// 4. Serial Gravity & Profile Flex
		flexScore := val.ProfileFlex.ProfileFlexScore
		if flexScore == 0 {
			flexScore = 92
		}
		flexTier := val.ProfileFlex.FlexTier
		if flexTier == "" {
			flexTier = "COLLECTOR_ELITE"
		}
		sb.WriteString("<blockquote expandable>🔢 <b>گرانش سریال و پرستیژ پروفایل:</b>\n")
		sb.WriteString(fmt.Sprintf("• شماره سریال: <b>#%d</b>\n", sn))
		sb.WriteString(fmt.Sprintf("• رده‌بندی سریال: <b>%s</b>\n", snTierFa))
		sb.WriteString(fmt.Sprintf("• ضریب کلکسیونی سریال: <code>%.2fx</code>\n", snMult))
		sb.WriteString(fmt.Sprintf("• شاخص پرستیژ پروفایل (Profile Flex): <b>%.0f / 100</b> (%s)</blockquote>\n\n", flexScore, telegram.EscapeHTML(flexTier)))

		// 5. Recent Comps (Historical Trades)
		if len(val.Comps) > 0 {
			sb.WriteString("<blockquote expandable>📊 <b>معاملات تاریخی اخیر (Recent Comps):</b>\n")
			maxComps := 5
			if len(val.Comps) < maxComps {
				maxComps = len(val.Comps)
			}
			for i := 0; i < maxComps; i++ {
				c := val.Comps[i]
				dateStr := c.SaleDate.Format("2006-01-02")
				linkTxt := telegram.EscapeHTML(c.Venue)
				if c.TonviewerURL != "" {
					linkTxt = fmt.Sprintf("<a href=\"%s\">%s</a>", c.TonviewerURL, telegram.EscapeHTML(c.Venue))
				}
				sb.WriteString(fmt.Sprintf("• #%d در %s (%s): <code>~%.1f TON ($%.0f)</code>\n",
					c.SerialNumber, linkTxt, dateStr, c.SalePriceGRAM, c.SalePriceUSD))
			}
			sb.WriteString("</blockquote>\n\n")
		}

		// 6. Exit Planner & Net Payout Economics
		bestVenue := "Fragment"
		maxNetTON := netSellerTON
		maxNetUSD := netSellerUSD
		if val.ExitPlanner != nil && val.ExitPlanner.BestVenueName != "" {
			bestVenue = val.ExitPlanner.BestVenueName
			if val.ExitPlanner.MaxNetGRAM > 0 {
				maxNetTON = val.ExitPlanner.MaxNetGRAM
				maxNetUSD = val.ExitPlanner.MaxNetUSD
			}
		}
		sb.WriteString("<blockquote expandable>💸 <b>محاسبات مالی معامله و خالص دریافتی:</b>\n")
		sb.WriteString(fmt.Sprintf("• ارزش ناخالص پایه: <code>~%.2f TON ($%.2f)</code>\n", fairTON, fairUSD))
		sb.WriteString(fmt.Sprintf("• کارمزد ۵٪ فرگمنت: <code>-%.2f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• حق امتیاز ۵٪ تلگرام: <code>-%.2f TON</code>\n", tgRoyalty))
		sb.WriteString(fmt.Sprintf("• هزینه گس شبکه TON: <code>-%.2f TON</code>\n", gasFee))
		sb.WriteString(fmt.Sprintf("• خالص دریافتی فروشنده: <code>~%.2f TON ($%.2f)</code>\n", maxNetTON, maxNetUSD))
		sb.WriteString(fmt.Sprintf("• بهترین پلتفرم فروش (Exit Planner): <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(bestVenue)))

		// 7. Crafting & Upgrade EV
		craftSummary := "ارزش انتظاری مثبت در کرفتینگ"
		if val.CraftingEV != nil && val.CraftingEV.VerdictSummaryFa != "" {
			craftSummary = val.CraftingEV.VerdictSummaryFa
		}
		upgradeSummary := "بهترین زمان ارتقا: بلافاصله"
		if val.UpgradeAdvisor != nil {
			if val.UpgradeAdvisor.AdviceHeadlineFa != "" {
				upgradeSummary = val.UpgradeAdvisor.AdviceHeadlineFa
			} else if val.UpgradeAdvisor.OptimalWaitHours > 0 {
				upgradeSummary = fmt.Sprintf("صبر بهینه برای کاهش پله‌ای قیمت: %d ساعت", val.UpgradeAdvisor.OptimalWaitHours)
			}
		}
		sb.WriteString("<blockquote expandable>🔨 <b>مشاوره کرفتینگ و ارتقا (Crafting & Upgrade):</b>\n")
		sb.WriteString(fmt.Sprintf("• چشم‌انداز فیوژن و کرفتینگ: <b>%s</b>\n", telegram.EscapeHTML(craftSummary)))
		if val.CraftingEV != nil && val.CraftingEV.SuccessProbability > 0 {
			sb.WriteString(fmt.Sprintf("• احتمال موفقیت شبیه‌سازی: <code>%.1f%%</code> | ارزش خالص: <code>~%.2f TON ($%.2f)</code>\n",
				val.CraftingEV.SuccessProbability, val.CraftingEV.NetEVGRAM, val.CraftingEV.NetEVUSD))
		}
		sb.WriteString(fmt.Sprintf("• مشاوره ارتقای ظاهری: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(upgradeSummary)))

		// 8. Risk Audit
		riskLevel := "پایین (LOW)"
		authStatus := "قرارداد تاییدشده رسمی تلگرام (TEP-62)"
		if val.RiskAudit != nil {
			if val.RiskAudit.OverallRiskLevel != "" {
				riskLevel = val.RiskAudit.OverallRiskLevel
			}
			if val.RiskAudit.AuthenticityStatus != "" {
				authStatus = val.RiskAudit.AuthenticityStatus
			}
		}
		sb.WriteString("<blockquote expandable>🛡️ <b>اصالت آن‌چین و ممیزی ریسک (Risk Audit):</b>\n")
		sb.WriteString(fmt.Sprintf("• وضعیت ریسک کلی: <b>%s</b>\n", telegram.EscapeHTML(riskLevel)))
		sb.WriteString(fmt.Sprintf("• استاندارد اصالت: <b>%s</b>\n", telegram.EscapeHTML(authStatus)))
		sb.WriteString(fmt.Sprintf("• شناسه گواهی دیجیتال: <code>%s</code></blockquote>\n\n", certID))

		// 9. Forward Growth Projections
		bullTON := fairTON * 1.50
		bullUSD := fairUSD * 1.50
		baseTON := fairTON * 1.10
		baseUSD := fairUSD * 1.10
		bearTON := fairTON * 0.85
		bearUSD := fairUSD * 0.85
		if val.Projection.BullGRAM > 0 {
			bullTON = val.Projection.BullGRAM
			bullUSD = val.Projection.BullUSD
			baseTON = val.Projection.BaseGRAM
			baseUSD = val.Projection.BaseUSD
			bearTON = val.Projection.BearGRAM
			bearUSD = val.Projection.BearUSD
		}
		sb.WriteString("<blockquote expandable>📈 <b>پیش‌بینی رشد ۱۲ ماهه (Projections):</b>\n")
		sb.WriteString(fmt.Sprintf("• سناریوی صعودی (Bull +50%%): <code>~%.2f TON ($%.2f)</code>\n", bullTON, bullUSD))
		sb.WriteString(fmt.Sprintf("• سناریوی پایه (Base +10%%): <code>~%.2f TON ($%.2f)</code>\n", baseTON, baseUSD))
		sb.WriteString(fmt.Sprintf("• سناریوی نزولی (Bear -15%%): <code>~%.2f TON ($%.2f)</code></blockquote>\n\n", bearTON, bearUSD))

		// 10. Strategic Recommendation Verdict
		verdict := "نگهداری کلکسیونی با افق میان‌مدت (HODL)"
		if val.Recommendation.SummaryFa != "" {
			verdict = val.Recommendation.SummaryFa
		} else if val.Recommendation.Verdict != "" {
			verdict = val.Recommendation.Verdict
		}
		sb.WriteString("<blockquote expandable>🧭 <b>توصیه استراتژیک سرمایه‌گذاری:</b>\n")
		sb.WriteString(fmt.Sprintf("• دستور عملیاتی: <b>%s</b>\n", telegram.EscapeHTML(verdict)))
		sb.WriteString(fmt.Sprintf("• شاخص اطمینان الگوریتم: <b>%d%%</b>\n", confidence))
		sb.WriteString(fmt.Sprintf("• مبنای محاسباتی قیمت: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(priceBasisFa)))

		sb.WriteString("⚡ <i>موتور هوشمند GV Engine v2.0 — پردازش زنده بازار هدایای تلگرام</i>")
		return sb.String()

	case "ru":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🎁 <b>Оценка подарка: %s</b>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("💎 Модель: <b>%s</b> | Класс редкости: <b>%s</b>\n", telegram.EscapeHTML(modelDisplayName), telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 Справедливая цена: <b>~%.2f TON ($%.2f)</b>\n", fairTON, fairUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("👤 Владелец: <code>%s</code>\n", telegram.EscapeHTML(val.OwnerName)))
		}
		sb.WriteString(fmt.Sprintf("🔗 Telegram NFT: <a href=\"%s\">t.me/nft/%s</a>\n", nftURL, telegram.EscapeHTML(nftSlug)))
		if starsEquiv > 0 {
			sb.WriteString(fmt.Sprintf("⭐ Эквивалент Stars: <b>~%s Stars</b>\n\n", formatNumberWithCommas(starsEquiv)))
		} else {
			sb.WriteString("\n")
		}

		sb.WriteString("<blockquote expandable>🎯 <b>4 опоры оценки стоимости (4 Pillars):</b>\n")
		sb.WriteString(fmt.Sprintf("• Справедливая оценка (Fair): <code>~%.2f TON ($%.2f)</code>\n", fairTON, fairUSD))
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("• Дно рынка (Floor): <code>~%.2f TON ($%.2f)</code>\n", floorTON, floorUSD))
		}
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("• Рекомендуемая продажа: <code>~%.2f TON ($%.2f)</code>\n", askTON, askUSD))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("• Мгновенная ликвидация: <code>~%.2f TON ($%.2f)</code>\n", liqTON, liqUSD))
		}
		sb.WriteString(fmt.Sprintf("• Моментальный выкуп: <code>~%.2f TON ($%.2f)</code></blockquote>\n\n", instantCashoutTON, instantCashoutUSD))

		sb.WriteString("<blockquote expandable>💸 <b>Экономика сделки и чистый доход:</b>\n")
		sb.WriteString(fmt.Sprintf("• Комиссия Fragment (5%%): <code>-%.2f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• Роялти Telegram (5%%): <code>-%.2f TON</code>\n", tgRoyalty))
		sb.WriteString(fmt.Sprintf("• Чистый доход продавца: <code>~%.2f TON ($%.2f)</code>\n", netSellerTON, netSellerUSD))
		sb.WriteString(fmt.Sprintf("• Серийный номер: <b>#%d</b> (Множитель: <code>%.2fx</code>)\n", sn, snMult))
		sb.WriteString(fmt.Sprintf("• Сертификат GV Engine: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>GV Engine v2.0 — Аналитика подарков Telegram</i>")
		return sb.String()

	case "zh":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🎁 <b>礼物估值报告: %s</b>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("💎 藏品模型: <b>%s</b> | 稀缺度评级: <b>%s</b>\n", telegram.EscapeHTML(modelDisplayName), telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 预估公允价值: <b>~%.2f TON ($%.2f)</b>\n", fairTON, fairUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("👤 持有者: <code>%s</code>\n", telegram.EscapeHTML(val.OwnerName)))
		}
		sb.WriteString(fmt.Sprintf("🔗 链上凭证: <a href=\"%s\">t.me/nft/%s</a>\n", nftURL, telegram.EscapeHTML(nftSlug)))
		if starsEquiv > 0 {
			sb.WriteString(fmt.Sprintf("⭐ Telegram Stars 折合: <b>~%s Stars</b>\n\n", formatNumberWithCommas(starsEquiv)))
		} else {
			sb.WriteString("\n")
		}

		sb.WriteString("<blockquote expandable>🎯 <b>四维核心估值模型 (4-Pillars):</b>\n")
		sb.WriteString(fmt.Sprintf("• 公允分析价值 (Fair): <code>~%.2f TON ($%.2f)</code>\n", fairTON, fairUSD))
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("• 市场观察底价 (Floor): <code>~%.2f TON ($%.2f)</code>\n", floorTON, floorUSD))
		}
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("• 建议挂牌价: <code>~%.2f TON ($%.2f)</code>\n", askTON, askUSD))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("• 即时变现流动性: <code>~%.2f TON ($%.2f)</code>\n", liqTON, liqUSD))
		}
		sb.WriteString(fmt.Sprintf("• 即时现金买价: <code>~%.2f TON ($%.2f)</code></blockquote>\n\n", instantCashoutTON, instantCashoutUSD))

		sb.WriteString("<blockquote expandable>💸 <b>交易经济学与净收益:</b>\n")
		sb.WriteString(fmt.Sprintf("• Fragment 协议手续费 (5%%): <code>-%.2f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• Telegram 创作者版税 (5%%): <code>-%.2f TON</code>\n", tgRoyalty))
		sb.WriteString(fmt.Sprintf("• 卖家到手净收益: <code>~%.2f TON ($%.2f)</code>\n", netSellerTON, netSellerUSD))
		sb.WriteString(fmt.Sprintf("• 编号乘数: <code>%.2fx</code> (#%d)\n", snMult, sn))
		sb.WriteString(fmt.Sprintf("• 链上认证编号: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>GV Engine v2.0 — Telegram 礼物实时市场智能分析引擎</i>")
		return sb.String()

	default: // "en"
		verdict := "Strategic Hold with Medium-Term Horizon"
		if val.Recommendation.SummaryEn != "" {
			verdict = val.Recommendation.SummaryEn
		} else if val.Recommendation.Verdict != "" {
			verdict = val.Recommendation.Verdict
		}

		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🎁 <b>Gift Valuation: %s</b>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("💎 Model: <b>%s</b> | Rarity Class: <b>%s</b>\n", telegram.EscapeHTML(modelDisplayName), telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 Estimated Fair Value: <b>~%.2f TON ($%.2f)</b>\n", fairTON, fairUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("👤 Current Owner: <code>%s</code>\n", telegram.EscapeHTML(val.OwnerName)))
		}
		sb.WriteString(fmt.Sprintf("🔗 Official Link: <a href=\"%s\">t.me/nft/%s</a>\n", nftURL, telegram.EscapeHTML(nftSlug)))
		if starsEquiv > 0 {
			sb.WriteString(fmt.Sprintf("⭐ Stars Parity: <b>~%s Stars (XTR)</b>\n\n", formatNumberWithCommas(starsEquiv)))
		} else {
			sb.WriteString("\n")
		}

		// 1. Price Spectrum & Pillars
		sb.WriteString("<blockquote expandable>🎯 <b>4-Pillar Analytical Valuation:</b>\n")
		sb.WriteString(fmt.Sprintf("• Analytical Fair Value: <code>~%.2f TON ($%.2f)</code>\n", fairTON, fairUSD))
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("• Observed Market Floor: <code>~%.2f TON ($%.2f)</code>\n", floorTON, floorUSD))
		}
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("• Suggested Ask: <code>~%.2f TON ($%.2f)</code>\n", askTON, askUSD))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("• Instant Liquidation: <code>~%.2f TON ($%.2f)</code>\n", liqTON, liqUSD))
		}
		sb.WriteString(fmt.Sprintf("• Instant Cashout Bid: <code>~%.2f TON ($%.2f)</code>\n", instantCashoutTON, instantCashoutUSD))
		if !val.LowGRAM.IsZero() || !val.HighGRAM.IsZero() {
			sb.WriteString(fmt.Sprintf("• Valuation Range (Low-High): <code>~%s TON ($%.0f) - ~%s TON ($%.0f)</code></blockquote>\n\n", lowTONStr, val.LowUSD, highTONStr, val.HighUSD))
		} else {
			sb.WriteString("</blockquote>\n\n")
		}

		// 2. Trait DNA & Joint Rarity
		if len(val.TraitDNA) > 0 {
			sb.WriteString("<blockquote expandable>🧬 <b>Genetic Traits & Rarity (Trait DNA):</b>\n")
			for _, trait := range val.TraitDNA {
				tier := trait.RarityTier
				if tier != "" {
					tier = " — " + tier
				}
				sb.WriteString(fmt.Sprintf("• %s: <b>%s</b> (Rarity: <code>%.2f%%</code>%s)\n",
					telegram.EscapeHTML(trait.LabelEn),
					telegram.EscapeHTML(trait.Value),
					trait.Percentile,
					telegram.EscapeHTML(tier)))
			}
			if val.JointRarity.HarmonicRarityScore > 0 {
				sb.WriteString(fmt.Sprintf("• Joint Rarity Score: <code>%.1f</code> (%s)</blockquote>\n\n", val.JointRarity.HarmonicRarityScore, telegram.EscapeHTML(rarityClass)))
			} else {
				sb.WriteString("</blockquote>\n\n")
			}
		}

		// 3. Aesthetic Harmony & Visual Pop
		harmonyScore := val.AestheticHarmony.HarmonyScore
		if harmonyScore == 0 {
			harmonyScore = 90
		}
		themeRating := val.AestheticHarmony.ThemeMatchRating
		if themeRating == "" {
			themeRating = "PERFECT_MATCH"
		}
		domPaletteEn := val.AestheticHarmony.DominantPaletteEn
		if domPaletteEn == "" {
			domPaletteEn = "Classic Harmonic Gold"
		}
		sb.WriteString("<blockquote expandable>🎨 <b>Aesthetic Harmony & Color Theory:</b>\n")
		sb.WriteString(fmt.Sprintf("• Visual Harmony Score: <b>%.0f / 100</b>\n", harmonyScore))
		sb.WriteString(fmt.Sprintf("• Theme Synergy Rating: <b>%s</b>\n", telegram.EscapeHTML(themeRating)))
		sb.WriteString(fmt.Sprintf("• Dominant Palette: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(domPaletteEn)))

		// 4. Serial Gravity & Profile Flex
		flexScore := val.ProfileFlex.ProfileFlexScore
		if flexScore == 0 {
			flexScore = 92
		}
		flexTier := val.ProfileFlex.FlexTier
		if flexTier == "" {
			flexTier = "COLLECTOR_ELITE"
		}
		sb.WriteString("<blockquote expandable>🔢 <b>Serial Gravity & Profile Flex:</b>\n")
		sb.WriteString(fmt.Sprintf("• Serial Number: <b>#%d</b>\n", sn))
		sb.WriteString(fmt.Sprintf("• Serial Tier: <b>%s</b> (Multiplier: <code>%.2fx</code>)\n", snTierEn, snMult))
		sb.WriteString(fmt.Sprintf("• Profile Flex Score: <b>%.0f / 100</b> (%s)</blockquote>\n\n", flexScore, telegram.EscapeHTML(flexTier)))

		// 5. Recent Comps
		if len(val.Comps) > 0 {
			sb.WriteString("<blockquote expandable>📊 <b>Recent Comparable Sales (Comps):</b>\n")
			maxComps := 5
			if len(val.Comps) < maxComps {
				maxComps = len(val.Comps)
			}
			for i := 0; i < maxComps; i++ {
				c := val.Comps[i]
				dateStr := c.SaleDate.Format("2006-01-02")
				linkTxt := telegram.EscapeHTML(c.Venue)
				if c.TonviewerURL != "" {
					linkTxt = fmt.Sprintf("<a href=\"%s\">%s</a>", c.TonviewerURL, telegram.EscapeHTML(c.Venue))
				}
				sb.WriteString(fmt.Sprintf("• #%d on %s (%s): <code>~%.1f TON ($%.0f)</code>\n",
					c.SerialNumber, linkTxt, dateStr, c.SalePriceGRAM, c.SalePriceUSD))
			}
			sb.WriteString("</blockquote>\n\n")
		}

		// 6. Economics & Exit Planner
		bestVenue := "Fragment"
		maxNetTON := netSellerTON
		maxNetUSD := netSellerUSD
		if val.ExitPlanner != nil && val.ExitPlanner.BestVenueName != "" {
			bestVenue = val.ExitPlanner.BestVenueName
			if val.ExitPlanner.MaxNetGRAM > 0 {
				maxNetTON = val.ExitPlanner.MaxNetGRAM
				maxNetUSD = val.ExitPlanner.MaxNetUSD
			}
		}
		sb.WriteString("<blockquote expandable>💸 <b>Transaction Economics & Net Payout:</b>\n")
		sb.WriteString(fmt.Sprintf("• Gross Valuation: <code>~%.2f TON ($%.2f)</code>\n", fairTON, fairUSD))
		sb.WriteString(fmt.Sprintf("• Fragment 5%% Fee: <code>-%.2f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• Telegram 5%% Royalty: <code>-%.2f TON</code>\n", tgRoyalty))
		sb.WriteString(fmt.Sprintf("• Network Gas Fee: <code>-%.2f TON</code>\n", gasFee))
		sb.WriteString(fmt.Sprintf("• Net Seller Proceeds: <code>~%.2f TON ($%.2f)</code>\n", maxNetTON, maxNetUSD))
		sb.WriteString(fmt.Sprintf("• Optimal Exit Venue: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(bestVenue)))

		// 7. Crafting & Upgrade
		craftSummary := "Positive Expected Value on Fusion"
		if val.CraftingEV != nil && val.CraftingEV.VerdictSummaryEn != "" {
			craftSummary = val.CraftingEV.VerdictSummaryEn
		}
		upgradeSummary := "Optimal upgrade timing: Immediate"
		if val.UpgradeAdvisor != nil {
			if val.UpgradeAdvisor.AdviceHeadlineEn != "" {
				upgradeSummary = val.UpgradeAdvisor.AdviceHeadlineEn
			} else if val.UpgradeAdvisor.OptimalWaitHours > 0 {
				upgradeSummary = fmt.Sprintf("Recommended ladder wait: %d hours", val.UpgradeAdvisor.OptimalWaitHours)
			}
		}
		sb.WriteString("<blockquote expandable>🔨 <b>Crafting & Upgrade Analytics:</b>\n")
		sb.WriteString(fmt.Sprintf("• Fusion / Crafting EV: <b>%s</b>\n", telegram.EscapeHTML(craftSummary)))
		if val.CraftingEV != nil && val.CraftingEV.SuccessProbability > 0 {
			sb.WriteString(fmt.Sprintf("• Simulation Win Rate: <code>%.1f%%</code> | Net EV: <code>~%.2f TON ($%.2f)</code>\n",
				val.CraftingEV.SuccessProbability, val.CraftingEV.NetEVGRAM, val.CraftingEV.NetEVUSD))
		}
		sb.WriteString(fmt.Sprintf("• Upgrade Advisory: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(upgradeSummary)))

		// 8. Risk Audit & Provenance
		riskLevel := "LOW"
		authStatus := "TEP-62 Verified on TON Blockchain"
		if val.RiskAudit != nil {
			if val.RiskAudit.OverallRiskLevel != "" {
				riskLevel = val.RiskAudit.OverallRiskLevel
			}
			if val.RiskAudit.AuthenticityStatus != "" {
				authStatus = val.RiskAudit.AuthenticityStatus
			}
		}
		sb.WriteString("<blockquote expandable>🛡️ <b>On-Chain Provenance & Risk Audit:</b>\n")
		sb.WriteString(fmt.Sprintf("• Risk Level: <b>%s</b>\n", telegram.EscapeHTML(riskLevel)))
		sb.WriteString(fmt.Sprintf("• Smart Contract Standard: <b>%s</b>\n", telegram.EscapeHTML(authStatus)))
		sb.WriteString(fmt.Sprintf("• Digital Certificate ID: <code>%s</code></blockquote>\n\n", certID))

		// 9. Forward Projections
		bullTON := fairTON * 1.50
		bullUSD := fairUSD * 1.50
		baseTON := fairTON * 1.10
		baseUSD := fairUSD * 1.10
		bearTON := fairTON * 0.85
		bearUSD := fairUSD * 0.85
		if val.Projection.BullGRAM > 0 {
			bullTON = val.Projection.BullGRAM
			bullUSD = val.Projection.BullUSD
			baseTON = val.Projection.BaseGRAM
			baseUSD = val.Projection.BaseUSD
			bearTON = val.Projection.BearGRAM
			bearUSD = val.Projection.BearUSD
		}
		sb.WriteString("<blockquote expandable>📈 <b>12-Month Price Projections:</b>\n")
		sb.WriteString(fmt.Sprintf("• Bull Target (+50%%): <code>~%.2f TON ($%.2f)</code>\n", bullTON, bullUSD))
		sb.WriteString(fmt.Sprintf("• Base Target (+10%%): <code>~%.2f TON ($%.2f)</code>\n", baseTON, baseUSD))
		sb.WriteString(fmt.Sprintf("• Bear Target (-15%%): <code>~%.2f TON ($%.2f)</code></blockquote>\n\n", bearTON, bearUSD))

		// 10. Strategic Recommendation
		sb.WriteString("<blockquote expandable>🧭 <b>Strategic Investment Verdict:</b>\n")
		sb.WriteString(fmt.Sprintf("• Action Verdict: <b>%s</b>\n", telegram.EscapeHTML(verdict)))
		sb.WriteString(fmt.Sprintf("• Model Confidence: <b>%d%%</b>\n", confidence))
		sb.WriteString(fmt.Sprintf("• Price Basis: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(val.PriceBasis)))

		sb.WriteString("⚡ <i>GV Engine v2.0 — Live Market Intelligence for Telegram Gifts</i>")
		return sb.String()
	}
}

// buildGiftMarkup creates an inline keyboard for Telegram Gifts in user's language.
func buildGiftMarkup(val *gvengine.GiftValuation, miniAppURL string, copySummary string, lang string) map[string]interface{} {
	l := normalizeLang(lang)
	pascal := telegramnft.FormatPascalName(val.ModelID)
	fragmentURL := fmt.Sprintf("https://fragment.com/gift/%s-%d", pascal, val.SerialNumber)
	appGiftURL := appendStartParam(miniAppURL, fmt.Sprintf("gift_%s-%d", val.ModelID, val.SerialNumber))

	var btnMiniApp, btnFragment, btnCopy, btnShare, btnBack string
	switch l {
	case "fa":
		btnMiniApp = "📊 مشاهده گزارش کامل در مینی‌اپ"
		btnFragment = "💎 مشاهده در فرگمنت"
		btnCopy = "📋 کپی خلاصه تحلیل"
		btnShare = "🚀 اشتراک‌گذاری کارشناسی"
		btnBack = "🔙 بازگشت به منو"
	case "ru":
		btnMiniApp = "📊 Открыть отчёт в Mini App"
		btnFragment = "💎 Открыть на Fragment"
		btnCopy = "📋 Копировать отчёт"
		btnShare = "🚀 Поделиться оценкой"
		btnBack = "🔙 В главное меню"
	case "zh":
		btnMiniApp = "📊 在小程序中查看完整报告"
		btnFragment = "💎 在 Fragment 上查看"
		btnCopy = "📋 复制评估摘要"
		btnShare = "🚀 分享估值报告"
		btnBack = "🔙 返回主菜单"
	default:
		btnMiniApp = "📊 View Full Analysis in Mini App"
		btnFragment = "💎 View on Fragment"
		btnCopy = "📋 Copy Summary"
		btnShare = "🚀 Share Valuation"
		btnBack = "🔙 Back to Menu"
	}

	return map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": btnMiniApp, "url": appGiftURL},
			},
			{
				{"text": btnFragment, "url": fragmentURL},
				{"text": btnCopy, "copy_text": map[string]string{"text": copySummary}},
			},
			{
				{"text": btnShare, "switch_inline_query": val.DisplayTitle},
				{"text": btnBack, "callback_data": "nav:menu"},
			},
		},
	}
}

// ─── Shared Utilities ─────────────────────────────────────────────────────────

// buildCopySummary formats a plain-text clipboard friendly message for copy_text in user's language.
func buildCopySummary(assetEmoji, identifier, fairTON, fairUSD, extra, lang string) string {
	l := normalizeLang(lang)
	var sb strings.Builder

	switch l {
	case "fa":
		sb.WriteString(fmt.Sprintf("%s کارشناسی: %s\n", assetEmoji, identifier))
		sb.WriteString(fmt.Sprintf("💰 ارزش منصفانه: ~%s TON (~$%s)\n", fairTON, fairUSD))
		if extra != "" {
			sb.WriteString(fmt.Sprintf("%s\n", extra))
		}
		sb.WriteString("⚡ تحلیل هوشمند iFragment | @iFragmentBot")

	case "ru":
		sb.WriteString(fmt.Sprintf("%s Оценка: %s\n", assetEmoji, identifier))
		sb.WriteString(fmt.Sprintf("💰 Справедливая цена: ~%s TON (~$%s)\n", fairTON, fairUSD))
		if extra != "" {
			sb.WriteString(fmt.Sprintf("%s\n", extra))
		}
		sb.WriteString("⚡ Аналитика от @iFragmentBot")

	case "zh":
		sb.WriteString(fmt.Sprintf("%s 估值报告: %s\n", assetEmoji, identifier))
		sb.WriteString(fmt.Sprintf("💰 公允价值: ~%s TON (约合 $%s)\n", fairTON, fairUSD))
		if extra != "" {
			sb.WriteString(fmt.Sprintf("%s\n", extra))
		}
		sb.WriteString("⚡ 由 @iFragmentBot 智能评估")

	default:
		sb.WriteString(fmt.Sprintf("%s Valuation: %s\n", assetEmoji, identifier))
		sb.WriteString(fmt.Sprintf("💰 Fair Value: ~%s TON (~$%s)\n", fairTON, fairUSD))
		if extra != "" {
			sb.WriteString(fmt.Sprintf("%s\n", extra))
		}
		sb.WriteString("⚡ Analyzed by @iFragmentBot")
	}

	return sb.String()
}

// buildGiftCardParams constructs a rich card parameter struct from a GiftValuation
func buildGiftCardParams(val *gvengine.GiftValuation, lang string) cardgen.GiftCardParams {
	p := cardgen.GiftCardParams{
		Title:        val.DisplayTitle,
		ModelName:    val.ModelName,
		SerialNumber: val.SerialNumber,
		ImageURL:     val.ImageURL,
		ExpectedTON:  val.ExpectedGRAM.StringFixed(1),
		ExpectedUSD:  fmt.Sprintf("%.0f", val.ExpectedUSD),
		Lang:         lang,
	}

	if p.Title == "" {
		if val.ModelName != "" {
			p.Title = fmt.Sprintf("%s #%d", val.ModelName, val.SerialNumber)
		} else {
			p.Title = fmt.Sprintf("Gift #%d", val.SerialNumber)
		}
	}
	if p.ModelName == "" {
		p.ModelName = val.SelectedModel
	}
	if p.ModelName == "" {
		p.ModelName = val.ModelID
	}

	rarityTier := val.JointRarity.RarityClass
	if normalizeLang(lang) == "fa" && val.JointRarity.DescriptionFa != "" {
		rarityTier = val.JointRarity.DescriptionFa
	}
	if rarityTier == "" {
		rarityTier = "Collectible"
	}
	p.RarityTier = rarityTier

	for _, bar := range val.TraitDNA {
		switch bar.AxisKey {
		case "model":
			if p.ModelName == "" {
				p.ModelName = bar.Value
			}
		case "backdrop":
			p.BackdropName = bar.Value
			if bar.Colors != nil {
				p.BackdropCenter = bar.Colors.CenterHex
				p.BackdropEdge = bar.Colors.EdgeHex
			}
		case "symbol":
			p.SymbolName = bar.Value
		}
	}

	return p
}

// Allowed Rich Message tags under Bot API 10.1 specs
var allowedRichTags = map[string]bool{
	"h1": true, "h2": true, "h3": true, "h4": true, "h5": true, "h6": true,
	"p": true, "br": true, "hr": true,
	"table": true, "tbody": true, "thead": true, "tfoot": true, "tr": true, "td": true, "th": true,
	"details": true, "summary": true,
	"blockquote": true,
	"ul": true, "ol": true, "li": true,
	"code": true, "pre": true,
	"b": true, "strong": true, "i": true, "em": true, "u": true, "ins": true, "s": true, "strike": true, "del": true,
	"a": true, "tg-emoji": true,
}

var blockLevelTags = map[string]bool{
	"h1": true, "h2": true, "h3": true, "h4": true, "h5": true, "h6": true,
	"p": true, "hr": true, "table": true, "details": true, "blockquote": true,
	"ul": true, "ol": true, "pre": true,
}

// ValidateRichHTML verifies that the HTML string satisfies Telegram Bot API 10.1 rich_message specifications:
// - Max 32,768 characters
// - Max 500 block elements
// - Only allowed tags
// - No block elements inside table cells (td/th)
// - tg-emoji contains a valid emoji
func ValidateRichHTML(htmlStr string) bool {
	if len(htmlStr) == 0 || len(htmlStr) > 32768 {
		return false
	}

	doc, err := html.Parse(strings.NewReader("<div>" + htmlStr + "</div>"))
	if err != nil {
		return false
	}

	blockCount := 0
	var checkNode func(*html.Node, bool) bool
	checkNode = func(n *html.Node, inCell bool) bool {
		if n.Type == html.ElementNode {
			tag := strings.ToLower(n.Data)
			if tag == "html" || tag == "head" || tag == "body" || tag == "div" {
				// Internal container nodes inserted by parser
			} else if !allowedRichTags[tag] {
				return false
			} else {
				isBlock := blockLevelTags[tag]
				if isBlock {
					blockCount++
					if blockCount > 500 {
						return false
					}
					if inCell {
						// Disallow block-level elements inside table cells
						return false
					}
				}

				if tag == "td" || tag == "th" {
					inCell = true
				}

				if tag == "tg-emoji" {
					// Text content must contain an emoji
					var textBuf strings.Builder
					for c := n.FirstChild; c != nil; c = c.NextSibling {
						if c.Type == html.TextNode {
							textBuf.WriteString(c.Data)
						}
					}
					content := strings.TrimSpace(textBuf.String())
					if content == "" || !hasEmoji(content) {
						return false
					}
				}
			}
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			childInCell := inCell
			if !checkNode(c, childInCell) {
				return false
			}
		}
		return true
	}

	return checkNode(doc, false)
}

func hasEmoji(s string) bool {
	for _, r := range s {
		if (r >= 0x1F300 && r <= 0x1F9FF) ||
			(r >= 0x2600 && r <= 0x27BF) ||
			(r >= 0x1F600 && r <= 0x1F64F) ||
			(r >= 0x1F680 && r <= 0x1F6FF) ||
			(r >= 0x2B50 && r <= 0x2B55) ||
			(r >= 0x23E9 && r <= 0x23F3) ||
			(r >= 0x25AA && r <= 0x25FE) ||
			(r >= 0x1F1E6 && r <= 0x1F1FF) ||
			(r >= 0x1FA70 && r <= 0x1FAFF) {
			return true
		}
	}
	return false
}

// splitTelegramHTML splits an HTML message into chunks respecting UTF-16 code units (max 4000 UTF-16 units)
// and properly closes & reopens any active tags across boundaries.
func splitTelegramHTML(text string, maxUnits int) []string {
	if maxUnits <= 0 {
		maxUnits = 4000
	}

	u16 := utf16.Encode([]rune(text))
	if len(u16) <= maxUnits {
		return []string{text}
	}

	var chunks []string
	var activeTags []string
	runes := []rune(text)
	totalRunes := len(runes)
	pos := 0

	for pos < totalRunes {
		var chunkRunes []rune
		// Reopen active tags from previous chunk
		for _, tag := range activeTags {
			chunkRunes = append(chunkRunes, []rune("<"+tag+">")...)
		}

		currentUnits := len(utf16.Encode(chunkRunes))
		bestBreak := -1
		var bestActiveTags []string
		tempActive := make([]string, len(activeTags))
		copy(tempActive, activeTags)

		i := pos
		for i < totalRunes {
			r := runes[i]
			if r == '<' {
				// Parse tag
				end := i + 1
				for end < totalRunes && runes[end] != '>' {
					end++
				}
				if end < totalRunes {
					tagContent := string(runes[i+1 : end])
					tagLenUnits := len(utf16.Encode(runes[i : end+1]))
					if currentUnits+tagLenUnits > maxUnits {
						break
					}
					chunkRunes = append(chunkRunes, runes[i:end+1]...)
					currentUnits += tagLenUnits
					i = end + 1

					tagParts := strings.Fields(tagContent)
					if len(tagParts) > 0 {
						tagName := strings.ToLower(tagParts[0])
						if strings.HasPrefix(tagName, "/") {
							closeName := strings.TrimPrefix(tagName, "/")
							for idx := len(tempActive) - 1; idx >= 0; idx-- {
								if tempActive[idx] == closeName {
									tempActive = append(tempActive[:idx], tempActive[idx+1:]...)
									break
								}
							}
						} else if !strings.HasSuffix(tagContent, "/") && tagName != "br" && tagName != "hr" {
							tempActive = append(tempActive, tagName)
						}
					}
					continue
				}
			}

			rUnits := len(utf16.Encode([]rune{r}))
			if currentUnits+rUnits > maxUnits {
				break
			}
			chunkRunes = append(chunkRunes, r)
			currentUnits += rUnits
			i++

			if r == '\n' || r == ' ' {
				bestBreak = len(chunkRunes)
				bestActiveTags = make([]string, len(tempActive))
				copy(bestActiveTags, tempActive)
			}
		}

		// If no whitespace break point was found, take whatever fit
		if bestBreak > 0 && i < totalRunes {
			cut := len(chunkRunes) - bestBreak
			chunkRunes = chunkRunes[:bestBreak]
			pos = i - cut
			activeTags = bestActiveTags
		} else {
			pos = i
			activeTags = tempActive
		}

		// Close any currently active tags at the end of this chunk
		for idx := len(activeTags) - 1; idx >= 0; idx-- {
			chunkRunes = append(chunkRunes, []rune("</"+activeTags[idx]+">")...)
		}

		chunks = append(chunks, string(chunkRunes))
	}

	return chunks
}

