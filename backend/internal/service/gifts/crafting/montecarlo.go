package crafting

import (
	"math"
	"math/rand"
	"sort"
)

// MonteCarloForgeResult models stochastic risk, VaR, and Kelly Criterion for crafting
type MonteCarloForgeResult struct {
	TrialsCount          int     `json:"trials_count"`           // 5,000 simulations
	ExpectedNetProfitGRAM float64 `json:"expected_net_profit_gram"` // Mean net return across trials
	ProbabilityOfProfitPct float64 `json:"probability_of_profit_pct"` // Win rate P(Profit > 0)
	ValueAtRisk95GRAM    float64 `json:"value_at_risk_95_gram"`  // Maximum loss at 95% confidence
	SharpeRatio          float64 `json:"sharpe_ratio"`           // Risk-adjusted EV ratio
	KellyFractionPercent float64 `json:"kelly_fraction_percent"` // Optimal Kelly Criterion capital allocation
	ForgeRiskRating      string  `json:"forge_risk_rating"`      // "HIGH_ALPHA_FORGE", "ASYMMETRIC_BET", "NEGATIVE_EV_GAMBLE", "CAPITAL_PRESERVATION"
	RecommendationEn     string  `json:"recommendation_en"`
	RecommendationFa     string  `json:"recommendation_fa"`
}

// RunMonteCarloCraftingSimulation simulates 5,000 stochastic forging iterations
func RunMonteCarloCraftingSimulation(inputTotalCostGRAM float64, baseOutputFloorGRAM float64, craftPersistencePermille int) MonteCarloForgeResult {
	if inputTotalCostGRAM <= 0 {
		inputTotalCostGRAM = 100.0
	}
	if baseOutputFloorGRAM <= 0 {
		baseOutputFloorGRAM = 120.0
	}

	trials := 5000
	r := rand.New(rand.NewSource(1337)) // Deterministic seed for reproducible testing
	profits := make([]float64, trials)
	winCount := 0
	sumProfit := 0.0

	// Trait persistence threshold
	chanceP := float64(craftPersistencePermille) / 1000.0
	if chanceP <= 0 {
		chanceP = 0.30
	}

	for i := 0; i < trials; i++ {
		// Simulate trait persistence roll
		rollBackdrop := r.Float64()
		rollSymbol := r.Float64()

		outputPrice := baseOutputFloorGRAM
		if rollBackdrop < (chanceP * 0.20) {
			// Legendary backdrop persistence (4x floor)
			outputPrice *= 3.8
		} else if rollBackdrop < chanceP {
			// Standard rare backdrop persistence (1.8x floor)
			outputPrice *= 1.8
		}

		if rollSymbol < (chanceP * 0.15) {
			// Legendary symbol bonus
			outputPrice *= 1.5
		}

		netProfit := outputPrice - inputTotalCostGRAM
		profits[i] = netProfit
		sumProfit += netProfit
		if netProfit > 0 {
			winCount++
		}
	}

	meanProfit := sumProfit / float64(trials)

	// Variance and standard deviation
	varSum := 0.0
	for _, p := range profits {
		d := p - meanProfit
		varSum += d * d
	}
	stdDev := math.Sqrt(varSum / float64(trials))
	if stdDev < 1e-4 {
		stdDev = 1.0
	}

	sharpe := meanProfit / stdDev

	// Value at Risk at 95th percentile (5th worst percentile)
	sort.Float64s(profits)
	varIdx := int(float64(trials) * 0.05)
	var95 := -profits[varIdx]
	if var95 < 0 {
		var95 = 0
	}

	winRate := float64(winCount) / float64(trials)

	// Kelly Criterion: f* = (p*b - q) / b where b is odds, p is win rate, q = 1-p
	kelly := 0.0
	if winRate > 0.50 && meanProfit > 0 {
		avgWin := meanProfit / winRate
		avgLoss := (inputTotalCostGRAM - baseOutputFloorGRAM)
		if avgLoss > 0 {
			b := avgWin / avgLoss
			k := (winRate*b - (1.0 - winRate)) / b
			if k > 0 {
				kelly = math.Min(35.0, k*100.0) // Half-Kelly cap at 35%
			}
		} else {
			// Dominant arbitrage / zero downside spread
			kelly = 35.0
		}
	}

	riskRating := "CAPITAL_PRESERVATION"
	recEn := "Crafting has low or negative expected value. Holding inputs directly is mathematically optimal."
	recFa := "کرفتینگ دارای ارزش انتظاری ضعیف است. نگهداری مستقیم ورودی‌ها پیشنهاد می‌شود."

	if meanProfit > 15.0 && winRate >= 0.55 {
		riskRating = "HIGH_ALPHA_FORGE"
		recEn = "Exceptional positive expected value with favorable win rate. Crafting recommended with Kelly size."
		recFa = "ارزش انتظاری مثبت فوق‌العاده با شانس برد بالا. انجام کرفتینگ با رعایت مدیریت سرمایه پیشنهاد می‌شود."
	} else if meanProfit > 0 {
		riskRating = "ASYMMETRIC_BET"
		recEn = "Positive expected return but high variance. Recommended only for risk-tolerant portfolios."
		recFa = "ارزش انتظاری مثبت با نوسان بالا. مناسب برای پورتفوهای ریسک‌پذیر."
	}

	return MonteCarloForgeResult{
		TrialsCount:            trials,
		ExpectedNetProfitGRAM:  math.Round(meanProfit*100.0) / 100.0,
		ProbabilityOfProfitPct: math.Round(winRate*1000.0) / 10.0,
		ValueAtRisk95GRAM:      math.Round(var95*100.0) / 100.0,
		SharpeRatio:            math.Round(sharpe*100.0) / 100.0,
		KellyFractionPercent:   math.Round(kelly*10.0) / 10.0,
		ForgeRiskRating:        riskRating,
		RecommendationEn:       recEn,
		RecommendationFa:       recFa,
	}
}
