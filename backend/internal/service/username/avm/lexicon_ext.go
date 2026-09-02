package avm

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	leetMap = map[string]string{
		"0": "o", "1": "i", "2": "z", "3": "e", "4": "a",
		"5": "s", "6": "g", "7": "t", "8": "b", "9": "g",
		"@": "a", "$": "s", "!": "i", "+": "t",
	}

	goldenYearRegex = regexp.MustCompile(`(19[89]\d|20[0-3]\d)`)
	binaryRegex     = regexp.MustCompile(`^[01]+$`)
	hexRegex        = regexp.MustCompile(`^[0-9a-f]+$`)
)

type TierResult struct {
	Tier       int
	Context    string
	Multiplier float64
}

func CheckTier(word string) TierResult {
	w := strings.ToLower(word)

	if _, ok := tier_0_corporate_gods[w]; ok {
		return TierResult{0, "Corporate God", 100.0}
	}
	if _, ok := tier_0_web3_gods[w]; ok {
		return TierResult{0, "Web3 God", 100.0}
	}
	if _, ok := tier_ai_tech_gods[w]; ok {
		return TierResult{0, "AI/Tech God", 80.0}
	}
	if _, ok := tier_1_atlas[w]; ok {
		return TierResult{1, "Geographic Elite", 30.0}
	}
	if _, ok := tier_2_wealth[w]; ok {
		return TierResult{2, "Wealth/Premium", 20.0}
	}
	if _, ok := tier_3_persian[w]; ok {
		return TierResult{3, "Persian Market", 25.0}
	}
	if _, ok := tier_3_russian[w]; ok {
		return TierResult{3, "Russian Market", 25.0}
	}
	if _, ok := tier_3_arabic[w]; ok {
		return TierResult{3, "Arabic Market", 25.0}
	}
	if _, ok := tier_3_chinese[w]; ok {
		return TierResult{3, "Chinese Market", 25.0}
	}
	if _, ok := tier_3_turkish[w]; ok {
		return TierResult{3, "Turkish Market", 25.0}
	}
	if _, ok := tier_3_lucky_numbers[w]; ok {
		return TierResult{3, "Lucky Number", 12.0}
	}
	if _, ok := tier_4_creator[w]; ok {
		return TierResult{4, "Creator Economy", 8.0}
	}
	if _, ok := tier_4_nature[w]; ok {
		return TierResult{4, "Nature/Animals", 8.0}
	}
	if _, ok := tier_4_jobs[w]; ok {
		return TierResult{4, "Professional", 6.0}
	}
	if _, ok := tier_4_tech[w]; ok {
		return TierResult{4, "Technology", 8.0}
	}
	if _, ok := tier_4_social[w]; ok {
		return TierResult{4, "Social/Lifestyle", 5.0}
	}
	if _, ok := tier_4_verbs[w]; ok {
		return TierResult{4, "Action/Verb", 4.0}
	}
	if _, ok := tier_4_gaming[w]; ok {
		return TierResult{4, "Gaming/Esports", 6.0}
	}
	if _, ok := tier_4_food[w]; ok {
		return TierResult{4, "Food/Beverage", 4.0}
	}
	if _, ok := tier_4_music[w]; ok {
		return TierResult{4, "Music/Entertainment", 5.0}
	}
	if _, ok := tier_4_sports[w]; ok {
		return TierResult{4, "Sports/Fitness", 5.0}
	}

	return TierResult{5, "Unknown", 1.0}
}

func DecodeLeet(word string) string {
	decoded := strings.ToLower(word)
	for leet, char := range leetMap {
		decoded = strings.ReplaceAll(decoded, leet, char)
	}
	return decoded
}

type ComboResult struct {
	IsCombo bool
	Parts   []string
	Value   float64
}

func DetectCombo(word string) ComboResult {
	if len(word) < 6 {
		return ComboResult{false, nil, 1.0}
	}

	for i := 3; i < len(word)-2; i++ {
		p1 := word[:i]
		p2 := word[i:]
		t1 := CheckTier(p1)
		t2 := CheckTier(p2)

		if t1.Tier <= 4 && t2.Tier <= 4 {
			maxMult := t1.Multiplier
			if t2.Multiplier > maxMult {
				maxMult = t2.Multiplier
			}
			return ComboResult{
				IsCombo: true,
				Parts:   []string{p1, p2},
				Value:   maxMult * 1.5,
			}
		}
	}
	return ComboResult{false, nil, 1.0}
}

type TechPatternResult struct {
	IsTechPattern bool
	PatternType   string
}

func DetectTechPattern(word string) TechPatternResult {
	if len(word) >= 4 && binaryRegex.MatchString(word) {
		return TechPatternResult{true, "Binary"}
	}
	if len(word) == 6 && hexRegex.MatchString(strings.ToLower(word)) {
		return TechPatternResult{true, "Hex Color"}
	}

	isSolid := true
	if len(word) >= 4 {
		for i := 1; i < len(word); i++ {
			if word[i] != word[0] {
				isSolid = false
				break
			}
		}
		if isSolid {
			return TechPatternResult{true, "Solid Pattern"}
		}
	}

	return TechPatternResult{false, ""}
}

type GoldenYearResult struct {
	HasYear bool
	Year    int
}

func DetectGoldenYear(word string) GoldenYearResult {
	match := goldenYearRegex.FindStringSubmatch(word)
	if match != nil {
		year, _ := strconv.Atoi(match[1])
		return GoldenYearResult{true, year}
	}
	return GoldenYearResult{false, 0}
}

type AffixResult struct {
	Bonus   float64
	Details []string
}

func DetectAffixes(word string) AffixResult {
	lower := strings.ToLower(word)
	bonus := 1.0
	var details []string

	for _, s := range powerSuffixes {
		if strings.HasSuffix(lower, s) && len(lower) > len(s)+2 {
			bonus *= 1.3
			details = append(details, "+"+s)
			break
		}
	}

	for _, p := range powerPrefixes {
		if strings.HasPrefix(lower, p) && len(lower) > len(p)+2 {
			bonus *= 1.2
			details = append(details, p+"+")
			break
		}
	}

	return AffixResult{bonus, details}
}
