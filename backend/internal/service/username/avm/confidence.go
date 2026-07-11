package avm

// CalcConfidenceScore computes a 0-100 confidence score for a valuation.
//
// Factors:
//   - nEff (effective sample size): more data = higher confidence
//   - saleCount: raw count of comparables used
//   - mad: lower MAD = more consistent data = higher confidence
//   - hasMomentum: market activity present = slightly higher confidence
func CalcConfidenceScore(nEff float64, saleCount int, mad float64, hasMomentum bool) int16 {
	score := 0.0

	// Base from effective sample size (0-40 points)
	switch {
	case nEff >= 20:
		score += 40
	case nEff >= 10:
		score += 30
	case nEff >= 5:
		score += 20
	case nEff >= 2:
		score += 12
	case nEff > 0:
		score += 5
	}

	// Raw sale count bonus (0-25 points)
	switch {
	case saleCount >= 50:
		score += 25
	case saleCount >= 20:
		score += 20
	case saleCount >= 10:
		score += 15
	case saleCount >= 5:
		score += 10
	case saleCount >= 1:
		score += 5
	}

	// MAD consistency bonus (0-20 points) — lower MAD = more consistent
	switch {
	case mad == 0 && saleCount == 0:
		// No data, no bonus
	case mad < 0.2:
		score += 20
	case mad < 0.5:
		score += 15
	case mad < 0.8:
		score += 10
	case mad < 1.2:
		score += 5
	}

	// Momentum activity bonus (0-15 points)
	if hasMomentum {
		score += 15
	}

	// Clamp to [35, 100]
	if score > 100 {
		score = 100
	}
	if score < 35 {
		score = 35
	}

	return int16(score)
}
