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
	// 1. Historical & Milestones
	"0000":     {PatternName: "Genesis Quad Zero", Category: "Milestone", BonusLogP: 1.80, RarityBonus: 25.0, Description: "Clean quad-zero milestone"},
	"00000000": {PatternName: "Octa Zero", Category: "Milestone", BonusLogP: 4.50, RarityBonus: 50.0, Description: "Legendary all-zero sequence"},
	"1000":     {PatternName: "Millennium", Category: "Milestone", BonusLogP: 0.85, RarityBonus: 15.0, Description: "Classic millennium round number"},
	"5000":     {PatternName: "Mid-Millennium", Category: "Milestone", BonusLogP: 0.60, RarityBonus: 12.0, Description: "5K milestone mark"},
	"10000000": {PatternName: "Decamillion Baseline", Category: "Milestone", BonusLogP: 2.20, RarityBonus: 35.0, Description: "10-million milestone"},
	"21000000": {PatternName: "Bitcoin Hard Cap 21M", Category: "Crypto", BonusLogP: 1.50, RarityBonus: 28.0, Description: "Total maximum Bitcoin supply 21,000,000"},
	"2100":     {PatternName: "Telemint Floor Milestone", Category: "Crypto", BonusLogP: 0.60, RarityBonus: 12.0, Description: "Starting Telegram number floor price milestone"},

	// 2. Binary Vanity & Double Blocks
	"88880000": {PatternName: "Quad 8 Quad 0 Block", Category: "BinaryVanity", BonusLogP: 3.50, RarityBonus: 45.0, Description: "Flawless half-split 8888 and 0000"},
	"00008888": {PatternName: "Quad 0 Quad 8 Block", Category: "BinaryVanity", BonusLogP: 3.50, RarityBonus: 45.0, Description: "Flawless half-split 0000 and 8888"},
	"80808080": {PatternName: "Binary Alternating 80", Category: "BinaryVanity", BonusLogP: 3.20, RarityBonus: 42.0, Description: "Perfect 4-period 80 alternation"},
	"08080808": {PatternName: "Binary Alternating 08", Category: "BinaryVanity", BonusLogP: 3.00, RarityBonus: 40.0, Description: "Perfect 4-period 08 alternation"},
	"01010101": {PatternName: "Classic Binary 01", Category: "BinaryVanity", BonusLogP: 2.90, RarityBonus: 38.0, Description: "Pure machine binary language sequence"},
	"10101010": {PatternName: "Classic Binary 10", Category: "BinaryVanity", BonusLogP: 2.90, RarityBonus: 38.0, Description: "Pure machine binary code alternation"},
	"88008800": {PatternName: "Binary Double Pair", Category: "BinaryVanity", BonusLogP: 2.70, RarityBonus: 36.0, Description: "Periodic 8800 double block"},
	"80088008": {PatternName: "Binary Mirror Word", Category: "BinaryVanity", BonusLogP: 2.60, RarityBonus: 35.0, Description: "Periodic 8008 symmetry"},

	// 3. Cultural / Auspicious (East Asia / Chinese Phonetics)
	"88888888": {PatternName: "Octa Fa (Infinite Fortune)", Category: "Cultural", BonusLogP: 5.50, RarityBonus: 50.0, Description: "Maximum 8-digit prosperity godhead"},
	"888888":   {PatternName: "Hexa Fa (Supreme Wealth)", Category: "Cultural", BonusLogP: 3.80, RarityBonus: 45.0, Description: "6 consecutive eights supreme prosperity"},
	"88888":    {PatternName: "Penta Fa (Grand Fortune)", Category: "Cultural", BonusLogP: 2.90, RarityBonus: 40.0, Description: "5 consecutive eights high status"},
	"8888":     {PatternName: "Quad Fa (Super Wealth)", Category: "Cultural", BonusLogP: 2.50, RarityBonus: 40.0, Description: "Quadruple 8 prosperity holy grail"},
	"888":      {PatternName: "Triple Fa", Category: "Cultural", BonusLogP: 1.10, RarityBonus: 20.0, Description: "Triple 8 Chinese wealth trinity"},
	"666666":   {PatternName: "Hexa Liu (Maximum Smoothness)", Category: "Cultural", BonusLogP: 3.60, RarityBonus: 42.0, Description: "6 sixes smooth success holy grail"},
	"6666":     {PatternName: "Quad Liu (Great Victory)", Category: "Cultural", BonusLogP: 2.20, RarityBonus: 34.0, Description: "Liu Liu Da Shun victorious flow"},
	"666":      {PatternName: "Triple Liu (Smooth Path)", Category: "Cultural", BonusLogP: 0.90, RarityBonus: 18.0, Description: "Chinese smooth fortune"},
	"999999":   {PatternName: "Hexa Emperor Nine", Category: "Cultural", BonusLogP: 3.70, RarityBonus: 44.0, Description: "Supreme longevity & supreme emperor"},
	"9999":     {PatternName: "Quad Emperor Nine", Category: "Cultural", BonusLogP: 2.10, RarityBonus: 32.0, Description: "Quadruple 9 imperial longevity"},
	"999":      {PatternName: "Triple Emperor Nine", Category: "Cultural", BonusLogP: 0.85, RarityBonus: 16.0, Description: "Triple 9 eternal longevity"},
	"777777":   {PatternName: "Hexa Lucky Seven", Category: "Cultural", BonusLogP: 3.80, RarityBonus: 45.0, Description: "6 sevens universal perfection"},
	"7777":     {PatternName: "Quad Lucky Seven", Category: "Cultural", BonusLogP: 2.00, RarityBonus: 35.0, Description: "Quadruple 7 perfection & sacred aura"},
	"777":      {PatternName: "Jackpot Triple Seven", Category: "Cultural", BonusLogP: 0.75, RarityBonus: 15.0, Description: "Universal casino/fortune jackpot"},
	"168":      {PatternName: "Yi Lu Fa (Road to Wealth)", Category: "Cultural", BonusLogP: 0.60, RarityBonus: 14.0, Description: "Chinese phonetics for smooth prosperity"},
	"1688":     {PatternName: "Yi Lu Fa Fa (Wealth Forever)", Category: "Cultural", BonusLogP: 0.90, RarityBonus: 18.0, Description: "Prosperity all the way"},
	"16888":    {PatternName: "Grand Yi Lu Fa", Category: "Cultural", BonusLogP: 1.40, RarityBonus: 24.0, Description: "Road to triple wealth"},
	"520":      {PatternName: "Wo Ai Ni (Love Code)", Category: "Cultural", BonusLogP: 0.50, RarityBonus: 12.0, Description: "Chinese cyber romance number"},
	"1314":     {PatternName: "Yi Sheng Yi Shi (Forever)", Category: "Cultural", BonusLogP: 0.70, RarityBonus: 15.0, Description: "Lifetime devotion symbol"},
	"5201314":  {PatternName: "Eternal Love Code", Category: "Cultural", BonusLogP: 2.20, RarityBonus: 35.0, Description: "I love you for a lifetime holy grail"},
	"518":      {PatternName: "Wo Yao Fa (I Will Prosper)", Category: "Cultural", BonusLogP: 0.55, RarityBonus: 12.0, Description: "Determination to attain riches"},

	// 4. Middle East / Persian / Solar Hijri & Dubai VIP
	"1400":     {PatternName: "Solar Century 1400", Category: "Persian", BonusLogP: 0.70, RarityBonus: 14.0, Description: "Persian new century solar milestone"},
	"1401":     {PatternName: "Solar Year 1401", Category: "Persian", BonusLogP: 0.50, RarityBonus: 10.0, Description: "Solar Hijri year 1401"},
	"1402":     {PatternName: "Solar Year 1402", Category: "Persian", BonusLogP: 0.50, RarityBonus: 10.0, Description: "Solar Hijri year 1402"},
	"1403":     {PatternName: "Solar Year 1403", Category: "Persian", BonusLogP: 0.60, RarityBonus: 12.0, Description: "Current active Solar Hijri year milestone"},
	"1404":     {PatternName: "Solar Year 1404", Category: "Persian", BonusLogP: 0.50, RarityBonus: 10.0, Description: "Solar Hijri year 1404"},
	"1357":     {PatternName: "Historic Year 1357", Category: "Persian", BonusLogP: 0.55, RarityBonus: 12.0, Description: "Major historical revolution year"},
	"1379":     {PatternName: "Millennium 2000 Era", Category: "Persian", BonusLogP: 0.35, RarityBonus: 8.0, Description: "Solar year milestone"},
	"1111":     {PatternName: "Tawhid / Unity Code", Category: "Cultural", BonusLogP: 1.80, RarityBonus: 30.0, Description: "Quadruple 1 supreme singularity"},

	// 5. Pop Culture / Tech / Memes
	"007":      {PatternName: "James Bond", Category: "PopCulture", BonusLogP: 0.70, RarityBonus: 15.0, Description: "Secret agent 007 license"},
	"404":      {PatternName: "HTTP Not Found", Category: "Tech", BonusLogP: 0.45, RarityBonus: 10.0, Description: "Iconic internet status code"},
	"1337":     {PatternName: "Leet H4x0r", Category: "Tech", BonusLogP: 0.75, RarityBonus: 16.0, Description: "Classic hacker culture elite"},
	"2077":     {PatternName: "Cyberpunk 2077", Category: "PopCulture", BonusLogP: 0.60, RarityBonus: 12.0, Description: "Futuristic cyberpunk sci-fi year"},
	"1984":     {PatternName: "Orwellian 1984", Category: "Literature", BonusLogP: 0.60, RarityBonus: 12.0, Description: "George Orwell dystopian classic"},
	"4090":     {PatternName: "RTX 4090 Flagship", Category: "Tech", BonusLogP: 0.45, RarityBonus: 10.0, Description: "High-end GPU tech vanity"},
	"1080":     {PatternName: "Full HD 1080p", Category: "Tech", BonusLogP: 0.35, RarityBonus: 8.0, Description: "Resolution standard milestone"},
	"6969":     {PatternName: "Double Meme 6969", Category: "Meme", BonusLogP: 0.65, RarityBonus: 14.0, Description: "Internet meme prestige code"},

	// 6. Ladders & Sequences
	"1234":     {PatternName: "Quad Ascending Ladder", Category: "Ladder", BonusLogP: 0.90, RarityBonus: 18.0, Description: "Clean 4-digit ascending run"},
	"4321":     {PatternName: "Quad Descending Ladder", Category: "Ladder", BonusLogP: 0.70, RarityBonus: 14.0, Description: "Clean 4-digit descending run"},
	"12345678": {PatternName: "Grand Ascending Ladder", Category: "Ladder", BonusLogP: 4.20, RarityBonus: 50.0, Description: "The absolute full 8-digit ascending ladder"},
	"87654321": {PatternName: "Grand Descending Ladder", Category: "Ladder", BonusLogP: 3.60, RarityBonus: 46.0, Description: "The absolute full 8-digit descending ladder"},
	"01234567": {PatternName: "Zero Start Ascending", Category: "Ladder", BonusLogP: 3.80, RarityBonus: 48.0, Description: "Full 8-digit zero-start ascending ladder"},
	"23456789": {PatternName: "Nine End Ascending", Category: "Ladder", BonusLogP: 3.90, RarityBonus: 48.0, Description: "Full 8-digit ascending to 9"},
}

