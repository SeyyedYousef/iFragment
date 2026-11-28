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

	numberInputRe = regexp.MustCompile(`^[\s+\-().0-9۰-۹٠-٩]+$`)
	reYear        = regexp.MustCompile(`(19[5-9][0-9]|20[0-3][0-9])`)
)

// NormalizeNumber parses and standardizes valid Telegram Anonymous Numbers.
// Telegram minted exactly 136,566 numbers in total:
// 1) 4-digit genesis numbers: 4 digits (e.g. 8000, 8888) -> "+888XXXX" (7 digits total with country code)
// 2) Standard 8-digit numbers: 8 digits (e.g. 88880000, 01234567) -> "+888XXXXXXXX" (11 digits total with country code)
// Numbers with other lengths (e.g. 1..3, 5, 6 like 715311, 9+) were NEVER minted by Telegram.
func NormalizeNumber(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || !numberInputRe.MatchString(trimmed) {
		return "", ErrInvalidNumberFormat
	}

	cleaned := CleanNumber(trimmed)
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
	Number               string          `json:"number"`                  // Normalized: +888XXXXXXXX or +888XXXX
	Suffix               string          `json:"suffix"`                  // Digits after 888 (4 digits for Genesis, 8 for Telemint)
	IsGenesis4Digit      bool            `json:"is_genesis_4digit"`       // True if 4-digit Genesis Grail (8000..8999, supply=1000)
	Genesis              GenesisMeta     `json:"genesis"`                 // 7-tier micro-segment Genesis details
	VIP                  VIPTaxonomy     `json:"vip"`                     // Standard Telephony VIP Tiering (Diamond, Platinum, Gold, Silver, Bronze)
	DialPad              DialPadFeatures `json:"dial_pad"`                // Physical ergonomics, Fitts's Law & DTMF acoustics on keypad
	LeadingEightCount    int             `json:"leading_eight_count"`     // Count of consecutive 8s at start of suffix
	PrefixJoinRun        int             `json:"prefix_join_run"`         // 3 (from +888) + leading 8s (e.g. +888 8001 -> 4, +888 8888 -> 7)
	EffectiveMaxRun      int             `json:"effective_max_run"`       // Max contiguous run across the full dial string
	MaxRun               int             `json:"max_run"`                 // Contiguous identical digits inside suffix
	MaxRunDigit          string          `json:"max_run_digit"`           // Digit ('0'..'9') forming the longest run in suffix
	RunCount2Plus        int             `json:"run_count_2plus"`         // Number of runs of length >= 2
	RunCount3Plus        int             `json:"run_count_3plus"`         // Number of runs of length >= 3
	DistinctDigits       int             `json:"distinct_digits"`         // Count of unique digits (1 to 10)
	BinaryVanity         bool            `json:"binary_vanity"`           // Exactly <= 2 distinct digits (High prestige binary)
	TernaryVanity        bool            `json:"ternary_vanity"`          // Exactly 3 distinct digits
	EchoHarmonics        string          `json:"echo_harmonics"`          // "ECHO_SANDWICH_888", "CLAMP_888_000", "PREFIX_SUFFIX_CLAMP_888", "FULL_DIAL_PALINDROME_888"
	HarmonicEntropy      float64         `json:"harmonic_entropy"`        // Shannon information entropy (0.0 = pure single digit)
	CompressionRatio     float64         `json:"compression_ratio"`       // Kolmogorov / RLE structural compression ratio [0.0, 1.0]
	IsPalindrome         bool            `json:"is_palindrome"`           // Perfect suffix symmetry
	IsFullDialPalindrome bool            `json:"is_full_dial_palindrome"` // Full 11-digit (or 7-digit) E.164 string (888 + suffix) is a palindrome
	MirrorScore          float64         `json:"mirror_score"`            // Structural mirror score 0.0 - 1.0
	HasMonotonicAsc      bool            `json:"has_monotonic_asc"`       // Contains monotonic ascending run >= 4
	HasMonotonicDesc     bool            `json:"has_monotonic_desc"`      // Contains monotonic descending run >= 4
	HasPairProgression   bool            `json:"has_pair_progression"`    // 2-digit arithmetic progression (e.g. 10 20 30 40, 01 02 03 04)
	RepeatedBlock        string          `json:"repeated_block"`          // "ALL_SAME", "AAAABBBB", "AABB_AABB", "ABBA_ABBA", "PERIOD_HALF", "PAIR_LADDER", etc.
	LeftBlockClass       string          `json:"left_block_class"`        // Human visual 4-digit left chunk class (QUAD, MIRROR_ABBA, ALT_ABAB, PAIR_AABB, LADDER_4, ROUND_HUNDRED, TRIPLE, etc.)
	RightBlockClass      string          `json:"right_block_class"`       // Human visual 4-digit right chunk class
	BlockSynergyPattern  string          `json:"block_synergy_pattern"`   // Cross-block cognitive pattern (TWIN_ZERO_PAD, DUAL_MIRROR, DUAL_RHYTHM, STEPPING_BLOCKS, INNER_MIRROR_6, etc.)
	MaxDigitFreq         int             `json:"max_digit_freq"`          // Highest count of any single digit across suffix (detects 4/5/6 scattered identical digits)
	DominantFreqDigit    string          `json:"dominant_freq_digit"`     // Digit ('0'..'9') with highest frequency in suffix
	HasContiguousPal6    bool            `json:"has_contiguous_pal6"`     // Contains a clean 6-digit mirror substring (e.g. +888 0912 2195)
	DigitFreq            [10]int         `json:"digit_freq"`              // Frequency array for 0..9
	LuckyWeight          float64         `json:"lucky_weight"`            // Cultural positive bonus
	UnluckyWeight        float64         `json:"unlucky_weight"`          // Cultural negative penalty
	SemanticMatches      []string        `json:"semantic_matches"`        // Matched lexicon pattern names
	SemanticBonusLogP    float64         `json:"semantic_bonus_log_p"`    // Hedonic log-price bonus from semantic lexicon
	SemanticRarityBonus  float64         `json:"semantic_rarity_bonus"`   // Rarity score bonus from semantic lexicon
	DateLike             bool            `json:"date_like"`               // Contains 19xx/20xx or date pattern
	TailClass            string          `json:"tail_class"`              // Last 4 digits pattern classification
	LeadingPattern       string          `json:"leading_pattern"`         // First 2 digits of suffix
	RarityPercentile     float64         `json:"rarity_percentile"`       // Percentile within 136,566 total supply
	RarityScore          int             `json:"rarity_score"`            // Composite score 0 - 100
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

	// Dominant single-digit frequency across the suffix (captures scattered 4-of-a-kind / 5-of-a-kind / 6-of-a-kind)
	bestFreq := 0
	bestFreqDigit := '0'
	for _, d := range []int{8, 0, 7, 9, 6, 5, 1, 2, 3, 4} {
		if fv.DigitFreq[d] > bestFreq {
			bestFreq = fv.DigitFreq[d]
			bestFreqDigit = rune('0' + d)
		}
	}
	fv.MaxDigitFreq = bestFreq
	fv.DominantFreqDigit = string(bestFreqDigit)

	// Shannon Entropy: H = -sum(p * log2(p))
	entropy := 0.0
	for i := 0; i < 10; i++ {
		if fv.DigitFreq[i] > 0 {
			p := float64(fv.DigitFreq[i]) / float64(length)
			entropy -= p * (math.Log(p) / math.Ln2)
		}
	}
	fv.HarmonicEntropy = math.Round(entropy*100.0) / 100.0

	// 3. Max Run & Run Counts + Dominant Run Digit
	currentRun := 1
	maxRun := 1
	maxRunDigit := suffix[0]
	run2Plus := 0
	run3Plus := 0

	for i := 1; i < length; i++ {
		if suffix[i] == suffix[i-1] {
			currentRun++
			if currentRun > maxRun || (currentRun == maxRun && suffix[i] == '8') {
				maxRun = currentRun
				maxRunDigit = suffix[i]
			}
		} else {
			if currentRun >= 2 {
				run2Plus++
			}
			if currentRun >= 3 {
				run3Plus++
			}
			if currentRun > maxRun {
				maxRun = currentRun
				maxRunDigit = suffix[i-1]
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
		maxRunDigit = suffix[length-1]
	}
	fv.MaxRun = maxRun
	fv.MaxRunDigit = string(maxRunDigit)
	fv.EffectiveMaxRun = maxRun
	if fv.PrefixJoinRun > fv.EffectiveMaxRun {
		fv.EffectiveMaxRun = fv.PrefixJoinRun
		fv.MaxRunDigit = "8"
	}
	fv.RunCount2Plus = run2Plus
	fv.RunCount3Plus = run3Plus

	// 4. Palindrome, Full-Dial E.164 Palindrome & Mirror Score
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

	// Check Full-11-Digit (or 7-digit) E.164 Dial Palindrome: "888" + suffix
	fullDial := "888" + suffix
	isFullDialPal := true
	fullHalf := len(fullDial) / 2
	fullMatches := 0
	for i := 0; i < fullHalf; i++ {
		if fullDial[i] == fullDial[len(fullDial)-1-i] {
			fullMatches++
		} else {
			isFullDialPal = false
		}
	}
	fv.IsFullDialPalindrome = isFullDialPal
	if isFullDialPal && fv.MirrorScore < 0.85 {
		fv.MirrorScore = 0.85
	}

	// 5. Monotonic Ascending, Descending & Pair Progressions
	fv.HasMonotonicAsc = checkMonotonic(suffix, true, 4)
	fv.HasMonotonicDesc = checkMonotonic(suffix, false, 4)
	fv.HasPairProgression = checkPairProgression(suffix)

	// 6. Repeated Block & Human Visual 4+4 Chunk Psychology Detection
	fv.RepeatedBlock = detectRepeatedBlock(suffix)
	if length == 8 {
		fv.LeftBlockClass = classifyVisualBlock4(suffix[0:4])
		fv.RightBlockClass = classifyVisualBlock4(suffix[4:8])
		fv.HasContiguousPal6 = hasNonTrivialPalindrome6(suffix)
		fv.BlockSynergyPattern = detectHumanBlockSynergy(suffix, fv.LeftBlockClass, fv.RightBlockClass, fv.IsPalindrome, fv.MirrorScore, fv.HasContiguousPal6)
	}

	// Kolmogorov / RLE Structural Compression Ratio
	maxEntropy := math.Log2(float64(length))
	if maxEntropy <= 0 {
		maxEntropy = 1.0
	}
	compRatio := 1.0 - (entropy / maxEntropy)
	if fv.RepeatedBlock == "PERIOD_HALF" || fv.RepeatedBlock == "AABB_AABB" || fv.RepeatedBlock == "ABBA_ABBA" || fv.IsPalindrome || fv.IsFullDialPalindrome || fv.HasPairProgression {
		compRatio = math.Max(compRatio, 0.55)
	}
	fv.CompressionRatio = math.Round(math.Min(1.0, math.Max(0.0, compRatio))*1000.0) / 1000.0

	// 7. Dial-Pad Ergonomics, Fitts's Law & DTMF Acoustics
	fv.DialPad = AnalyzeDialPad(suffix)

	// 8. Telephony Standard VIP Taxonomy
	fv.VIP = ClassifyVIPTaxonomy(suffix, fv.EffectiveMaxRun, fv.DistinctDigits, fv.IsPalindrome || fv.IsFullDialPalindrome, fv.HasMonotonicAsc, fv.HasMonotonicDesc)

	// 9. Echo Harmonics (Prefix +888 synergy)
	if fv.IsFullDialPalindrome && !fv.IsPalindrome {
		fv.EchoHarmonics = "FULL_DIAL_PALINDROME_888"
	} else if strings.HasSuffix(suffix, "888") && strings.Contains(suffix[:len(suffix)-3], "888") {
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

// checkPairProgression detects 4 two-digit pairs in arithmetic progression (e.g. 10 20 30 40, 01 02 03 04, 80 60 40 20)
func checkPairProgression(s string) bool {
	if len(s) != 8 {
		return false
	}
	p0, err0 := strconv.Atoi(s[0:2])
	p1, err1 := strconv.Atoi(s[2:4])
	p2, err2 := strconv.Atoi(s[4:6])
	p3, err3 := strconv.Atoi(s[6:8])
	if err0 != nil || err1 != nil || err2 != nil || err3 != nil {
		return false
	}
	step1 := p1 - p0
	step2 := p2 - p1
	step3 := p3 - p2
	return step1 != 0 && step1 == step2 && step2 == step3
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

	// Check AAAABBBB (half blocks)
	if n == 8 && s[0] == s[1] && s[1] == s[2] && s[2] == s[3] &&
		s[4] == s[5] && s[5] == s[6] && s[6] == s[7] && s[0] != s[4] {
		return "AAAABBBB"
	}

	// Check AABB_AABB (repeating double pairs: e.g. 1188 1188, 8800 8800, 7788 7788)
	if n == 8 && s[0:4] == s[4:8] && s[0] == s[1] && s[2] == s[3] && s[0] != s[2] {
		return "AABB_AABB"
	}

	// Check ABBA_ABBA (dual 4-digit mirror palindromes: e.g. 8008 8008, 1221 1221)
	if n == 8 && s[0:4] == s[4:8] && s[0] == s[3] && s[1] == s[2] && s[0] != s[1] {
		return "ABBA_ABBA"
	}

	// Check ABCDABCD (period n/2, e.g. 1234 1234)
	if n >= 6 && n%2 == 0 {
		half := n / 2
		if s[:half] == s[half:] {
			return "PERIOD_HALF"
		}
	}

	// Check ABC ABC repeating triplet (e.g. 123 123 45, 800 800 12, 00 123 123)
	if n >= 6 {
		if s[0:3] == s[3:6] && (s[0] != s[1] || s[1] != s[2]) {
			return "PERIOD_TRIPLET"
		}
		if n >= 8 && s[2:5] == s[5:8] && (s[2] != s[3] || s[3] != s[4]) {
			return "PERIOD_TRIPLET"
		}
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

	// Check 2-digit arithmetic pair ladder (e.g. 10 20 30 40, 01 02 03 04)
	if checkPairProgression(s) {
		return "PAIR_LADDER"
	}

	return "STANDARD"
}

func checkDateLike(s string) bool {
	// Match year 1950-2035 anywhere in the string
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

	// 3. ABBA mirror tail (e.g. 1221, 8008, 7007)
	if tail[0] == tail[3] && tail[1] == tail[2] && tail[0] != tail[1] {
		return "PAIR_ABBA"
	}

	// 4. ABAB tail (e.g. 1212, 2929, 8989)
	if tail[0] == tail[2] && tail[1] == tail[3] && tail[0] != tail[1] {
		return "PAIR_ABAB"
	}

	// 5. AABB tail (e.g. 1122, 8899, 7700)
	if tail[0] == tail[1] && tail[2] == tail[3] && tail[0] != tail[2] {
		return "PAIR_AABB"
	}

	// 6. Monotonic 4 tail: 1234, 6789, 4321
	if (tail[1] == tail[0]+1 && tail[2] == tail[1]+1 && tail[3] == tail[2]+1) ||
		(tail[1] == tail[0]-1 && tail[2] == tail[1]-1 && tail[3] == tail[2]-1) {
		return "MONOTONIC_4"
	}

	// 7. Zero-padded / Round tail: 000X, X000, XX00, 0X00
	if (tail[0] == '0' && tail[1] == '0' && tail[2] == '0') || (tail[1] == '0' && tail[2] == '0' && tail[3] == '0') {
		return "ROUND_THOUSAND"
	}
	if tail[2] == '0' && tail[3] == '0' {
		return "ROUND_HUNDRED"
	}

	return "STANDARD_TAIL"
}

// classifyVisualBlock4 classifies a single 4-digit visual block (how humans read +888 XXXX YYYY)
func classifyVisualBlock4(b string) string {
	if len(b) != 4 {
		return "RANDOM"
	}
	if b[0] == b[1] && b[1] == b[2] && b[2] == b[3] {
		return "QUAD"
	}
	if (b[0] == '0' && b[1] == '0' && b[2] == '0') || (b[1] == '0' && b[2] == '0' && b[3] == '0') {
		return "TRIPLE_ZERO_PAD"
	}
	if (b[0] == b[1] && b[1] == b[2]) || (b[1] == b[2] && b[2] == b[3]) {
		return "TRIPLE"
	}
	if b[0] == b[3] && b[1] == b[2] && b[0] != b[1] {
		return "MIRROR_ABBA"
	}
	if b[0] == b[2] && b[1] == b[3] && b[0] != b[1] {
		return "ALT_ABAB"
	}
	if b[0] == b[1] && b[2] == b[3] && b[0] != b[2] {
		return "PAIR_AABB"
	}
	if (b[1] == b[0]+1 && b[2] == b[1]+1 && b[3] == b[2]+1) ||
		(b[1] == b[0]-1 && b[2] == b[1]-1 && b[3] == b[2]-1) {
		return "LADDER_4"
	}
	if b[2] == '0' && b[3] == '0' {
		return "ROUND_HUNDRED"
	}
	if b[0] == '0' && b[1] == '0' {
		return "ZERO_LEAD_PAIR"
	}
	return "RANDOM"
}

func hasNonTrivialPalindrome6(s string) bool {
	if len(s) < 6 {
		return false
	}
	for start := 0; start <= len(s)-6; start++ {
		sub := s[start : start+6]
		if sub[0] == sub[5] && sub[1] == sub[4] && sub[2] == sub[3] {
			if !(sub[0] == sub[1] && sub[1] == sub[2]) {
				return true
			}
		}
	}
	return false
}

func detectHumanBlockSynergy(s, b1, b2 string, isFullPal bool, mirrorScore float64, hasPal6 bool) string {
	if len(s) != 8 {
		return "NONE"
	}
	left := s[0:4]
	right := s[4:8]

	// 1. Whale Twin Zero-Padded / Triple Blocks (e.g. +888 0007 0007, +888 7000 7000, +888 8881 8881)
	if left == right && (b1 == "TRIPLE_ZERO_PAD" || b1 == "TRIPLE") {
		return "TWIN_TRIPLE_BLOCK"
	}

	// 2. Dual 4-Digit Mirror Blocks: +888 ABBA CDDC (e.g. +888 1221 4554, +888 8008 7007)
	if (b1 == "MIRROR_ABBA" || b1 == "QUAD") && (b2 == "MIRROR_ABBA" || b2 == "QUAD") && left != right && !(b1 == "QUAD" && b2 == "QUAD") {
		return "DUAL_MIRROR_BLOCKS"
	}

	// 3. Dual Alternating or Dual Pair Blocks: ABAB CDCD (+888 1212 3434) or AABB CCDD (+888 1122 3344)
	if (b1 == "ALT_ABAB" && b2 == "ALT_ABAB") || (b1 == "PAIR_AABB" && b2 == "PAIR_AABB") {
		return "DUAL_PAIR_CADENCE"
	}

	// 4. Double Clean Thousands: X000 Y000 or 000X 000Y (e.g. +888 2000 5000, +888 0001 0002)
	if b1 == "TRIPLE_ZERO_PAD" && b2 == "TRIPLE_ZERO_PAD" {
		return "DOUBLE_THOUSAND_BLOCKS"
	}

	// 5. Stepping 4-Digit Blocks: +888 1001 1002, +888 2024 2025, +888 1100 1200
	v1, e1 := strconv.Atoi(left)
	v2, e2 := strconv.Atoi(right)
	if e1 == nil && e2 == nil {
		diff := v2 - v1
		if diff < 0 {
			diff = -diff
		}
		if diff == 1 || (diff == 100 && b1 == "ROUND_HUNDRED" && b2 == "ROUND_HUNDRED") || (diff == 1000 && (b1 == "TRIPLE_ZERO_PAD" || b1 == "ROUND_HUNDRED")) {
			return "STEPPING_TWIN_BLOCKS"
		}
	}

	// 6. Both Visual Blocks Structured (e.g. +888 0100 2929 -> ROUND_HUNDRED + ALT_ABAB, or +888 1200 3400, or +888 1234 6789)
	if b1 != "RANDOM" && b2 != "RANDOM" {
		return "DUAL_CLEAN_CHUNKS"
	}

	// 7. 6-Digit Contiguous Mirror or 6-of-8 Near-Palindrome (e.g. +888 0912 2195, +888 1234 5321)
	if !isFullPal && (hasPal6 || mirrorScore >= 0.75) {
		return "NEAR_MIRROR_6"
	}

	// 8. Single Prominent Structured Block (Tail or Lead)
	if b2 == "MIRROR_ABBA" || b2 == "ALT_ABAB" || b2 == "PAIR_AABB" || b2 == "LADDER_4" || b2 == "TRIPLE_ZERO_PAD" {
		return "CLEAN_RIGHT_BLOCK"
	}
	if b1 == "MIRROR_ABBA" || b1 == "ALT_ABAB" || b1 == "PAIR_AABB" || b1 == "LADDER_4" || b1 == "TRIPLE_ZERO_PAD" {
		return "CLEAN_LEFT_BLOCK"
	}

	return "NONE"
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
	switch {
	case runToScore >= 8:
		score += 50.0
	case runToScore == 7:
		score += 42.0
	case runToScore == 6:
		score += 35.0
	case runToScore == 5:
		score += 26.0
	case runToScore == 4:
		score += 18.0
	case runToScore == 3:
		score += 10.0
	case runToScore == 2:
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

	// 3. Palindrome & Full-Dial E.164 Palindrome
	if fv.IsPalindrome {
		score += 20.0
	} else if fv.IsFullDialPalindrome {
		score += 18.0
	} else if fv.MirrorScore >= 0.75 {
		score += 10.0
	}

	// 4. Monotonic & Pair Progression Sequences
	if fv.HasMonotonicAsc || fv.HasMonotonicDesc {
		score += 15.0
	} else if fv.HasPairProgression {
		score += 14.0
	}

	// 5. Repeated Block Bonus
	switch fv.RepeatedBlock {
	case "ALL_SAME":
		score += 25.0
	case "AAAABBBB", "AABB_AABB", "ABBA_ABBA":
		score += 22.0
	case "ABAB", "PERIOD_TRIPLET":
		score += 18.0
	case "AABB", "PERIOD_HALF", "PAIR_LADDER":
		score += 14.0
	}

	// 6. Cultural Lucky Net
	netCultural := fv.LuckyWeight - fv.UnluckyWeight
	if netCultural > 0 {
		score += netCultural * 0.8
	} else {
		score += netCultural * 0.5
	}

	// 7. Tail Class & Human Block Psychology Bonus
	switch fv.TailClass {
	case "QUAD_8888":
		score += 20.0
	case "QUAD_7777", "QUAD_0000", "QUAD_AAAA":
		score += 16.0
	case "TRIPLE_X888":
		score += 12.0
	case "TRIPLE_X777", "TRIPLE_X000", "TRIPLE_X999", "TRIPLE_XAAA", "ROUND_THOUSAND":
		score += 10.0
	case "PAIR_ABBA", "PAIR_ABAB", "PAIR_AABB", "MONOTONIC_4":
		score += 9.0
	case "ROUND_HUNDRED":
		score += 5.0
	}

	switch fv.BlockSynergyPattern {
	case "TWIN_TRIPLE_BLOCK":
		score += 24.0
	case "DUAL_MIRROR_BLOCKS", "DUAL_PAIR_CADENCE", "DOUBLE_THOUSAND_BLOCKS":
		score += 16.0
	case "STEPPING_TWIN_BLOCKS", "DUAL_CLEAN_CHUNKS":
		score += 12.0
	case "NEAR_MIRROR_6":
		score += 10.0
	case "CLEAN_RIGHT_BLOCK", "CLEAN_LEFT_BLOCK":
		score += 7.0
	}

	if fv.MaxRun < 4 && fv.MaxDigitFreq >= 4 {
		score += float64((fv.MaxDigitFreq - 3) * 7)
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
		pct := 99.27 + (score/100.0)*0.729
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
	if fv.IsPalindrome || fv.IsFullDialPalindrome {
		return 99.20
	}
	return pct
}

// CalculateExactPercentiles replaces estimated percentiles with bit-exact numbers from histogram
func CalculateExactPercentiles(fv *FeatureVector, histograms map[string]map[string]int, totalCount int) {
	if totalCount <= 0 {
		totalCount = registry.TotalSupply
	}

	runVal := fv.EffectiveMaxRun
	if runVal < fv.MaxRun {
		runVal = fv.MaxRun
	}

	// Calculate percentile for max_run
	if runHist, ok := histograms["max_run"]; ok {
		belowCount := 0
		sameCount := 0
		for bucket, cnt := range runHist {
			bucketVal, _ := strconv.Atoi(bucket)
			if bucketVal < runVal {
				belowCount += cnt
			} else if bucketVal == runVal {
				sameCount += cnt
			}
		}
		// Exact percentile using mid-rank for ties
		rank := float64(belowCount) + float64(sameCount)/2.0
		fv.RarityPercentile = (rank / float64(totalCount)) * 100.0
	}
}
