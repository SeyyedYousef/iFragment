package features

import (
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"ifragment-backend/internal/service/numbers/registry"
)

var (
	ErrInvalidNumberFormat = errors.New("invalid anonymous number format; Telegram numbers must be 8 digits or genesis 8888")
	ErrNumberNotMinted     = errors.New("this number was not minted in the 136,566 Telegram Anonymous Numbers collection")
)

// NormalizeNumber parses and standardizes valid Telegram Anonymous Numbers.
// Telegram minted exactly 136,566 numbers in total:
// 1) 4-digit genesis numbers: 4 digits (e.g. 8000, 8888) -> "+888XXXX" (7 digits total with country code)
// 2) Standard 8-digit numbers: 8 digits (e.g. 88880000, 01234567) -> "+888XXXXXXXX" (11 digits total with country code)
// Numbers with other lengths (e.g. 1..3, 5, 6 like 715311, 9+) were NEVER minted by Telegram.
func NormalizeNumber(raw string) (string, error) {
	cleaned := CleanNumber(raw)
	if cleaned == "" {
		return "", ErrInvalidNumberFormat
	}

	var suffix string
	switch {
	case len(cleaned) == 11 && strings.HasPrefix(cleaned, "888"):
		// Format: +888 XXXXXXXX (country code 888 + 8 digits)
		suffix = cleaned[3:]
	case len(cleaned) == 7 && strings.HasPrefix(cleaned, "888"):
		// Format: +888 XXXX (country code 888 + 4 digits, e.g. 8000, 8888)
		suffix = cleaned[3:]
	case len(cleaned) == 14 && strings.HasPrefix(cleaned, "888888"):
		// Defensive cleanup for redundant double +888 prefix (e.g. +888 +888 XXXXXXXX)
		suffix = cleaned[6:]
	case len(cleaned) == 10 && strings.HasPrefix(cleaned, "888888"):
		// Defensive cleanup for redundant double +888 prefix (e.g. +888 +888 XXXX)
		suffix = cleaned[6:]
	case len(cleaned) == 8:
		// Format: XXXXXXXX (8 digits directly, e.g. 88888888 or 12345678)
		suffix = cleaned
	case len(cleaned) == 4:
		// Format: XXXX (4 digits directly, e.g. 8000, 8888)
		suffix = cleaned
	default:
		return "", ErrNumberNotMinted
	}

	// 1. 4-digit genesis numbers (7 digits with +888): Telegram only minted 8000..8999
	if len(suffix) == 4 {
		n, err := strconv.Atoi(suffix)
		if err != nil || n < 8000 || n > 8999 {
			return "", ErrNumberNotMinted
		}
		return "+888" + suffix, nil
	}

	// 2. Standard 8-digit Telemint numbers (11 digits with +888)
	if len(suffix) == 8 {
		return "+888" + suffix, nil
	}

	// Any other length is NOT a valid Telegram number
	return "", ErrNumberNotMinted
}

