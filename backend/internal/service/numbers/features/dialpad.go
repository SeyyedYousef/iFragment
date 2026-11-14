package features

import (
	"fmt"
	"math"
	"strings"
)

// KeyCoord represents the row, column, and ITU-T Q.23 DTMF frequencies on a standard 3x4 dial-pad
type KeyCoord struct {
	Row   int
	Col   int
	RowHz int
	ColHz int
	BCD   string
}

// DialPadCoords maps digits 0-9 to their physical ITU-T E.161 keypad positions and ITU-T Q.23 DTMF frequencies:
// [1: 697,1209] [2: 697,1336] [3: 697,1477]
// [4: 770,1209] [5: 770,1336] [6: 770,1477]
// [7: 852,1209] [8: 852,1336] [9: 852,1477]
// [*: 941,1209] [0: 941,1336] [#: 941,1477]
var DialPadCoords = map[rune]KeyCoord{
	'1': {Row: 0, Col: 0, RowHz: 697, ColHz: 1209, BCD: "0001"},
	'2': {Row: 0, Col: 1, RowHz: 697, ColHz: 1336, BCD: "0010"},
	'3': {Row: 0, Col: 2, RowHz: 697, ColHz: 1477, BCD: "0011"},
	'4': {Row: 1, Col: 0, RowHz: 770, ColHz: 1209, BCD: "0100"},
	'5': {Row: 1, Col: 1, RowHz: 770, ColHz: 1336, BCD: "0101"},
	'6': {Row: 1, Col: 2, RowHz: 770, ColHz: 1477, BCD: "0110"},
	'7': {Row: 2, Col: 0, RowHz: 852, ColHz: 1209, BCD: "0111"},
	'8': {Row: 2, Col: 1, RowHz: 852, ColHz: 1336, BCD: "1000"},
	'9': {Row: 2, Col: 2, RowHz: 852, ColHz: 1477, BCD: "1001"},
	'0': {Row: 3, Col: 1, RowHz: 941, ColHz: 1336, BCD: "0000"},
}

// DialPadFeatures contains geometric, Fitts's Law biomechanical, and ITU-T Q.23 DTMF acoustic ergonomics
type DialPadFeatures struct {
	FingerTravelDistance  float64 `json:"finger_travel_distance"`  // Average Euclidean distance between consecutive keys (0.0 = perfect same key)
	ManhattanDistance     int     `json:"manhattan_distance"`      // Total L1 grid steps across the sequence
	FittsIndexBits        float64 `json:"fitts_index_bits"`        // Mean Fitts's Law Index of Difficulty log2(1 + D/W) in bits/tap
	FittsErgonomicScore   float64 `json:"fitts_ergonomic_score"`   // 0 to 100 Fitts's Law + collinear momentum biomechanical score
	DTMFConsonanceScore   float64 `json:"dtmf_consonance_score"`   // 0 to 100 ITU-T Q.23 dual-tone frequency harmonic consonance
	DTMFAcousticSignature string  `json:"dtmf_acoustic_signature"` // Compact ITU-T Q.23 frequency path
	IsRowPattern          bool    `json:"is_row_pattern"`          // Uses entire rows (e.g. 123456, 456789, 789789, 987654)
	IsColPattern          bool    `json:"is_col_pattern"`          // Uses entire columns (e.g. 147258, 25802580, 369369)
	IsDiagonalPattern     bool    `json:"is_diagonal_pattern"`     // Uses diagonals (e.g. 159159, 357357, 753159)
	IsCornerVanity        bool    `json:"is_corner_vanity"`        // Uses only keypad corners {1, 3, 7, 9, 0}
	IsCrossVanity         bool    `json:"is_cross_vanity"`         // Uses center cross {2, 4, 5, 6, 8, 0}
	DialPadEleganceScore  float64 `json:"dial_pad_elegance_score"` // 0 to 100 overall spatial rating
	GeometryClass         string  `json:"geometry_class"`          // "MONODIAL", "LINEAR_ROW", "VERTICAL_COL", "DIAGONAL", "CORNER_VIP", "COMPACT_TOUCH", "STANDARD"
}

