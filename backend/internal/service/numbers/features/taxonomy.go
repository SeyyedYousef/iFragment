package features

// VIPTier represents the telephony standard ranking
type VIPTier string

const (
	TierDiamond      VIPTier = "DIAMOND"
	TierPlatinumPlus VIPTier = "PLATINUM_PLUS"
	TierPlatinum     VIPTier = "PLATINUM"
	TierGold         VIPTier = "GOLD"
	TierSilver       VIPTier = "SILVER"
	TierBronze       VIPTier = "BRONZE"
	TierStandard     VIPTier = "STANDARD"
)

// VIPTaxonomy holds the structured telephony classification
type VIPTaxonomy struct {
	Tier         VIPTier `json:"tier"`
	PatternKey   string  `json:"pattern_key"`
	TitleEn      string  `json:"title_en"`
	TitleFa      string  `json:"title_fa"`
	Description  string  `json:"description"`
	BetaTaxonomy float64 `json:"beta_taxonomy"` // Hedonic beta contribution
}

// ClassifyVIPTaxonomy classifies an 8-digit or 4-digit number into international telephony VIP tiers
func ClassifyVIPTaxonomy(suffix string, maxRun int, distinctDigits int, isPalindrome bool, isAsc, isDesc bool) VIPTaxonomy {
	n := len(suffix)

	// 1. Diamond Tier (8 Identical Digits: AAAAAAAA)
	if maxRun >= 8 || (n == 4 && maxRun == 4 && suffix == "8888") {
		return VIPTaxonomy{
			Tier:         TierDiamond,
			PatternKey:   "OCTA_MONODIGIT",
			TitleEn:      "Diamond Monodigit",
			TitleFa:      "رند الماسی یکدست",
			Description:  "All identical single digit sequence with maximum global prestige",
			BetaTaxonomy: 5.50,
		}
	}

	// 2. Platinum Plus Tier (AAAA BBBB, AAAA 0000, 0000 AAAA)
	if n == 8 {
		if suffix[0] == suffix[1] && suffix[1] == suffix[2] && suffix[2] == suffix[3] &&
			suffix[4] == suffix[5] && suffix[5] == suffix[6] && suffix[6] == suffix[7] &&
			suffix[0] != suffix[4] {
			return VIPTaxonomy{
				Tier:         TierPlatinumPlus,
				PatternKey:   "HALF_BLOCK_QUAD",
				TitleEn:      "Platinum Plus Quad Block",
				TitleFa:      "رند پلاتین پلاس دوگانه چهار رقمی",
				Description:  "Two distinct homogeneous 4-digit blocks (AAAA BBBB)",
				BetaTaxonomy: 3.80,
			}
		}
	}

	// 3. Platinum Tier (ABABABAB, AABBCCDD, Binary Vanity with 2 distinct digits)
	if distinctDigits == 2 && n == 8 {
		if suffix[0] == suffix[2] && suffix[2] == suffix[4] && suffix[4] == suffix[6] &&
			suffix[1] == suffix[3] && suffix[3] == suffix[5] && suffix[5] == suffix[7] {
			return VIPTaxonomy{
				Tier:         TierPlatinum,
				PatternKey:   "BINARY_ALTERNATING_ABAB",
				TitleEn:      "Platinum Binary Alternating",
				TitleFa:      "رند پلاتین متناوب دو رقمی",
				Description:  "Perfect 2-digit alternating binary pattern (ABAB ABAB)",
				BetaTaxonomy: 3.20,
			}
		}
		return VIPTaxonomy{
			Tier:         TierPlatinum,
			PatternKey:   "BINARY_VANITY",
			TitleEn:      "Platinum Binary Vanity",
			TitleFa:      "رند پلاتین دو رقمی خالص",
			Description:  "Composed strictly of only 2 distinct digits across the entire number",
			BetaTaxonomy: 2.70,
		}
	}

	// 4. Gold Tier (ABCD ABCD periodic, AAAA XXXX, XXXX AAAA, 7 identical)
	if maxRun == 7 {
		return VIPTaxonomy{
			Tier:         TierGold,
			PatternKey:   "SEPTA_RUN",
			TitleEn:      "Gold Septa Run",
			TitleFa:      "رند طلایی هفت‌تایی",
			Description:  "7 identical digits in contiguous sequence",
			BetaTaxonomy: 2.80,
		}
	}

	if n == 8 && suffix[0:4] == suffix[4:8] {
		return VIPTaxonomy{
			Tier:         TierGold,
			PatternKey:   "PERIODIC_QUAD_ABCD",
			TitleEn:      "Gold Repeating Quad",
			TitleFa:      "رند طلایی تکرار چهار رقم",
			Description:  "Two identical repeated 4-digit groups (ABCD ABCD)",
			BetaTaxonomy: 2.40,
		}
	}

	if n == 8 && (suffix[0:4] == "0000" || suffix[4:8] == "0000" || suffix[0:4] == "8888" || suffix[4:8] == "8888") {
		return VIPTaxonomy{
			Tier:         TierGold,
			PatternKey:   "QUAD_BOOKEND",
			TitleEn:      "Gold Quad Bookend",
			TitleFa:      "رند طلایی چهار صفر / هشت",
			Description:  "Contains a prominent 4-digit zero or eight bookend cluster",
			BetaTaxonomy: 2.10,
		}
	}

	// 5. Silver Tier (Full 8-digit Ladder, 6 identical, Palindrome, Triple pairs)
	if (isAsc || isDesc) && n >= 6 {
		return VIPTaxonomy{
			Tier:         TierSilver,
			PatternKey:   "FULL_LADDER_SEQUENCE",
			TitleEn:      "Silver Full Ladder",
			TitleFa:      "رند نقره‌ای پله‌ای کامل",
			Description:  "Continuous monotonic ascending or descending step ladder",
			BetaTaxonomy: 1.80,
		}
	}

	if isPalindrome && n >= 6 {
		return VIPTaxonomy{
			Tier:         TierSilver,
			PatternKey:   "PERFECT_PALINDROME",
			TitleEn:      "Silver Palindrome",
			TitleFa:      "رند نقره‌ای آینه‌ای متقارن",
			Description:  "Reads identically backwards and forwards (Mirror symmetry)",
			BetaTaxonomy: 1.60,
		}
	}

	if maxRun == 6 {
		return VIPTaxonomy{
			Tier:         TierSilver,
			PatternKey:   "HEXA_RUN",
			TitleEn:      "Silver Hexa Run",
			TitleFa:      "رند نقره‌ای شش‌تایی",
			Description:  "6 identical digits in sequence",
			BetaTaxonomy: 1.70,
		}
	}

	// 6. Bronze Tier (Penta 5-run, Triple endings, Double pairs AABBCCDD)
	if maxRun == 5 {
		return VIPTaxonomy{
			Tier:         TierBronze,
			PatternKey:   "PENTA_RUN",
			TitleEn:      "Bronze Penta Run",
			TitleFa:      "رند برنزی پنج‌تایی",
			Description:  "5 identical consecutive digits",
			BetaTaxonomy: 1.20,
		}
	}

	if maxRun == 4 {
		return VIPTaxonomy{
			Tier:         TierBronze,
			PatternKey:   "QUAD_RUN",
			TitleEn:      "Bronze Quad Run",
			TitleFa:      "رند برنزی چهار رقمی",
			Description:  "4 identical consecutive digits",
			BetaTaxonomy: 0.80,
		}
	}

	if distinctDigits == 3 && n == 8 {
		return VIPTaxonomy{
			Tier:         TierBronze,
			PatternKey:   "TERNARY_VANITY",
			TitleEn:      "Bronze Ternary Vanity",
			TitleFa:      "رند برنزی سه رقمی",
			Description:  "Composed of only 3 distinct digits across all 8 places",
			BetaTaxonomy: 0.70,
		}
	}

	// 7. Standard Baseline
	return VIPTaxonomy{
		Tier:         TierStandard,
		PatternKey:   "STANDARD_BASELINE",
		TitleEn:      "Standard Anonymous Number",
		TitleFa:      "شماره استاندارد ناشناس",
		Description:  "Standard 8-digit anonymous Telegram number with baseline scarcity",
		BetaTaxonomy: 0.0,
	}
}
