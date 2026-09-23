package handler

import (
	"fmt"
	"strings"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/telegramnft"
	"ifragment-backend/internal/service/numbers/nvengine"
	"ifragment-backend/internal/service/username/avm"
)

// ─── Username Formatters ──────────────────────────────────────────────────────

// buildUsernameRichHTML builds structured Rich Message HTML (Bot API 10.1+) with headings,
// tables, details/summary collapsible sections, and blockquotes for Telegram usernames.
func buildUsernameRichHTML(username string, res *avm.ValuationResult) string {
	var sb strings.Builder
	cleanUser := strings.TrimPrefix(strings.ToLower(username), "@")

	var gradeEmoji string = "📊"
	grade := "STANDARD"
	brandability := 50
	lowTON := "0.0"
	expectedTON := "0.0"
	highTON := "0.0"
	expectedUSD := "0"
	length := len(cleanUser)
	liquidity := "متوسط"
	sellTime := "۱ الی ۳ ماه"
	buyerProfile := "عمومی"
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

	sb.WriteString("<blockquote>⚡ موتور هوشمند AVM v7.0 — تحلیل جامع معاملات فرگمنت</blockquote>")
	return sb.String()
}

// buildUsernameStandardHTML builds standard HTML suitable for photo captions (under 1024 chars)
// and legacy sendMessage fallback.
func buildUsernameStandardHTML(username string, res *avm.ValuationResult) string {
	cleanUser := strings.TrimPrefix(strings.ToLower(username), "@")
	if res == nil {
		return fmt.Sprintf("🏷️ <b>کارشناسی نام کاربری: @%s</b>\n\nگزارش کامل شاخص‌های برندپذیری و ارزش‌گذاری این نام کاربری هم‌اکنون آماده است.", cleanUser)
	}

	var gradeEmoji string
	switch res.InvestmentGrade {
	case "AAA", "AA":
		gradeEmoji = "💎"
	case "A", "BBB":
		gradeEmoji = "⭐"
	default:
		gradeEmoji = "📊"
	}

	return fmt.Sprintf(`🏷️ <b>کارشناسی تحلیلی نام کاربری: @%s</b>

%s درجه سرمایه‌گذاری: <b>%s</b>
📈 شاخص برندپذیری: <b>%d / 100</b>
📉 بازه ارزش: <b>%s الی %s TON</b>
💰 برآورد منصفانه: <b>~%s TON (معادل $%s)</b>

<blockquote expandable>🧬 <b>ویژگی‌های ساختاری:</b>
• طول شناسه: <b>%d کاراکتر</b>
• رتبه نقدشوندگی: <b>%s</b>
• افق زمانی فروش: <b>%s</b>
• مخاطب هدف: <b>%s</b></blockquote>

⚡ <i>موتور هوشمند AVM v7.0 — سیگنال‌های زنده فرگمنت</i>`,
		cleanUser,
		gradeEmoji, res.InvestmentGrade,
		res.Brandability,
		res.LowTON.StringFixed(1), res.HighTON.StringFixed(1),
		res.ExpectedTON.StringFixed(1), res.ExpectedUSD.StringFixed(0),
		res.Length,
		res.LiquidityRating,
		res.EstimatedSellTime,
		res.TargetBuyerProfile,
	)
}

// buildUsernameMarkup creates an inline keyboard including WebApp, Fragment link,
// copy_text button, switch_inline_query, and back navigation.
func buildUsernameMarkup(username string, appURL string, copySummary string) map[string]interface{} {
	cleanUser := strings.TrimPrefix(strings.ToLower(username), "@")
	return map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": "📊 مشاهده تحلیل جامع در مینی‌اپ", "url": appURL},
			},
			{
				{"text": "🌐 مشاهده در فرگمنت", "url": fmt.Sprintf("https://fragment.com/username/%s", cleanUser)},
				{"text": "📋 کپی خلاصه تحلیل", "copy_text": map[string]string{"text": copySummary}},
			},
			{
				{"text": "🚀 اشتراک‌گذاری کارشناسی", "switch_inline_query": "@" + cleanUser},
				{"text": "🔙 بازگشت به منو", "callback_data": "nav:menu"},
			},
		},
	}
}

// ─── Number Formatters ────────────────────────────────────────────────────────

// buildNumberRichHTML builds structured Rich Message HTML for +888 Anonymous Numbers.
func buildNumberRichHTML(val *nvengine.NumberValuation) string {
	if val == nil {
		return "<h1>📱 کارشناسی شماره کلکسیونی</h1><p>اطلاعات شماره در دسترس نیست.</p>"
	}

	dispNum := val.DisplayNumber
	if dispNum == "" {
		dispNum = "شماره ناشناس"
	}

	club := val.CategoryClubFa
	if club == "" {
		club = val.CategoryClub
	}
	if club == "" {
		club = "کلکسیونی"
	}

	colorName := val.Color.Name
	if colorName == "" {
		colorName = "پیش‌فرض"
	}

	priceBasisFa := "فروش‌های مستقیم و همتراز"
	if strings.Contains(val.PriceBasis, "median") {
		priceBasisFa = "میانه آماری رده"
	} else if strings.Contains(val.PriceBasis, "pattern") {
		priceBasisFa = "الگوریتم تطبیق الگو"
	}

	var sb strings.Builder
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

	sb.WriteString("<blockquote>⚡ موتور هوشمند NV Engine v3.0 — ثبت متدولوژی بر پایه TON</blockquote>")
	return sb.String()
}

