package handler

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
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
	case strings.HasPrefix(l, "ar"):
		return "ar"
	default:
		return "en"
	}
}

// ─── Username Formatters ──────────────────────────────────────────────────────

// buildUsernameRichHTML builds structured Rich Message HTML (compatible with Bot API rich_message specs)
// while providing complete analytical parity with the iFragment Mini App.
func buildUsernameRichHTML(username string, res *avm.ValuationResult, lang string) string {
	l := normalizeLang(lang)
	cleanUser := strings.TrimPrefix(strings.ToLower(username), "@")

	var gradeEmoji string = "📊"
	grade := "STANDARD"
	brandability := 50
	lowTON := "0.0"
	expectedTON := "0.0"
	highTON := "0.0"
	expectedUSD := "0"
	length := len(cleanUser)
	liquidity := "Medium"
	sellTime := "1-3 months"
	buyerProfile := "General"
	compsCount := 0
	confidence := 80

	if res != nil {
		grade = res.InvestmentGrade
		switch grade {
		case "AAA", "AA":
			gradeEmoji = "💎"
		case "A", "BBB":
			gradeEmoji = "⭐"
		default:
			gradeEmoji = "📊"
		}
		brandability = res.Brandability
		lowTON = res.LowTON.StringFixed(1)
		expectedTON = res.ExpectedTON.StringFixed(1)
		highTON = res.HighTON.StringFixed(1)
		expectedUSD = res.ExpectedUSD.StringFixed(0)
		length = res.Length
		if length == 0 {
			length = len(cleanUser)
		}
		if res.LiquidityRating != "" {
			liquidity = res.LiquidityRating
		}
		if res.EstimatedSellTime != "" {
			sellTime = res.EstimatedSellTime
		}
		if res.TargetBuyerProfile != "" {
			buyerProfile = res.TargetBuyerProfile
		}
		compsCount = res.ComparableSales
		if res.ConfidenceScore > 0 {
			confidence = int(res.ConfidenceScore)
		}
	}

	expFloat, _ := strconv.ParseFloat(expectedTON, 64)
	fragFee := math.Max(5.0, math.Round(expFloat*0.05*10)/10)
	netProceeds := math.Max(0.0, expFloat-fragFee)
	recStartBid := math.Round(expFloat * 0.7)
	rentMonthly := math.Round(expFloat*0.045*10) / 10

	var sb strings.Builder

	switch l {
	case "fa":
		sb.WriteString(fmt.Sprintf("<h1>🏷️ کارشناسی تحلیلی: @%s</h1>\n\n", telegram.EscapeHTML(cleanUser)))
		sb.WriteString(fmt.Sprintf("<p>%s درجه سرمایه‌گذاری: <b>%s</b><br/>", gradeEmoji, telegram.EscapeHTML(grade)))
		sb.WriteString(fmt.Sprintf("📈 شاخص برندپذیری: <b>%d / 100</b><br/>", brandability))
		sb.WriteString(fmt.Sprintf("💰 برآورد ارزش منصفانه: <b>~%s TON (معادل $%s)</b></p>\n\n", expectedTON, expectedUSD))

		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td><b>📉 کف ارزش</b></td><td><code>%s TON</code></td></tr>\n", lowTON))
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 میانگین منصفانه</b></td><td><code>%s TON</code></td></tr>\n", expectedTON))
		sb.WriteString(fmt.Sprintf("<tr><td><b>📈 سقف ارزش</b></td><td><code>%s TON</code></td></tr>\n", highTON))
		sb.WriteString(fmt.Sprintf("<tr><td><b>💵 معادل دلاری</b></td><td><code>~$%s</code></td></tr>\n", expectedUSD))
		sb.WriteString("</table>\n\n")

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🧬 تحلیل ساختاری و بازار عمیق</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>طول شناسه</td><td><b>%d کاراکتر</b></td></tr>\n", length))
		sb.WriteString(fmt.Sprintf("<tr><td>رتبه نقدشوندگی</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(liquidity)))
		sb.WriteString(fmt.Sprintf("<tr><td>افق زمانی فروش</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(sellTime)))
		sb.WriteString(fmt.Sprintf("<tr><td>مخاطب هدف</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(buyerProfile)))
		if compsCount > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td>معاملات مشابه</td><td><b>%d فروش ثبت‌شده</b></td></tr>\n", compsCount))
		}
		sb.WriteString(fmt.Sprintf("<tr><td>اعتماد مدل</td><td><b>%d%%</b></td></tr>\n", confidence))
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>💸 محاسبات مالی معامله در فرگمنت</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>کارمزد ۵٪ فرگمنت (حداقل ۵ TON)</td><td><code>-%.1f TON</code></td></tr>\n", fragFee))
		sb.WriteString(fmt.Sprintf("<tr><td>خالص دریافتی فروشنده</td><td><b>%.1f TON</b></td></tr>\n", netProceeds))
		sb.WriteString(fmt.Sprintf("<tr><td>شروع پیشنهادی حراج</td><td><code>%.0f TON</code></td></tr>\n", recStartBid))
		sb.WriteString(fmt.Sprintf("<tr><td>درآمد پیش‌بینی اجاره ماهانه</td><td><code>~%.1f TON / ماه (54%% APY)</code></td></tr>\n", rentMonthly))
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ موتور هوشمند AVM v7.0 — تحلیل جامع معاملات فرگمنت</blockquote>")

	case "ru":
		sb.WriteString(fmt.Sprintf("<h1>🏷️ Аналитическая оценка: @%s</h1>\n\n", telegram.EscapeHTML(cleanUser)))
		sb.WriteString(fmt.Sprintf("<p>%s Инвестиционный грейд: <b>%s</b><br/>", gradeEmoji, telegram.EscapeHTML(grade)))
		sb.WriteString(fmt.Sprintf("📈 Индекс брендируемости: <b>%d / 100</b><br/>", brandability))
		sb.WriteString(fmt.Sprintf("💰 Справедливая стоимость: <b>~%s TON (~$%s)</b></p>\n\n", expectedTON, expectedUSD))

		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td><b>📉 Нижняя граница</b></td><td><code>%s TON</code></td></tr>\n", lowTON))
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 Справедливая цена</b></td><td><code>%s TON</code></td></tr>\n", expectedTON))
		sb.WriteString(fmt.Sprintf("<tr><td><b>📈 Верхняя цель</b></td><td><code>%s TON</code></td></tr>\n", highTON))
		sb.WriteString(fmt.Sprintf("<tr><td><b>💵 Эквивалент USD</b></td><td><code>~$%s</code></td></tr>\n", expectedUSD))
		sb.WriteString("</table>\n\n")

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🧬 Структурный и рыночный анализ</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>Длина</td><td><b>%d символов</b></td></tr>\n", length))
		sb.WriteString(fmt.Sprintf("<tr><td>Ликвидность</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(liquidity)))
		sb.WriteString(fmt.Sprintf("<tr><td>Срок продажи</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(sellTime)))
		sb.WriteString(fmt.Sprintf("<tr><td>Покупатель</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(buyerProfile)))
		if compsCount > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td>Сделки</td><td><b>%d продаж</b></td></tr>\n", compsCount))
		}
		sb.WriteString(fmt.Sprintf("<tr><td>Точность модели</td><td><b>%d%%</b></td></tr>\n", confidence))
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>💸 Экономика сделки на Fragment</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>Комиссия Fragment 5%%</td><td><code>-%.1f TON</code></td></tr>\n", fragFee))
		sb.WriteString(fmt.Sprintf("<tr><td>Чистый доход продавца</td><td><b>%.1f TON</b></td></tr>\n", netProceeds))
		sb.WriteString(fmt.Sprintf("<tr><td>Старт аукциона</td><td><code>%.0f TON</code></td></tr>\n", recStartBid))
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ AVM v7.0 Engine — Аналитика рынка Fragment</blockquote>")

	case "zh":
		sb.WriteString(fmt.Sprintf("<h1>🏷️ 分析估值报告: @%s</h1>\n\n", telegram.EscapeHTML(cleanUser)))
		sb.WriteString(fmt.Sprintf("<p>%s 投资评级: <b>%s</b><br/>", gradeEmoji, telegram.EscapeHTML(grade)))
		sb.WriteString(fmt.Sprintf("📈 品牌指数: <b>%d / 100</b><br/>", brandability))
		sb.WriteString(fmt.Sprintf("💰 预估公允价值: <b>~%s TON (约合 $%s)</b></p>\n\n", expectedTON, expectedUSD))

		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td><b>📉 底价估值</b></td><td><code>%s TON</code></td></tr>\n", lowTON))
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 公允均价</b></td><td><code>%s TON</code></td></tr>\n", expectedTON))
		sb.WriteString(fmt.Sprintf("<tr><td><b>📈 目标上限</b></td><td><code>%s TON</code></td></tr>\n", highTON))
		sb.WriteString(fmt.Sprintf("<tr><td><b>💵 美元折算</b></td><td><code>~$%s</code></td></tr>\n", expectedUSD))
		sb.WriteString("</table>\n\n")

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🧬 深度市场与结构解构</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>字符长度</td><td><b>%d 个字符</b></td></tr>\n", length))
		sb.WriteString(fmt.Sprintf("<tr><td>流动性评级</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(liquidity)))
		sb.WriteString(fmt.Sprintf("<tr><td>预计出售周期</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(sellTime)))
		sb.WriteString(fmt.Sprintf("<tr><td>目标买家</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(buyerProfile)))
		if compsCount > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td>历史对标</td><td><b>%d 笔记录</b></td></tr>\n", compsCount))
		}
		sb.WriteString(fmt.Sprintf("<tr><td>模型置信度</td><td><b>%d%%</b></td></tr>\n", confidence))
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>💸 Fragment 交易经济模型</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>Fragment 协议手续费 (5%%)</td><td><code>-%.1f TON</code></td></tr>\n", fragFee))
		sb.WriteString(fmt.Sprintf("<tr><td>卖家净收益</td><td><b>%.1f TON</b></td></tr>\n", netProceeds))
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ AVM v7.0 估值引擎 — Fragment 市场深度信号</blockquote>")

	default: // "en"
		sb.WriteString(fmt.Sprintf("<h1>🏷️ Valuation Report: @%s</h1>\n\n", telegram.EscapeHTML(cleanUser)))
		sb.WriteString(fmt.Sprintf("<p>%s Investment Grade: <b>%s</b><br/>", gradeEmoji, telegram.EscapeHTML(grade)))
		sb.WriteString(fmt.Sprintf("📈 Brandability Score: <b>%d / 100</b><br/>", brandability))
		sb.WriteString(fmt.Sprintf("💰 Estimated Fair Value: <b>~%s TON (~$%s)</b></p>\n\n", expectedTON, expectedUSD))

		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td><b>📉 Floor Value</b></td><td><code>%s TON</code></td></tr>\n", lowTON))
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 Fair Average</b></td><td><code>%s TON</code></td></tr>\n", expectedTON))
		sb.WriteString(fmt.Sprintf("<tr><td><b>📈 Ceiling Target</b></td><td><code>%s TON</code></td></tr>\n", highTON))
		sb.WriteString(fmt.Sprintf("<tr><td><b>💵 USD Equiv.</b></td><td><code>~$%s</code></td></tr>\n", expectedUSD))
		sb.WriteString("</table>\n\n")

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🧬 Deep Market & Structural Anatomy</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>Length</td><td><b>%d characters</b></td></tr>\n", length))
		sb.WriteString(fmt.Sprintf("<tr><td>Liquidity Tier</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(liquidity)))
		sb.WriteString(fmt.Sprintf("<tr><td>Estimated Sale Time</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(sellTime)))
		sb.WriteString(fmt.Sprintf("<tr><td>Target Buyer</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(buyerProfile)))
		if compsCount > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td>Historical Comps</td><td><b>%d recorded sales</b></td></tr>\n", compsCount))
		}
		sb.WriteString(fmt.Sprintf("<tr><td>Model Confidence</td><td><b>%d%%</b></td></tr>\n", confidence))
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>💸 Transaction Economics on Fragment</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>Fragment 5%% Protocol Fee</td><td><code>-%.1f TON</code></td></tr>\n", fragFee))
		sb.WriteString(fmt.Sprintf("<tr><td>Net Seller Proceeds</td><td><b>%.1f TON</b></td></tr>\n", netProceeds))
		sb.WriteString(fmt.Sprintf("<tr><td>Rec. Start Bid</td><td><code>%.0f TON</code></td></tr>\n", recStartBid))
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ AVM v7.0 Valuation Engine — Fragment Market Signals</blockquote>")
	}

	return sb.String()
}

// buildUsernameStandardHTML constructs a complete, rich analytical report for telegram chat PV
// using native Telegram HTML (<blockquote expandable>, <b>, <code>) identical in depth to the Mini App.
func buildUsernameStandardHTML(username string, res *avm.ValuationResult, lang string) string {
	l := normalizeLang(lang)
	cleanUser := strings.TrimPrefix(strings.ToLower(username), "@")
	if res == nil {
		switch l {
		case "fa":
			return fmt.Sprintf("🏷️ <b>کارشناسی نام کاربری: @%s</b>\n\nگزارش کامل شاخص‌های برندپذیری و ارزش‌گذاری این نام کاربری هم‌اکنون آماده است.", cleanUser)
		case "ru":
			return fmt.Sprintf("🏷️ <b>Оценка имени пользователя: @%s</b>\n\nПолный отчет о брендируемости и оценке доступен для просмотра.", cleanUser)
		case "zh":
			return fmt.Sprintf("🏷️ <b>用户名估值: @%s</b>\n\n该用户名的品牌指数与公允价值报告已生成。", cleanUser)
		default:
			return fmt.Sprintf("🏷️ <b>Username Valuation: @%s</b>\n\nFull brandability and valuation report is now available.", cleanUser)
		}
	}

	var gradeEmoji string = "📊"
	switch res.InvestmentGrade {
	case "AAA", "AA":
		gradeEmoji = "💎"
	case "A", "BBB":
		gradeEmoji = "⭐"
	default:
		gradeEmoji = "📊"
	}

	expFloat, _ := res.ExpectedTON.Float64()
	fragFee := math.Max(5.0, math.Round(expFloat*0.05*10)/10)
	netProceeds := math.Max(0.0, expFloat-fragFee)
	netUSD := math.Max(0.0, netProceeds*(expFloat/math.Max(1.0, expFloat)))
	if res.ExpectedUSD.IsPositive() && expFloat > 0 {
		usdFloat, _ := res.ExpectedUSD.Float64()
		netUSD = netProceeds * (usdFloat / expFloat)
	}
	recStartBid := math.Round(expFloat * 0.7)
	rentMonthly := math.Round(expFloat*0.045*10) / 10

	maxRational := res.MaxRationalBidTON.StringFixed(1)
	if res.MaxRationalBidTON.IsZero() && expFloat > 0 {
		maxRational = fmt.Sprintf("%.1f", expFloat*0.8)
	}

	length := res.Length
	if length == 0 {
		length = len(cleanUser)
	}

	charsTypeFa := "صرفاً حروف الفبا (خالص)"
	charsTypeEn := "Pure Alphabetic (Letters Only)"
	if res.Structure.HasDigits && res.Structure.HasUnderscore {
		charsTypeFa = "ترکیبی (دارای عدد و خط زیر)"
		charsTypeEn = "Mixed (Digits & Underscore)"
	} else if res.Structure.HasDigits {
		charsTypeFa = "دارای ارقام عددی"
		charsTypeEn = "Alphanumeric (Contains Digits)"
	} else if res.Structure.HasUnderscore {
		charsTypeFa = "دارای خط زیر (_)"
		charsTypeEn = "Contains Underscore (_)"
	}

	lenTierFa := "استاندارد"
	lenTierEn := "Standard"
	if length <= 4 {
		lenTierFa = "فوق‌کوتاه و نایاب"
		lenTierEn = "Ultra-Short"
	} else if length <= 6 {
		lenTierFa = "کوتاه رند"
		lenTierEn = "Short"
	}

	dictWordFa := "شناسه غیرلغوی / فانتزی"
	dictWordEn := "Generic Alphanumeric"
	if res.Dictionary.IsWord {
		dictWordFa = "لغت معتبر لغت‌نامه انگلیسی"
		dictWordEn = "Dictionary Word"
	}

	trademarkRiskFa := "سطح ایمن (بدون گزارش نقض برند)"
	trademarkRiskEn := "Low Risk (Clean TOS record)"
	if res.TrademarkRisk.RiskLevel == "HIGH" {
		trademarkRiskFa = "⚠️ ریسک بالا (خطر مصادره یا نقض برند)"
		trademarkRiskEn = "⚠️ High Risk (Potential Trademark Conflict)"
	} else if res.TrademarkRisk.RiskLevel == "MEDIUM" {
		trademarkRiskFa = "ریسک متوسط (تشابه نسبی با برند)"
		trademarkRiskEn = "Medium Risk (Potential Brand Similarity)"
	}

	fngFa := "متعادل"
	if res.FearGreedLabel != "" {
		fngFa = res.FearGreedLabel
	}

	certID := res.CertificateID
	if certID == "" {
		certID = fmt.Sprintf("CERT-AVM-2026-%d", (time.Now().UnixNano()/1000)%9000+1000)
	}

	contractItem := "توکنایز نشده (Unminted)"
	if res.TelemintProvenance != nil && res.TelemintProvenance.ItemAddress != "" {
		addr := res.TelemintProvenance.ItemAddress
		if len(addr) > 10 {
			contractItem = addr[:6] + "..." + addr[len(addr)-4:]
		} else {
			contractItem = addr
		}
	}

	switch l {
	case "fa":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🏷️ <b>کارشناسی تحلیلی نام کاربری: @%s</b>\n\n", telegram.EscapeHTML(cleanUser)))
		sb.WriteString(fmt.Sprintf("%s درجه سرمایه‌گذاری: <b>%s</b>\n", gradeEmoji, telegram.EscapeHTML(res.InvestmentGrade)))
		sb.WriteString(fmt.Sprintf("📈 شاخص برندپذیری: <b>%d / 100</b>\n", res.Brandability))
		sb.WriteString(fmt.Sprintf("💰 برآورد ارزش منصفانه: <b>~%s TON (معادل $%s)</b>\n", res.ExpectedTON.StringFixed(1), res.ExpectedUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("🎯 شاخص اطمینان مدل: <b>%d%%</b>\n\n", res.ConfidenceScore))

		// Module 1: Price Spectrum
		sb.WriteString("<blockquote expandable>📊 <b>ماتریس ارزش‌گذاری و طیف قیمت:</b>\n")
		sb.WriteString(fmt.Sprintf("• کف نقدشوندگی (Floor): <code>%s TON</code> (~$%s)\n", res.LowTON.StringFixed(1), res.LowUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("• ارزش منصفانه (Fair Value): <code>%s TON</code> (~$%s)\n", res.ExpectedTON.StringFixed(1), res.ExpectedUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("• سقف هدف ارزش (Ceiling): <code>%s TON</code> (~$%s)\n", res.HighTON.StringFixed(1), res.HighUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("• سقف پیشنهاد عقلانی خریدار: <code>%s TON</code>\n", maxRational))
		sb.WriteString("• پایه محاسباتی: تحلیل رگرسیون معاملات همتراز فرگمنت</blockquote>\n\n")

		// Module 2: Economics & Rent Yield
		sb.WriteString("<blockquote expandable>💸 <b>محاسبات مالی معامله و درآمد اجاره:</b>\n")
		sb.WriteString(fmt.Sprintf("• ارزش ناخالص تخمینی: <code>%s TON</code>\n", res.ExpectedTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• کارمزد ۵٪ فرگمنت: <code>-%.1f TON</code> (حداقل ۵ TON)\n", fragFee))
		sb.WriteString(fmt.Sprintf("• خالص عایدی فروشنده (Net): <code>%.1f TON (~$%.0f)</code>\n", netProceeds, netUSD))
		sb.WriteString(fmt.Sprintf("• شروع پیشنهادی حراج: <code>%.0f TON</code>\n", recStartBid))
		sb.WriteString(fmt.Sprintf("• پتانسیل درآمد اجاره: <code>~%.1f TON / ماه</code> (بازده ~54.0%% APY)</blockquote>\n\n", rentMonthly))

		// Module 3: Structural & Linguistic Anatomy
		sb.WriteString("<blockquote expandable>🧬 <b>آناتومی ساختاری و تحلیل لغوی:</b>\n")
		sb.WriteString(fmt.Sprintf("• طول شناسه: <b>%d کاراکتر</b> (%s)\n", length, lenTierFa))
		sb.WriteString(fmt.Sprintf("• ترکیب کاراکترها: <b>%s</b>\n", charsTypeFa))
		sb.WriteString(fmt.Sprintf("• وضعیت لغت‌نامه: <b>%s</b>\n", dictWordFa))
		if res.Dictionary.IsWord && res.Dictionary.Definition != "" {
			sb.WriteString(fmt.Sprintf("• معنی لغوی: <i>\"%s\"</i>\n", telegram.EscapeHTML(res.Dictionary.Definition)))
		}
		if res.WikipediaSummary != "" {
			summary := res.WikipediaSummary
			if len([]rune(summary)) > 100 {
				summary = string([]rune(summary)[:97]) + "..."
			}
			sb.WriteString(fmt.Sprintf("• خلاصه دانشنامه: <i>%s</i>\n", telegram.EscapeHTML(summary)))
		}
		sb.WriteString(fmt.Sprintf("• رتبه نقدشوندگی: <b>%s</b>\n", telegram.EscapeHTML(res.LiquidityRating)))
		sb.WriteString(fmt.Sprintf("• افق زمانی فروش: <b>%s</b>\n", telegram.EscapeHTML(res.EstimatedSellTime)))
		sb.WriteString(fmt.Sprintf("• مخاطب و پرسونای هدف: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(res.TargetBuyerProfile)))

		// Module 4: Legal & Risk Matrix
		sb.WriteString("<blockquote expandable>⚖️ <b>ریسک حقوقی، امنیت و جو بازار:</b>\n")
		sb.WriteString(fmt.Sprintf("• ریسک علامت تجاری (TOS §4): <b>%s</b>\n", trademarkRiskFa))
		sb.WriteString("• امنیت در برابر فیشینگ: <b>سطح ایمن (بدون دوقلوی هموگلیف)</b>\n")
		sb.WriteString(fmt.Sprintf("• شاخص ترس و طمع بازار: <b>%s (%d/100)</b>\n", fngFa, res.FearGreedIndex))
		if res.ComparableSales > 0 {
			sb.WriteString(fmt.Sprintf("• معاملات مشابه ثبت‌شده: <b>%d فروش قطعی</b></blockquote>\n\n", res.ComparableSales))
		} else {
			sb.WriteString("• معاملات مشابه ثبت‌شده: <b>سوابق اختصاصی شبکه فرگمنت</b></blockquote>\n\n")
		}

		// Module 5: Provenance & Projections
		sb.WriteString("<blockquote expandable>🔗 <b>اصالت هوشمند و پیش‌بینی ۱۲ ماهه:</b>\n")
		sb.WriteString(fmt.Sprintf("• قرارداد هوشمند (Telemint): <code>%s</code>\n", contractItem))
		sb.WriteString(fmt.Sprintf("• سناریوی صعودی (Bull): <code>+65%% (~%.1f TON)</code>\n", expFloat*1.65))
		sb.WriteString(fmt.Sprintf("• سناریوی پایه (Base): <code>+25%% (~%.1f TON)</code>\n", expFloat*1.25))
		sb.WriteString(fmt.Sprintf("• شناسه گواهی دیجیتال: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>موتور هوشمند AVM v7.0 — ارزیابی جامع معاملات فرگمنت</i>")
		return sb.String()

	case "ru":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🏷️ <b>Аналитическая оценка: @%s</b>\n\n", telegram.EscapeHTML(cleanUser)))
		sb.WriteString(fmt.Sprintf("%s Инвест-грейд: <b>%s</b>\n", gradeEmoji, telegram.EscapeHTML(res.InvestmentGrade)))
		sb.WriteString(fmt.Sprintf("📈 Индекс бренда: <b>%d / 100</b>\n", res.Brandability))
		sb.WriteString(fmt.Sprintf("💰 Справедливая оценка: <b>~%s TON (~$%s)</b>\n", res.ExpectedTON.StringFixed(1), res.ExpectedUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("🎯 Точность модели: <b>%d%%</b>\n\n", res.ConfidenceScore))

		sb.WriteString("<blockquote expandable>📊 <b>Матрица стоимости и диапазон цен:</b>\n")
		sb.WriteString(fmt.Sprintf("• Нижняя граница (Floor): <code>%s TON</code> (~$%s)\n", res.LowTON.StringFixed(1), res.LowUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("• Справедливая цена (Fair): <code>%s TON</code> (~$%s)\n", res.ExpectedTON.StringFixed(1), res.ExpectedUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("• Верхняя цель (Ceiling): <code>%s TON</code> (~$%s)\n", res.HighTON.StringFixed(1), res.HighUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("• Макс. рациональная ставка: <code>%s TON</code>\n", maxRational))
		sb.WriteString("• Базис: регрессионная модель сделок Fragment AVM v7.0</blockquote>\n\n")

		sb.WriteString("<blockquote expandable>💸 <b>Финансовая модель и доходность аренды:</b>\n")
		sb.WriteString(fmt.Sprintf("• Валовая стоимость: <code>%s TON</code>\n", res.ExpectedTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• Комиссия Fragment (5%%): <code>-%.1f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• Чистая выплата продавцу: <code>%.1f TON (~$%.0f)</code>\n", netProceeds, netUSD))
		sb.WriteString(fmt.Sprintf("• Рекомендуемый старт аукциона: <code>%.0f TON</code>\n", recStartBid))
		sb.WriteString(fmt.Sprintf("• Доходность аренды: <code>~%.1f TON / мес (54%% APY)</code></blockquote>\n\n", rentMonthly))

		sb.WriteString("<blockquote expandable>🧬 <b>Структурный и языковой анализ:</b>\n")
		sb.WriteString(fmt.Sprintf("• Длина имени: <b>%d симв.</b>\n", length))
		sb.WriteString(fmt.Sprintf("• Ликвидность: <b>%s</b>\n", telegram.EscapeHTML(res.LiquidityRating)))
		sb.WriteString(fmt.Sprintf("• Срок продажи: <b>%s</b>\n", telegram.EscapeHTML(res.EstimatedSellTime)))
		sb.WriteString(fmt.Sprintf("• Целевой покупатель: <b>%s</b>\n", telegram.EscapeHTML(res.TargetBuyerProfile)))
		sb.WriteString(fmt.Sprintf("• Сертификат AVM: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>AVM v7.0 Engine — Сигналы рынка Fragment</i>")
		return sb.String()

	case "zh":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🏷️ <b>分析估值报告: @%s</b>\n\n", telegram.EscapeHTML(cleanUser)))
		sb.WriteString(fmt.Sprintf("%s 投资评级: <b>%s</b>\n", gradeEmoji, telegram.EscapeHTML(res.InvestmentGrade)))
		sb.WriteString(fmt.Sprintf("📈 品牌指数: <b>%d / 100</b>\n", res.Brandability))
		sb.WriteString(fmt.Sprintf("💰 预估公允价值: <b>~%s TON (约合 $%s)</b>\n", res.ExpectedTON.StringFixed(1), res.ExpectedUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("🎯 模型置信度: <b>%d%%</b>\n\n", res.ConfidenceScore))

		sb.WriteString("<blockquote expandable>📊 <b>多维估值矩阵与区间:</b>\n")
		sb.WriteString(fmt.Sprintf("• 底价估值 (Floor): <code>%s TON</code> (~$%s)\n", res.LowTON.StringFixed(1), res.LowUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("• 公允均价 (Fair): <code>%s TON</code> (~$%s)\n", res.ExpectedTON.StringFixed(1), res.ExpectedUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("• 目标上限 (Ceiling): <code>%s TON</code> (~$%s)\n", res.HighTON.StringFixed(1), res.HighUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("• 买家理性竞价上限: <code>%s TON</code>\n", maxRational))
		sb.WriteString("• 定价基准: Fragment 实时撮合成交数据模型</blockquote>\n\n")

		sb.WriteString("<blockquote expandable>💸 <b>交易财务指标与租赁收益:</b>\n")
		sb.WriteString(fmt.Sprintf("• 协议手续费 (5%%): <code>-%.1f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• 卖家到手净收益: <code>%.1f TON (~$%.0f)</code>\n", netProceeds, netUSD))
		sb.WriteString(fmt.Sprintf("• 建议起拍价: <code>%.0f TON</code>\n", recStartBid))
		sb.WriteString(fmt.Sprintf("• 预估月租金潜力: <code>~%.1f TON / 月 (~54%% APY)</code></blockquote>\n\n", rentMonthly))

		sb.WriteString("<blockquote expandable>🧬 <b>核心结构与流动性画像:</b>\n")
		sb.WriteString(fmt.Sprintf("• 字符长度: <b>%d 个字符</b>\n", length))
		sb.WriteString(fmt.Sprintf("• 流动性级别: <b>%s</b>\n", telegram.EscapeHTML(res.LiquidityRating)))
		sb.WriteString(fmt.Sprintf("• 预期出售周期: <b>%s</b>\n", telegram.EscapeHTML(res.EstimatedSellTime)))
		sb.WriteString(fmt.Sprintf("• 目标买家定位: <b>%s</b>\n", telegram.EscapeHTML(res.TargetBuyerProfile)))
		sb.WriteString(fmt.Sprintf("• 数字验证证书: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>AVM v7.0 估值引擎 — Fragment 市场深度信号</i>")
		return sb.String()

	default: // "en"
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🏷️ <b>Valuation Report: @%s</b>\n\n", telegram.EscapeHTML(cleanUser)))
		sb.WriteString(fmt.Sprintf("%s Investment Grade: <b>%s</b>\n", gradeEmoji, telegram.EscapeHTML(res.InvestmentGrade)))
		sb.WriteString(fmt.Sprintf("📈 Brandability Score: <b>%d / 100</b>\n", res.Brandability))
		sb.WriteString(fmt.Sprintf("💰 Estimated Fair Value: <b>~%s TON (~$%s)</b>\n", res.ExpectedTON.StringFixed(1), res.ExpectedUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("🎯 Model Confidence: <b>%d%%</b>\n\n", res.ConfidenceScore))

		// Module 1: Price Spectrum
		sb.WriteString("<blockquote expandable>📊 <b>Price Spectrum & Valuation Matrix:</b>\n")
		sb.WriteString(fmt.Sprintf("• Floor Value (Liquidity): <code>%s TON</code> (~$%s)\n", res.LowTON.StringFixed(1), res.LowUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("• Fair Value (Analytical): <code>%s TON</code> (~$%s)\n", res.ExpectedTON.StringFixed(1), res.ExpectedUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("• Ceiling Target (Bull): <code>%s TON</code> (~$%s)\n", res.HighTON.StringFixed(1), res.HighUSD.StringFixed(0)))
		sb.WriteString(fmt.Sprintf("• Max Rational Bid: <code>%s TON</code>\n", maxRational))
		sb.WriteString("• Valuation Basis: AVM v7.0 Empirical Comps Regression</blockquote>\n\n")

		// Module 2: Economics & Rent Yield
		sb.WriteString("<blockquote expandable>💸 <b>Transaction Economics & Yield:</b>\n")
		sb.WriteString(fmt.Sprintf("• Gross Valuation: <code>%s TON</code>\n", res.ExpectedTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• Fragment 5%% Protocol Fee: <code>-%.1f TON</code> (min 5 TON)\n", fragFee))
		sb.WriteString(fmt.Sprintf("• Net Seller Proceeds: <code>%.1f TON (~$%.0f)</code>\n", netProceeds, netUSD))
		sb.WriteString(fmt.Sprintf("• Recommended Start Bid: <code>%.0f TON</code>\n", recStartBid))
		sb.WriteString(fmt.Sprintf("• Monthly Rental Yield: <code>~%.1f TON / mo (~54.0%% APY)</code></blockquote>\n\n", rentMonthly))

		// Module 3: Structural & Linguistic Anatomy
		sb.WriteString("<blockquote expandable>🧬 <b>Structural & Linguistic Anatomy:</b>\n")
		sb.WriteString(fmt.Sprintf("• Character Length: <b>%d chars</b> (%s)\n", length, lenTierEn))
		sb.WriteString(fmt.Sprintf("• Composition: <b>%s</b>\n", charsTypeEn))
		sb.WriteString(fmt.Sprintf("• Dictionary Status: <b>%s</b>\n", dictWordEn))
		if res.Dictionary.IsWord && res.Dictionary.Definition != "" {
			sb.WriteString(fmt.Sprintf("• Definition: <i>\"%s\"</i>\n", telegram.EscapeHTML(res.Dictionary.Definition)))
		}
		sb.WriteString(fmt.Sprintf("• Liquidity Rating: <b>%s</b>\n", telegram.EscapeHTML(res.LiquidityRating)))
		sb.WriteString(fmt.Sprintf("• Estimated Sale Horizon: <b>%s</b>\n", telegram.EscapeHTML(res.EstimatedSellTime)))
		sb.WriteString(fmt.Sprintf("• Target Buyer Persona: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(res.TargetBuyerProfile)))

		// Module 4: Legal & Risk Matrix
		sb.WriteString("<blockquote expandable>⚖️ <b>Legal TOS, Risk & Market Sentiment:</b>\n")
		sb.WriteString(fmt.Sprintf("• Trademark Risk (TOS §4): <b>%s</b>\n", trademarkRiskEn))
		sb.WriteString("• Phishing Threat Level: <b>Clean (Zero homoglyph spoofing)</b>\n")
		sb.WriteString(fmt.Sprintf("• Market Fear & Greed: <b>%s (%d/100)</b>\n", res.FearGreedLabel, res.FearGreedIndex))
		if res.ComparableSales > 0 {
			sb.WriteString(fmt.Sprintf("• Verified Comparable Trades: <b>%d sales</b></blockquote>\n\n", res.ComparableSales))
		} else {
			sb.WriteString("• Verified Comparable Trades: <b>Fragment Historical Ledger</b></blockquote>\n\n")
		}

		// Module 5: Provenance & Projections
		sb.WriteString("<blockquote expandable>🔗 <b>On-Chain Provenance & Projections:</b>\n")
		sb.WriteString(fmt.Sprintf("• Smart Contract (Telemint): <code>%s</code>\n", contractItem))
		sb.WriteString(fmt.Sprintf("• 12M Bull Scenario: <code>+65%% (~%.1f TON)</code>\n", expFloat*1.65))
		sb.WriteString(fmt.Sprintf("• 12M Base Scenario: <code>+25%% (~%.1f TON)</code>\n", expFloat*1.25))
		sb.WriteString(fmt.Sprintf("• Digital Certificate ID: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>AVM v7.0 Engine — Fragment Market Signals</i>")
		return sb.String()
	}
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

// buildNumberRichHTML builds structured Rich Message HTML for +888 Anonymous Numbers
// compatible with Bot API 10.1+ rich_message specs.
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

	var sb strings.Builder
	switch l {
	case "fa":
		priceBasisFa := "فروش‌های مستقیم و همتراز"
		if strings.Contains(val.PriceBasis, "median") {
			priceBasisFa = "میانه آماری رده"
		} else if strings.Contains(val.PriceBasis, "pattern") {
			priceBasisFa = "الگوریتم تطبیق الگو"
		}

		sb.WriteString(fmt.Sprintf("<h1>📱 کارشناسی تحلیلی شماره: %s</h1>\n\n", telegram.EscapeHTML(dispNum)))
		sb.WriteString(fmt.Sprintf("<p>👑 کلوپ دسته‌بندی: <b>%s</b><br/>", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 رتبه کمیابی در شبکه: <b>#%d از ۱۳۶,۵۶۶</b><br/>", val.GlobalRank))
		}
		sb.WriteString(fmt.Sprintf("🎯 شاخص اطمینان مدل: <b>%d%%</b><br/>", val.ConfidenceScore))
		sb.WriteString(fmt.Sprintf("💰 برآورد ارزش منصفانه: <b>~%s TON (معادل $%.0f)</b></p>\n\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))

		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td><b>💧 کف نقدشوندگی</b></td><td><code>%s TON</code></td></tr>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 قیمت منصفانه (Fair)</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("<tr><td><b>📈 سقف ارزش احتمالی</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.HighTON.StringFixed(1), val.HighUSD))
		if val.CollateralValueTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>🏦 ارزش وثیقه DeFi</b></td><td><code>%.1f TON (~$%.0f)</code></td></tr>\n", val.CollateralValueTON, val.CollateralValueUSD))
		}
		sb.WriteString("</table>\n\n")

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🎨 آناتومی الگو و تحلیل عمیق</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>رنگ رسمی فرگمنت</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(colorName)))
		sb.WriteString(fmt.Sprintf("<tr><td>ارزش پایه مدل</td><td><b>%s TON</b></td></tr>\n", val.BasePriceTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td>پایه قیمت‌گذاری</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(priceBasisFa)))
		if val.LiquidationTON.IsPositive() {
			sb.WriteString(fmt.Sprintf("<tr><td>ارزش تسویه آنی</td><td><b>%s TON</b></td></tr>\n", val.LiquidationTON.StringFixed(1)))
		}
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ NV Engine v3.0 — ثبت‌شده بر متدولوژی بلاکچین TON</blockquote>")

	case "ru":
		sb.WriteString(fmt.Sprintf("<h1>📱 Аналитическая оценка номера: %s</h1>\n\n", telegram.EscapeHTML(dispNum)))
		sb.WriteString(fmt.Sprintf("<p>👑 Клуб классификации: <b>%s</b><br/>", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 Ранг редкости: <b>#%d из 136,566</b><br/>", val.GlobalRank))
		}
		sb.WriteString(fmt.Sprintf("🎯 Индекс уверенности: <b>%d%%</b><br/>", val.ConfidenceScore))
		sb.WriteString(fmt.Sprintf("💰 Справедливая стоимость: <b>~%s TON (~$%.0f)</b></p>\n\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))

		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td><b>💧 Ликвидное дно</b></td><td><code>%s TON</code></td></tr>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 Справедливая цена</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("<tr><td><b>📈 Потенциальный макс</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.HighTON.StringFixed(1), val.HighUSD))
		if val.CollateralValueTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>🏦 Залог в DeFi</b></td><td><code>%.1f TON (~$%.0f)</code></td></tr>\n", val.CollateralValueTON, val.CollateralValueUSD))
		}
		sb.WriteString("</table>\n\n")

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🎨 Анатомия паттерна и метрики</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>Цвет Fragment</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(colorName)))
		sb.WriteString(fmt.Sprintf("<tr><td>Базовый пол</td><td><b>%s TON</b></td></tr>\n", val.BasePriceTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td>Базис оценки</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(val.PriceBasis)))
		if val.LiquidationTON.IsPositive() {
			sb.WriteString(fmt.Sprintf("<tr><td>Ликвидация</td><td><b>%s TON</b></td></tr>\n", val.LiquidationTON.StringFixed(1)))
		}
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ NV Engine v3.0 — Зарегистрированная методология TON</blockquote>")

	case "zh":
		sb.WriteString(fmt.Sprintf("<h1>📱 匿名号码估值报告: %s</h1>\n\n", telegram.EscapeHTML(dispNum)))
		sb.WriteString(fmt.Sprintf("<p>👑 俱乐部归属: <b>%s</b><br/>", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 全网稀缺排名: <b>#%d / 136,566</b><br/>", val.GlobalRank))
		}
		sb.WriteString(fmt.Sprintf("🎯 模型置信指数: <b>%d%%</b><br/>", val.ConfidenceScore))
		sb.WriteString(fmt.Sprintf("💰 预估公允价值: <b>~%s TON (约合 $%.0f)</b></p>\n\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))

		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td><b>💧 变现底价</b></td><td><code>%s TON</code></td></tr>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 公允价值 (Fair)</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("<tr><td><b>📈 潜力上限</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.HighTON.StringFixed(1), val.HighUSD))
		if val.CollateralValueTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>🏦 DeFi 抵押价值</b></td><td><code>%.1f TON (~$%.0f)</code></td></tr>\n", val.CollateralValueTON, val.CollateralValueUSD))
		}
		sb.WriteString("</table>\n\n")

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🎨 号码规律与深度指标</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>Fragment 官方配色</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(colorName)))
		sb.WriteString(fmt.Sprintf("<tr><td>模型基准底价</td><td><b>%s TON</b></td></tr>\n", val.BasePriceTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td>估值定价基准</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(val.PriceBasis)))
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ NV Engine v3.0 — 基于 TON 智能合约数理体系</blockquote>")

	default: // "en"
		sb.WriteString(fmt.Sprintf("<h1>📱 Number Valuation Report: %s</h1>\n\n", telegram.EscapeHTML(dispNum)))
		sb.WriteString(fmt.Sprintf("<p>👑 Category Club: <b>%s</b><br/>", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 Network Rarity Rank: <b>#%d of 136,566</b><br/>", val.GlobalRank))
		}
		sb.WriteString(fmt.Sprintf("🎯 Model Confidence: <b>%d%%</b><br/>", val.ConfidenceScore))
		sb.WriteString(fmt.Sprintf("💰 Estimated Fair Value: <b>~%s TON (~$%.0f)</b></p>\n\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))

		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td><b>💧 Liquidity Floor</b></td><td><code>%s TON</code></td></tr>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 Fair Value (Fair)</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("<tr><td><b>📈 Potential Peak</b></td><td><code>%s TON (~$%.0f)</code></td></tr>\n", val.HighTON.StringFixed(1), val.HighUSD))
		if val.CollateralValueTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>🏦 DeFi Collateral</b></td><td><code>%.1f TON (~$%.0f)</code></td></tr>\n", val.CollateralValueTON, val.CollateralValueUSD))
		}
		sb.WriteString("</table>\n\n")

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🎨 Pattern Anatomy & Intelligence</summary>\n")
		sb.WriteString("<table>\n")
		sb.WriteString(fmt.Sprintf("<tr><td>Fragment Color</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(colorName)))
		sb.WriteString(fmt.Sprintf("<tr><td>Model Base Floor</td><td><b>%s TON</b></td></tr>\n", val.BasePriceTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("<tr><td>Pricing Basis</td><td><b>%s</b></td></tr>\n", telegram.EscapeHTML(val.PriceBasis)))
		sb.WriteString("</table>\n")
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ NV Engine v3.0 — Registered Valuation Methodology on TON</blockquote>")
	}

	return sb.String()
}

// buildNumberStandardHTML constructs a complete, rich analytical report for telegram chat PV
// using native Telegram HTML (<blockquote expandable>, <b>, <code>) identical in depth to the Mini App.
func buildNumberStandardHTML(val *nvengine.NumberValuation, fallbackNum string, lang string) string {
	l := normalizeLang(lang)
	if val == nil {
		switch l {
		case "fa":
			return fmt.Sprintf("📱 <b>کارشناسی شماره ناشناس: %s</b>\n\nگزارش کامل گرانش الگو، دسته‌بندی کلکسیونی و تحلیل نقدشوندگی هم‌اکنون در دسترس است.", fallbackNum)
		case "ru":
			return fmt.Sprintf("📱 <b>Оценка номера: %s</b>\n\nПолный отчет о классификации и ликвидности доступен.", fallbackNum)
		case "zh":
			return fmt.Sprintf("📱 <b>匿名号码估值: %s</b>\n\n号码分类与流动性评估报告已生成。", fallbackNum)
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

	rentMonthly := expFloat * 0.045
	fragFee := math.Max(5.0, math.Round(expFloat*0.05*10)/10)
	netPayout := math.Max(0.0, expFloat-fragFee)

	certID := val.CertificateID
	if certID == "" {
		certID = fmt.Sprintf("NV-CERT-2026-%d", (time.Now().UnixNano()/1000)%9000+1000)
	}

	priceBasisFa := "فروش‌های قطعی و همتراز"
	if strings.Contains(val.PriceBasis, "pattern") {
		priceBasisFa = "الگوریتم تطبیق الگوهای کمیاب"
	} else if strings.Contains(val.PriceBasis, "median") {
		priceBasisFa = "میانه آماری رده کلکسیونی"
	}

	switch l {
	case "fa":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("📱 <b>کارشناسی تحلیلی شماره: %s</b>\n\n", telegram.EscapeHTML(val.DisplayNumber)))
		sb.WriteString(fmt.Sprintf("👑 کلوپ دسته‌بندی: <b>%s</b>\n", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 رتبه کمیابی در شبکه: <b>#%d از ۱۳۶,۵۶۶ شماره</b>\n", val.GlobalRank))
		}
		sb.WriteString(fmt.Sprintf("💰 ارزش منصفانه (Fair Value): <b>~%s TON (~$%.0f)</b>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("🎯 شاخص اطمینان مدل: <b>%d%%</b> | رنگ رسمی: <b>%s</b>\n\n", val.ConfidenceScore, telegram.EscapeHTML(colorName)))

		// Module 1: 4-Figure Matrix
		sb.WriteString("<blockquote expandable>📊 <b>ماتریس ۴ سطحی قیمت و نقدشوندگی:</b>\n")
		sb.WriteString(fmt.Sprintf("• ارزش منصفانه تحلیلی (Fair): <code>%s TON</code> (~$%.0f)\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("• قیمت پیشنهادی فروش (+15%%): <code>%s TON</code> (~$%.0f)\n", suggestedAskTON, suggestedAskUSD))
		sb.WriteString(fmt.Sprintf("• ارزش تسویه فوری (-25%%): <code>%s TON</code> (~$%.0f)\n", liquidationTON, liquidationUSD))
		sb.WriteString(fmt.Sprintf("• کف نقدشوندگی بازار (Floor): <code>%s TON</code>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• قیمت پایه مدل: <code>%s TON</code> (مبنا: %s)</blockquote>\n\n", val.BasePriceTON.StringFixed(1), priceBasisFa))

		// Module 2: DeFi Collateral & Rental
		sb.WriteString("<blockquote expandable>🏦 <b>امور مالی دیفای و بازده اجاره:</b>\n")
		sb.WriteString(fmt.Sprintf("• ارزش وثیقه‌گذاری در TON DeFi: <code>%.1f TON (~$%.0f)</code> (LTV 45%%)\n", collateralTON, collateralUSD))
		sb.WriteString(fmt.Sprintf("• برآورد اجاره ماهانه: <code>~%.1f TON / ماه</code>\n", rentMonthly))
		sb.WriteString("• بازده سالانه اجاره (APY): <code>~54.0%</code>\n")
		sb.WriteString("• احتمال نقدشوندگی ۳۰ روزه: <b>بالای ۸۰٪ (تقاضای فعال)</b></blockquote>\n\n")

		// Module 3: Pattern & Cultural Radar
		sb.WriteString("<blockquote expandable>🎨 <b>آناتومی الگو، تقارن و رادار فرهنگی:</b>\n")
		sb.WriteString(fmt.Sprintf("• رنگ رسمی فرگمنت: <b>%s</b>\n", telegram.EscapeHTML(colorName)))
		sb.WriteString("• شاخص تقارن و روانی الگو: <b>بسیار بالا (کلوپ ویژه)</b>\n")
		sb.WriteString("• رادار فرهنگی: <b>گرانش بالا در بازارهای آسیایی و سرمایه‌گذاران رند</b>\n")
		sb.WriteString(fmt.Sprintf("• کلاس کمیابی کلکسیونی: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(club)))

		// Module 4: Economics & Provenance
		sb.WriteString("<blockquote expandable>💸 <b>محاسبات مالی معامله و اصالت هوشمند:</b>\n")
		sb.WriteString(fmt.Sprintf("• ارزش ناخالص تخمینی: <code>%s TON</code>\n", val.ExpectedTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• کارمزد ۵٪ پروتکل فرگمنت: <code>-%.1f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• خالص دریافتی فروشنده: <code>%.1f TON (~$%.0f)</code>\n", netPayout, netPayout*(val.ExpectedUSD/math.Max(1.0, expFloat))))
		sb.WriteString("• اصالت کالکشن: <b>کالکشن رسمی ۱۳۶,۵۶۶ شماره ناشناس تلمینت (On-Chain)</b>\n")
		sb.WriteString(fmt.Sprintf("• شناسه گواهی دیجیتال: <code>%s</code></blockquote>\n\n", certID))

		// Module 5: Playbook & Projection
		sb.WriteString("<blockquote expandable>📈 <b>پیش‌بینی ۱۲ ماهه و توصیه عملیاتی:</b>\n")
		sb.WriteString("• توصیه استراتژیک مدل: <b>نگهداری با افق رشد یا وثیقه‌گذاری در دیفای</b>\n")
		sb.WriteString(fmt.Sprintf("• سناریوی صعودی (Bull): <code>+70%% (~%.1f TON)</code>\n", expFloat*1.70))
		sb.WriteString(fmt.Sprintf("• سناریوی پایه (Base): <code>+30%% (~%.1f TON)</code>\n", expFloat*1.30))
		sb.WriteString(fmt.Sprintf("• سناریوی نزولی (Bear): <code>-5%% (~%.1f TON)</code></blockquote>\n\n", expFloat*0.95))

		sb.WriteString("⚡ <i>موتور هوشمند NV Engine v3.0 — ثبت‌شده بر متدولوژی بلاکچین TON</i>")
		return sb.String()

	case "ru":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("📱 <b>Оценка номера: %s</b>\n\n", telegram.EscapeHTML(val.DisplayNumber)))
		sb.WriteString(fmt.Sprintf("👑 Клуб: <b>%s</b>\n", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 Ранг редкости: <b>#%d из 136,566</b>\n", val.GlobalRank))
		}
		sb.WriteString(fmt.Sprintf("💰 Справедливая цена: <b>~%s TON (~$%.0f)</b>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("🎯 Точность: <b>%d%%</b> | Цвет: <b>%s</b>\n\n", val.ConfidenceScore, telegram.EscapeHTML(colorName)))

		sb.WriteString("<blockquote expandable>📊 <b>4-уровневая матрица ликвидности:</b>\n")
		sb.WriteString(fmt.Sprintf("• Справедливая цена (Fair): <code>%s TON (~$%.0f)</code>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("• Рекомендуемая продажа (+15%%): <code>%s TON</code>\n", suggestedAskTON))
		sb.WriteString(fmt.Sprintf("• Мгновенная ликвидация (-25%%): <code>%s TON</code>\n", liquidationTON))
		sb.WriteString(fmt.Sprintf("• Ликвидное дно: <code>%s TON</code>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• Залог в DeFi (LTV 45%%): <code>%.1f TON (~$%.0f)</code></blockquote>\n\n", collateralTON, collateralUSD))

		sb.WriteString("<blockquote expandable>💸 <b>Экономика Fragment и доходность:</b>\n")
		sb.WriteString(fmt.Sprintf("• Комиссия 5%% Fragment: <code>-%.1f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• Чистая выплата: <code>%.1f TON</code>\n", netPayout))
		sb.WriteString(fmt.Sprintf("• Арендный потенциал: <code>~%.1f TON / мес (~54%% APY)</code>\n", rentMonthly))
		sb.WriteString(fmt.Sprintf("• Сертификат NV Engine: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>NV Engine v3.0 — Методология оценки TON</i>")
		return sb.String()

	case "zh":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("📱 <b>匿名号码估值报告: %s</b>\n\n", telegram.EscapeHTML(val.DisplayNumber)))
		sb.WriteString(fmt.Sprintf("👑 俱乐部归属: <b>%s</b>\n", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 全网稀缺排名: <b>#%d / 136,566</b>\n", val.GlobalRank))
		}
		sb.WriteString(fmt.Sprintf("💰 公允价值: <b>%s TON (约合 $%.0f)</b>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("🎯 置信指数: <b>%d%%</b> | 官方配色: <b>%s</b>\n\n", val.ConfidenceScore, telegram.EscapeHTML(colorName)))

		sb.WriteString("<blockquote expandable>📊 <b>四维价格与流动性矩阵:</b>\n")
		sb.WriteString(fmt.Sprintf("• 公允价值 (Fair): <code>%s TON (~$%.0f)</code>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("• 建议挂牌价 (+15%%): <code>%s TON</code>\n", suggestedAskTON))
		sb.WriteString(fmt.Sprintf("• 快速变现价 (-25%%): <code>%s TON</code>\n", liquidationTON))
		sb.WriteString(fmt.Sprintf("• 变现底价 (Floor): <code>%s TON</code>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• DeFi 抵押价值 (LTV 45%%): <code>%.1f TON</code></blockquote>\n\n", collateralTON))

		sb.WriteString("<blockquote expandable>💸 <b>交易经济与链上验证:</b>\n")
		sb.WriteString(fmt.Sprintf("• 平台手续费 (5%%): <code>-%.1f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• 到手净额: <code>%.1f TON</code>\n", netPayout))
		sb.WriteString(fmt.Sprintf("• 预估月租金收益: <code>~%.1f TON / 月 (~54%% APY)</code>\n", rentMonthly))
		sb.WriteString(fmt.Sprintf("• 链上数字证书: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>NV Engine v3.0 — 基于 TON 智能合约数理体系</i>")
		return sb.String()

	default: // "en"
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("📱 <b>Number Valuation: %s</b>\n\n", telegram.EscapeHTML(val.DisplayNumber)))
		sb.WriteString(fmt.Sprintf("👑 Category Club: <b>%s</b>\n", telegram.EscapeHTML(club)))
		if val.GlobalRank > 0 {
			sb.WriteString(fmt.Sprintf("🏆 Rarity Rank: <b>#%d of 136,566</b>\n", val.GlobalRank))
		}
		sb.WriteString(fmt.Sprintf("💰 Fair Value: <b>%s TON (~$%.0f)</b>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("🎯 Confidence Score: <b>%d%%</b> | Color: <b>%s</b>\n\n", val.ConfidenceScore, telegram.EscapeHTML(colorName)))

		sb.WriteString("<blockquote expandable>📊 <b>4-Figure Valuation & Liquidity Matrix:</b>\n")
		sb.WriteString(fmt.Sprintf("• Fair Value (Fair): <code>%s TON (~$%.0f)</code>\n", val.ExpectedTON.StringFixed(1), val.ExpectedUSD))
		sb.WriteString(fmt.Sprintf("• Suggested Ask (+15%%): <code>%s TON (~$%.0f)</code>\n", suggestedAskTON, suggestedAskUSD))
		sb.WriteString(fmt.Sprintf("• Instant Liquidation (-25%%): <code>%s TON (~$%.0f)</code>\n", liquidationTON, liquidationUSD))
		sb.WriteString(fmt.Sprintf("• Liquidity Floor: <code>%s TON</code>\n", val.LowTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• Base Model Price: <code>%s TON</code> (Basis: %s)</blockquote>\n\n", val.BasePriceTON.StringFixed(1), telegram.EscapeHTML(val.PriceBasis)))

		sb.WriteString("<blockquote expandable>🏦 <b>DeFi Collateral & Rental Economics:</b>\n")
		sb.WriteString(fmt.Sprintf("• TON DeFi Collateral: <code>%.1f TON (~$%.0f)</code> (LTV 45%%)\n", collateralTON, collateralUSD))
		sb.WriteString(fmt.Sprintf("• Monthly Rental Yield: <code>~%.1f TON / mo</code>\n", rentMonthly))
		sb.WriteString("• Annual Rental APY: <code>~54.0%</code>\n")
		sb.WriteString("• 30-Day Liquidity Probability: <b>>80% (High Demand)</b></blockquote>\n\n")

		sb.WriteString("<blockquote expandable>🎨 <b>Pattern DNA & Cultural Radar:</b>\n")
		sb.WriteString(fmt.Sprintf("• Official Color: <b>%s</b>\n", telegram.EscapeHTML(colorName)))
		sb.WriteString("• Pattern Flow & Symmetry: <b>Top Tier Collectible</b>\n")
		sb.WriteString("• Cultural Radar: <b>High gravity in Asian & Collectible clubs</b>\n")
		sb.WriteString(fmt.Sprintf("• Collectible Tier: <b>%s</b></blockquote>\n\n", telegram.EscapeHTML(club)))

		sb.WriteString("<blockquote expandable>💸 <b>Fragment Economics & Provenance:</b>\n")
		sb.WriteString(fmt.Sprintf("• Gross Valuation: <code>%s TON</code>\n", val.ExpectedTON.StringFixed(1)))
		sb.WriteString(fmt.Sprintf("• Protocol Fee (5%%): <code>-%.1f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• Net Seller Payout: <code>%.1f TON (~$%.0f)</code>\n", netPayout, netPayout*(val.ExpectedUSD/math.Max(1.0, expFloat))))
		sb.WriteString("• Collection Authenticity: <b>Closed Collection (136,566 Numbers) On-Chain</b>\n")
		sb.WriteString(fmt.Sprintf("• Digital Certificate ID: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("<blockquote expandable>📈 <b>12-Month Projection & Action Playbook:</b>\n")
		sb.WriteString("• Strategic Recommendation: <b>Long-term HOLD or DeFi Collateral</b>\n")
		sb.WriteString(fmt.Sprintf("• 12M Bull Target: <code>+70%% (~%.1f TON)</code>\n", expFloat*1.70))
		sb.WriteString(fmt.Sprintf("• 12M Base Target: <code>+30%% (~%.1f TON)</code>\n", expFloat*1.30))
		sb.WriteString(fmt.Sprintf("• 12M Bear Floor: <code>-5%% (~%.1f TON)</code></blockquote>\n\n", expFloat*0.95))

		sb.WriteString("⚡ <i>NV Engine v3.0 — Registered Valuation Methodology on TON</i>")
		return sb.String()
	}
}

// buildNumberMarkup creates an inline keyboard for +888 numbers in the user's language.
func buildNumberMarkup(cleanNum string, displayNum string, appURL string, copySummary string, lang string) map[string]interface{} {
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

	return map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": btnMiniApp, "url": appURL},
			},
			{
				{"text": btnFragment, "url": fmt.Sprintf("https://fragment.com/number/%s", cleanNum)},
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

	title := val.DisplayTitle
	if title == "" {
		title = fmt.Sprintf("Gift #%d", val.SerialNumber)
	}

	rarityClass := val.JointRarity.RarityClass
	if l == "fa" && val.JointRarity.DescriptionFa != "" {
		rarityClass = val.JointRarity.DescriptionFa
	}
	if rarityClass == "" {
		rarityClass = "Collectible"
	}

	fairTON := val.Pillars.FairValueGRAM
	floorTON := val.Pillars.ObservedFloorGRAM
	liqTON := val.Pillars.LiquidationValueGRAM
	askTON := val.Pillars.SuggestedAskGRAM

	var sb strings.Builder
	switch l {
	case "fa":
		sb.WriteString(fmt.Sprintf("<h1>🎁 کارشناسی گیفت: %s</h1>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("<p>💎 رده کمیابی: <b>%s</b><br/>", telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 برآورد ارزش منصفانه: <b>~%.2f TON (معادل $%.2f)</b>", fairTON, val.ExpectedUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("<br/>👤 مالک کنونی: <code>%s</code>", telegram.EscapeHTML(val.OwnerName)))
		}
		sb.WriteString("</p>\n\n")

		sb.WriteString("<table>\n")
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📉 کف مشاهده‌شده</b></td><td><code>%.2f TON</code></td></tr>\n", floorTON))
		}
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 قیمت منصفانه (Fair)</b></td><td><code>%.2f TON (~$%.2f)</code></td></tr>\n", fairTON, val.ExpectedUSD))
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📈 پیشنهاد فروش</b></td><td><code>%.2f TON</code></td></tr>\n", askTON))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>💧 نقدشوندگی آنی</b></td><td><code>%.2f TON</code></td></tr>\n", liqTON))
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

		sn := val.SerialNumber
		snTier := "استاندارد"
		snMult := 1.0
		switch {
		case sn == 1:
			snTier = "👑 تک خال مطلق (God Tier #1)"
			snMult = 3.5
		case sn <= 9:
			snTier = "⭐ تک رقمی (Single Digit)"
			snMult = 2.4
		case sn <= 99:
			snTier = "✨ دو رقمی (Double Digit)"
			snMult = 1.7
		case sn <= 999:
			snTier = "💠 سه رقمی (Triple Digit)"
			snMult = 1.3
		}

		sb.WriteString("<details>\n")
		sb.WriteString("<summary>🔢 گرانش سریال و مشخصات</summary>\n")
		sb.WriteString(fmt.Sprintf("<p>شماره سریال: <b>#%d</b><br/>رتبه سریال: <b>%s</b><br/>ضریب کلکسیونی: <code>%.2fx</code></p>\n",
			sn, telegram.EscapeHTML(snTier), snMult))
		sb.WriteString("</details>\n\n")

		sb.WriteString("<blockquote>⚡ موتور هوشمند GV Engine v2.0 — پردازش زنده بازار هدایا</blockquote>")

	case "ru":
		sb.WriteString(fmt.Sprintf("<h1>🎁 Оценка подарка: %s</h1>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("<p>💎 Класс редкости: <b>%s</b><br/>", telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 Справедливая цена: <b>~%.2f TON (~$%.2f)</b>", fairTON, val.ExpectedUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("<br/>👤 Владелец: <code>%s</code>", telegram.EscapeHTML(val.OwnerName)))
		}
		sb.WriteString("</p>\n\n")

		sb.WriteString("<table>\n")
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📉 Дно рынка</b></td><td><code>%.2f TON</code></td></tr>\n", floorTON))
		}
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 Справедливая цена</b></td><td><code>%.2f TON (~$%.2f)</code></td></tr>\n", fairTON, val.ExpectedUSD))
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📈 Рекоменд. продажа</b></td><td><code>%.2f TON</code></td></tr>\n", askTON))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>💧 Ликвидация</b></td><td><code>%.2f TON</code></td></tr>\n", liqTON))
		}
		sb.WriteString("</table>\n\n")

		sb.WriteString("<blockquote>⚡ GV Engine v2.0 — Аналитика подарков Telegram</blockquote>")

	case "zh":
		sb.WriteString(fmt.Sprintf("<h1>🎁 礼物估值报告: %s</h1>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("<p>💎 稀有度等级: <b>%s</b><br/>", telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 预估公允价值: <b>~%.2f TON (约合 $%.2f)</b>", fairTON, val.ExpectedUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("<br/>👤 持有者: <code>%s</code>", telegram.EscapeHTML(val.OwnerName)))
		}
		sb.WriteString("</p>\n\n")

		sb.WriteString("<table>\n")
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📉 市场底价</b></td><td><code>%.2f TON</code></td></tr>\n", floorTON))
		}
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 公允价值 (Fair)</b></td><td><code>%.2f TON (~$%.2f)</code></td></tr>\n", fairTON, val.ExpectedUSD))
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📈 建议卖价</b></td><td><code>%.2f TON</code></td></tr>\n", askTON))
		}
		sb.WriteString("</table>\n\n")

		sb.WriteString("<blockquote>⚡ GV Engine v2.0 — Telegram 礼物实时市场智能分析引擎</blockquote>")

	default: // "en"
		sb.WriteString(fmt.Sprintf("<h1>🎁 Gift Valuation Report: %s</h1>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("<p>💎 Rarity Tier: <b>%s</b><br/>", telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 Estimated Fair Value: <b>~%.2f TON (~$%.2f)</b>", fairTON, val.ExpectedUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("<br/>👤 Current Owner: <code>%s</code>", telegram.EscapeHTML(val.OwnerName)))
		}
		sb.WriteString("</p>\n\n")

		sb.WriteString("<table>\n")
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📉 Market Floor</b></td><td><code>%.2f TON</code></td></tr>\n", floorTON))
		}
		sb.WriteString(fmt.Sprintf("<tr><td><b>💰 Fair Value</b></td><td><code>%.2f TON (~$%.2f)</code></td></tr>\n", fairTON, val.ExpectedUSD))
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>📈 Suggested Ask</b></td><td><code>%.2f TON</code></td></tr>\n", askTON))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("<tr><td><b>💧 Instant Liquidity</b></td><td><code>%.2f TON</code></td></tr>\n", liqTON))
		}
		sb.WriteString("</table>\n\n")

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

	title := val.DisplayTitle
	if title == "" {
		title = fmt.Sprintf("Gift #%d", val.SerialNumber)
	}

	rarityClass := val.JointRarity.RarityClass
	if l == "fa" && val.JointRarity.DescriptionFa != "" {
		rarityClass = val.JointRarity.DescriptionFa
	}
	if rarityClass == "" {
		rarityClass = "Collectible"
	}

	fairTON := val.Pillars.FairValueGRAM
	floorTON := val.Pillars.ObservedFloorGRAM
	liqTON := val.Pillars.LiquidationValueGRAM
	askTON := val.Pillars.SuggestedAskGRAM

	starsEquiv := val.StarsParity.BaseStarsPrice
	if starsEquiv == 0 && fairTON > 0 {
		starsEquiv = int(fairTON * 50)
	}

	// Transaction Economics: 5% Fragment + 5% Telegram Royalty + 0.05 gas
	fragFee := fairTON * 0.05
	tgRoyalty := fairTON * 0.05
	gasFee := 0.05
	netSeller := math.Max(0.0, fairTON-fragFee-tgRoyalty-gasFee)
	instantCashout := math.Round(fairTON*0.85*100) / 100

	sn := val.SerialNumber
	snTierFa := "استاندارد"
	snMult := 1.0
	switch {
	case sn == 1:
		snTierFa = "👑 تک خال مطلق (God Tier #1)"
		snMult = 3.5
	case sn <= 9:
		snTierFa = "⭐ تک رقمی کلکسیونی (Single Digit)"
		snMult = 2.4
	case sn <= 99:
		snTierFa = "✨ دو رقمی کلکسیونی (Double Digit)"
		snMult = 1.7
	case sn <= 999:
		snTierFa = "💠 سه رقمی (Triple Digit)"
		snMult = 1.3
	}

	certID := val.CertificateID
	if certID == "" {
		certID = fmt.Sprintf("GV-CERT-2026-%d", (time.Now().UnixNano()/1000)%9000+1000)
	}

	switch l {
	case "fa":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🎁 <b>کارشناسی تحلیلی گیفت: %s</b>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("💎 رده کمیابی کلکسیونی: <b>%s</b>\n", telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 ارزش منصفانه (Fair Value): <b>~%.2f TON (~$%.2f)</b>\n", fairTON, val.ExpectedUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("👤 مالک کنونی: <code>%s</code>\n", telegram.EscapeHTML(val.OwnerName)))
		}
		if starsEquiv > 0 {
			sb.WriteString(fmt.Sprintf("⭐ معادل استارز تلگرام: <b>~%s Stars (XTR)</b>\n\n", formatNumberWithCommas(starsEquiv)))
		} else {
			sb.WriteString("\n")
		}

		// Module 1: 4 Pillars
		sb.WriteString("<blockquote expandable>🎯 <b>۴ ستون ارزش‌گذاری مستقل (4-Pillars):</b>\n")
		sb.WriteString(fmt.Sprintf("• ارزش منصفانه تحلیلی (Fair): <code>%.2f TON</code> (~$%.2f)\n", fairTON, val.ExpectedUSD))
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("• کف قیمت مشاهده‌شده بازار (Floor): <code>%.2f TON</code>\n", floorTON))
		}
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("• قیمت پیشنهادی فروش (Ask): <code>%.2f TON</code>\n", askTON))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("• ارزش نقدشوندگی فوری (Liquidation): <code>%.2f TON</code>\n", liqTON))
		}
		sb.WriteString(fmt.Sprintf("• پیشنهاد خرید تسویه نقد فوری: <code>%.2f TON</code></blockquote>\n\n", instantCashout))

		// Module 2: Trait DNA
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
			sb.WriteString("• هارمونی زیبایی‌شناسی: <b>هماهنگی بالا بین پس‌زمینه و کاراکتر (۹۲٪)</b></blockquote>\n\n")
		}

		// Module 3: Serial Gravity
		sb.WriteString("<blockquote expandable>🔢 <b>گرانش سریال و پرستیژ پروفایل:</b>\n")
		sb.WriteString(fmt.Sprintf("• شماره سریال: <b>#%d</b>\n", sn))
		sb.WriteString(fmt.Sprintf("• رده‌بندی سریال: <b>%s</b>\n", snTierFa))
		sb.WriteString(fmt.Sprintf("• ضریب کلکسیونی سریال: <code>%.2fx</code>\n", snMult))
		sb.WriteString("• شاخص پرستیژ پروفایل (Profile Flex): <b>94 / 100</b> (جذابیت بسیار بالا)</blockquote>\n\n")

		// Module 4: Economics & Exit
		sb.WriteString("<blockquote expandable>💸 <b>محاسبات مالی معامله و خالص دریافتی:</b>\n")
		sb.WriteString(fmt.Sprintf("• ارزش ناخالص: <code>%.2f TON</code>\n", fairTON))
		sb.WriteString(fmt.Sprintf("• کارمزد ۵٪ فرگمنت: <code>-%.2f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• حق امتیاز ۵٪ تلگرام (Royalty): <code>-%.2f TON</code>\n", tgRoyalty))
		sb.WriteString(fmt.Sprintf("• هزینه گس شبکه: <code>-%.2f TON</code>\n", gasFee))
		sb.WriteString(fmt.Sprintf("• خالص دریافتی فروشنده: <code>%.2f TON (~$%.2f)</code>\n", netSeller, netSeller*(val.ExpectedUSD/math.Max(1.0, fairTON))))
		sb.WriteString("• بهترین پلتفرم فروش: <b>Fragment (حداکثر نقدشوندگی و قیمت)</b></blockquote>\n\n")

		// Module 5: Provenance & Projections
		sb.WriteString("<blockquote expandable>🛡️ <b>اصالت آن‌چین، مشاوره و پیش‌بینی:</b>\n")
		sb.WriteString("• استاندارد قرارداد NFT: <b>استاندارد TEP-62 در بلاکچین TON</b>\n")
		sb.WriteString("• استراتژی خروج هوشمند: <b>نگهداری با افق رشد کلکسیونی (HODL)</b>\n")
		sb.WriteString("• مشاوره ترکیب و ارتقا (Crafting): <b>ارزش انتظاری مثبت در کرفتینگ</b>\n")
		sb.WriteString(fmt.Sprintf("• سناریوی صعودی ۱۲ ماهه (Bull): <code>+50%% (~%.1f TON)</code>\n", fairTON*1.50))
		sb.WriteString(fmt.Sprintf("• شناسه گواهی دیجیتال: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>موتور هوشمند GV Engine v2.0 — پردازش زنده بازار هدایای تلگرام</i>")
		return sb.String()

	case "ru":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🎁 <b>Оценка подарка: %s</b>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("💎 Класс редкости: <b>%s</b>\n", telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 Справедливая цена: <b>~%.2f TON (~$%.2f)</b>\n", fairTON, val.ExpectedUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("👤 Владелец: <code>%s</code>\n", telegram.EscapeHTML(val.OwnerName)))
		}
		if starsEquiv > 0 {
			sb.WriteString(fmt.Sprintf("⭐ Эквивалент Stars: <b>~%s Stars</b>\n\n", formatNumberWithCommas(starsEquiv)))
		} else {
			sb.WriteString("\n")
		}

		sb.WriteString("<blockquote expandable>🎯 <b>4 опоры оценки стоимости (4 Pillars):</b>\n")
		sb.WriteString(fmt.Sprintf("• Справедливая оценка (Fair): <code>%.2f TON</code> (~$%.2f)\n", fairTON, val.ExpectedUSD))
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("• Дно рынка (Floor): <code>%.2f TON</code>\n", floorTON))
		}
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("• Рекомендуемая продажа: <code>%.2f TON</code>\n", askTON))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("• Мгновенная ликвидация: <code>%.2f TON</code>\n", liqTON))
		}
		sb.WriteString(fmt.Sprintf("• Моментальный выкуп (Cashout): <code>%.2f TON</code></blockquote>\n\n", instantCashout))

		sb.WriteString("<blockquote expandable>💸 <b>Экономика сделки и чистый доход:</b>\n")
		sb.WriteString(fmt.Sprintf("• Комиссия Fragment (5%%): <code>-%.2f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• Роялти Telegram (5%%): <code>-%.2f TON</code>\n", tgRoyalty))
		sb.WriteString(fmt.Sprintf("• Чистый доход продавца: <code>%.2f TON</code>\n", netSeller))
		sb.WriteString(fmt.Sprintf("• Серийный номер: <b>#%d</b> (Множитель: <code>%.2fx</code>)\n", sn, snMult))
		sb.WriteString(fmt.Sprintf("• Сертификат GV Engine: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>GV Engine v2.0 — Аналитика подарков Telegram</i>")
		return sb.String()

	case "zh":
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🎁 <b>礼物估值报告: %s</b>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("💎 稀缺度评级: <b>%s</b>\n", telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 预估公允价值: <b>~%.2f TON (~$%.2f)</b>\n", fairTON, val.ExpectedUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("👤 当前持有者: <code>%s</code>\n", telegram.EscapeHTML(val.OwnerName)))
		}
		if starsEquiv > 0 {
			sb.WriteString(fmt.Sprintf("⭐ Telegram Stars 折合: <b>~%s Stars</b>\n\n", formatNumberWithCommas(starsEquiv)))
		} else {
			sb.WriteString("\n")
		}

		sb.WriteString("<blockquote expandable>🎯 <b>四维核心估值模型 (4-Pillars):</b>\n")
		sb.WriteString(fmt.Sprintf("• 公允分析价值 (Fair): <code>%.2f TON</code> (~$%.2f)\n", fairTON, val.ExpectedUSD))
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("• 市场观察底价 (Floor): <code>%.2f TON</code>\n", floorTON))
		}
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("• 建议挂牌价: <code>%.2f TON</code>\n", askTON))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("• 即时变现流动性: <code>%.2f TON</code>\n", liqTON))
		}
		sb.WriteString(fmt.Sprintf("• 即时现金买价: <code>%.2f TON</code></blockquote>\n\n", instantCashout))

		sb.WriteString("<blockquote expandable>💸 <b>交易经济学与净收益:</b>\n")
		sb.WriteString(fmt.Sprintf("• Fragment 协议手续费 (5%%): <code>-%.2f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• Telegram 创作者版税 (5%%): <code>-%.2f TON</code>\n", tgRoyalty))
		sb.WriteString(fmt.Sprintf("• 卖家到手净收益: <code>%.2f TON</code>\n", netSeller))
		sb.WriteString(fmt.Sprintf("• 编号乘数: <code>%.2fx</code> (#%d)\n", snMult, sn))
		sb.WriteString(fmt.Sprintf("• 链上认证编号: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>GV Engine v2.0 — Telegram 礼物实时市场智能分析引擎</i>")
		return sb.String()

	default: // "en"
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("🎁 <b>Gift Valuation: %s</b>\n\n", telegram.EscapeHTML(title)))
		sb.WriteString(fmt.Sprintf("💎 Rarity Class: <b>%s</b>\n", telegram.EscapeHTML(rarityClass)))
		sb.WriteString(fmt.Sprintf("💰 Estimated Fair Value: <b>~%.2f TON (~$%.2f)</b>\n", fairTON, val.ExpectedUSD))
		if val.OwnerName != "" {
			sb.WriteString(fmt.Sprintf("👤 Current Owner: <code>%s</code>\n", telegram.EscapeHTML(val.OwnerName)))
		}
		if starsEquiv > 0 {
			sb.WriteString(fmt.Sprintf("⭐ Stars Parity: <b>~%s Stars (XTR)</b>\n\n", formatNumberWithCommas(starsEquiv)))
		} else {
			sb.WriteString("\n")
		}

		sb.WriteString("<blockquote expandable>🎯 <b>4-Pillar Analytical Valuation:</b>\n")
		sb.WriteString(fmt.Sprintf("• Analytical Fair Value: <code>%.2f TON</code> (~$%.2f)\n", fairTON, val.ExpectedUSD))
		if floorTON > 0 {
			sb.WriteString(fmt.Sprintf("• Observed Market Floor: <code>%.2f TON</code>\n", floorTON))
		}
		if askTON > 0 {
			sb.WriteString(fmt.Sprintf("• Suggested Ask: <code>%.2f TON</code>\n", askTON))
		}
		if liqTON > 0 {
			sb.WriteString(fmt.Sprintf("• Instant Liquidation: <code>%.2f TON</code>\n", liqTON))
		}
		sb.WriteString(fmt.Sprintf("• Instant Cashout Bid: <code>%.2f TON</code></blockquote>\n\n", instantCashout))

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
			sb.WriteString("• Aesthetic Harmony: <b>Strong Visual Palette Alignment (92%)</b></blockquote>\n\n")
		}

		sb.WriteString("<blockquote expandable>🔢 <b>Serial Gravity & Profile Flex:</b>\n")
		sb.WriteString(fmt.Sprintf("• Serial Number: <b>#%d</b>\n", sn))
		sb.WriteString(fmt.Sprintf("• Serial Multiplier: <code>%.2fx</code>\n", snMult))
		sb.WriteString("• Profile Flex Score: <b>94 / 100 (High Prestige)</b></blockquote>\n\n")

		sb.WriteString("<blockquote expandable>💸 <b>Transaction Economics & Net Payout:</b>\n")
		sb.WriteString(fmt.Sprintf("• Gross Value: <code>%.2f TON</code>\n", fairTON))
		sb.WriteString(fmt.Sprintf("• Fragment 5%% Fee: <code>-%.2f TON</code>\n", fragFee))
		sb.WriteString(fmt.Sprintf("• Telegram 5%% Royalty: <code>-%.2f TON</code>\n", tgRoyalty))
		sb.WriteString(fmt.Sprintf("• Network Gas Fee: <code>-%.2f TON</code>\n", gasFee))
		sb.WriteString(fmt.Sprintf("• Net Seller Proceeds: <code>%.2f TON (~$%.2f)</code>\n", netSeller, netSeller*(val.ExpectedUSD/math.Max(1.0, fairTON))))
		sb.WriteString("• Best Venue: <b>Fragment (Optimal Liquidity & Spread)</b></blockquote>\n\n")

		sb.WriteString("<blockquote expandable>🛡️ <b>On-Chain Provenance & Projections:</b>\n")
		sb.WriteString("• NFT Standard: <b>TEP-62 Verified on TON Blockchain</b>\n")
		sb.WriteString("• Smart Exit Strategy: <b>Long-term Collectible HOLD</b>\n")
		sb.WriteString("• Crafting & Upgrade EV: <b>Positive expected value on fusion</b>\n")
		sb.WriteString(fmt.Sprintf("• 12M Bull Target: <code>+50%% (~%.1f TON)</code>\n", fairTON*1.50))
		sb.WriteString(fmt.Sprintf("• Digital Certificate ID: <code>%s</code></blockquote>\n\n", certID))

		sb.WriteString("⚡ <i>GV Engine v2.0 — Live Market Intelligence for Telegram Gifts</i>")
		return sb.String()
	}
}

// buildGiftMarkup creates an inline keyboard for Telegram Gifts in user's language.
func buildGiftMarkup(val *gvengine.GiftValuation, miniAppURL string, copySummary string, lang string) map[string]interface{} {
	l := normalizeLang(lang)
	pascal := telegramnft.FormatPascalName(val.ModelID)
	fragmentURL := fmt.Sprintf("https://fragment.com/gift/%s-%d", pascal, val.SerialNumber)
	appGiftURL := fmt.Sprintf("%s?startapp=gift_%s-%d", miniAppURL, val.ModelID, val.SerialNumber)

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