// FeatureVector represents the complete mathematical profile of an anonymous number
type FeatureVector struct {
	Number              string          `json:"number"`                // Normalized: +888XXXXXXXX or +888XXXX
	Suffix              string          `json:"suffix"`                // Digits after 888 (4 digits for Genesis, 8 for Telemint)
	IsGenesis4Digit     bool            `json:"is_genesis_4digit"`     // True if 4-digit Genesis Grail (8000..8999, supply=1000)
	Genesis             GenesisMeta     `json:"genesis"`               // 7-tier micro-segment Genesis details
	VIP                 VIPTaxonomy     `json:"vip"`                   // Standard Telephony VIP Tiering (Diamond, Platinum, Gold, Silver, Bronze)
	DialPad             DialPadFeatures `json:"dial_pad"`              // Physical ergonomics and spatial geometry on keypad
	LeadingEightCount   int             `json:"leading_eight_count"`   // Count of consecutive 8s at start of suffix
	PrefixJoinRun       int             `json:"prefix_join_run"`       // 3 (from +888) + leading 8s (e.g. +888 8001 -> 4, +888 8888 -> 7)
	EffectiveMaxRun     int             `json:"effective_max_run"`     // Max contiguous run across the full dial string
	MaxRun              int             `json:"max_run"`               // Contiguous identical digits inside suffix
	RunCount2Plus       int             `json:"run_count_2plus"`       // Number of runs of length >= 2
	RunCount3Plus       int             `json:"run_count_3plus"`       // Number of runs of length >= 3
	DistinctDigits      int             `json:"distinct_digits"`       // Count of unique digits (1 to 10)
	BinaryVanity        bool            `json:"binary_vanity"`         // Exactly <= 2 distinct digits (High prestige binary)
	TernaryVanity       bool            `json:"ternary_vanity"`        // Exactly 3 distinct digits
	EchoHarmonics       string          `json:"echo_harmonics"`        // "ECHO_SANDWICH_888", "CLAMP_888_000", "PREFIX_MIRROR", "NONE"
	HarmonicEntropy     float64         `json:"harmonic_entropy"`      // Shannon information entropy (0.0 = pure single digit)
	IsPalindrome        bool            `json:"is_palindrome"`         // Perfect symmetry
	MirrorScore         float64         `json:"mirror_score"`          // Structural mirror score 0.0 - 1.0
	HasMonotonicAsc     bool            `json:"has_monotonic_asc"`     // Contains monotonic ascending run >= 4
	HasMonotonicDesc    bool            `json:"has_monotonic_desc"`    // Contains monotonic descending run >= 4
	RepeatedBlock       string          `json:"repeated_block"`        // "AAAA", "ABAB", "AABB", "ABCDABCD", etc.
	DigitFreq           [10]int         `json:"digit_freq"`            // Frequency array for 0..9
	LuckyWeight         float64         `json:"lucky_weight"`          // Cultural positive bonus
	UnluckyWeight       float64         `json:"unlucky_weight"`        // Cultural negative penalty
	SemanticMatches     []string        `json:"semantic_matches"`      // Matched lexicon pattern names
	SemanticBonusLogP   float64         `json:"semantic_bonus_log_p"`  // Hedonic log-price bonus from semantic lexicon
	SemanticRarityBonus float64         `json:"semantic_rarity_bonus"` // Rarity score bonus from semantic lexicon
	DateLike            bool            `json:"date_like"`             // Contains 19xx/20xx or date pattern
	TailClass           string          `json:"tail_class"`            // Last 4 digits pattern classification
	LeadingPattern      string          `json:"leading_pattern"`       // First 2 digits of suffix
	RarityPercentile    float64         `json:"rarity_percentile"`     // Percentile within 136,566 total supply
	RarityScore         int             `json:"rarity_score"`          // Composite score 0 - 100
}

// CleanNumber removes whitespace, hyphens, and standardizes input to ASCII digits only
// Fully supports Eastern Arabic (Persian) ۰-۹ and Arabic-Indic ٠-٩ numeral conversions
func CleanNumber(raw string) string {
	var sb strings.Builder
	for _, r := range raw {
		switch {
		case r >= '0' && r <= '9':
			sb.WriteRune(r)
		case r >= '۰' && r <= '۹': // Persian / Eastern Arabic digits (U+06F0 - U+06F9)
			sb.WriteRune('0' + (r - '۰'))
		case r >= '٠' && r <= '٩': // Arabic-Indic digits (U+0660 - U+0669)
			sb.WriteRune('0' + (r - '٠'))
		}
	}
	return sb.String()
}

// ValidateNumber returns true if the input can be normalized into a valid +888 number
func ValidateNumber(raw string) bool {
	_, err := NormalizeNumber(raw)
	return err == nil
}

