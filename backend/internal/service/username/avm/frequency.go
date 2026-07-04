package avm

import "strings"

// RankWord returns the frequency rank of the word (1 to 10000).
// If the word is not in the top 10k, it returns 0.
func RankWord(word string) int {
	lower := strings.ToLower(word)
	if rank, ok := wordFrequencyRank[lower]; ok {
		return rank
	}
	return 0
}

// IsHyped returns true if the word is in the Meme/Hype culture dictionary.
func IsHyped(word string) bool {
	lower := strings.ToLower(word)
	_, ok := hypeDictionary[lower]
	return ok
}
