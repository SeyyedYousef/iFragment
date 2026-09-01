package features

import (
	"strings"
)

// NumberSemanticMatch defines a known significant or cultural numeric pattern
type NumberSemanticMatch struct {
	PatternName string
	Category    string
	BonusLogP   float64 // Log-price bonus in hedonic regression
	RarityBonus float64 // Bonus to composite rarity score
	Description string
}

// Known significant numeric sequences
var knownNumberLexicon = map[string]NumberSemanticMatch{
	// Historical & Milestones
	"0000":     {PatternName: "Genesis Quad Zero", Category: "Milestone", BonusLogP: 1.80, RarityBonus: 25.0, Description: "Clean quad-zero milestone"},
	"00000000": {PatternName: "Octa Zero", Category: "Milestone", BonusLogP: 4.50, RarityBonus: 50.0, Description: "Legendary all-zero sequence"},
	"1000":     {PatternName: "Millennium", Category: "Milestone", BonusLogP: 0.85, RarityBonus: 15.0, Description: "Classic millennium round number"},
	"5000":     {PatternName: "Mid-Millennium", Category: "Milestone", BonusLogP: 0.60, RarityBonus: 12.0, Description: "5K milestone mark"},
	"10000000": {PatternName: "Decamillion Baseline", Category: "Milestone", BonusLogP: 2.20, RarityBonus: 35.0, Description: "10-million milestone"},

	// Cultural / Auspicious (East Asia / Global / ME)
	"8888":     {PatternName: "Quad Fa (Super Wealth)", Category: "Cultural", BonusLogP: 2.50, RarityBonus: 40.0, Description: "Quadruple 8 prosperity holy grail"},
	"7777":     {PatternName: "Quad Lucky Seven", Category: "Cultural", BonusLogP: 2.00, RarityBonus: 35.0, Description: "Quadruple 7 perfection & sacred aura"},
	"9999":     {PatternName: "Quad Emperor Nine", Category: "Cultural", BonusLogP: 1.70, RarityBonus: 30.0, Description: "Quadruple 9 imperial longevity"},
	"168":      {PatternName: "Yi Lu Fa (Road to Wealth)", Category: "Cultural", BonusLogP: 0.50, RarityBonus: 12.0, Description: "Chinese phonetics for smooth prosperity"},
	"520":      {PatternName: "Wo Ai Ni (Love Code)", Category: "Cultural", BonusLogP: 0.45, RarityBonus: 10.0, Description: "Chinese cyber romance number"},
	"1314":     {PatternName: "Yi Sheng Yi Shi (Forever)", Category: "Cultural", BonusLogP: 0.65, RarityBonus: 14.0, Description: "Lifetime devotion symbol"},
	"5201314":  {PatternName: "Eternal Love Code", Category: "Cultural", BonusLogP: 1.90, RarityBonus: 32.0, Description: "I love you forever holy grail"},
	"777":      {PatternName: "Jackpot Triple Seven", Category: "Cultural", BonusLogP: 0.75, RarityBonus: 15.0, Description: "Universal casino/fortune jackpot"},

	// Pop Culture / Tech / Crypto Memes
	"007":      {PatternName: "James Bond", Category: "PopCulture", BonusLogP: 0.60, RarityBonus: 14.0, Description: "Secret agent license"},
	"404":      {PatternName: "HTTP Not Found", Category: "Tech", BonusLogP: 0.40, RarityBonus: 10.0, Description: "Iconic internet status code"},
	"1337":     {PatternName: "Leet H4x0r", Category: "Tech", BonusLogP: 0.70, RarityBonus: 15.0, Description: "Classic hacker culture elite"},
	"2077":     {PatternName: "Cyberpunk 2077", Category: "PopCulture", BonusLogP: 0.55, RarityBonus: 12.0, Description: "Futuristic cyberpunk sci-fi year"},
	"1984":     {PatternName: "Orwellian 1984", Category: "Literature", BonusLogP: 0.55, RarityBonus: 12.0, Description: "George Orwell dystopian classic"},
	"4090":     {PatternName: "RTX 4090 Flagship", Category: "Tech", BonusLogP: 0.40, RarityBonus: 10.0, Description: "High-end GPU tech vanity"},
	"1080":     {PatternName: "Full HD 1080p", Category: "Tech", BonusLogP: 0.35, RarityBonus: 8.0, Description: "Resolution standard milestone"},
	"1400":     {PatternName: "Solar Century 1400", Category: "Cultural", BonusLogP: 0.50, RarityBonus: 10.0, Description: "Persian new century solar milestone"},
	"1379":     {PatternName: "Millennium 2000 Era", Category: "Historical", BonusLogP: 0.30, RarityBonus: 8.0, Description: "Notable calendar transition year"},

	// Ladders
	"1234":     {PatternName: "Quad Ascending Ladder", Category: "Ladder", BonusLogP: 0.90, RarityBonus: 18.0, Description: "Clean 4-digit ascending run"},
	"4321":     {PatternName: "Quad Descending Ladder", Category: "Ladder", BonusLogP: 0.70, RarityBonus: 14.0, Description: "Clean 4-digit descending run"},
	"12345678": {PatternName: "Grand Ascending Ladder", Category: "Ladder", BonusLogP: 3.80, RarityBonus: 48.0, Description: "The absolute full 8-digit ascending ladder"},
	"87654321": {PatternName: "Grand Descending Ladder", Category: "Ladder", BonusLogP: 3.20, RarityBonus: 44.0, Description: "The absolute full 8-digit descending ladder"},
}

// MatchNumberSemantics scans suffix for semantic numeric patterns
func MatchNumberSemantics(suffix string) (matches []NumberSemanticMatch, totalBonusLogP float64, totalRarityBonus float64) {
	// 1. Direct exact suffix match
	if m, ok := knownNumberLexicon[suffix]; ok {
		matches = append(matches, m)
		totalBonusLogP += m.BonusLogP
		totalRarityBonus += m.RarityBonus
	}

	// 2. Ending pattern matches (last 3 or 4 digits)
	if len(suffix) >= 4 {
		last4 := suffix[len(suffix)-4:]
		if m, ok := knownNumberLexicon[last4]; ok && last4 != suffix {
			matches = append(matches, m)
			totalBonusLogP += m.BonusLogP * 0.75
			totalRarityBonus += m.RarityBonus * 0.75
		}
	} else if len(suffix) >= 3 {
		last3 := suffix[len(suffix)-3:]
		if m, ok := knownNumberLexicon[last3]; ok && last3 != suffix {
			matches = append(matches, m)
			totalBonusLogP += m.BonusLogP * 0.60
			totalRarityBonus += m.RarityBonus * 0.60
		}
	}

	// 3. Substring patterns
	for key, m := range knownNumberLexicon {
		if len(key) >= 4 && strings.Contains(suffix, key) && suffix != key {
			// Avoid duplicate appending if already matched ending
			alreadyMatched := false
			for _, existing := range matches {
				if existing.PatternName == m.PatternName {
					alreadyMatched = true
					break
				}
			}
			if !alreadyMatched {
				matches = append(matches, m)
				totalBonusLogP += m.BonusLogP * 0.50
				totalRarityBonus += m.RarityBonus * 0.50
			}
		}
	}

	// Clamp total semantic bonus
	if totalBonusLogP > 2.50 {
		totalBonusLogP = 2.50
	}
	if totalRarityBonus > 35.0 {
		totalRarityBonus = 35.0
	}

	return matches, totalBonusLogP, totalRarityBonus
}
