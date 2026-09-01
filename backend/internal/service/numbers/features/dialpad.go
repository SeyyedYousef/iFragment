package features

import (
	"math"
)

// KeyCoord represents the row and column coordinates on a standard 3x4 dial-pad
type KeyCoord struct {
	Row int
	Col int
}

// DialPadCoords maps digits 0-9 to their physical keypad positions:
// [1] [2] [3]
// [4] [5] [6]
// [7] [8] [9]
// [*] [0] [#]
var DialPadCoords = map[rune]KeyCoord{
	'1': {Row: 0, Col: 0},
	'2': {Row: 0, Col: 1},
	'3': {Row: 0, Col: 2},
	'4': {Row: 1, Col: 0},
	'5': {Row: 1, Col: 1},
	'6': {Row: 1, Col: 2},
	'7': {Row: 2, Col: 0},
	'8': {Row: 2, Col: 1},
	'9': {Row: 2, Col: 2},
	'0': {Row: 3, Col: 1},
}

// DialPadFeatures contains geometric ergonomics of dialing a number
type DialPadFeatures struct {
	FingerTravelDistance float64 `json:"finger_travel_distance"` // Average Euclidean distance between consecutive keys (0.0 = perfect same key)
	IsRowPattern         bool    `json:"is_row_pattern"`          // Uses entire rows (e.g. 123456, 456789, 789789)
	IsColPattern         bool    `json:"is_col_pattern"`          // Uses entire columns (e.g. 147258, 25802580, 369369)
	IsDiagonalPattern    bool    `json:"is_diagonal_pattern"`     // Uses diagonals (e.g. 159159, 357357, 753159)
	IsCornerVanity       bool    `json:"is_corner_vanity"`        // Uses only keypad corners {1, 3, 7, 9}
	IsCrossVanity        bool    `json:"is_cross_vanity"`         // Uses center cross {2, 4, 5, 6, 8, 0}
	DialPadEleganceScore float64 `json:"dial_pad_elegance_score"` // 0 to 100 overall spatial rating
	GeometryClass        string  `json:"geometry_class"`          // "MONODIAL", "LINEAR_ROW", "VERTICAL_COL", "DIAGONAL", "CORNER_VIP", "COMPACT_TOUCH", "STANDARD"
}

// AnalyzeDialPad evaluates physical ergonomics and layout on telephone dial-pad
func AnalyzeDialPad(s string) DialPadFeatures {
	if len(s) == 0 {
		return DialPadFeatures{GeometryClass: "STANDARD"}
	}

	// 1. Calculate Finger Travel Distance
	totalDist := 0.0
	steps := 0
	runes := []rune(s)

	for i := 1; i < len(runes); i++ {
		c1, ok1 := DialPadCoords[runes[i-1]]
		c2, ok2 := DialPadCoords[runes[i]]
		if ok1 && ok2 {
			dr := float64(c1.Row - c2.Row)
			dc := float64(c1.Col - c2.Col)
			dist := math.Sqrt(dr*dr + dc*dc)
			totalDist += dist
			steps++
		}
	}

	avgDist := 0.0
	if steps > 0 {
		avgDist = totalDist / float64(steps)
	}

	// 2. Geometric Shape Classifications
	isCorner := true
	isCross := true
	for _, r := range runes {
		if r != '1' && r != '3' && r != '7' && r != '9' && r != '0' {
			isCorner = false
		}
		if r != '2' && r != '4' && r != '5' && r != '6' && r != '8' && r != '0' {
			isCross = false
		}
	}

	// Row & Column sequences check
	isRow := checkRowPattern(s)
	isCol := checkColPattern(s)
	isDiag := checkDiagonalPattern(s)

	// 3. Classify Geometry
	geomClass := "STANDARD"
	eleganceScore := 20.0

	if avgDist == 0.0 {
		geomClass = "MONODIAL"
		eleganceScore = 99.0
	} else if isCol {
		geomClass = "VERTICAL_COL"
		eleganceScore = 92.0
	} else if isRow {
		geomClass = "LINEAR_ROW"
		eleganceScore = 90.0
	} else if isDiag {
		geomClass = "DIAGONAL"
		eleganceScore = 88.0
	} else if isCorner {
		geomClass = "CORNER_VIP"
		eleganceScore = 82.0
	} else if isCross {
		geomClass = "CROSS_VIP"
		eleganceScore = 78.0
	} else if avgDist <= 1.10 {
		geomClass = "COMPACT_TOUCH"
		eleganceScore = 72.0
	} else if avgDist <= 1.45 {
		geomClass = "SMOOTH_FLOW"
		eleganceScore = 55.0
	}

	return DialPadFeatures{
		FingerTravelDistance: math.Round(avgDist*100.0) / 100.0,
		IsRowPattern:         isRow,
		IsColPattern:         isCol,
		IsDiagonalPattern:    isDiag,
		IsCornerVanity:       isCorner,
		IsCrossVanity:        isCross,
		DialPadEleganceScore: eleganceScore,
		GeometryClass:        geomClass,
	}
}

func checkRowPattern(s string) bool {
	// Checks for occurrences of row triplets: 123, 321, 456, 654, 789, 987
	rowTriplets := []string{"123", "321", "456", "654", "789", "987", "1234", "4567", "6789"}
	count := 0
	for _, rt := range rowTriplets {
		if containsSubstring(s, rt) {
			count++
		}
	}
	return count >= 1 && (len(s) <= 8 && (containsSubstring(s, "123") || containsSubstring(s, "456") || containsSubstring(s, "789")))
}

func checkColPattern(s string) bool {
	// Checks for occurrences of column patterns: 147, 741, 258, 852, 369, 963, 2580, 0852, 1470, 3690
	colPatterns := []string{"147", "741", "258", "852", "369", "963", "2580", "0852", "1470", "3690", "147258", "258369"}
	for _, cp := range colPatterns {
		if containsSubstring(s, cp) {
			return true
		}
	}
	return false
}

func checkDiagonalPattern(s string) bool {
	diagPatterns := []string{"159", "951", "357", "753", "1590", "3570", "159357", "357159"}
	for _, dp := range diagPatterns {
		if containsSubstring(s, dp) {
			return true
		}
	}
	return false
}

func containsSubstring(s, sub string) bool {
	if len(sub) > len(s) {
		return false
	}
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