// FormatDisplayNumber formats numbers into standardized display strings:
// - 4 digits (e.g. 8000 or +8888000) -> "+888 8000"
// - 8 digits (e.g. 12345678 or +88812345678) -> "+888 1234 5678"
func FormatDisplayNumber(normalized string) string {
	clean := CleanNumber(normalized)
	if len(clean) == 11 && strings.HasPrefix(clean, "888") {
		return fmt.Sprintf("+888 %s %s", clean[3:7], clean[7:11])
	}
	if len(clean) == 7 && strings.HasPrefix(clean, "888") {
		return fmt.Sprintf("+888 %s", clean[3:7])
	}
	if len(clean) == 8 {
		return fmt.Sprintf("+888 %s %s", clean[0:4], clean[4:8])
	}
	if len(clean) == 4 {
		return fmt.Sprintf("+888 %s", clean)
	}
	if strings.HasPrefix(normalized, "+") {
		return normalized
	}
	return "+" + normalized
}

// ExtractFeatures performs pure, deterministic feature analysis on an anonymous number
func ExtractFeatures(normalizedNumber string) (FeatureVector, error) {
	norm, err := NormalizeNumber(normalizedNumber)
	if err != nil {
		return FeatureVector{}, err
	}

	suffix := strings.TrimPrefix(norm, "+888")
	length := len(suffix)
	if length == 0 {
		return FeatureVector{}, ErrInvalidNumberFormat
	}

	fv := FeatureVector{
		Number:          norm,
		Suffix:          suffix,
		IsGenesis4Digit: (length == 4),
	}

	// 0. Genesis 4-Digit Specialized Classification
	if fv.IsGenesis4Digit {
		if gMeta, ok := ClassifyGenesis(suffix); ok {
			fv.Genesis = gMeta
		}
	}

	// 1. PrefixJoinRun & Leading 8s (Country code +888 contiguous dialing run)
	leadingEights := 0
	for _, r := range suffix {
		if r == '8' {
			leadingEights++
		} else {
			break
		}
	}
	fv.LeadingEightCount = leadingEights
	if leadingEights > 0 {
		fv.PrefixJoinRun = 3 + leadingEights // 3 from prefix +888
	}

	// 2. Digit Frequencies, Distinct Digits & Shannon Entropy
	distinctSet := make(map[rune]bool)
	for _, r := range suffix {
		if r >= '0' && r <= '9' {
			idx := r - '0'
			fv.DigitFreq[idx]++
			distinctSet[r] = true
		}
	}
	fv.DistinctDigits = len(distinctSet)
	fv.BinaryVanity = (fv.DistinctDigits <= 2)
	fv.TernaryVanity = (fv.DistinctDigits == 3)

	// Shannon Entropy: H = -sum(p * log2(p))
	entropy := 0.0
	for i := 0; i < 10; i++ {
		if fv.DigitFreq[i] > 0 {
			p := float64(fv.DigitFreq[i]) / float64(length)
			entropy -= p * (math.Log(p) / math.Ln2)
		}
	}
	fv.HarmonicEntropy = math.Round(entropy*100.0) / 100.0

	// 3. Max Run & Run Counts
	currentRun := 1
	maxRun := 1
	run2Plus := 0
	run3Plus := 0

	for i := 1; i < length; i++ {
		if suffix[i] == suffix[i-1] {
			currentRun++
		} else {
			if currentRun >= 2 {
				run2Plus++
			}
			if currentRun >= 3 {
				run3Plus++
			}
			if currentRun > maxRun {
				maxRun = currentRun
			}
			currentRun = 1
		}
	}
	if currentRun >= 2 {
		run2Plus++
	}
	if currentRun >= 3 {
		run3Plus++
	}
	if currentRun > maxRun {
		maxRun = currentRun
	}
	fv.MaxRun = maxRun
	fv.EffectiveMaxRun = maxRun
	if fv.PrefixJoinRun > fv.EffectiveMaxRun {
		fv.EffectiveMaxRun = fv.PrefixJoinRun
	}
	fv.RunCount2Plus = run2Plus
	fv.RunCount3Plus = run3Plus

	// 4. Palindrome & Mirror Score
	isPalin := true
	matchingRunes := 0
	halfLen := length / 2
	for i := 0; i < halfLen; i++ {
		if suffix[i] == suffix[length-1-i] {
			matchingRunes++
		} else {
			isPalin = false
		}
	}
	fv.IsPalindrome = isPalin
	if halfLen > 0 {
		fv.MirrorScore = float64(matchingRunes) / float64(halfLen)
	}

	// 5. Monotonic Ascending & Descending Runs (>= 4)
	fv.HasMonotonicAsc = checkMonotonic(suffix, true, 4)
	fv.HasMonotonicDesc = checkMonotonic(suffix, false, 4)

	// 6. Repeated Block Detection
	fv.RepeatedBlock = detectRepeatedBlock(suffix)

	// 7. Dial-Pad Ergonomics & Geometry
	fv.DialPad = AnalyzeDialPad(suffix)

	// 8. Telephony Standard VIP Taxonomy
	fv.VIP = ClassifyVIPTaxonomy(suffix, fv.EffectiveMaxRun, fv.DistinctDigits, fv.IsPalindrome, fv.HasMonotonicAsc, fv.HasMonotonicDesc)

	// 9. Echo Harmonics (Prefix +888 synergy)
	if strings.HasSuffix(suffix, "888") && strings.Contains(suffix[:len(suffix)-3], "888") {
		fv.EchoHarmonics = "ECHO_SANDWICH_888"
	} else if strings.HasSuffix(suffix, "888") {
		fv.EchoHarmonics = "PREFIX_SUFFIX_CLAMP_888"
	} else if strings.HasSuffix(suffix, "0000") && strings.HasPrefix(suffix, "8888") {
		fv.EchoHarmonics = "CLAMP_888_000"
	} else {
		fv.EchoHarmonics = "STANDARD"
	}

	// 10. Cultural Weights
	var lucky float64
	var unlucky float64
	for _, r := range suffix {
		switch r {
		case '8':
			lucky += 2.0
		case '9':
			lucky += 1.5
		case '7':
			lucky += 1.5
		case '6':
			lucky += 1.0
		case '4':
			unlucky += 2.0
		}
	}
	fv.LuckyWeight = lucky
	fv.UnluckyWeight = unlucky

	// 11. Number Semantic Lexicon Matching
	semMatches, bonusLogP, rarityBonus := MatchNumberSemantics(suffix)
	fv.SemanticBonusLogP = bonusLogP
	fv.SemanticRarityBonus = rarityBonus
	for _, m := range semMatches {
		fv.SemanticMatches = append(fv.SemanticMatches, m.PatternName)
	}

	// 12. Date Like Pattern (e.g. 19xx, 20xx, 14xx or MMDD)
	fv.DateLike = checkDateLike(suffix)

	// 13. Tail Class (last 4 digits classification)
	fv.TailClass = classifyTail(suffix)

	// 14. Leading Pattern (first 2 digits of suffix)
	if length >= 2 {
		fv.LeadingPattern = suffix[0:2]
	} else {
		fv.LeadingPattern = suffix
	}

	// 15. Composite Rarity Score (0 to 100) & Percentile Estimation
	fv.RarityScore = computeCompositeScore(fv)
	fv.RarityPercentile = estimateInitialPercentile(fv)

	return fv, nil
}

