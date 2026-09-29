package handler

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/service/username/avm"
)

// formatUSDT formats a USD/USDT valuation amount:
// - For values under 10: 2 decimal places (e.g., "7.50 USDT")
// - For values >= 10: no decimals, thousands separator with comma (e.g., "≈ 12,450 USDT")
// - If ok is false (or rate not available): "— USDT (نرخ موقتاً در دسترس نیست)"
func formatUSDT(v float64, ok bool, lang string) string {
	l := normalizeLang(lang)
	if !ok || v <= 0 {
		switch l {
		case "fa":
			return "— USDT (نرخ موقتاً در دسترس نیست)"
		case "ru":
			return "— USDT (курс временно недоступен)"
		case "zh":
			return "— USDT (汇率暂不可用)"
		default:
			return "— USDT (rate temporarily unavailable)"
		}
	}

	if v < 10.0 {
		return fmt.Sprintf("%.2f USDT", v)
	}

	intPart := int64(math.Round(v))
	str := strconv.FormatInt(intPart, 10)
	var buf strings.Builder
	lStr := len(str)
	for i, c := range str {
		buf.WriteRune(c)
		rem := lStr - 1 - i
		if rem > 0 && rem%3 == 0 {
			buf.WriteByte(',')
		}
	}
	return fmt.Sprintf("≈ %s USDT", buf.String())
}

// buildRateReferenceLine constructs the reference rate line:
// «💱 نرخ مرجع: 1 TON = X USDT (منبع، زمان)»
// If stale is true, prepends ⚠️
func buildRateReferenceLine(rate float64, source string, fetchedAt time.Time, isStale bool, ok bool, lang string) string {
	l := normalizeLang(lang)
	if !ok || rate <= 0 {
		switch l {
		case "fa":
			return "⚠️ 💱 نرخ مرجع: موقتاً در دسترس نیست"
		case "ru":
			return "⚠️ 💱 Справочный курс: временно недоступен"
		case "zh":
			return "⚠️ 💱 参考汇率: 暂不可用"
		default:
			return "⚠️ 💱 Reference Rate: temporarily unavailable"
		}
	}

	timeStr := "هم‌اکنون"
	if !fetchedAt.IsZero() {
		dur := time.Since(fetchedAt)
		if dur < time.Minute {
			timeStr = "هم‌اکنون"
		} else if dur < time.Hour {
			timeStr = fmt.Sprintf("%d دقیقه پیش", int(dur.Minutes()))
		} else {
			timeStr = fetchedAt.Format("15:04 UTC")
		}
	}

	rateFmt := fmt.Sprintf("%.2f", rate)
	if rate < 1.0 {
		rateFmt = fmt.Sprintf("%.4f", rate)
	}

	var warnPrefix string
	if isStale {
		warnPrefix = "⚠️ "
	}

	switch l {
	case "fa":
		return fmt.Sprintf("%s💱 نرخ مرجع: 1 TON = %s USDT (%s، %s)", warnPrefix, rateFmt, source, timeStr)
	case "ru":
		timeRu := "только что"
		if !fetchedAt.IsZero() && time.Since(fetchedAt) >= time.Minute {
			timeRu = fmt.Sprintf("%d мин. назад", int(time.Since(fetchedAt).Minutes()))
		}
		return fmt.Sprintf("%s💱 Справочный курс: 1 TON = %s USDT (%s, %s)", warnPrefix, rateFmt, source, timeRu)
	case "zh":
		timeZh := "刚刚"
		if !fetchedAt.IsZero() && time.Since(fetchedAt) >= time.Minute {
			timeZh = fmt.Sprintf("%d 分钟前", int(time.Since(fetchedAt).Minutes()))
		}
		return fmt.Sprintf("%s💱 参考汇率: 1 TON = %s USDT (%s, %s)", warnPrefix, rateFmt, source, timeZh)
	default:
		timeEn := "just now"
		if !fetchedAt.IsZero() && time.Since(fetchedAt) >= time.Minute {
			timeEn = fmt.Sprintf("%dm ago", int(time.Since(fetchedAt).Minutes()))
		}
		return fmt.Sprintf("%s💱 Reference Rate: 1 TON = %s USDT (%s, %s)", warnPrefix, rateFmt, source, timeEn)
	}
}

// translateAVM maps English engine terms (Liquidity, EstimatedSellTime, TargetBuyerProfile, Market status, etc.)
// into localized human-readable text for fa, ru, zh, ar, and en.
func translateAVM(term string, lang string) string {
	raw := strings.TrimSpace(term)
	if raw == "" {
		return ""
	}
	l := normalizeLang(lang)

	type termTrans struct {
		fa string
		ru string
		zh string
		ar string
		en string
	}

	dict := map[string]termTrans{
		// Liquidity Ratings
		"very high": {
			fa: "بسیار بالا",
			ru: "Очень высокая",
			zh: "极高",
			ar: "مرتفع جداً",
			en: "Very High",
		},
		"high": {
			fa: "بالا",
			ru: "Высокая",
			zh: "高",
			ar: "مرتفع",
			en: "High",
		},
		"high (a+)": {
			fa: "بسیار بالا (A+)",
			ru: "Очень высокая (A+)",
			zh: "极高 (A+)",
			ar: "مرتفع جداً (A+)",
			en: "Very High (A+)",
		},
		"high (a)": {
			fa: "بالا (A)",
			ru: "Высокая (A)",
			zh: "高 (A)",
			ar: "مرتفع (A)",
			en: "High (A)",
		},
		"medium": {
			fa: "متوسط",
			ru: "Средняя",
			zh: "中等",
			ar: "متوسط",
			en: "Medium",
		},
		"medium (bbb)": {
			fa: "متوسط (BBB)",
			ru: "Средняя (BBB)",
			zh: "中等 (BBB)",
			ar: "متوسط (BBB)",
			en: "Medium (BBB)",
		},
		"medium (bb)": {
			fa: "متوسط رو به پایین (BB)",
			ru: "Умеренная (BB)",
			zh: "中等偏低 (BB)",
			ar: "متوسط منخفض (BB)",
			en: "Moderate (BB)",
		},
		"low": {
			fa: "پایین",
			ru: "Низкая",
			zh: "低",
			ar: "منخفض",
			en: "Low",
		},
		"illiquid": {
			fa: "فاقد نقدشوندگی (راکد)",
			ru: "Неликвид",
			zh: "非流动性/停滞",
			ar: "غير سائل (راكد)",
			en: "Illiquid",
		},

		// Estimated Sell Time
		"instant / hours": {
			fa: "فوری / چند ساعت",
			ru: "Мгновенно / часы",
			zh: "即时 / 数小时内",
			ar: "فوري / بضع ساعات",
			en: "Instant / Hours",
		},
		"1-3 days": {
			fa: "۱ تا ۳ روز",
			ru: "1-3 дня",
			zh: "1-3 天",
			ar: "1-3 أيام",
			en: "1-3 days",
		},
		"1-2 weeks": {
			fa: "۱ تا ۲ هفته",
			ru: "1-2 недели",
			zh: "1-2 周",
			ar: "1-2 أسبوع",
			en: "1-2 weeks",
		},
		"1-3 months": {
			fa: "۱ تا ۳ ماه",
			ru: "1-3 месяца",
			zh: "1-3 个月",
			ar: "1-3 أشهر",
			en: "1-3 months",
		},
		"3-6 months": {
			fa: "۳ تا ۶ ماه",
			ru: "3-6 месяцев",
			zh: "3-6 个月",
			ar: "3-6 أشهر",
			en: "3-6 months",
		},
		"6-12 months": {
			fa: "۶ تا ۱۲ ماه",
			ru: "6-12 месяцев",
			zh: "6-12 个月",
			ar: "6-12 شهر",
			en: "6-12 months",
		},
		"12+ months": {
			fa: "بیش از ۱۲ ماه",
			ru: "Более 12 месяцев",
			zh: "12 个月以上",
			ar: "أكثر من 12 شهراً",
			en: "12+ months",
		},

		// Target Buyer Profile
		"corporate / brand": {
			fa: "سازمانی / برند تجاری",
			ru: "Корпоративный / Бренд",
			zh: "企业 / 商业品牌",
			ar: "شركات / علامات تجارية",
			en: "Corporate / Brand",
		},
		"crypto / web3 project": {
			fa: "پروژه کریپتو / وب۳",
			ru: "Крипто / Web3 проект",
			zh: "加密 / Web3 项目方",
			ar: "مشروع كريبتو / ويب3",
			en: "Crypto / Web3 Project",
		},
		"investor / collector": {
			fa: "سرمایه‌گذار / کلکسیونر",
			ru: "Инвестор / Коллекционер",
			zh: "投资者 / 藏家",
			ar: "مستثمر / جامع مقتنيات",
			en: "Investor / Collector",
		},
		"personal / identity": {
			fa: "هویت فردی / شخصی",
			ru: "Персональный / Личный",
			zh: "个人 / 身份认证",
			ar: "هوية شخصية / فردية",
			en: "Personal / Identity",
		},
		"speculator": {
			fa: "معامله‌گر نوسان‌گیر",
			ru: "Спекулянт / Трейдер",
			zh: "投机者 / 交易者",
			ar: "مضارب / متداول",
			en: "Speculator",
		},
		"general": {
			fa: "عمومی / نامشخص",
			ru: "Общий профиль",
			zh: "大众用户",
			ar: "عام",
			en: "General",
		},

		// Market Status
		"on_auction": {
			fa: "در حال حراج",
			ru: "На аукционе",
			zh: "竞拍中",
			ar: "في المزاد",
			en: "On Auction",
		},
		"on_sale": {
			fa: "برای فروش فوری",
			ru: "В продаже (Buy Now)",
			zh: "一口价出售",
			ar: "للبيع الفوري",
			en: "For Sale",
		},
		"sold": {
			fa: "فروخته‌شده",
			ru: "Продано",
			zh: "已成交",
			ar: "تم البيع",
			en: "Sold",
		},
		"available": {
			fa: "آزاد / قابل عرضه",
			ru: "Доступно к торгам",
			zh: "可供竞拍/自由",
			ar: "متاح للطرح",
			en: "Available",
		},
		"taken": {
			fa: "ثبت‌شده / در اختیار کاربر",
			ru: "Занято",
			zh: "已被占用",
			ar: "محجوز / مستخدم",
			en: "Taken",
		},
		"unknown": {
			fa: "نامشخص",
			ru: "Неизвестно",
			zh: "未知",
			ar: "غير معروف",
			en: "Unknown",
		},

		// Risk Levels
		"risk_low": {
			fa: "پایین (ایمن)",
			ru: "Низкий (безопасно)",
			zh: "低风险 (安全)",
			ar: "منخفض (آمن)",
			en: "Low (Safe)",
		},
		"risk_medium": {
			fa: "متوسط (نیاز به احتیاط)",
			ru: "Средний (внимание)",
			zh: "中等风险",
			ar: "متوسط (تحذير)",
			en: "Medium",
		},
		"risk_high": {
			fa: "بالا (پرخطر)",
			ru: "Высокий (опасно)",
			zh: "高风险 (危险)",
			ar: "مرتفع (خطر)",
			en: "High Risk",
		},
		"risk_critical": {
			fa: "بسیار بحرانی ⚠️",
			ru: "Критический ⚠️",
			zh: "极度危险 ⚠️",
			ar: "حرج للغاية ⚠️",
			en: "Critical ⚠️",
		},
		"critical": {
			fa: "بسیار بحرانی ⚠️",
			ru: "Критический ⚠️",
			zh: "极度危险 ⚠️",
			ar: "حرج للغاية ⚠️",
			en: "Critical ⚠️",
		},

		// Band Methods
		"empirical_sales_calibration": {
			fa: "کالیبراسیون تجربی معاملات واقعی",
			ru: "Эмпирическая калибровка сделок",
			zh: "真实成交经验校准",
			ar: "معايرة تجريبية للصفقات الفعلية",
			en: "Empirical Sales Calibration",
		},
		"comps_regression": {
			fa: "رگرسیون داده‌های همتراز فرگمنت",
			ru: "Регрессия аналогов Fragment",
			zh: "对标成交回归模型",
			ar: "انحدار المقارنات السابقة",
			en: "Comps Regression",
		},
		"heuristic": {
			fa: "الگوریتم تطبیقی و ساختار لغوی",
			ru: "Эвристический анализ",
			zh: "启发式结构算法",
			ar: "تحليل هيكلي استدلالي",
			en: "Heuristic",
		},
		"fallback": {
			fa: "برآورد پشتیبان پایه (حداقلی)",
			ru: "Базовая резервная оценка",
			zh: "兜底基准估算",
			ar: "تقدير احتياطي بديل",
			en: "Fallback",
		},

		// Price Spectrum Keys
		"floor": {
			fa: "کف ارزش",
			ru: "Нижняя граница",
			zh: "底价估值",
			ar: "الحد الأدنى للقيمة",
			en: "Floor Value",
		},
		"fair": {
			fa: "میانگین منصفانه",
			ru: "Справедливая цена",
			zh: "公允均价",
			ar: "متوسط القيمة العادلة",
			en: "Fair Average",
		},
		"ceiling": {
			fa: "سقف پتانسیل",
			ru: "Верхняя граница",
			zh: "天花板潜力",
			ar: "الحد الأقصى للإمكانات",
			en: "Ceiling Potential",
		},
	}

	key := strings.ToLower(raw)
	if tr, found := dict[key]; found {
		switch l {
		case "fa":
			return tr.fa
		case "ru":
			return tr.ru
		case "zh":
			return tr.zh
		case "ar":
			return tr.ar
		default:
			return tr.en
		}
	}

	return raw
}

