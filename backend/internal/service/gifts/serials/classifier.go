package serials

import (
	"strconv"
)

// Category defines the numerical classification of a gift's serial number
type Category string

const (
	CategorySingleDigit   Category = "single_digit"   // #1 - #9
	CategoryTwoDigit      Category = "two_digit"      // #10 - #99
	CategoryRepDigit      Category = "repeating"      // #11, #777, #888, #999, #7777
	CategoryLadder        Category = "ladder"         // #123, #1234, #4321, #789, #987
	CategoryDoublet       Category = "doublet"        // #2020, #1212, #6969, #2424
	CategoryMilestoneYear Category = "milestone_year" // #1999, #2000, #2024, #2025, #2026
	CategoryPalindrome    Category = "palindrome"     // #101, #1221, #4004, #5005
	CategoryRoundNumber   Category = "round_number"   // #100, #500, #1000, #5000
	CategoryEarlyMint     Category = "early_mint"     // #100 - #250
	CategoryStandard      Category = "standard"       // Generic serials
)

// ClassificationResult contains genetic attributes and market valuation multiplier
type ClassificationResult struct {
	SerialNumber     int      `json:"serial_number"`
	Category         Category `json:"category"`
	Label            string   `json:"label"`
	Multiplier       float64  `json:"multiplier"`
	RarityPercentage float64  `json:"rarity_percentage"`
	EstimatedFloor   float64  `json:"estimated_floor_gram"`
	Description      string   `json:"description"`
}

// ClassifySerial analyzes the serial number and returns genetic characteristics and valuation boost
func ClassifySerial(serial int, baseFloor float64) ClassificationResult {
	if serial <= 0 {
		return ClassificationResult{
			SerialNumber:     serial,
			Category:         CategoryStandard,
			Label:            "Standard",
			Multiplier:       1.0,
			RarityPercentage: 100.0,
			EstimatedFloor:   baseFloor,
			Description:      "Standard non-premium serial number",
		}
	}

	s := strconv.Itoa(serial)
	length := len(s)

	// 1. Single Digit (#1 - #9)
	if serial >= 1 && serial <= 9 {
		mult := 20.0
		if serial == 1 {
			mult = 35.0 // The Genesis #1 is apex prestige
		} else if serial == 7 {
			mult = 25.0
		} else if serial == 8 {
			mult = 22.0
		}
		return ClassificationResult{
			SerialNumber:     serial,
			Category:         CategorySingleDigit,
			Label:            "Single Digit (Apex Tier)",
			Multiplier:       mult,
			RarityPercentage: 0.01,
			EstimatedFloor:   round(baseFloor * mult),
			Description:      "Top-tier Genesis serial number with maximum collector and whale demand",
		}
	}

	// 2. Repeating Digits / RepDigit (#777, #888, #111, etc.)
	if isRepDigit(s) {
		mult := 6.0
		if stringsContainsAll(s, '7') {
			mult = 12.0 // Lucky 7s
		} else if stringsContainsAll(s, '8') {
			mult = 10.0 // Prosperity 8s
		} else if length >= 4 {
			mult = 8.0
		}
		return ClassificationResult{
			SerialNumber:     serial,
			Category:         CategoryRepDigit,
			Label:            "Repeating Digits (RepDigit)",
			Multiplier:       mult,
			RarityPercentage: 0.05,
			EstimatedFloor:   round(baseFloor * mult),
			Description:      "Uniform repeating digits commanding high cultural and prestige premium",
		}
	}

	// 3. Two Digit (#10 - #99)
	if serial >= 10 && serial <= 99 {
		mult := 5.0
		if serial == 69 {
			mult = 8.0 // Meme / collector target
		} else if serial <= 25 {
			mult = 6.5
		}
		return ClassificationResult{
			SerialNumber:     serial,
			Category:         CategoryTwoDigit,
			Label:            "Double Digit (Collector Tier)",
			Multiplier:       mult,
			RarityPercentage: 0.10,
			EstimatedFloor:   round(baseFloor * mult),
			Description:      "Sub-100 two-digit early serial number favored by long-term holders",
		}
	}

	// 4. Consecutive Ladder (Ascending & Descending: #123, #1234, #4321, #789, #987)
	if isLadderSeq, isAsc := isLadder(s); isLadderSeq {
		mult := 3.2
		direction := "Ascending"
		if !isAsc {
			direction = "Descending"
		}
		if length >= 4 {
			mult = 4.5
		}
		return ClassificationResult{
			SerialNumber:     serial,
			Category:         CategoryLadder,
			Label:            direction + " Ladder Sequence",
			Multiplier:       mult,
			RarityPercentage: 0.08,
			EstimatedFloor:   round(baseFloor * mult),
			Description:      "Strict sequential numerical progression with exceptional aesthetic flow",
		}
	}

	// 5. Doublets & Alternating Patterns (ABAB: #2020, #1212, #6969, #2424)
	if isDoublet(s) {
		mult := 3.8
		if serial == 6969 {
			mult = 6.0 // Apex cultural doublet
		}
		return ClassificationResult{
			SerialNumber:     serial,
			Category:         CategoryDoublet,
			Label:            "Doublet Pattern (ABAB)",
			Multiplier:       mult,
			RarityPercentage: 0.12,
			EstimatedFloor:   round(baseFloor * mult),
			Description:      "Harmonic two-cycle repeating pattern highly prized by web3 collectors",
		}
	}

	// 6. Palindromes (#101, #1221, #5005, #7007)
	if isPalindrome(s) && length >= 3 {
		mult := 2.5
		if length == 4 && s[0] == s[3] && s[1] == s[2] {
			mult = 3.2
		}
		return ClassificationResult{
			SerialNumber:     serial,
			Category:         CategoryPalindrome,
			Label:            "Palindrome (Symmetric DNA)",
			Multiplier:       mult,
			RarityPercentage: 0.40,
			EstimatedFloor:   round(baseFloor * mult),
			Description:      "Symmetric numerical sequence with distinct visual harmony",
		}
	}

	// 7. Milestone Years (Telegram Ecosystem & Cultural Anchors: #1999, #2000, #2024, #2025, #2026)
	if isMilestoneYear(serial) {
		mult := 2.4
		label := "Milestone Calendar Year"
		desc := "Recognized Gregorian calendar milestone year"
		if serial == 2024 {
			mult = 4.0
			label = "Telegram Gifts Genesis Year (2024)"
			desc = "Foundational genesis launch year of Telegram Collectibles ecosystem"
		} else if serial == 2025 || serial == 2026 {
			mult = 3.2
			label = "Active Era Ecosystem Year"
			desc = "Active modern expansion era year of Telegram NFTs"
		} else if serial == 2000 || serial == 1999 {
			mult = 3.0
			label = "Millennium Turn Milestone"
			desc = "Historic turn of the millennium generational collector serial"
		}
		return ClassificationResult{
			SerialNumber:     serial,
			Category:         CategoryMilestoneYear,
			Label:            label,
			Multiplier:       mult,
			RarityPercentage: 0.20,
			EstimatedFloor:   round(baseFloor * mult),
			Description:      desc,
		}
	}

	// 8. Cultural Meme Milestones (#420, #1337)
	if serial == 420 || serial == 1337 {
		return ClassificationResult{
			SerialNumber:     serial,
			Category:         CategoryDoublet,
			Label:            "Cultural Web3 Milestone",
			Multiplier:       3.5,
			RarityPercentage: 0.10,
			EstimatedFloor:   round(baseFloor * 3.5),
			Description:      "Iconic Internet culture milestone commanding aggressive community bidding",
		}
	}

	// 9. Round Number Milestone (#100, #500, #1000, #5000, #10000)
	if isRoundNumber(serial) {
		mult := 2.0
		if serial == 1000 || serial == 5000 || serial == 10000 {
			mult = 2.8
		}
		return ClassificationResult{
			SerialNumber:     serial,
			Category:         CategoryRoundNumber,
			Label:            "Milestone Round Number",
			Multiplier:       mult,
			RarityPercentage: 0.25,
			EstimatedFloor:   round(baseFloor * mult),
			Description:      "Clean milestone boundary serial number",
		}
	}

	// 10. Early Mint (#100 - #250)
	if serial >= 100 && serial <= 250 {
		mult := 1.5
		return ClassificationResult{
			SerialNumber:     serial,
			Category:         CategoryEarlyMint,
			Label:            "Early Mint Generation",
			Multiplier:       mult,
			RarityPercentage: 1.5,
			EstimatedFloor:   round(baseFloor * mult),
			Description:      "First 250 minted gifts carrying provenance age premium",
		}
	}

	// 11. Standard
	return ClassificationResult{
		SerialNumber:     serial,
		Category:         CategoryStandard,
		Label:            "Standard",
		Multiplier:       1.0,
		RarityPercentage: 97.5,
		EstimatedFloor:   baseFloor,
		Description:      "Standard non-premium serial number aligned with market floor",
	}
}