func checkMonotonic(s string, asc bool, minRun int) bool {
	if len(s) < minRun {
		return false
	}
	curr := 1
	for i := 1; i < len(s); i++ {
		prevDigit := int(s[i-1] - '0')
		currDigit := int(s[i] - '0')
		if asc && currDigit == (prevDigit+1)%10 {
			curr++
		} else if !asc && (prevDigit == currDigit+1 || (prevDigit == 0 && currDigit == 9)) {
			curr++
		} else {
			curr = 1
		}
		if curr >= minRun {
			return true
		}
	}
	return false
}

func detectRepeatedBlock(s string) string {
	n := len(s)
	if n == 0 {
		return "NONE"
	}

	// Check all identical: AAAAAAAA
	allIdentical := true
	for i := 1; i < n; i++ {
		if s[i] != s[0] {
			allIdentical = false
			break
		}
	}
	if allIdentical {
		return "ALL_SAME"
	}

	// Check ABABABAB (period 2)
	if n >= 4 && n%2 == 0 {
		isABAB := true
		for i := 2; i < n; i++ {
			if s[i] != s[i%2] {
				isABAB = false
				break
			}
		}
		if isABAB && s[0] != s[1] {
			return "ABAB"
		}
	}

	// Check AABBCCDD (pair blocks)
	if n >= 4 && n%2 == 0 {
		isAABB := true
		for i := 0; i < n; i += 2 {
			if s[i] != s[i+1] {
				isAABB = false
				break
			}
		}
		if isAABB {
			return "AABB"
		}
	}

	// Check AAAABBBB (half blocks)
	if n == 8 && s[0] == s[1] && s[1] == s[2] && s[2] == s[3] &&
		s[4] == s[5] && s[5] == s[6] && s[6] == s[7] && s[0] != s[4] {
		return "AAAABBBB"
	}

	// Check ABCDABCD (period n/2)
	if n >= 6 && n%2 == 0 {
		half := n / 2
		if s[:half] == s[half:] {
			return "PERIOD_HALF"
		}
	}

	return "STANDARD"
}

