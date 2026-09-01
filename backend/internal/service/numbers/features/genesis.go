package features

// GenesisMeta holds the exact micro-segment pricing metadata for a 4-digit Genesis number
type GenesisMeta struct {
	IsGenesis         bool    `json:"is_genesis"`
	TierKey           string  `json:"tier_key"`
	TitleEn           string  `json:"title_en"`
	TitleFa           string  `json:"title_fa"`
	Description       string  `json:"description"`
	BetaGenesis       float64 `json:"beta_genesis"`
	EstimatedFloorTON float64 `json:"estimated_floor_ton"`
}

// ClassifyGenesis evaluates a 4-digit suffix (+888 8000 .. +888 8999)
func ClassifyGenesis(suffix string) (GenesisMeta, bool) {
	if len(suffix) != 4 || suffix[0] != '8' {
		return GenesisMeta{}, false
	}

	// 1. Tier 0: Godhead Genesis (+888 8888 - Historical ATH #1 of all numbers)
	if suffix == "8888" {
		return GenesisMeta{
			IsGenesis:         true,
			TierKey:           "GENESIS_GODHEAD_8888",
			TitleEn:           "Genesis Supreme Godhead (#1 ATH)",
			TitleFa:           "شماره جنسیس سرور شماره‌های جهان (+888 8888)",
			Description:       "Absolute #1 highest recorded valuation in Telegram history with 7 consecutive 8s",
			BetaGenesis:       5.35, // ~380,000+ TON expected
			EstimatedFloorTON: 300000.0,
		}, true
	}

	// 2. Tier 1: Anchor Kings (+888 8000, 8777, 8999, 8008, 8800, 8880, 8080)
	anchorKings := map[string]bool{
		"8000": true, "8777": true, "8999": true, "8008": true,
		"8800": true, "8880": true, "8080": true, "8881": true, "8889": true,
	}
	if anchorKings[suffix] {
		return GenesisMeta{
			IsGenesis:         true,
			TierKey:           "GENESIS_ANCHOR_KING",
			TitleEn:           "Genesis Anchor King",
			TitleFa:           "پادشاه لنگرگاه جنسیس",
			Description:       "Top-tier Genesis holy milestone with pristine zeroes or sevens/nines",
			BetaGenesis:       4.85, // ~190,000+ TON expected
			EstimatedFloorTON: 170000.0,
		}, true
	}

	// 3. Tier 2: Symmetric & Inversion Pairs (+888 8118, 8228, 8338, 8778, 8998, 8181, 8787, 8989)
	symmetricPairs := map[string]bool{
		"8118": true, "8228": true, "8338": true, "8448": true, "8558": true,
		"8668": true, "8778": true, "8998": true, "8181": true, "8282": true,
		"8383": true, "8484": true, "8585": true, "8686": true, "8787": true, "8989": true,
	}
	if symmetricPairs[suffix] {
		return GenesisMeta{
			IsGenesis:         true,
			TierKey:           "GENESIS_SYMMETRIC_PAIR",
			TitleEn:           "Genesis Symmetric Pair",
			TitleFa:           "جنسیس متقارن و جفت‌های آینه‌ای",
			Description:       "Flawless 2-digit mirror or alternating symmetry inside 4-digit Genesis space",
			BetaGenesis:       4.20, // ~135,000+ TON expected
			EstimatedFloorTON: 120000.0,
		}, true
	}

	// 4. Tier 3: Consecutive Ladders (+888 8123, 8765, 8901, 8012, 8567, 8678, 8456)
	ladders := map[string]bool{
		"8123": true, "8765": true, "8901": true, "8012": true,
		"8321": true, "8567": true, "8678": true, "8456": true,
	}
	if ladders[suffix] {
		return GenesisMeta{
			IsGenesis:         true,
			TierKey:           "GENESIS_LADDER_SEQUENCE",
			TitleEn:           "Genesis Ladder Sequence",
			TitleFa:           "جنسیس پله‌ای متوالی",
			Description:       "Contiguous ascending or descending ladder sequence within Genesis range",
			BetaGenesis:       3.95, // ~110,000+ TON expected
			EstimatedFloorTON: 95000.0,
		}, true
	}

	// 5. Tier 4: Cultural Lucky Genesis (+888 8168, 8520, 8314, 8688, 8868, 8988, 8788, 8518, 8666, 8111, 8222, 8333, 8555)
	culturalLucky := map[string]bool{
		"8168": true, "8520": true, "8314": true, "8688": true, "8868": true,
		"8988": true, "8788": true, "8518": true, "8666": true, "8111": true,
		"8222": true, "8333": true, "8555": true,
	}
	if culturalLucky[suffix] {
		return GenesisMeta{
			IsGenesis:         true,
			TierKey:           "GENESIS_CULTURAL_LUCKY",
			TitleEn:           "Genesis Cultural Lucky Code",
			TitleFa:           "جنسیس نمادهای خوش‌یمن جهانی",
			Description:       "High-demand Chinese/Global cultural fortune code in Genesis format",
			BetaGenesis:       3.85, // ~100,000+ TON expected
			EstimatedFloorTON: 90000.0,
		}, true
	}

	// 6. Tier 5: Single Non-8 Genesis (+888 8001 .. 8009, 8010, 8020, 8090, 8100..8900)
	isSingleNonEight := false
	nonEightCount := 0
	for _, ch := range suffix[1:] {
		if ch != '0' && ch != '8' {
			nonEightCount++
		}
	}
	if (suffix[1] == '0' && suffix[2] == '0' && suffix[3] >= '1' && suffix[3] <= '9') ||
		(suffix[1] == '0' && suffix[3] == '0') ||
		(suffix[2] == '0' && suffix[3] == '0') ||
		nonEightCount <= 1 {
		isSingleNonEight = true
	}

	if isSingleNonEight {
		return GenesisMeta{
			IsGenesis:         true,
			TierKey:           "GENESIS_SINGLE_OFFSET",
			TitleEn:           "Genesis Single Offset Milestone",
			TitleFa:           "جنسیس تک‌رقمی و مایلستون‌های نخستین",
			Description:       "First-cohort Genesis ordinal milestone with minimum entropy (+888 8001..8009)",
			BetaGenesis:       3.75, // ~90,000+ TON expected
			EstimatedFloorTON: 80000.0,
		}, true
	}

	// 7. Tier 6: Baseline Genesis (Remaining standard 4-digit numbers)
	return GenesisMeta{
		IsGenesis:         true,
		TierKey:           "GENESIS_STANDARD_BASELINE",
		TitleEn:           "Genesis Standard Collectible",
		TitleFa:           "جنسیس استاندارد ۴ رقمی",
		Description:       "Authentic 4-digit Genesis collection scarcity (1 of 1,000 ever minted)",
		BetaGenesis:       3.35, // ~60,000+ TON baseline expected
		EstimatedFloorTON: 50000.0,
	}, true
}