// MatchNumberSemantics scans suffix for semantic numeric patterns
func MatchNumberSemantics(suffix string) (matches []NumberSemanticMatch, totalBonusLogP float64, totalRarityBonus float64) {
	// 1. Direct exact suffix match
	if m, ok := knownNumberLexicon[suffix]; ok {
		matches = append(matches, m)
		totalBonusLogP += m.BonusLogP
		totalRarityBonus += m.RarityBonus
	}

	// 2. Ending pattern matches (last 4, 3, or 2 digits)
	if len(suffix) >= 4 {
		last4 := suffix[len(suffix)-4:]
		if m, ok := knownNumberLexicon[last4]; ok && last4 != suffix {
			matches = append(matches, m)
			totalBonusLogP += m.BonusLogP * 0.80
			totalRarityBonus += m.RarityBonus * 0.80
		}
	}
	if len(suffix) >= 3 {
		last3 := suffix[len(suffix)-3:]
		if m, ok := knownNumberLexicon[last3]; ok && last3 != suffix {
			already := false
			for _, ex := range matches {
				if ex.PatternName == m.PatternName {
					already = true
					break
				}
			}
			if !already {
				matches = append(matches, m)
				totalBonusLogP += m.BonusLogP * 0.65
				totalRarityBonus += m.RarityBonus * 0.65
			}
		}
	}

	// 3. Substring patterns
	for key, m := range knownNumberLexicon {
		if len(key) >= 4 && strings.Contains(suffix, key) && suffix != key {
			alreadyMatched := false
			for _, existing := range matches {
				if existing.PatternName == m.PatternName {
					alreadyMatched = true
					break
				}
			}
			if !alreadyMatched {
				matches = append(matches, m)
				totalBonusLogP += m.BonusLogP * 0.55
				totalRarityBonus += m.RarityBonus * 0.55
			}
		}
	}

	// Clamp total semantic bonus
	if totalBonusLogP > 3.20 {
		totalBonusLogP = 3.20
	}
	if totalRarityBonus > 45.0 {
		totalRarityBonus = 45.0
	}

	return matches, totalBonusLogP, totalRarityBonus
}