// shortenWalletAddr shortens a TON wallet address (e.g., "EQD1234567890abcdef" -> "EQD123...cdef").
func shortenWalletAddr(addr string) string {
	clean := strings.TrimSpace(addr)
	if len(clean) <= 12 {
		return clean
	}
	return clean[:6] + "..." + clean[len(clean)-4:]
}

// formatMarketStatusLabel returns localized status string for current market presence.
func formatMarketStatusLabel(liveStatus, fragStatus, tgStatus, lang string) string {
	l := normalizeLang(lang)
	var stat string
	if liveStatus != "" && liveStatus != "unknown" {
		stat = liveStatus
	} else if fragStatus != "" {
		stat = fragStatus
	} else if tgStatus != "" {
		stat = tgStatus
	} else {
		stat = "unknown"
	}

	translated := translateAVM(stat, l)
	switch stat {
	case "on_auction":
		return "🔥 " + translated
	case "on_sale":
		return "🏷️ " + translated
	case "sold":
		return "✅ " + translated
	case "available":
		return "🟢 " + translated
	case "taken":
		return "🔒 " + translated
	default:
		return "ℹ️ " + translated
	}
}

// formatAuctionEndText formats remaining time or RFC3339 date string into human friendly text.
func formatAuctionEndText(endsAtStr string, lang string) string {
	l := normalizeLang(lang)
	if endsAtStr == "" {
		return ""
	}
	t, err := time.Parse(time.RFC3339, endsAtStr)
	if err != nil {
		return endsAtStr
	}

	diff := time.Until(t)
	if diff <= 0 {
		switch l {
		case "fa":
			return "پایان یافته"
		case "ru":
			return "Завершен"
		case "zh":
			return "已结束"
		case "ar":
			return "انتهى"
		default:
			return "Ended"
		}
	}

	hours := int(diff.Hours())
	mins := int(diff.Minutes()) % 60
	if hours > 24 {
		days := hours / 24
		remHours := hours % 24
		switch l {
		case "fa":
			return fmt.Sprintf("%d روز و %d ساعت دیگر", days, remHours)
		case "ru":
			return fmt.Sprintf("через %d дн. %d ч.", days, remHours)
		case "zh":
			return fmt.Sprintf("还剩 %d 天 %d 小时", days, remHours)
		case "ar":
			return fmt.Sprintf("متبقي %d يوم و %d ساعة", days, remHours)
		default:
			return fmt.Sprintf("%dd %dh remaining", days, remHours)
		}
	}

	switch l {
	case "fa":
		return fmt.Sprintf("%d ساعت و %d دقیقه دیگر", hours, mins)
	case "ru":
		return fmt.Sprintf("через %d ч. %d мин.", hours, mins)
	case "zh":
		return fmt.Sprintf("还剩 %d 小时 %d 分", hours, mins)
	case "ar":
		return fmt.Sprintf("متبقي %d ساعة و %d دقيقة", hours, mins)
	default:
		return fmt.Sprintf("%dh %dm remaining", hours, mins)
	}
}