func isLadder(s string) (bool, bool) {
	if len(s) < 3 {
		return false, false
	}
	// Ascending ladder (e.g. 123, 1234, 6789)
	asc := true
	for i := 0; i < len(s)-1; i++ {
		if s[i+1] != s[i]+1 {
			asc = false
			break
		}
	}
	if asc {
		return true, true
	}
	// Descending ladder (e.g. 321, 4321, 9876)
	desc := true
	for i := 0; i < len(s)-1; i++ {
		if s[i+1] != s[i]-1 {
			desc = false
			break
		}
	}
	if desc {
		return true, false
	}
	return false, false
}

func isDoublet(s string) bool {
	if len(s) == 4 {
		// ABAB format (e.g. 2020, 1212, 6969, 2424)
		if s[0] == s[2] && s[1] == s[3] && s[0] != s[1] {
			return true
		}
	}
	return false
}

func isMilestoneYear(serial int) bool {
	return serial == 2024 || serial == 2025 || serial == 2026 || serial == 2000 || serial == 1999
}

func isRepDigit(s string) bool {
	if len(s) <= 1 {
		return false
	}
	first := s[0]
	for i := 1; i < len(s); i++ {
		if s[i] != first {
			return false
		}
	}
	return true
}

func isPalindrome(s string) bool {
	n := len(s)
	for i := 0; i < n/2; i++ {
		if s[i] != s[n-1-i] {
			return false
		}
	}
	return true
}

func isRoundNumber(serial int) bool {
	if serial <= 0 {
		return false
	}
	if serial%10000 == 0 || serial%5000 == 0 || serial%1000 == 0 || serial%500 == 0 || serial%100 == 0 {
		return true
	}
	return false
}

func stringsContainsAll(s string, ch rune) bool {
	for _, r := range s {
		if r != ch {
			return false
		}
	}
	return true
}

func round(val float64) float64 {
	return float64(int64(val*100+0.5)) / 100
}
