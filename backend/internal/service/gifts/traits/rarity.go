package traits

import (
	"math"
)

// JointRarityAnalysis models multi-dimensional trait synergy and statistical surprisal
type JointRarityAnalysis struct {
	JointProbability    float64 `json:"joint_probability"`     // P(Model) * P(Backdrop) * P(Symbol) * P(Serial)
	SurprisalBits       float64 `json:"surprisal_bits"`        // Information entropy: -log2(P_joint)
	HarmonicRarityScore float64 `json:"harmonic_rarity_score"` // 0 to 100 scale
	RarityClass         string  `json:"rarity_class"`          // "TRIPLE_GOD_TIER", "DOUBLE_GOD_TIER", "LEGENDARY_GRAIL", "EPIC_COLLECTIBLE", "RARE_CURATED", "STANDARD_FLOOR"
	BetaSynergy         float64 `json:"beta_synergy"`          // Combinatorial super-additive hedonic bonus
	DescriptionEn       string  `json:"description_en"`
	DescriptionFa       string  `json:"description_fa"`
}

// ComputeJointRarity calculates joint probability, information content (bits), and combinatorial synergy
func ComputeJointRarity(totalSupply, serial, backdropPermille, symbolPermille int, craftedFlag bool) JointRarityAnalysis {
	if totalSupply <= 0 {
		totalSupply = 10000
	}
	if serial <= 0 {
		serial = 1
	}

	// 1. Individual Trait Marginal Probabilities
	pModel := math.Min(1.0, float64(totalSupply)/500000.0)
	if craftedFlag {
		pModel *= 0.35 // High difficulty craft persistence
	}

	pBackdrop := math.Max(1.0, float64(backdropPermille)) / 1000.0
	pSymbol := math.Max(1.0, float64(symbolPermille)) / 1000.0
	pSerial := math.Min(1.0, math.Max(1.0, float64(serial))/float64(totalSupply))

	// 2. Joint Probability: P(Joint)
	pJoint := pModel * pBackdrop * pSymbol * pSerial
	if pJoint < 1e-12 {
		pJoint = 1e-12
	}

	// 3. Information Surprisal: I = -log2(P_joint)
	surprisal := -math.Log2(pJoint)

	// 4. Count Ultra-Rare Traits (Top 2% or 5%)
	rareCount := 0
	if backdropPermille <= 20 {
		rareCount++
	}
	if symbolPermille <= 25 {
		rareCount++
	}
	if serial <= 10 || (serial <= 100 && totalSupply >= 5000) {
		rareCount++
	}
	if totalSupply <= 2500 || craftedFlag {
		rareCount++
	}

	// 5. Combinatorial Synergy Multiplier (Super-Additive Value)
	betaSynergy := 0.0
	rarityClass := "STANDARD_FLOOR"
	harmonicScore := math.Min(99.9, surprisal*3.0)
	descEn := "Standard collectible baseline with balanced trait distribution."
	descFa := "گیفت کلکسیونی استاندارد با توزیع متعادل صفات."

	switch {
	case rareCount >= 3:
		rarityClass = "TRIPLE_GOD_TIER"
		betaSynergy = 0.55
		harmonicScore = 99.8
		descEn = "Triple God-Tier Holy Grail: Simultaneous legendary model, ultra-rare backdrop, and single-digit serial."
		descFa = "جام مقدس سه‌گانه: همزمانی مدل افسانه‌ای، بک‌دراپ فوق‌نایاب و سریال تک‌رقمی."
	case rareCount == 2:
		rarityClass = "DOUBLE_GOD_TIER"
		betaSynergy = 0.35
		harmonicScore = 96.5
		descEn = "Double God-Tier Grail: Dual high-tier rarity attributes commanding exponential collector premium."
		descFa = "جام مقدس دوگانه: دو صفت فوق‌نایاب همزمان با پرمیوم تصاعدی کلکسیونرها."
	case surprisal >= 18.0 || rareCount == 1:
		rarityClass = "LEGENDARY_GRAIL"
		betaSynergy = 0.20
		harmonicScore = 90.0
		descEn = "Legendary Grail: Standout high-scarcity attribute with strong secondary market demand."
		descFa = "گیفت افسانه‌ای: دارای صفت کمیاب با تقاضای بالای بازار ثانویه."
	case surprisal >= 12.0:
		rarityClass = "EPIC_COLLECTIBLE"
		betaSynergy = 0.10
		harmonicScore = 80.0
		descEn = "Epic Collectible: Low-supply and favorable trait configuration."
		descFa = "کلکسیونی حماسی: عرضه محدود و ترکیب صفات جذاب."
	case surprisal >= 8.0:
		rarityClass = "RARE_CURATED"
		betaSynergy = 0.04
		harmonicScore = 70.0
		descEn = "Rare Curated: Above-average rarity in the general collection pool."
		descFa = "کلکسیونی نایاب: صفات برتر از میانگین کلکسیون."
	}

	return JointRarityAnalysis{
		JointProbability:    pJoint,
		SurprisalBits:       math.Round(surprisal*100.0) / 100.0,
		HarmonicRarityScore: math.Round(harmonicScore*10.0) / 10.0,
		RarityClass:         rarityClass,
		BetaSynergy:         math.Round(betaSynergy*100.0) / 100.0,
		DescriptionEn:       descEn,
		DescriptionFa:       descFa,
	}
}