// formatUsernameRichHTML builds a comprehensive Bot API rich_message HTML report for usernames
// utilizing all 50+ analytical fields and 10 detailed sections.
func formatUsernameRichHTML(username string, res *avm.ValuationResult, lang string) string {
	l := normalizeLang(lang)
	cleanUser := strings.TrimPrefix(strings.ToLower(username), "@")

	if res == nil {
		switch l {
		case "fa":
			return fmt.Sprintf("<h1>🏷️ کارشناسی تحلیلی: @%s</h1><p>اطلاعات ارزش‌گذاری برای این نام کاربری در دسترس نیست.</p>", telegram.EscapeHTML(cleanUser))
		case "ru":
			return fmt.Sprintf("<h1>🏷️ Аналитическая оценка: @%s</h1><p>Данные оценки для этого юзернейма недоступны.</p>", telegram.EscapeHTML(cleanUser))
		case "zh":
			return fmt.Sprintf("<h1>🏷️ 分析估值报告: @%s</h1><p>该用户名的估值数据不可用。</p>", telegram.EscapeHTML(cleanUser))
		case "ar":
			return fmt.Sprintf("<h1>🏷️ تقييم تحليلي: @%s</h1><p>بيانات التقييم غير متوفرة لاسم المستخدم هذا.</p>", telegram.EscapeHTML(cleanUser))
		default:
			return fmt.Sprintf("<h1>🏷️ Valuation Report: @%s</h1><p>Valuation data is unavailable for this username.</p>", telegram.EscapeHTML(cleanUser))
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

	expUSDFloat, _ := res.ExpectedUSD.Float64()
	rateOk := res.TONUSDRate > 0
	expectedUSDFormatted := formatUSDT(expUSDFloat, rateOk, l)

	var sb strings.Builder

	// Header Titles by language
	var (
		hTitle, lblGrade, lblBrand, lblFairVal string
		secStatus, secSpectrum, secComps, secTrend string
		secOwner, secStructure, secRisk, secPlaybook string
		secSimilar, secModel string
	)

	switch l {
	case "fa":
		hTitle = fmt.Sprintf("🏷️ کارشناسی تحلیلی: @%s", cleanUser)
		lblGrade = "درجه سرمایه‌گذاری"
		lblBrand = "شاخص برندپذیری"
		lblFairVal = "برآورد ارزش منصفانه"
		secStatus = "🟢 وضعیت بازار و فرگمنت"
		secSpectrum = "💰 طیف و ماتریس ارزش‌گذاری"
		secComps = "📊 معاملات مشابه و ثبت‌شده"
		secTrend = "📈 روند قیمتی و پیش‌بینی افق زمانی"
		secOwner = "👤 مشخصات مالک، کیف‌پول و اصالت تلمینت"
		secStructure = "🧬 آناتومی ساختاری، سئو و کمیابی"
		secRisk = "⚖️ ممیزی ریسک، برند و ضریب امنیت"
		secPlaybook = "🎯 استراتژی حراج و درآمد اجاره"
		secSimilar = "🔁 شناسه‌های مشابه و ارزش تخمینی"
		secModel = "ℹ️ شفافیت مدل و متدولوژی هوشمند"
	case "ru":
		hTitle = fmt.Sprintf("🏷️ Аналитическая оценка: @%s", cleanUser)
		lblGrade = "Инвестиционный грейд"
		lblBrand = "Индекс брендируемости"
		lblFairVal = "Справедливая оценка"
		secStatus = "🟢 Текущий статус и рынок"
		secSpectrum = "💰 Ценовой спектр и матрица"
		secComps = "📊 Похожие реальные сделки"
		secTrend = "📈 Динамика цен и прогнозы"
		secOwner = "👤 Профиль владельца, кошелек и Telemint"
		secStructure = "🧬 Структурный анализ, SEO и редкость"
		secRisk = "⚖️ Аудит рисков, бренды и безопасность"
		secPlaybook = "🎯 Тактика аукциона и аренда"
		secSimilar = "🔁 Похожие имена и оценка"
		secModel = "ℹ️ Прозрачность модели и методология"
	case "zh":
		hTitle = fmt.Sprintf("🏷️ 估值深度报告: @%s", cleanUser)
		lblGrade = "投资评级"
		lblBrand = "品牌指数"
		lblFairVal = "预估公允价值"
		secStatus = "🟢 实时状态与 Fragment 市场"
		secSpectrum = "💰 估值区间与价格矩阵"
		secComps = "📊 历史对标真实交易"
		secTrend = "📈 价格趋势与增长预测"
		secOwner = "👤 持有人画像、钱包与 Telemint 存证"
		secStructure = "🧬 结构属性、SEO 与稀缺度"
		secRisk = "⚖️ 风险合规、商标防伪与情绪"
		secPlaybook = "🎯 拍卖作战策略与出租收益"
		secSimilar = "🔁 相似标识与参考估值"
		secModel = "ℹ️ 模型透明度与算法指标"
	case "ar":
		hTitle = fmt.Sprintf("🏷️ تقييم تحليلي: @%s", cleanUser)
		lblGrade = "الدرجة الاستثمارية"
		lblBrand = "مؤشر العلامة التجارية"
		lblFairVal = "القيمة العادلة المقدرة"
		secStatus = "🟢 الحالة الحالية وسوق Fragment"
		secSpectrum = "💰 طيف السعر ومصفوفة التقييم"
		secComps = "📊 الصفقات المماثلة المسجلة"
		secTrend = "📈 اتجاه الأسعار والتوقعات"
		secOwner = "👤 ملف المالك، المحفظة وأصل Telemint"
		secStructure = "🧬 التحليل الهيكلي، السيو والندرة"
		secRisk = "⚖️ تدقيق المخاطر والأمان"
		secPlaybook = "🎯 تكتيكات المزاد وعائد التأجير"
		secSimilar = "🔁 المعرفات المماثلة والقيمة المقدرة"
		secModel = "ℹ️ شفافية النموذج والمنهجية"
	default:
		hTitle = fmt.Sprintf("🏷️ Valuation Report: @%s", cleanUser)
		lblGrade = "Investment Grade"
		lblBrand = "Brandability Score"
		lblFairVal = "Fair Value Estimate"
		secStatus = "🟢 Current Market & Fragment Status"
		secSpectrum = "💰 Valuation Spectrum & Matrix"
		secComps = "📊 Comparable Historical Sales"
		secTrend = "📈 Price Trend & Projections"
		secOwner = "👤 Owner Profile, Wallet & Telemint"
		secStructure = "🧬 Structural Anatomy, SEO & Rarity"
		secRisk = "⚖️ Risk Audit, Trademark & Security"
		secPlaybook = "🎯 Auction Playbook & Rent Yield"
		secSimilar = "🔁 Similar Handles & Estimates"
		secModel = "ℹ️ Model Transparency & Method"
	}

	sb.WriteString(fmt.Sprintf("<h1>%s</h1>\n\n", telegram.EscapeHTML(hTitle)))
	sb.WriteString(fmt.Sprintf("<p>%s %s: <b>%s</b>", gradeEmoji, lblGrade, telegram.EscapeHTML(res.InvestmentGrade)))
	if res.QualityGrade != "" {
		sb.WriteString(fmt.Sprintf(" (<code>%s</code>)", telegram.EscapeHTML(res.QualityGrade)))
	}
	sb.WriteString("<br/>\n")
	sb.WriteString(fmt.Sprintf("📈 %s: <b>%d / 100</b><br/>\n", lblBrand, res.Brandability))
	sb.WriteString(fmt.Sprintf("💰 %s: <b>~%s TON (%s)</b></p>\n\n", lblFairVal, res.ExpectedTON.StringFixed(1), expectedUSDFormatted))

	// ── SECTION 1: Current Status ──────────────────────────────────────────────
	sb.WriteString("<details>\n")
	sb.WriteString(fmt.Sprintf("<summary>%s</summary>\n<table>\n", secStatus))
	liveStatus := ""
	if res.LiveMarket != nil {
		liveStatus = res.LiveMarket.Status
	}
	statusBadge := formatMarketStatusLabel(liveStatus, res.FragmentMarketStatus, res.TelegramStatus, l)
	statusTitle := "وضعیت دارایی"
	switch l {
	case "ru":
		statusTitle = "Текущий статус"
	case "zh":
		statusTitle = "当前状态"
	case "ar":
		statusTitle = "حالة الأصل"
	case "en":
		statusTitle = "Current Status"
	}
	sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s</b></td></tr>\n", statusTitle, statusBadge))

	if res.LiveMarket != nil {
		if res.LiveMarket.CurrentBidTON > 0 {
			lblBid := "بالاترین پیشنهاد (Bid)"
			switch l {
			case "ru":
				lblBid = "Текущая ставка"
			case "zh":
				lblBid = "当前最高竞价"
			case "ar":
				lblBid = "أعلى عرض حالي"
			case "en":
				lblBid = "Current Standing Bid"
			}
			sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>%.1f TON</code></td></tr>\n", lblBid, res.LiveMarket.CurrentBidTON))
		}
		if res.LiveMarket.BuyNowTON > 0 {
			lblBuyNow := "قیمت فروش فوری (Ask)"
			switch l {
			case "ru":
				lblBuyNow = "Цена выкупа (Buy Now)"
			case "zh":
				lblBuyNow = "一口价 (Buy Now)"
			case "ar":
				lblBuyNow = "سعر الشراء الفوري"
			case "en":
				lblBuyNow = "Buy Now Ask"
			}
			sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>%.1f TON</code></td></tr>\n", lblBuyNow, res.LiveMarket.BuyNowTON))
		}
		if res.LiveMarket.AuctionEndsAt != "" {
			timeTxt := formatAuctionEndText(res.LiveMarket.AuctionEndsAt, l)
			lblEnd := "پایان حراج"
			switch l {
			case "ru":
				lblEnd = "Окончание аукциона"
			case "zh":
				lblEnd = "拍卖结束倒计时"
			case "ar":
				lblEnd = "نهاية المزاد"
			case "en":
				lblEnd = "Auction Closes In"
			}
			sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s</b></td></tr>\n", lblEnd, telegram.EscapeHTML(timeTxt)))
		}
	}
	sb.WriteString("</table>\n</details>\n\n")

	// ── SECTION 2: Price Spectrum ──────────────────────────────────────────────
	sb.WriteString("<details>\n")
	sb.WriteString(fmt.Sprintf("<summary>%s</summary>\n<table>\n", secSpectrum))
	lowUSDFloat, _ := res.LowUSD.Float64()
	highUSDFloat, _ := res.HighUSD.Float64()
	sb.WriteString(fmt.Sprintf("<tr><td>📉 %s</td><td><code>%s TON (%s)</code></td></tr>\n",
		translateAVM("floor", l), res.LowTON.StringFixed(1), formatUSDT(lowUSDFloat, rateOk, l)))
	sb.WriteString(fmt.Sprintf("<tr><td>💰 %s</td><td><code>%s TON (%s)</code></td></tr>\n",
		translateAVM("fair", l), res.ExpectedTON.StringFixed(1), expectedUSDFormatted))
	sb.WriteString(fmt.Sprintf("<tr><td>📈 %s</td><td><code>%s TON (%s)</code></td></tr>\n",
		translateAVM("ceiling", l), res.HighTON.StringFixed(1), formatUSDT(highUSDFloat, rateOk, l)))

	if res.MaxRationalBidTON.IsPositive() {
		lblMaxBid := "حداکثر بید عقلانی"
		switch l {
		case "ru":
			lblMaxBid = "Макс. разумная ставка"
		case "zh":
			lblMaxBid = "最高理性出价上限"
		case "ar":
			lblMaxBid = "الحد الأقصى للعرض العقلاني"
		case "en":
			lblMaxBid = "Max Rational Bid"
		}
		sb.WriteString(fmt.Sprintf("<tr><td>🎯 %s</td><td><code>%s TON</code></td></tr>\n", lblMaxBid, res.MaxRationalBidTON.StringFixed(1)))
	}
	if res.PercentileRank > 0 {
		lblPct := "پرسنتایل در کل بازار"
		switch l {
		case "ru":
			lblPct = "Процентиль на рынке"
		case "zh":
			lblPct = "全网市场百分位"
		case "ar":
			lblPct = "الرتبة المئوية في السوق"
		case "en":
			lblPct = "Market Percentile"
		}
		sb.WriteString(fmt.Sprintf("<tr><td>📊 %s</td><td><b>Top %.1f%%</b></td></tr>\n", lblPct, 100.0-res.PercentileRank))
	}
	sb.WriteString("</table>\n</details>\n\n")

	// ── SECTION 3: Comparables (Top 5) ─────────────────────────────────────────
	if len(res.Comparables) > 0 {
		sb.WriteString("<details>\n")
		sb.WriteString(fmt.Sprintf("<summary>%s (%d)</summary>\n<table>\n", secComps, len(res.Comparables)))
		limit := len(res.Comparables)
		if limit > 5 {
			limit = 5
		}
		for i := 0; i < limit; i++ {
			c := res.Comparables[i]
			cUSD := ""
			if res.TONUSDRate > 0 {
				cUSD = fmt.Sprintf(" (~$%s)", formatUSDT(c.Price*res.TONUSDRate, true, l))
			}
			dateStr := c.Date
			if len(dateStr) > 10 {
				dateStr = dateStr[:10]
			}
			sb.WriteString(fmt.Sprintf("<tr><td>@%s</td><td><code>%.1f TON%s</code></td><td>%s</td></tr>\n",
				telegram.EscapeHTML(c.Username), c.Price, cUSD, telegram.EscapeHTML(dateStr)))
		}
		sb.WriteString("</table>\n</details>\n\n")
	}

	// ── SECTION 4: Price Trend & Projections ───────────────────────────────────
	if len(res.PriceTrend) > 0 || res.ProjectedGrowth.BullTON > 0 || res.ProjectedGrowth.BaseTON > 0 {
		sb.WriteString("<details>\n")
		sb.WriteString(fmt.Sprintf("<summary>%s</summary>\n<table>\n", secTrend))
		if res.ProjectedGrowth.BullTON > 0 {
			lblBull := "سناریوی صعودی ۱۲ ماهه (Bull)"
			switch l {
			case "ru":
				lblBull = "12M Бычий сценарий (Bull)"
			case "zh":
			lblBull = "12个月乐观牛市 (Bull)"
			case "ar":
				lblBull = "سيناريو صعودي 12 شهر (Bull)"
			case "en":
				lblBull = "12M Bull Scenario"
			}
			sb.WriteString(fmt.Sprintf("<tr><td>🚀 %s</td><td><code>+%.1f TON</code></td></tr>\n", lblBull, res.ProjectedGrowth.BullTON))
		}
		if res.ProjectedGrowth.BaseTON > 0 {
			lblBase := "سناریوی پایه ۱۲ ماهه (Base)"
			switch l {
			case "ru":
				lblBase = "12M Базовый сценарий (Base)"
			case "zh":
				lblBase = "12个月基准预期 (Base)"
			case "ar":
				lblBase = "السيناريو الأساسي 12 شهر (Base)"
			case "en":
				lblBase = "12M Base Scenario"
			}
			sb.WriteString(fmt.Sprintf("<tr><td>⚖️ %s</td><td><code>~%.1f TON</code></td></tr>\n", lblBase, res.ProjectedGrowth.BaseTON))
		}
		if len(res.PriceTrend) > 0 {
			for _, pt := range res.PriceTrend {
				sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>%.1f TON</code></td></tr>\n",
					telegram.EscapeHTML(pt.Label), pt.Value))
			}
		}
		sb.WriteString("</table>\n</details>\n\n")
	}

	// ── SECTION 5: Owner, Wallet & Telemint Provenance ─────────────────────────
	hasOwnerSec := res.OwnerProfile != nil || res.WalletInfo != nil || res.Portfolio != nil || (res.TelemintProvenance != nil && res.TelemintProvenance.ItemAddress != "")
	if hasOwnerSec {
		sb.WriteString("<details>\n")
		sb.WriteString(fmt.Sprintf("<summary>%s</summary>\n<table>\n", secOwner))
		if res.OwnerProfile != nil {
			name := strings.TrimSpace(res.OwnerProfile.FirstName + " " + res.OwnerProfile.LastName)
			if name != "" {
				lblOwner := "هویت تلگرام"
				switch l {
				case "ru":
					lblOwner = "Профиль Telegram"
				case "zh":
					lblOwner = "Telegram 身份"
				case "ar":
					lblOwner = "ملف تيليجرام"
				case "en":
					lblOwner = "Telegram Profile"
				}
				prem := ""
				if res.OwnerProfile.IsPremium {
					prem = " ⭐"
				}
				sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s%s</b> (%s)</td></tr>\n",
					lblOwner, telegram.EscapeHTML(name), prem, telegram.EscapeHTML(translateAVM(res.OwnerProfile.PeerType, l))))
			}
		}
		if res.WalletInfo != nil {
			lblWallet := "کیف‌پول مالک"
			switch l {
			case "ru":
				lblWallet = "Кошелек владельца"
			case "zh":
				lblWallet = "持有者钱包"
			case "ar":
				lblWallet = "محفظة المالك"
			case "en":
				lblWallet = "Owner Wallet"
			}
			whaleBadge := ""
			if res.WalletInfo.IsWhale {
				whaleBadge = " 🐋"
			}
			sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>%.1f TON</code> (%d NFTs)%s</td></tr>\n",
				lblWallet, res.WalletInfo.Balance, res.WalletInfo.NFTCount, whaleBadge))
		}
		if res.Portfolio != nil && res.Portfolio.TotalCount > 0 {
			lblPort := "سبد دارایی والت"
			switch l {
			case "ru":
				lblPort = "Портфель кошелька"
			case "zh":
				lblPort = "钱包资产规模"
			case "ar":
				lblPort = "محفظة الأصول"
			case "en":
				lblPort = "Wallet Portfolio"
			}
			sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%d نام کاربری</b> (~%.0f TON)</td></tr>\n",
				lblPort, res.Portfolio.TotalCount, res.Portfolio.TotalEstValueTON))
		}
		if res.TelemintProvenance != nil && res.TelemintProvenance.ItemAddress != "" {
			lblContract := "قرارداد Telemint"
			switch l {
			case "ru":
				lblContract = "Смарт-контракт"
			case "zh":
				lblContract = "Telemint 合约"
			case "ar":
				lblContract = "عقد Telemint"
			case "en":
				lblContract = "Telemint Contract"
			}
			auth := "✅ Authentic"
			if !res.TelemintProvenance.IsAuthentic {
				auth = "⚠️ Unverified"
			}
			sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>%s</code> (%s)</td></tr>\n",
				lblContract, shortenWalletAddr(res.TelemintProvenance.ItemAddress), auth))
		}
		sb.WriteString("</table>\n</details>\n\n")
	}

	// ── SECTION 6: Structure, Dictionary, Wiki, SEO & Rarity ──────────────────
	sb.WriteString("<details>\n")
	sb.WriteString(fmt.Sprintf("<summary>%s</summary>\n<table>\n", secStructure))
	charLen := res.Length
	if charLen == 0 {
		charLen = len(cleanUser)
	}
	lblLen := "طول شناسه"
	switch l {
	case "ru":
		lblLen = "Длина"
	case "zh":
		lblLen = "字符长度"
	case "ar":
		lblLen = "طول المعرف"
	case "en":
		lblLen = "Length"
	}
	sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%d کاراکتر</b></td></tr>\n", lblLen, charLen))

	if res.Rarity.Tier != "" {
		sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s (%s)</b></td></tr>\n",
			translateAVM("rarity", l), telegram.EscapeHTML(translateAVM(res.Rarity.Tier, l)), res.Rarity.Stars))
	}
	if len(res.Tags) > 0 {
		lblTags := "برچسب‌های موضوعی"
		switch l {
		case "ru":
			lblTags = "Теги"
		case "zh":
			lblTags = "标签"
		case "ar":
			lblTags = "الوسوم"
		case "en":
			lblTags = "Tags"
		}
		sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>%s</code></td></tr>\n",
			lblTags, telegram.EscapeHTML(strings.Join(res.Tags, ", "))))
	}
	if res.Dictionary.IsWord {
		lblDict := "وضعیت لغت‌نامه"
		switch l {
		case "ru":
			lblDict = "Словарь"
		case "zh":
			lblDict = "词典收录"
		case "ar":
			lblDict = "حالة القاموس"
		case "en":
			lblDict = "Dictionary"
		}
		defText := res.Dictionary.PartOfSpeech
		if res.Dictionary.Definition != "" {
			defText += ": " + res.Dictionary.Definition
		}
		sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><i>%s</i></td></tr>\n", lblDict, telegram.EscapeHTML(defText)))
	}
	if res.WikipediaSummary != "" {
		lblWiki := "دانشنامه ویکی‌پدیا"
		switch l {
		case "ru":
			lblWiki = "Википедия"
		case "zh":
			lblWiki = "维基百科"
		case "ar":
			lblWiki = "ويكيبيديا"
		case "en":
			lblWiki = "Wikipedia"
		}
		wSummary := res.WikipediaSummary
		if len([]rune(wSummary)) > 80 {
			wSummary = string([]rune(wSummary)[:77]) + "..."
		}
		sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><i>%s</i></td></tr>\n", lblWiki, telegram.EscapeHTML(wSummary)))
	}
	if res.SEO.Score > 0 || res.SEO.Verdict != "" {
		sb.WriteString(fmt.Sprintf("<tr><td>SEO</td><td><b>%d/100</b> (%s)</td></tr>\n",
			res.SEO.Score, telegram.EscapeHTML(res.SEO.Verdict)))
	}
	if res.SearchTrend != nil && res.SearchTrend.Status != "" {
		lblTrend := "روند جستجو"
		switch l {
		case "ru":
			lblTrend = "Поисковый тренд"
		case "zh":
			lblTrend = "搜索热度"
		case "ar":
			lblTrend = "اتجاه البحث"
		case "en":
			lblTrend = "Search Trend"
		}
		sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s (+%d%%)</b></td></tr>\n",
			lblTrend, telegram.EscapeHTML(translateAVM(res.SearchTrend.Status, l)), res.SearchTrend.SurgePercent))
	}
	sb.WriteString("</table>\n</details>\n\n")

	// ── SECTION 7: Risk Audit, Trademark, Phishing & Homoglyph Twins, Fear/Greed
	sb.WriteString("<details>\n")
	sb.WriteString(fmt.Sprintf("<summary>%s</summary>\n<table>\n", secRisk))

	tmRiskText := translateAVM("risk_low", l)
	if res.TrademarkRisk.RiskLevel != "" {
		tmRiskText = translateAVM("risk_"+strings.ToLower(res.TrademarkRisk.RiskLevel), l)
		if res.TrademarkRisk.Brand != "" {
			tmRiskText += fmt.Sprintf(" (%s)", res.TrademarkRisk.Brand)
		}
	}
	lblTM := "ریسک علامت تجاری (TOS §4)"
	switch l {
	case "ru":
		lblTM = "Риск бренда (TOS §4)"
	case "zh":
		lblTM = "商标侵权风险 (TOS §4)"
	case "ar":
		lblTM = "مخاطر العلامة التجارية"
	case "en":
		lblTM = "Trademark Risk (TOS §4)"
	}
	sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s</b></td></tr>\n", lblTM, telegram.EscapeHTML(tmRiskText)))

	// Dynamic Phishing & Homoglyph Twins (NO hardcoded clean)
	phishingText := translateAVM("risk_low", l)
	if res.PhishingThreat != nil && res.PhishingThreat.HasThreat {
		phishingText = fmt.Sprintf("⚠️ %s (%s)", translateAVM(res.PhishingThreat.RiskLevel, l), res.PhishingThreat.SimilarUsername)
	} else if len(res.HomoglyphTwins) > 0 {
		phishingText = fmt.Sprintf("⚠️ %d دوقلوی بصری شناسایی شد", len(res.HomoglyphTwins))
		if l == "en" {
			phishingText = fmt.Sprintf("⚠️ %d visual twins detected", len(res.HomoglyphTwins))
		}
	}
	lblPhish := "امنیت فیشینگ و هوموگلیف"
	switch l {
	case "ru":
		lblPhish = "Фишинг и омоглифы"
	case "zh":
		lblPhish = "钓鱼仿冒与形近字"
	case "ar":
		lblPhish = "أمان التصيد والمتجانسات"
	case "en":
		lblPhish = "Phishing & Homoglyphs"
	}
	sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s</b></td></tr>\n", lblPhish, telegram.EscapeHTML(phishingText)))

	if len(res.HomoglyphTwins) > 0 {
		twinsList := make([]string, 0, len(res.HomoglyphTwins))
		for _, tw := range res.HomoglyphTwins {
			twinsList = append(twinsList, "@"+tw.Twin)
		}
		lblTwins := "دوقلوهای مشابه"
		switch l {
		case "ru":
			lblTwins = "Омоглифы-двойники"
		case "zh":
			lblTwins = "形近仿冒标识"
		case "ar":
			lblTwins = "المعرفات التوأم"
		case "en":
			lblTwins = "Identified Twins"
		}
		sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>%s</code></td></tr>\n", lblTwins, telegram.EscapeHTML(strings.Join(twinsList, ", "))))
	}

	if res.FearGreedIndex > 0 || res.FearGreedLabel != "" {
		lblFng := "شاخص ترس و طمع"
		switch l {
		case "ru":
			lblFng = "Индекс страха и жадности"
		case "zh":
			lblFng = "市场恐慌贪婪指数"
		case "ar":
			lblFng = "مؤشر الخوف والجشع"
		case "en":
			lblFng = "Fear & Greed Index"
		}
		sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s (%d/100)</b></td></tr>\n",
			lblFng, telegram.EscapeHTML(translateAVM(res.FearGreedLabel, l)), res.FearGreedIndex))
	}
	sb.WriteString("</table>\n</details>\n\n")

	// ── SECTION 8: Auction Playbook & Rent Yield ───────────────────────────────
	hasPlaybookSec := res.AuctionPlaybook != nil || res.RentYield != nil || res.TransactionEconomics != nil
	if hasPlaybookSec {
		sb.WriteString("<details>\n")
		sb.WriteString(fmt.Sprintf("<summary>%s</summary>\n<table>\n", secPlaybook))
		if res.TransactionEconomics != nil {
			lblFee := "کارمزد پروتکل فرگمنت"
			lblNet := "خالص دریافتی فروشنده"
			switch l {
			case "ru":
				lblFee = "Комиссия Fragment"
				lblNet = "Чистая выплата продавцу"
			case "zh":
				lblFee = "Fragment 协议手续费"
				lblNet = "卖家实际到手 (Net)"
			case "ar":
				lblFee = "رسوم منصة Fragment"
				lblNet = "صافي عوائد البائع"
			case "en":
				lblFee = "Fragment Protocol Fee"
				lblNet = "Net Seller Proceeds"
			}
			sb.WriteString(fmt.Sprintf("<tr><td>%s (%.0f%%)</td><td><code>-%.1f TON</code></td></tr>\n",
				lblFee, res.TransactionEconomics.FragmentFeePct, res.TransactionEconomics.FragmentFeeTON))
			sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%.1f TON</b></td></tr>\n",
				lblNet, res.TransactionEconomics.NetPayoutTON))
		}
		if res.AuctionPlaybook != nil {
			lblStartBid := "شروع پیشنهادی حراج"
			lblStep := "گام افزایش بید"
			lblBestTime := "بهترین زمان عرضه"
			switch l {
			case "ru":
				lblStartBid = "Реком. старт аукциона"
				lblStep = "Шаг ставки (Bid Step)"
				lblBestTime = "Лучшее время запуска"
			case "zh":
				lblStartBid = "建议起拍底价"
				lblStep = "竞价最小步长"
				lblBestTime = "最佳开拍时机"
			case "ar":
				lblStartBid = "بداية المزاد المقترحة"
				lblStep = "خطوة المزايدة"
				lblBestTime = "أفضل وقت للطرح"
			case "en":
				lblStartBid = "Recommended Start Bid"
				lblStep = "Bid Step"
				lblBestTime = "Optimal Launch Window"
			}
			sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>%.1f TON</code></td></tr>\n", lblStartBid, res.AuctionPlaybook.StartPriceTON))
			if res.AuctionPlaybook.BidStepTON > 0 {
				sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>%.1f TON</code></td></tr>\n", lblStep, res.AuctionPlaybook.BidStepTON))
			}
			if res.AuctionPlaybook.BestDay != "" {
				sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s (%s UTC)</b></td></tr>\n",
					lblBestTime, telegram.EscapeHTML(res.AuctionPlaybook.BestDay), telegram.EscapeHTML(res.AuctionPlaybook.BestHourUTC)))
			}
		}
		// Dynamic RentYield: OMIT if nil!
		if res.RentYield != nil && res.RentYield.MonthlyMedianTON > 0 {
			lblRent := "کف درآمد اجاره ماهانه"
			switch l {
			case "ru":
				lblRent = "Арендная доходность/мес"
			case "zh":
				lblRent = "月度租赁收益基准"
			case "ar":
				lblRent = "عائد الإيجار الشهري"
			case "en":
				lblRent = "Monthly Rent Yield Floor"
			}
			sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>~%.1f TON / mo</code> (Floor: %.1f TON)</td></tr>\n",
				lblRent, res.RentYield.MonthlyMedianTON, res.RentYield.RentFloorTON))
		}
		sb.WriteString("</table>\n</details>\n\n")
	}

	// ── SECTION 9: Similar Usernames (Top 5) ───────────────────────────────────
	if len(res.Similar) > 0 {
		sb.WriteString("<details>\n")
		sb.WriteString(fmt.Sprintf("<summary>%s (%d)</summary>\n<table>\n", secSimilar, len(res.Similar)))
		limit := len(res.Similar)
		if limit > 5 {
			limit = 5
		}
		for i := 0; i < limit; i++ {
			s := res.Similar[i]
			priceStr := "—"
			if s.SalePrice > 0 {
				priceStr = fmt.Sprintf("%.1f TON", s.SalePrice)
			}
			st := translateAVM(s.Status, l)
			sb.WriteString(fmt.Sprintf("<tr><td>@%s</td><td><code>%s</code></td><td>%s</td></tr>\n",
				telegram.EscapeHTML(s.Username), priceStr, telegram.EscapeHTML(st)))
		}
		sb.WriteString("</table>\n</details>\n\n")
	}

	// ── SECTION 10: Model Transparency, Accuracy, Freshness & Fallback ────────
	sb.WriteString("<details>\n")
	sb.WriteString(fmt.Sprintf("<summary>%s</summary>\n<table>\n", secModel))
	lblConf := "ضریب اطمینان مدل"
	switch l {
	case "ru":
		lblConf = "Уверенность модели"
	case "zh":
		lblConf = "模型置信度"
	case "ar":
		lblConf = "نسبة الثقة في النموذج"
	case "en":
		lblConf = "Model Confidence"
	}
	sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%d%%</b></td></tr>\n", lblConf, res.ConfidenceScore))

	if res.ModelAccuracy != nil {
		lblErr := "میانه خطای آماری (Error)"
		switch l {
		case "ru":
			lblErr = "Медианная погрешность"
		case "zh":
			lblErr = "实测中位数误差"
		case "ar":
			lblErr = "متوسط الخطأ الإحصائي"
		case "en":
			lblErr = "Median Backtest Error"
		}
		sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>±%.1f%%</code> (Band: %.1f%%)</td></tr>\n",
			lblErr, res.ModelAccuracy.MedianErrorPct, res.ModelAccuracy.WithinBandPct))
	}

	if res.BandMethod != "" {
		lblMethod := "روش تعیین بازه"
		switch l {
		case "ru":
			lblMethod = "Метод калибровки"
		case "zh":
			lblMethod = "估值校准方法"
		case "ar":
			lblMethod = "طريقة تحديد النطاق"
		case "en":
			lblMethod = "Band Method"
		}
		sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><b>%s</b></td></tr>\n",
			lblMethod, telegram.EscapeHTML(translateAVM(res.BandMethod, l))))
	}

	if !res.DataFreshness.IsZero() {
		lblFresh := "تازگی سیگنال‌های بازار"
		switch l {
		case "ru":
			lblFresh = "Свежесть рыночных данных"
		case "zh":
			lblFresh = "链上市场数据时效"
		case "ar":
			lblFresh = "حداثة بيانات السوق"
		case "en":
			lblFresh = "Market Data Freshness"
		}
		freshText := "زنده (Live On-Chain)"
		dur := time.Since(res.DataFreshness)
		if dur > 24*time.Hour {
			freshText = fmt.Sprintf("%d روز پیش", int(dur.Hours()/24))
		} else if dur > time.Hour {
			freshText = fmt.Sprintf("%d ساعت پیش", int(dur.Hours()))
		}
		sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>%s</code></td></tr>\n", lblFresh, telegram.EscapeHTML(freshText)))
	}

	if res.IsFallbackUsed {
		lblWarn := "⚠️ هشدار: استفاده از مدل پشتیبان به دلیل کمبود معاملات مستقیم"
		switch l {
		case "ru":
			lblWarn = "⚠️ Внимание: использована резервная модель из-за нехватки сделок"
		case "zh":
			lblWarn = "⚠️ 提示: 由于缺乏直接对标成交，当前采用兜底启发式模型"
		case "ar":
			lblWarn = "⚠️ تنبيه: تم استخدام نموذج احتياطي لنقص التداولات المباشرة"
		case "en":
			lblWarn = "⚠️ Warning: Fallback model engaged due to sparse direct trades"
		}
		sb.WriteString(fmt.Sprintf("<tr><td colspan=\"2\"><b>%s</b></td></tr>\n", telegram.EscapeHTML(lblWarn)))
	}

	// Cryptographic Digital Certificate (OMIT if CertificateID is empty!)
	if res.CertificateID != "" {
		lblCert := "شناسه گواهی دیجیتال"
		switch l {
		case "ru":
			lblCert = "Сертификат оценки"
		case "zh":
			lblCert = "数字防伪凭据 ID"
		case "ar":
			lblCert = "معرف الشهادة الرقمية"
		case "en":
			lblCert = "Digital Certificate"
		}
		sigSnippet := ""
		if res.CertificateSignature != "" {
			sigSnippet = " [HMAC-SHA256 Signed ✅]"
		}
		sb.WriteString(fmt.Sprintf("<tr><td>%s</td><td><code>%s</code>%s</td></tr>\n",
			lblCert, telegram.EscapeHTML(res.CertificateID), sigSnippet))
	}

	sb.WriteString("</table>\n</details>\n\n")

	sb.WriteString("<blockquote>⚡ AVM v7.0 Valuation Engine — Fragment Market Signals</blockquote>")
	return sb.String()
}

