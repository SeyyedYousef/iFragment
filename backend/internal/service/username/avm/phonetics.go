package avm

import "strings"

var (
	softConsonants = map[rune]bool{
		'l': true, 'm': true, 'n': true, 'r': true, 'w': true, 'y': true,
	}
	harshConsonants = map[rune]bool{
		'p': true, 't': true, 'k': true, 'b': true, 'd': true, 'g': true,
		'x': true, 'q': true, 'j': true,
	}
)

// CalculateEuphony mathematically scores how "beautiful" a word sounds based on phonetic properties.
// It returns a score and a boolean indicating if it passed the threshold for an "Aesthetic Premium".
func CalculateEuphony(word string) (score float64, isAesthetic bool) {
	if len(word) < 3 {
		return 0, false
	}

	lower := strings.ToLower(word)
	runes := []rune(lower)

	softCount := 0
	harshCount := 0
	vowelCount := 0

	for _, r := range runes {
		if isVowel(r) {
			vowelCount++
		} else if softConsonants[r] {
			softCount++
		} else if harshConsonants[r] {
			harshCount++
		}
	}

	// Smoothness is determined by ratio of soft consonants + vowels versus harsh consonants
	total := len(runes)
	smoothRatio := float64(softCount+vowelCount) / float64(total)
	harshRatio := float64(harshCount) / float64(total)

	score = smoothRatio - (harshRatio * 1.5) // heavily penalize harsh sounds
	if score < 0 {
		score = 0
	}

	// For a word to be aesthetically pleasing, it must have a high smoothness score
	if score > 0.65 {
		isAesthetic = true
	}

	return score, isAesthetic
}
