package avm

import (
	"math"
	"regexp"
	"strings"
)

var (
	brandablePatterns = []*regexp.Regexp{
		regexp.MustCompile(`^[a-z]{2,4}ly$`),
		regexp.MustCompile(`^[a-z]{2,4}ify$`),
		regexp.MustCompile(`^[a-z]{2,4}io$`),
		regexp.MustCompile(`^[a-z]{2,4}er$`),
		regexp.MustCompile(`^[a-z]{2,4}a$`),
		regexp.MustCompile(`^[a-z]{2,4}o$`),
		regexp.MustCompile(`^[a-z]+ex$`),
		regexp.MustCompile(`^[a-z]+ix$`),
		regexp.MustCompile(`^[a-z]+ax$`),
		regexp.MustCompile(`^[a-z]+oo$`),
	}

	keyboardPatterns = []string{
		"qwerty", "qwert", "werty", "asdf", "asdfg", "zxcv", "zxcvb",
		"1234", "12345", "123456", "qwer", "asd", "zxc", "qaz", "wsx",
		"edc", "rfv", "tgb", "yhn", "ujm", "qazwsx", "wsxedc", "edcrfv",
		"zaq", "xsw", "cde", "vfr", "bgt", "nhy", "mju", "poiuy", "lkjhg", "mnbvc",
	}

	bigramScores = map[string]float64{
		"th": 9, "he": 9, "in": 9, "er": 9, "an": 9, "re": 9, "on": 9, "at": 9, "en": 9, "nd": 9,
		"ti": 9, "es": 9, "or": 9, "te": 9, "of": 9, "ed": 9, "is": 9, "it": 9, "to": 9, "io": 9,
		"al": 8, "ar": 8, "st": 8, "nt": 8, "ng": 8, "se": 8, "ha": 8, "as": 8, "ou": 8, "le": 8,
		"ve": 8, "co": 8, "me": 8, "de": 8, "hi": 8, "ri": 8, "ro": 8, "ic": 8, "ne": 8, "ea": 8,
		"ce": 8, "ly": 8, "be": 8, "el": 8, "ta": 8, "la": 8, "ns": 8, "di": 8, "si": 8,
		"li": 7, "ch": 7, "ll": 7, "ma": 7, "om": 7, "ur": 7, "ca": 7, "fo": 7, "ho": 7, "pe": 7,
		"ec": 7, "pr": 7, "no": 7, "ct": 7, "us": 7, "rt": 7, "ut": 7, "nc": 7, "tr": 7, "ss": 7,
		"rs": 7, "sh": 7, "oo": 7, "ee": 7, "ai": 7, "ow": 7, "da": 7, "ay": 7, "ge": 7, "ol": 7,
		"op": 7, "do": 7, "ra": 7, "ke": 7, "po": 7, "mo": 7, "lo": 7, "so": 7, "go": 7, "bo": 7,
		"qu": 6, "ck": 6, "ph": 6, "wh": 6, "pl": 6, "bl": 6, "cl": 6, "fl": 6, "gl": 6, "sl": 6,
		"cr": 6, "dr": 6, "fr": 6, "gr": 6, "br": 6, "sp": 6, "sc": 6, "sk": 6, "sm": 6, "sn": 6,
		"sw": 6, "tw": 6, "hy": 6, "og": 6, "fy": 6,
		"wr": 5, "kn": 5, "rh": 5, "ym": 5, "ps": 5, "pt": 5, "ft": 5, "lt": 5, "mp": 5, "nk": 5,
		"ld": 5, "mb": 5, "ei": 5, "ie": 5,
		"dw": 4, "gn": 4, "pn": 4, "bt": 4, "lk": 4, "lm": 4, "ln": 4, "lf": 4, "lp": 4, "oe": 4,
		"ae": 4, "eu": 4, "ua": 4,
		"aa": 3, "uo": 3, "xy": 3,
		"ii": 2, "uu": 2, "qw": 2,
		"jk": 1, "kj": 1, "vw": 1,
	}
)

func isVowel(c rune) bool {
	switch c {
	case 'a', 'e', 'i', 'o', 'u', 'y':
		return true
	}
	return false
}

// AnalyzeFlow returns a flow score from 0.0 to 1.0.
// A low score indicates unpronounceable text or keyboard smash.
func AnalyzeFlow(word string) float64 {
	if len(word) < 2 {
		return 0.5
	}

	clean := strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' {
			return r
		}
		if r >= 'A' && r <= 'Z' {
			return r + 32
		}
		return -1
	}, word)

	if len(clean) < 2 {
		return 0.2 // mostly numbers or underscores
	}

	var bigramScore float64
	pairs := 0

	runes := []rune(clean)
	for i := 0; i < len(runes)-1; i++ {
		pair := string(runes[i : i+2])
		if score, ok := bigramScores[pair]; ok {
			bigramScore += score
		} else {
			bigramScore += 4 // default medium-low score
		}
		pairs++
	}

	avgBigram := 0.5
	if pairs > 0 {
		avgBigram = (bigramScore / float64(pairs)) / 9.0
	}

	vowelCount := 0
	for _, char := range runes {
		if isVowel(char) {
			vowelCount++
		}
	}

	// Optimal vowel ratio is around 38%
	ratio := float64(vowelCount) / float64(len(runes))
	balanceScore := 1.0 - math.Abs(0.38-ratio)*2

	maxConsecutive := 1
	current := 1

	for i := 1; i < len(runes); i++ {
		if isVowel(runes[i-1]) == isVowel(runes[i]) {
			current++
			if current > maxConsecutive {
				maxConsecutive = current
			}
		} else {
			current = 1
		}
	}

	consecutivePenalty := 1.0
	if maxConsecutive > 3 {
		consecutivePenalty = 0.7
	} else if maxConsecutive > 2 {
		consecutivePenalty = 0.9
	}

	brandBonus := 1.0
	for _, pattern := range brandablePatterns {
		if pattern.MatchString(clean) {
			brandBonus = 1.3
			break
		}
	}

	finalScore := (avgBigram*0.5 + balanceScore*0.3 + consecutivePenalty*0.2) * brandBonus
	return math.Max(0.0, math.Min(1.0, finalScore))
}

// IsPalindrome returns true if the alphanumeric characters of the word read the same forwards and backwards.
func IsPalindrome(word string) bool {
	clean := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		if r >= 'A' && r <= 'Z' {
			return r + 32
		}
		return -1
	}, word)

	if len(clean) < 3 {
		return false
	}

	runes := []rune(clean)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		if runes[i] != runes[j] {
			return false
		}
	}
	return true
}

// IsKeyboardPattern returns true if the word contains common sequential keyboard patterns.
func IsKeyboardPattern(word string) bool {
	lower := strings.ToLower(word)
	for _, p := range keyboardPatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}