// formatUsernameStandardHTML constructs an expandable analytical report for telegram chats
// using native Telegram HTML (<blockquote expandable>, <b>, <code>) structured cleanly across modules.
func formatUsernameStandardHTML(username string, res *avm.ValuationResult, lang string) string {
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
		case "ar":
			return fmt.Sprintf("🏷️ <b>تقييم اسم المستخدم: @%s</b>\n\nتقرير التقييم الكامل متاح الآن للعرض.", cleanUser)
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
	expUSDFloat, _ := res.ExpectedUSD.Float64()
	rateOk := res.TONUSDRate > 0
	expectedUSDFormatted := formatUSDT(expUSDFloat, rateOk, l)

	var sb strings.Builder

	// Localized Labels
	var (
		titleHdr, lblGrade, lblBrand, lblFairVal string
		mod1Title, lblCurStatus, lblFloor, lblMedian, lblCeiling, lblMaxBid, lblPercentile string
		mod2Title, lblFeeStr, lblNetStr, lblStartBid, lblBestTime, lblRent string
		mod3Title, lblBull12m, lblBase12m string
		mod4Title, lblLen, lblRarity, lblTags, lblDict, lblOwner, lblWallet, lblTelemint string
		mod5Title, lblTM, lblPhish, lblTwins, lblFnG, lblConf, lblAcc, lblMethod, lblFallback, lblCert string
	)

	switch l {
	case "fa":
		titleHdr = fmt.Sprintf("🏷️ <b>کارشناسی تحلیلی نام کاربری: @%s</b>", telegram.EscapeHTML(cleanUser))
		lblGrade = "درجه سرمایه‌گذاری:"
		lblBrand = "شاخص برندپذیری:"
		lblFairVal = "برآورد ارزش منصفانه:"

		mod1Title = "🟢 <b>وضعیت بازار و طیف قیمت:</b>"
		lblCurStatus = "وضعیت فعلی:"
		lblFloor = "کف ارزش تخمینی:"
		lblMedian = "میانه منصفانه:"
		lblCeiling = "سقف ارزش احتمالی:"
		lblMaxBid = "حداکثر بید عقلانی:"
		lblPercentile = "جایگاه آماری: <b>Top %.1f%% کل بازار</b>"

		mod2Title = "🎯 <b>محاسبات مالی، استراتژی و اجاره:</b>"
		lblFeeStr = "کارمزد ۵٪ فرگمنت (حداقل ۵ TON):"
		lblNetStr = "خالص دریافتی:"
		lblStartBid = "شروع پیشنهادی حراج:"
		lblBestTime = "بهترین زمان عرضه:"
		lblRent = "کف درآمد اجاره ماهانه:"

		mod3Title = "📊 <b>معاملات مشابه و پیش‌بینی روند:</b>"
		lblBull12m = "سناریوی صعودی ۱۲ ماهه:"
		lblBase12m = "سناریوی پایه ۱۲ ماهه:"

		mod4Title = "🧬 <b>ساختار، مالکیت و اصالت هوشمند:</b>"
		lblLen = "طول شناسه:"
		lblRarity = "کمیابی:"
		lblTags = "دسته‌بندی موضوعی:"
		lblDict = "معنی لغوی:"
		lblOwner = "مالک ثبت‌شده تلگرام:"
		lblWallet = "کیف‌پول مالک:"
		lblTelemint = "قرارداد هوشمند (Telemint):"

		mod5Title = "⚖️ <b>ریسک حقوقی، امنیت و شفافیت مدل:</b>"
		lblTM = "ریسک علامت تجاری (TOS §4):"
		lblPhish = "امنیت فیشینگ:"
		lblTwins = "لیست دوقلوهای بصری:"
		lblFnG = "شاخص ترس و طمع:"
		lblConf = "ضریب اطمینان مدل:"
		lblAcc = "دقت مدل در آزمون گذشته‌نگر:"
		lblMethod = "متد کالیبراسیون:"
		lblFallback = "⚠️ <b>توجه: استفاده از مدل پشتیبان به دلیل محدودیت معاملات مشابه</b>"
		lblCert = "گواهی دیجیتال:"

	case "ru":
		titleHdr = fmt.Sprintf("🏷️ <b>Аналитическая оценка: @%s</b>", telegram.EscapeHTML(cleanUser))
		lblGrade = "Инвест-грейд:"
		lblBrand = "Индекс бренда:"
		lblFairVal = "Справедливая оценка:"

		mod1Title = "🟢 <b>Рыночный статус и диапазон цен:</b>"
		lblCurStatus = "Текущий статус:"
		lblFloor = "Нижняя граница:"
		lblMedian = "Справедливая цена:"
		lblCeiling = "Верхняя цель:"
		lblMaxBid = "Макс. рациональная ставка:"
		lblPercentile = "Рыночный перцентиль: <b>Топ %.1f%% рынка</b>"

		mod2Title = "🎯 <b>Финансы, стратегия и аренда:</b>"
		lblFeeStr = "Комиссия Fragment (5%):"
		lblNetStr = "Чистая выплата продавцу:"
		lblStartBid = "Реком. старт аукциона:"
		lblBestTime = "Лучшее время запуска:"
		lblRent = "Доходность аренды:"

		mod3Title = "📊 <b>Сравнимые сделки и тренды:</b>"
		lblBull12m = "Бычий сценарий (12 мес):"
		lblBase12m = "Базовый сценарий (12 мес):"

		mod4Title = "🧬 <b>Структура, смарт-контракт и владелец:</b>"
		lblLen = "Длина имени:"
		lblRarity = "Редкость:"
		lblTags = "Теги:"
		lblDict = "Значение слова:"
		lblOwner = "Владелец Telegram:"
		lblWallet = "Кошелек владельца:"
		lblTelemint = "Контракт Telemint:"

		mod5Title = "⚖️ <b>Риски, безопасность и прозрачность:</b>"
		lblTM = "Риск бренда (TOS §4):"
		lblPhish = "Фишинг-безопасность:"
		lblTwins = "Двойники-омоглифы:"
		lblFnG = "Индекс страха и жадности:"
		lblConf = "Уверенность модели:"
		lblAcc = "Точность модели:"
		lblMethod = "Метод оценки:"
		lblFallback = "⚠️ <b>Внимание: использована резервная модель</b>"
		lblCert = "Сертификат AVM:"

	case "zh":
		titleHdr = fmt.Sprintf("🏷️ <b>分析估值报告: @%s</b>", telegram.EscapeHTML(cleanUser))
		lblGrade = "投资评级:"
		lblBrand = "品牌指数:"
		lblFairVal = "预估公允价值:"

		mod1Title = "🟢 <b>市场现状与估值区间:</b>"
		lblCurStatus = "当前状态:"
		lblFloor = "底价估值:"
		lblMedian = "公允均价:"
		lblCeiling = "目标上限:"
		lblMaxBid = "买家理性竞价上限:"
		lblPercentile = "市场分位: <b>前 %.1f%%</b>"

		mod2Title = "🎯 <b>交易财务、策略与租赁:</b>"
		lblFeeStr = "协议手续费 (5%):"
		lblNetStr = "卖家到手净收益:"
		lblStartBid = "建议起拍底价:"
		lblBestTime = "最佳开拍时机:"
		lblRent = "预估月租金:"

		mod3Title = "📊 <b>可比成交与走势预测:</b>"
		lblBull12m = "12个月乐观预期 (Bull):"
		lblBase12m = "12个月基准预期 (Base):"

		mod4Title = "🧬 <b>结构特征、归属与链上溯源:</b>"
		lblLen = "字符长度:"
		lblRarity = "稀缺评级:"
		lblTags = "分类标签:"
		lblDict = "词典释义:"
		lblOwner = "Telegram 登记所有者:"
		lblWallet = "所有者钱包:"
		lblTelemint = "Telemint 智能合约:"

		mod5Title = "⚖️ <b>合规风控、安全与透明度:</b>"
		lblTM = "商标侵权风险 (TOS §4):"
		lblPhish = "仿冒与钓鱼风险:"
		lblTwins = "同形异义孪生体:"
		lblFnG = "市场情绪指数:"
		lblConf = "模型置信度:"
		lblAcc = "历史回测准确率:"
		lblMethod = "校准方法:"
		lblFallback = "⚠️ <b>注意：由于缺乏相似交易，已采用后备估值模型</b>"
		lblCert = "数字验证证书:"

	default: // "en"
		titleHdr = fmt.Sprintf("🏷️ <b>Valuation Report: @%s</b>", telegram.EscapeHTML(cleanUser))
		lblGrade = "Investment Grade:"
		lblBrand = "Brandability Score:"
		lblFairVal = "Estimated Fair Value:"

		mod1Title = "🟢 <b>Market Status & Price Spectrum:</b>"
		lblCurStatus = "Current Status:"
		lblFloor = "Floor Value:"
		lblMedian = "Fair Value:"
		lblCeiling = "Ceiling Target:"
		lblMaxBid = "Max Rational Bid:"
		lblPercentile = "Market Rank: <b>Top %.1f%% overall</b>"

		mod2Title = "🎯 <b>Transaction Economics, Strategy & Yield:</b>"
		lblFeeStr = "Fragment Protocol Fee (5%):"
		lblNetStr = "Net Seller Proceeds:"
		lblStartBid = "Recommended Start Bid:"
		lblBestTime = "Optimal Launch Window:"
		lblRent = "Monthly Rental Yield:"

		mod3Title = "📊 <b>Comparable Sales & Projections:</b>"
		lblBull12m = "12M Bull Scenario:"
		lblBase12m = "12M Base Scenario:"

		mod4Title = "🧬 <b>Structure, Provenance & Ownership:</b>"
		lblLen = "Character Length:"
		lblRarity = "Rarity:"
		lblTags = "Market Tags:"
		lblDict = "Dictionary Meaning:"
		lblOwner = "Telegram Owner:"
		lblWallet = "Owner Wallet:"
		lblTelemint = "Telemint Smart Contract:"

		mod5Title = "⚖️ <b>Legal TOS, Risk & Model Transparency:</b>"
		lblTM = "Trademark Risk (TOS §4):"
		lblPhish = "Phishing Threat:"
		lblTwins = "Homoglyph Twins:"
		lblFnG = "Market Fear & Greed:"
		lblConf = "Model Confidence:"
		lblAcc = "Backtest Accuracy:"
		lblMethod = "Band Method:"
		lblFallback = "⚠️ <b>Notice: Fallback valuation model used due to sparse comps</b>"
		lblCert = "Digital Certificate ID:"
	}

	// Header
	sb.WriteString(fmt.Sprintf("%s\n\n", titleHdr))
	sb.WriteString(fmt.Sprintf("%s %s <b>%s</b>", gradeEmoji, lblGrade, telegram.EscapeHTML(res.InvestmentGrade)))
	if res.QualityGrade != "" {
		sb.WriteString(fmt.Sprintf(" (<code>%s</code>)", telegram.EscapeHTML(res.QualityGrade)))
	}
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf("📈 %s <b>%d / 100</b>\n", lblBrand, res.Brandability))
	sb.WriteString(fmt.Sprintf("💰 %s <b>~%s TON (%s)</b>\n\n", lblFairVal, res.ExpectedTON.StringFixed(1), expectedUSDFormatted))

	// Module 1: Current Status & Price Spectrum
	liveStatus := ""
	if res.LiveMarket != nil {
		liveStatus = res.LiveMarket.Status
	}
	statusBadge := formatMarketStatusLabel(liveStatus, res.FragmentMarketStatus, res.TelegramStatus, l)
	sb.WriteString(fmt.Sprintf("<blockquote expandable>%s\n", mod1Title))
	sb.WriteString(fmt.Sprintf("• %s <b>%s</b>\n", lblCurStatus, statusBadge))
	if res.LiveMarket != nil {
		if res.LiveMarket.CurrentBidTON > 0 {
			sb.WriteString(fmt.Sprintf("• Current Bid: <code>%.1f TON</code>\n", res.LiveMarket.CurrentBidTON))
		}
		if res.LiveMarket.BuyNowTON > 0 {
			sb.WriteString(fmt.Sprintf("• Buy Now (Ask): <code>%.1f TON</code>\n", res.LiveMarket.BuyNowTON))
		}
		if res.LiveMarket.AuctionEndsAt != "" {
			sb.WriteString(fmt.Sprintf("• Auction Ends: <b>%s</b>\n", telegram.EscapeHTML(formatAuctionEndText(res.LiveMarket.AuctionEndsAt, l))))
		}
	}
	lowUSDFloat, _ := res.LowUSD.Float64()
	highUSDFloat, _ := res.HighUSD.Float64()
	sb.WriteString(fmt.Sprintf("• %s <code>%s TON (%s)</code>\n", lblFloor, res.LowTON.StringFixed(1), formatUSDT(lowUSDFloat, rateOk, l)))
	sb.WriteString(fmt.Sprintf("• %s <code>%s TON (%s)</code>\n", lblMedian, res.ExpectedTON.StringFixed(1), expectedUSDFormatted))
	sb.WriteString(fmt.Sprintf("• %s <code>%s TON (%s)</code>\n", lblCeiling, res.HighTON.StringFixed(1), formatUSDT(highUSDFloat, rateOk, l)))
	if res.MaxRationalBidTON.IsPositive() {
		sb.WriteString(fmt.Sprintf("• %s <code>%s TON</code>\n", lblMaxBid, res.MaxRationalBidTON.StringFixed(1)))
	}
	if res.PercentileRank > 0 {
		sb.WriteString(fmt.Sprintf("• %s\n", fmt.Sprintf(lblPercentile, 100.0-res.PercentileRank)))
	}
	sb.WriteString("</blockquote>\n\n")

	// Module 2: Economics, Playbook & Rent Yield
	sb.WriteString(fmt.Sprintf("<blockquote expandable>%s\n", mod2Title))
	if res.TransactionEconomics != nil {
		sb.WriteString(fmt.Sprintf("• %s (%.0f%%): <code>-%.1f TON</code>\n",
			lblFeeStr, res.TransactionEconomics.FragmentFeePct, res.TransactionEconomics.FragmentFeeTON))
		sb.WriteString(fmt.Sprintf("• %s <b>%.1f TON</b>\n", lblNetStr, res.TransactionEconomics.NetPayoutTON))
	} else if expFloat > 0 {
		fee := math.Max(5.0, math.Round(expFloat*0.05*10)/10)
		sb.WriteString(fmt.Sprintf("• %s <code>-%.1f TON</code>\n", lblFeeStr, fee))
		sb.WriteString(fmt.Sprintf("• %s <b>%.1f TON</b>\n", lblNetStr, math.Max(0.0, expFloat-fee)))
	}
	if res.AuctionPlaybook != nil {
		sb.WriteString(fmt.Sprintf("• %s <code>%.1f TON</code>\n", lblStartBid, res.AuctionPlaybook.StartPriceTON))
		if res.AuctionPlaybook.BestDay != "" {
			sb.WriteString(fmt.Sprintf("• %s <b>%s (%s UTC)</b>\n",
				lblBestTime, telegram.EscapeHTML(res.AuctionPlaybook.BestDay), telegram.EscapeHTML(res.AuctionPlaybook.BestHourUTC)))
		}
	}
	// RentYield: ONLY show if non-nil!
	if res.RentYield != nil && res.RentYield.MonthlyMedianTON > 0 {
		sb.WriteString(fmt.Sprintf("• %s <code>~%.1f TON / mo</code> (Floor: %.1f TON)\n",
			lblRent, res.RentYield.MonthlyMedianTON, res.RentYield.RentFloorTON))
	}
	sb.WriteString("</blockquote>\n\n")

	// Module 3: Comparables, Trends & Projections
	if len(res.Comparables) > 0 || res.ProjectedGrowth.BullTON > 0 {
		sb.WriteString(fmt.Sprintf("<blockquote expandable>%s\n", mod3Title))
		limit := len(res.Comparables)
		if limit > 5 {
			limit = 5
		}
		for i := 0; i < limit; i++ {
			c := res.Comparables[i]
			dateStr := c.Date
			if len(dateStr) > 10 {
				dateStr = dateStr[:10]
			}
			sb.WriteString(fmt.Sprintf("• @%s ➔ <code>%.1f TON</code> (%s)\n",
				telegram.EscapeHTML(c.Username), c.Price, telegram.EscapeHTML(dateStr)))
		}
		if res.ProjectedGrowth.BullTON > 0 {
			sb.WriteString(fmt.Sprintf("• %s <code>+%.1f TON</code>\n", lblBull12m, res.ProjectedGrowth.BullTON))
		}
		if res.ProjectedGrowth.BaseTON > 0 {
			sb.WriteString(fmt.Sprintf("• %s <code>~%.1f TON</code>\n", lblBase12m, res.ProjectedGrowth.BaseTON))
		}
		sb.WriteString("</blockquote>\n\n")
	}

	// Module 4: Structure, Provenance & Owner
	sb.WriteString(fmt.Sprintf("<blockquote expandable>%s\n", mod4Title))
	charLen := res.Length
	if charLen == 0 {
		charLen = len(cleanUser)
	}
	sb.WriteString(fmt.Sprintf("• %s <b>%d chars</b>", lblLen, charLen))
	if res.Rarity.Tier != "" {
		sb.WriteString(fmt.Sprintf(" (%s: <b>%s</b> %s)", lblRarity, telegram.EscapeHTML(translateAVM(res.Rarity.Tier, l)), res.Rarity.Stars))
	}
	sb.WriteString("\n")
	if len(res.Tags) > 0 {
		sb.WriteString(fmt.Sprintf("• %s <code>%s</code>\n", lblTags, telegram.EscapeHTML(strings.Join(res.Tags, ", "))))
	}
	if res.Dictionary.IsWord && res.Dictionary.Definition != "" {
		sb.WriteString(fmt.Sprintf("• %s <i>\"%s\"</i>\n", lblDict, telegram.EscapeHTML(res.Dictionary.Definition)))
	}
	if res.OwnerProfile != nil {
		name := strings.TrimSpace(res.OwnerProfile.FirstName + " " + res.OwnerProfile.LastName)
		if name != "" {
			sb.WriteString(fmt.Sprintf("• %s <b>%s</b>\n", lblOwner, telegram.EscapeHTML(name)))
		}
	}
	if res.WalletInfo != nil {
		sb.WriteString(fmt.Sprintf("• %s <code>%.1f TON</code> (%d NFTs)\n", lblWallet, res.WalletInfo.Balance, res.WalletInfo.NFTCount))
	}
	if res.TelemintProvenance != nil && res.TelemintProvenance.ItemAddress != "" {
		sb.WriteString(fmt.Sprintf("• %s <code>%s</code>\n", lblTelemint, shortenWalletAddr(res.TelemintProvenance.ItemAddress)))
	}
	sb.WriteString("</blockquote>\n\n")

	// Module 5: Risk, Phishing, Model Transparency & Certificate
	sb.WriteString(fmt.Sprintf("<blockquote expandable>%s\n", mod5Title))
	tmText := "Clean (Low Risk)"
	if l == "fa" {
		tmText = "سطح ایمن (بدون نقض برند)"
	}
	if res.TrademarkRisk.RiskLevel != "" && strings.ToUpper(res.TrademarkRisk.RiskLevel) != "LOW" {
		tmText = fmt.Sprintf("⚠️ %s (%s)", translateAVM(res.TrademarkRisk.RiskLevel, l), res.TrademarkRisk.Brand)
	}
	sb.WriteString(fmt.Sprintf("• %s <b>%s</b>\n", lblTM, telegram.EscapeHTML(tmText)))

	phishText := "Clean"
	if l == "fa" {
		phishText = "سطح ایمن"
	}
	if res.PhishingThreat != nil && res.PhishingThreat.HasThreat {
		phishText = fmt.Sprintf("⚠️ %s (%s)", translateAVM("Phishing Threat", l), res.PhishingThreat.SimilarUsername)
	} else if len(res.HomoglyphTwins) > 0 {
		phishText = fmt.Sprintf("⚠️ %d twins", len(res.HomoglyphTwins))
	}
	sb.WriteString(fmt.Sprintf("• %s <b>%s</b>\n", lblPhish, telegram.EscapeHTML(phishText)))

	if len(res.HomoglyphTwins) > 0 {
		twinsList := make([]string, 0, len(res.HomoglyphTwins))
		for _, tw := range res.HomoglyphTwins {
			twinsList = append(twinsList, "@"+tw.Twin)
		}
		sb.WriteString(fmt.Sprintf("• %s <code>%s</code>\n", lblTwins, telegram.EscapeHTML(strings.Join(twinsList, ", "))))
	}
	if res.FearGreedIndex > 0 || res.FearGreedLabel != "" {
		sb.WriteString(fmt.Sprintf("• %s <b>%s (%d/100)</b>\n",
			lblFnG, telegram.EscapeHTML(translateAVM(res.FearGreedLabel, l)), res.FearGreedIndex))
	}
	sb.WriteString(fmt.Sprintf("• %s <b>%d%%</b>\n", lblConf, res.ConfidenceScore))
	if res.ModelAccuracy != nil {
		sb.WriteString(fmt.Sprintf("• %s <code>±%.1f%%</code> (Within band: %.1f%%)\n",
			lblAcc, res.ModelAccuracy.MedianErrorPct, res.ModelAccuracy.WithinBandPct))
	}
	if res.BandMethod != "" {
		sb.WriteString(fmt.Sprintf("• %s <b>%s</b>\n", lblMethod, telegram.EscapeHTML(translateAVM(res.BandMethod, l))))
	}
	if res.IsFallbackUsed {
		sb.WriteString(fmt.Sprintf("• %s\n", lblFallback))
	}
	// Certificate: ONLY display if CertificateID is not empty!
	if res.CertificateID != "" {
		sigTxt := ""
		if res.CertificateSignature != "" {
			sigTxt = " (HMAC Signed)"
			if l == "fa" {
				sigTxt = " (امضای معتبر HMAC)"
			}
		}
		sb.WriteString(fmt.Sprintf("• %s <code>%s</code>%s\n", lblCert, telegram.EscapeHTML(res.CertificateID), sigTxt))
	}
	sb.WriteString("</blockquote>\n\n")

	sb.WriteString("⚡ <i>AVM v7.0 Engine — Fragment Market Signals</i>")
	return sb.String()
}

