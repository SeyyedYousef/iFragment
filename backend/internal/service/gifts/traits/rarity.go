package traits

import (
	"math"
)

// JointRarityAnalysis models multi-dimensional trait synergy, covariance coupling, and statistical surprisal entropy
type JointRarityAnalysis struct {
	JointProbability    float64 `json:"joint_probability"`     // P(Model) * P(Backdrop) * P(Symbol) * P(Serial) with covariance
	SurprisalBits       float64 `json:"surprisal_bits"`        // Information entropy: -log2(P_joint)
	SurprisalEntropy    float64 `json:"surprisal_entropy"`     // Normalized Shannon information entropy (0 to 1)
	CovarianceCoupling  float64 `json:"covariance_coupling"`   // Cross-trait correlation coupling factor (0 to 0.25)
	HarmonicRarityScore float64 `json:"harmonic_rarity_score"` // 0 to 100 scale
	RarityClass         string  `json:"rarity_class"`          // "TRIPLE_GOD_TIER", "DOUBLE_GOD_TIER", "LEGENDARY_GRAIL", "EPIC_COLLECTIBLE", "RARE_CURATED", "STANDARD_FLOOR"
	BetaSynergy         float64 `json:"beta_synergy"`          // Combinatorial super-additive hedonic bonus
	DescriptionEn       string  `json:"description_en"`
	DescriptionFa       string  `json:"description_fa"`
}

// ComputeJointRarity calculates joint probability, information content (bits), covariance coupling, and combinatorial synergy
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

	// 2. Conditioned Serial Scarcity (Power-law tail concentration for prestige low serials)
	serialExponent := 1.15
	if serial <= 100 {
		serialExponent = 1.30
	}
	pSerial := math.Pow(math.Min(1.0, math.Max(1.0, float64(serial))/float64(totalSupply)), serialExponent)

	// 3. Covariance Coupling Matrix between Traits
	// When multiple traits are in top percentiles, mutual information increases surprisal
	traitCorrelation := 0.0
	if backdropPermille <= 50 && symbolPermille <= 50 {
		traitCorrelation = 0.20 * math.Sqrt((1.0-pBackdrop)*(1.0-pSymbol))
	}

	// 4. Joint Probability with Covariance Adjustment: P(Joint)
	pJoint := pModel * pBackdrop * pSymbol * pSerial * (1.0 - traitCorrelation)
	if pJoint < 1e-15 {
		pJoint = 1e-15
	}

	// 5. Information Surprisal Entropy: I = -log2(P_joint)
	surprisal := -math.Log2(pJoint)
	// Normalized entropy across practical max bounds (50 bits)
	normalizedEntropy := math.Min(1.0, surprisal/50.0)

	// 6. Count Genuinely Rare Traits (Top 1% or Apex Milestones)
	rareCount := 0
	if backdropPermille <= 10 {
		rareCount++
	}
	if symbolPermille <= 10 {
		rareCount++
	}
	if serial == 1 {
		rareCount += 2 // Genesis sovereign milestone
	} else if serial <= 9 {
		rareCount++
	}
	if totalSupply <= 1500 || (craftedFlag && totalSupply <= 3000) {
		rareCount++
	}

	// 7. Combinatorial Synergy Multiplier (Super-Additive Value)
	betaSynergy := 0.0
	rarityClass := "STANDARD_FLOOR"
	harmonicScore := math.Min(99.9, surprisal*2.5)
	descEn := "Standard collectible baseline with balanced trait distribution."
	descFa := "گیفت کلکسیونی استاندارد با توزیع متعادل صفات."

	switch {
	case rareCount >= 3:
		rarityClass = "TRIPLE_GOD_TIER"
		betaSynergy = 0.50
		harmonicScore = 99.8
		descEn = "Triple God-Tier Holy Grail: Simultaneous legendary model, ultra-rare backdrop, and single-digit serial."
		descFa = "جام مقدس سه‌گانه: همزمانی مدل افسانه‌ای، بک‌دراپ فوق‌نایاب و سریال تک‌رقمی."
	case rareCount == 2:
		rarityClass = "DOUBLE_GOD_TIER"
		betaSynergy = 0.30
		harmonicScore = 96.5
		descEn = "Double God-Tier Grail: Dual high-tier rarity attributes commanding collector premium."
		descFa = "جام مقدس دوگانه: دو صفت فوق‌نایاب همزمان با پرمیوم کلکسیونرها."
	case rareCount == 1:
		rarityClass = "RARE_CURATED"
		betaSynergy = 0.12
		harmonicScore = 85.0
		descEn = "Rare Curated: Standout scarcity attribute with strong secondary market interest."
		descFa = "کلکسیونی نایاب: دارای صفت کمیاب با توجه بازار ثانویه."
	default:
		rarityClass = "STANDARD_FLOOR"
		betaSynergy = 0.0
		harmonicScore = math.Max(40.0, math.Min(75.0, surprisal*2.0))
		descEn = "Standard collectible baseline aligned with collection floor."
		descFa = "گیفت کلکسیونی استاندارد منطبق بر کف قیمت (Floor) بازار."
	}

	return JointRarityAnalysis{
		JointProbability:    pJoint,
		SurprisalBits:       math.Round(surprisal*100.0) / 100.0,
		SurprisalEntropy:    math.Round(normalizedEntropy*1000.0) / 1000.0,
		CovarianceCoupling:  math.Round(traitCorrelation*1000.0) / 1000.0,
		HarmonicRarityScore: math.Round(harmonicScore*10.0) / 10.0,
		RarityClass:         rarityClass,
		BetaSynergy:         math.Round(betaSynergy*100.0) / 100.0,
		DescriptionEn:       descEn,
		DescriptionFa:       descFa,
	}
}