func checkDateLike(s string) bool {
	// Match year 1950-2035 anywhere in the string
	reYear := regexp.MustCompile(`(19[5-9][0-9]|20[0-3][0-9])`)
	return reYear.MatchString(s)
}

func classifyTail(s string) string {
	if len(s) < 4 {
		return "SHORT"
	}
	tail := s[len(s)-4:]

	// 1. Quad 8888 or 0000 or identical 4: AAAA
	if tail[0] == tail[1] && tail[1] == tail[2] && tail[2] == tail[3] {
		if tail == "8888" {
			return "QUAD_8888"
		}
		if tail == "7777" {
			return "QUAD_7777"
		}
		if tail == "0000" {
			return "QUAD_0000"
		}
		return "QUAD_AAAA"
	}

	// 2. Triple Ending: x888, x777, x000, x999
	if tail[1] == tail[2] && tail[2] == tail[3] {
		if tail[1] == '8' {
			return "TRIPLE_X888"
		}
		if tail[1] == '7' {
			return "TRIPLE_X777"
		}
		if tail[1] == '0' {
			return "TRIPLE_X000"
		}
		if tail[1] == '9' {
			return "TRIPLE_X999"
		}
		return "TRIPLE_XAAA"
	}

	// 3. ABAB tail (e.g. 1212, 8989)
	if tail[0] == tail[2] && tail[1] == tail[3] && tail[0] != tail[1] {
		return "PAIR_ABAB"
	}

	// 4. AABB tail (e.g. 1122, 8899)
	if tail[0] == tail[1] && tail[2] == tail[3] && tail[0] != tail[2] {
		return "PAIR_AABB"
	}

	// 5. Monotonic 4 tail: 1234, 6789
	if (tail[1] == tail[0]+1 && tail[2] == tail[1]+1 && tail[3] == tail[2]+1) ||
		(tail[1] == tail[0]-1 && tail[2] == tail[1]-1 && tail[3] == tail[2]-1) {
		return "MONOTONIC_4"
	}

	return "STANDARD_TAIL"
}

