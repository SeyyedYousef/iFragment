package gvengine

import (
	"math"

	"ifragment-backend/internal/service/gifts/traits"
)

// ProfileFlexReport models social signaling, visual pop, and Telegram profile showcase prestige
type ProfileFlexReport struct {
	ProfileFlexScore    float64 `json:"profile_flex_score"`    // 0 to 100 composite status score
	VisualPopIndex      float64 `json:"visual_pop_index"`      // 0 to 100 visual contrast & glow
	FlexTier            string  `json:"flex_tier"`             // "SOVEREIGN_WHALE", "COLLECTOR_ELITE", "AESTHETIC_CURATOR", "FLOOR_HOLDER"
	GiveawayAppealScore float64 `json:"giveaway_appeal_score"` // Desirability score for Telegram channel community giveaways
	ShowcaseStatusEn    string  `json:"showcase_status_en"`
	ShowcaseStatusFa    string  `json:"showcase_status_fa"`
}

// ComputeProfileFlex evaluates the social flex appeal and visual dominance of a Telegram Gift
func ComputeProfileFlex(col traits.CollectionMeta, serial int, harmony traits.AestheticHarmonyResult, rarity traits.JointRarityAnalysis) ProfileFlexReport {
	// 1. Base status from model supply and serial rank
	modelScore := 40.0
	if col.TotalSupply <= 2500 || col.CraftedFlag {
		modelScore = 90.0
	} else if col.TotalSupply <= 5000 {
		modelScore = 75.0
	} else if col.TotalSupply <= 15000 {
		modelScore = 60.0
	}

	serialScore := 30.0
	if serial == 1 {
		serialScore = 100.0
	} else if serial <= 10 {
		serialScore = 95.0
	} else if serial <= 100 {
		serialScore = 80.0
	} else if serial <= 1000 {
		serialScore = 60.0
	}

	// 2. Visual Pop Index from Delta-E contrast and chromatic harmony
	visualPop := math.Min(99.0, harmony.HarmonyScore*0.60+harmony.DeltaECenterEdge*0.50)

	// 3. Composite Profile Flex Score
	flexScore := (modelScore * 0.35) + (serialScore * 0.35) + (rarity.HarmonicRarityScore * 0.20) + (visualPop * 0.10)
	flexScore = math.Round(flexScore*10.0) / 10.0

	// 4. Flex Tier
	tier := "FLOOR_HOLDER"
	statusEn := "Solid profile collectible with standard aesthetic appeal."
	statusFa := "گیفت کلکسیونی جذاب با نمایش استاندارد در پروفایل کاربری."

	if flexScore >= 90.0 || serial <= 3 || rarity.RarityClass == "TRIPLE_GOD_TIER" {
		tier = "SOVEREIGN_WHALE"
		statusEn = "Sovereign Whale Showcase: Maximum prestige on Telegram profiles commanding instant authority."
		statusFa = "نمایشگاه وال سلطنتی: اوج پرستیژ و اعتبار اجتماعی در پروفایل و کانال‌های تلگرام."
	} else if flexScore >= 80.0 || rarity.RarityClass == "DOUBLE_GOD_TIER" {
		tier = "COLLECTOR_ELITE"
		statusEn = "Collector Elite: High-tier visual pop and rare traits recognized by Telegram power users."
		statusFa = "کلکسیونر نخبه: درخشش بصری بالا و صفات کمیاب شناخته‌شده در اکوسیستم تلگرام."
	} else if flexScore >= 65.0 {
		tier = "AESTHETIC_CURATOR"
		statusEn = "Aesthetic Curator: Clean chromatic harmony and refined collection placement."
		statusFa = "کلکسیونر زیباشناختی: هارمونی رنگی چشم‌نواز و گزینش شیک برای پروفایل."
	}

	giveawayScore := math.Round(math.Min(98.0, flexScore*1.05)*10.0) / 10.0

	return ProfileFlexReport{
		ProfileFlexScore:    flexScore,
		VisualPopIndex:      math.Round(visualPop*10.0) / 10.0,
		FlexTier:            tier,
		GiveawayAppealScore: giveawayScore,
		ShowcaseStatusEn:    statusEn,
		ShowcaseStatusFa:    statusFa,
	}
}