// buildNumberStandardHTML builds standard HTML for photo captions and legacy fallback.
func buildNumberStandardHTML(val *nvengine.NumberValuation, fallbackNum string) string {
	if val == nil {
		return fmt.Sprintf("📱 <b>کارشناسی شماره ناشناس: %s</b>\n\nگزارش کامل گرانش الگو، دسته‌بندی کلکسیونی و تحلیل نقدشوندگی هم‌اکنون در دسترس است.", fallbackNum)
	}

	club := val.CategoryClubFa
	if club == "" {
		club = val.CategoryClub
	}

	return fmt.Sprintf(`📱 <b>کارشناسی تحلیلی شماره: %s</b>

👑 کلوپ دسته‌بندی: <b>%s</b>
🏆 رتبه کمیابی در شبکه: <b>#%d از ۱۳۶,۵۶۶</b>
🎯 شاخص اطمینان مدل: <b>%d%%</b>
💰 ارزش منصفانه (Fair): <b>%s TON (~$%.0f)</b>

<blockquote expandable>📊 <b>جزییات برآورد بازار:</b>
• ارزش پایه: <b>%s TON</b>
• کف نقدشوندگی: <b>%s TON (~$%.0f)</b>
• سقف ارزش احتمالی: <b>%s TON (~$%.0f)</b>
• رنگ رسمی: <b>%s</b></blockquote>

⚡ <i>موتور NV Engine v3.0 بر اساس متدولوژی ثبت‌شده در TON</i>`,
		val.DisplayNumber,
		club,
		val.GlobalRank,
		val.ConfidenceScore,
		val.ExpectedTON.StringFixed(1), val.ExpectedUSD,
		val.BasePriceTON.StringFixed(1),
		val.LowTON.StringFixed(1), val.LowUSD,
		val.HighTON.StringFixed(1), val.HighUSD,
		val.Color.Name,
	)
}

// buildNumberMarkup creates an inline keyboard for +888 numbers.
func buildNumberMarkup(cleanNum string, displayNum string, appURL string, copySummary string) map[string]interface{} {
	return map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": "📊 مشاهده تحلیل جامع در مینی‌اپ", "url": appURL},
			},
			{
				{"text": "🌐 مشاهده در فرگمنت", "url": fmt.Sprintf("https://fragment.com/number/%s", cleanNum)},
				{"text": "📋 کپی خلاصه تحلیل", "copy_text": map[string]string{"text": copySummary}},
			},
			{
				{"text": "🚀 اشتراک‌گذاری کارشناسی", "switch_inline_query": displayNum},
				{"text": "🔙 بازگشت به منو", "callback_data": "nav:menu"},
			},
		},
	}
}

// ─── Gift Formatters ──────────────────────────────────────────────────────────

// buildGiftRichHTML builds structured Rich Message HTML for Telegram Gifts.
func buildGiftRichHTML(val *gvengine.GiftValuation) string {
	if val == nil {
		return "<h1>🎁 کارشناسی گیفت تلگرام</h1><p>اطلاعات گیفت در دسترس نیست.</p>"
	}

	title := val.DisplayTitle
	if title == "" {
		title = fmt.Sprintf("گیفت #%d", val.SerialNumber)
	}

	rarityClass := val.JointRarity.DescriptionFa
	if rarityClass == "" {
		rarityClass = val.JointRarity.RarityClass
	}
	if rarityClass == "" {
		rarityClass = "کلکسیونی"
	}

	fairTON := val.Pillars.FairValueGRAM
	floorTON := val.Pillars.ObservedFloorGRAM
	liqTON := val.Pillars.LiquidationValueGRAM
	askTON := val.Pillars.SuggestedAskGRAM

	var sb strings.Builder
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

	// Trait DNA section in <details>
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

	// Serial Gravity section in <details>
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
	return sb.String()
}

// buildGiftMarkup creates an inline keyboard for Telegram Gifts.
func buildGiftMarkup(val *gvengine.GiftValuation, miniAppURL string, copySummary string) map[string]interface{} {
	pascal := telegramnft.FormatPascalName(val.ModelID)
	fragmentURL := fmt.Sprintf("https://fragment.com/gift/%s-%d", pascal, val.SerialNumber)
	appGiftURL := fmt.Sprintf("%s?startapp=gift_%s-%d", miniAppURL, val.ModelID, val.SerialNumber)

	return map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": "📊 مشاهده گزارش کامل در مینی‌اپ", "url": appGiftURL},
			},
			{
				{"text": "💎 مشاهده در فرگمنت", "url": fragmentURL},
				{"text": "📋 کپی خلاصه تحلیل", "copy_text": map[string]string{"text": copySummary}},
			},
			{
				{"text": "🚀 اشتراک‌گذاری کارشناسی", "switch_inline_query": val.DisplayTitle},
				{"text": "🔙 بازگشت به منو", "callback_data": "nav:menu"},
			},
		},
	}
}

// ─── Shared Utilities ─────────────────────────────────────────────────────────

// buildCopySummary formats a plain-text clipboard friendly message for copy_text.
func buildCopySummary(assetEmoji, identifier, fairTON, fairUSD, extra string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%s کارشناسی: %s\n", assetEmoji, identifier))
	sb.WriteString(fmt.Sprintf("💰 ارزش منصفانه: ~%s TON (~$%s)\n", fairTON, fairUSD))
	if extra != "" {
		sb.WriteString(fmt.Sprintf("%s\n", extra))
	}
	sb.WriteString("⚡ تحلیل هوشمند iFragment | @iFragmentBot")
	return sb.String()
}