func computeCompositeScore(fv FeatureVector) int {
	score := 20.0 // Base score

	// 0. Genesis Scarcity Base (1,000 supply out of 136,566 = 0.73% ultra-rare baseline)
	if fv.IsGenesis4Digit {
		score += 35.0
	}

	// 1. Max Run Bonus (using EffectiveMaxRun for dial string continuity)
	runToScore := fv.EffectiveMaxRun
	if runToScore < fv.MaxRun {
		runToScore = fv.MaxRun
	}
	switch runToScore {
	case 8, 9:
		score += 50.0
	case 7:
		score += 42.0
	case 6:
		score += 35.0
	case 5:
		score += 26.0
	case 4:
		score += 18.0
	case 3:
		score += 10.0
	case 2:
		score += 4.0
	}

	// 2. Distinct Digits (Fewer is rarer)
	switch fv.DistinctDigits {
	case 1:
		score += 30.0
	case 2:
		score += 22.0
	case 3:
		score += 14.0
	case 4:
		score += 8.0
	}

	// 3. Palindrome
	if fv.IsPalindrome {
		score += 20.0
	} else if fv.MirrorScore >= 0.75 {
		score += 10.0
	}

	// 4. Monotonic Sequences
	if fv.HasMonotonicAsc || fv.HasMonotonicDesc {
		score += 15.0
	}

	// 5. Repeated Block Bonus
	switch fv.RepeatedBlock {
	case "ALL_SAME":
		score += 25.0
	case "ABAB", "AAAABBBB":
		score += 20.0
	case "AABB", "PERIOD_HALF":
		score += 14.0
	}

	// 6. Cultural Lucky Net
	netCultural := fv.LuckyWeight - fv.UnluckyWeight
	if netCultural > 0 {
		score += netCultural * 0.8
	} else {
		score += netCultural * 0.5
	}

	// 7. Tail Class Bonus
	switch fv.TailClass {
	case "QUAD_8888":
		score += 20.0
	case "QUAD_7777", "QUAD_0000", "QUAD_AAAA":
		score += 16.0
	case "TRIPLE_X888":
		score += 12.0
	case "TRIPLE_X777", "TRIPLE_X000", "TRIPLE_X999", "TRIPLE_XAAA":
		score += 9.0
	case "PAIR_ABAB", "PAIR_AABB", "MONOTONIC_4":
		score += 7.0
	}

	// 8. Semantic Lexicon Bonus
	score += fv.SemanticRarityBonus

	if score > 100.0 {
		score = 100.0
	}
	if score < 5.0 {
		score = 5.0
	}

	return int(score)
}

func estimateInitialPercentile(fv FeatureVector) float64 {
	score := float64(fv.RarityScore)

	// Genesis numbers belong strictly to the top 0.73% tier (>= 99.27%)
	if fv.IsGenesis4Digit {
		pct := 99.27 + (score / 100.0) * 0.729
		if pct > 99.999 {
			pct = 99.999
		}
		return pct
	}

	pct := (score / 100.0) * 99.99
	if fv.EffectiveMaxRun >= 8 {
		return 99.999
	}
	if fv.EffectiveMaxRun >= 6 {
		return 99.95
	}
	if fv.EffectiveMaxRun >= 5 {
		return 99.50
	}
	if fv.DistinctDigits <= 2 {
		return 99.80
	}
	if fv.IsPalindrome {
		return 99.20
	}
	return pct
}

// CalculateExactPercentiles replaces estimated percentiles with bit-exact numbers from histogram
func CalculateExactPercentiles(fv *FeatureVector, histograms map[string]map[string]int, totalCount int) {
	if totalCount <= 0 {
		totalCount = registry.TotalSupply
	}

	// Calculate percentile for max_run
	if runHist, ok := histograms["max_run"]; ok {
		belowCount := 0
		for bucket, cnt := range runHist {
			bucketVal, _ := strconv.Atoi(bucket)
			if bucketVal < fv.MaxRun {
				belowCount += cnt
			}
		}
		// Exact percentile
		fv.RarityPercentile = (float64(belowCount) / float64(totalCount)) * 100.0
	}
}