// AnalyzeDialPad evaluates physical ergonomics, Fitts's Law biomechanics, and ITU-T Q.23 DTMF acoustics on the telephone dial-pad
func AnalyzeDialPad(s string) DialPadFeatures {
	if len(s) == 0 {
		return DialPadFeatures{GeometryClass: "STANDARD"}
	}

	// 1. Calculate Finger Travel Distance, Manhattan Steps, Fitts's Law ID, and DTMF Consonance
	totalDist := 0.0
	totalManhattan := 0
	totalFittsBits := 0.0
	totalDTMFHarmony := 0.0
	collinearBonuses := 0.0
	steps := 0
	runes := []rune(s)

	sigParts := make([]string, 0, len(runes))
	for _, r := range runes {
		if c, ok := DialPadCoords[r]; ok {
			sigParts = append(sigParts, fmt.Sprintf("%c:[%d+%dHz]", r, c.RowHz, c.ColHz))
		}
	}

	for i := 1; i < len(runes); i++ {
		c1, ok1 := DialPadCoords[runes[i-1]]
		c2, ok2 := DialPadCoords[runes[i]]
		if ok1 && ok2 {
			dr := float64(c2.Row - c1.Row)
			dc := float64(c2.Col - c1.Col)
			dist := math.Sqrt(dr*dr + dc*dc)
			totalDist += dist
			totalManhattan += int(math.Abs(dr) + math.Abs(dc))

			// Fitts's Law Index of Difficulty: ID = log2(1 + D/W) with W = 1.0 key width unit
			fittsID := math.Log2(1.0 + dist)
			totalFittsBits += fittsID

			// ITU-T Q.23 DTMF Acoustic Consonance between consecutive tones:
			// - Identical digit (unison both row & col frequencies): 1.00
			// - Shared Column frequency (e.g. 1336 Hz spine 2-5-8-0) or Shared Row frequency: 0.82
			// - Harmonic adjacent row/col step: 0.55
			// - Disjoint cross-grid jump: 0.25
			switch {
			case c1.RowHz == c2.RowHz && c1.ColHz == c2.ColHz:
				totalDTMFHarmony += 1.00
			case c1.ColHz == c2.ColHz:
				if c1.ColHz == 1336 {
					// 1336 Hz is the native carrier frequency of the +888 prefix ('8' = 852+1336 Hz)
					totalDTMFHarmony += 0.88
				} else {
					totalDTMFHarmony += 0.82
				}
			case c1.RowHz == c2.RowHz:
				totalDTMFHarmony += 0.82
			case math.Abs(dr)+math.Abs(dc) <= 2.0:
				totalDTMFHarmony += 0.55
			default:
				totalDTMFHarmony += 0.25
			}

			// Collinear 3-key kinematic momentum (zero angular deflection along a row, col, or diagonal)
			if i >= 2 {
				if c0, ok0 := DialPadCoords[runes[i-2]]; ok0 {
					v1r, v1c := float64(c1.Row-c0.Row), float64(c1.Col-c0.Col)
					v2r, v2c := dr, dc
					n1 := math.Hypot(v1r, v1c)
					n2 := math.Hypot(v2r, v2c)
					if n1 == 0 || n2 == 0 {
						collinearBonuses += 1.0
					} else {
						cosTheta := (v1r*v2r + v1c*v2c) / (n1 * n2)
						if cosTheta >= 0.95 {
							// Smooth collinear sweep (e.g. 1->2->3, 2->5->8->0, 1->5->9)
							collinearBonuses += 1.0
						} else if cosTheta <= -0.95 && runes[i] == runes[i-2] {
							// Rhythmic 2-key oscillation (e.g. 8->0->8->0)
							collinearBonuses += 0.85
						}
					}
				}
			}

			steps++
		}
	}

	avgDist := 0.0
	meanFitts := 0.0
	dtmfConsonance := 100.0
	fittsErgonomic := 100.0

	if steps > 0 {
		avgDist = totalDist / float64(steps)
		meanFitts = totalFittsBits / float64(steps)
		dtmfConsonance = (totalDTMFHarmony / float64(steps)) * 100.0

		// Also bonus if first suffix digit shares +888 prefix tone (852 Hz or 1336 Hz)
		if firstCoord, ok := DialPadCoords[runes[0]]; ok {
			if firstCoord.RowHz == 852 && firstCoord.ColHz == 1336 {
				dtmfConsonance = math.Min(100.0, dtmfConsonance+5.0)
			} else if firstCoord.ColHz == 1336 || firstCoord.RowHz == 852 {
				dtmfConsonance = math.Min(100.0, dtmfConsonance+2.5)
			}
		}

		// Max possible Fitts ID on 4x3 keypad is corner-to-bottom: sqrt(3^2+1^2)=3.162 -> log2(4.162) ≈ 2.057 bits
		baseErgo := math.Max(0.0, 100.0*(1.0-meanFitts/2.06))
		momentumBonus := 0.0
		if len(runes) >= 3 {
			momentumBonus = (collinearBonuses / float64(len(runes)-2)) * 14.0
		}
		fittsErgonomic = math.Min(100.0, math.Max(10.0, baseErgo*0.88+momentumBonus))
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
	} else if fittsErgonomic >= 65.0 {
		eleganceScore = math.Max(eleganceScore, math.Round(fittsErgonomic*0.75))
	}

	return DialPadFeatures{
		FingerTravelDistance:  math.Round(avgDist*100.0) / 100.0,
		ManhattanDistance:     totalManhattan,
		FittsIndexBits:        math.Round(meanFitts*1000.0) / 1000.0,
		FittsErgonomicScore:   math.Round(fittsErgonomic*10.0) / 10.0,
		DTMFConsonanceScore:   math.Round(dtmfConsonance*10.0) / 10.0,
		DTMFAcousticSignature: strings.Join(sigParts, " → "),
		IsRowPattern:          isRow,
		IsColPattern:          isCol,
		IsDiagonalPattern:     isDiag,
		IsCornerVanity:        isCorner,
		IsCrossVanity:         isCross,
		DialPadEleganceScore:  eleganceScore,
		GeometryClass:         geomClass,
	}
}

func checkRowPattern(s string) bool {
	// Checks for occurrences of ascending or descending row triplets: 123, 321, 456, 654, 789, 987
	rowTriplets := []string{"123", "321", "456", "654", "789", "987", "1234", "4567", "6789", "9876", "6543", "4321"}
	count := 0
	for _, rt := range rowTriplets {
		if containsSubstring(s, rt) {
			count++
		}
	}
	return count >= 1 && len(s) <= 8 && (containsSubstring(s, "123") || containsSubstring(s, "456") || containsSubstring(s, "789") ||
		containsSubstring(s, "321") || containsSubstring(s, "654") || containsSubstring(s, "987"))
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
