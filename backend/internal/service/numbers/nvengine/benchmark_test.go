package nvengine

import (
	"context"
	"fmt"
	"testing"
)

func TestValuationEngine_ComprehensiveBenchmark(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	type testCase struct {
		number string
		label  string
	}

	cases := []testCase{
		// === TIER S: LEGENDARY MONODIGITS ===
		{"+888 8888 8888", "11x Eights (King of 8-digit)"},
		{"+888 0000 0000", "Pristine Octa Zero"},
		{"+888 7777 7777", "Octa Sevens (Lucky)"},
		{"+888 9999 9999", "Octa Nines"},
		{"+888 1111 1111", "Octa Ones"},
		{"+888 5555 5555", "Octa Fives"},
		{"+888 3333 3333", "Octa Threes"},

		// === TIER A: HALF BLOCK / DOUBLE QUAD ===
		{"+888 8888 0000", "Half Block 8888-0000"},
		{"+888 1111 2222", "Half Block 1111-2222"},
		{"+888 0000 8888", "Half Block 0000-8888"},
		{"+888 7777 8888", "Half Block 7777-8888"},

		// === TIER B: LONG RUNS (7, 6, 5) ===
		{"+888 8888 8880", "Septa Run (7x8)"},
		{"+888 8888 8800", "Hexa Run (6x8)"},
		{"+888 0000 0123", "Penta Run (5x0)"},
		{"+888 8888 8000", "Penta Run (5x8)"},

		// === TIER C: SPECIAL PATTERNS ===
		{"+888 1234 5678", "Full Ascending Ladder"},
		{"+888 8765 4321", "Full Descending Ladder"},
		{"+888 8080 8080", "Binary Alternating ABAB"},
		{"+888 0101 0101", "Binary Alternating 0101"},
		{"+888 1234 4321", "Perfect Palindrome"},
		{"+888 1234 1234", "Repeating Quad"},

		// === TIER D: TAIL CLASS ===
		{"+888 1234 8888", "Quad-8888 Tail"},
		{"+888 5678 7777", "Quad-7777 Tail"},
		{"+888 1234 0000", "Quad-0000 Tail"},
		{"+888 9876 5555", "Quad-5555 Tail"},
		{"+888 1234 5888", "Triple-888 Tail"},
		{"+888 9876 5000", "Triple-000 Tail"},

		// === TIER E: MID-RANGE VANITY ===
		{"+888 8800 8800", "Ternary Vanity (3 digits)"},
		{"+888 1188 1188", "Ternary Vanity Repeating"},
		{"+888 1122 3344", "AABB Pattern"},

		// === TIER F: FLOOR-LEVEL (Random) ===
		{"+888 0139 7412", "Random Baseline A"},
		{"+888 2847 5139", "Random Baseline B"},
		{"+888 6305 9174", "Random Baseline C"},
		{"+888 4821 7693", "Random Baseline D"},
		{"+888 3947 2856", "Random Baseline E"},

		// === GENESIS 4-DIGIT ===
		{"+888 8888", "Genesis Godhead (#1)"},
		{"+888 8000", "Genesis Anchor King"},
		{"+888 8118", "Genesis Symmetric Pair"},
		{"+888 8123", "Genesis Ladder"},
		{"+888 8001", "Genesis Single Offset"},
		{"+888 8501", "Genesis Chaotic"},
	}

	fmt.Println("\n╔═══════════════════════════════════════════════════════════════════════════════════╗")
	fmt.Println("║              iFragment NV-Engine v4.5 — Comprehensive Valuation Benchmark         ║")
	fmt.Println("╠════════════════════════════╦═══════════════╦═══════════════╦═══════════════╦═══════╣")
	fmt.Println("║ Number / Label             ║   Low (TON)   ║  Fair (TON)   ║  High (TON)   ║ Conf% ║")
	fmt.Println("╠════════════════════════════╬═══════════════╬═══════════════╬═══════════════╬═══════╣")

	for _, tc := range cases {
		val, err := engine.Valuate(ctx, tc.number)
		if err != nil {
			t.Fatalf("valuation failed for %s: %v", tc.number, err)
		}

		low, _ := val.LowTON.Float64()
		exp, _ := val.ExpectedTON.Float64()
		high, _ := val.HighTON.Float64()

		// Verify basic invariants
		if low > exp || exp > high {
			t.Errorf("INVARIANT VIOLATED for %s: low=%.2f exp=%.2f high=%.2f", tc.number, low, exp, high)
		}

		label := fmt.Sprintf("%s (%s)", tc.number, tc.label)
		if len(label) > 28 {
			label = label[:28]
		}

		fmt.Printf("║ %-26s ║ %13.2f ║ %13.2f ║ %13.2f ║ %4d%% ║\n",
			label, low, exp, high, val.ConfidenceScore)
	}

	fmt.Println("╚════════════════════════════╩═══════════════╩═══════════════╩═══════════════╩═══════╝")
	fmt.Println("")
}
