package crafting

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sort"
	"time"
)

// CraftInputItem represents a gift proposed for crafting combination
type CraftInputItem struct {
	GiftID              string  `json:"gift_id"`
	ModelID             string  `json:"model_id"`
	Name                string  `json:"name"`
	SerialNumber        int     `json:"serial_number"`
	EstimatedValueGRAM  float64 `json:"estimated_value_gram"`
	CraftChancePermille int     `json:"craft_chance_permille"` // e.g. 250 for 25%
	CanCraftAt          *time.Time `json:"can_craft_at,omitempty"`
}

// CraftingEVResult holds the full Monte Carlo EV calculation breakdown
type CraftingEVResult struct {
	TotalInputsCount      int                 `json:"total_inputs_count"`
	TotalInputsCostGRAM   float64             `json:"total_inputs_cost_gram"`
	TotalInputsCostUSD    float64             `json:"total_inputs_cost_usd"`
	SuccessProbability    float64             `json:"success_probability_pct"` // e.g. 75.0%
	ExpectedOutputGRAM    float64             `json:"expected_output_gram"`
	ExpectedOutputUSD     float64             `json:"expected_output_usd"`
	CraftingFeeStars      int                 `json:"crafting_fee_stars"`
	CraftingFeeGRAM       float64             `json:"crafting_fee_gram"`
	NetEVGRAM             float64             `json:"net_ev_gram"` // Net Expected Value
	NetEVUSD              float64             `json:"net_ev_usd"`
	ROIPercent            float64             `json:"roi_percent"`
	Recommendation        string              `json:"recommendation"` // "YES", "RISKY", "NO"
	VerdictSummaryEn      string              `json:"verdict_summary_en"`
	VerdictSummaryFa      string              `json:"verdict_summary_fa"`
	DistributionP10       float64             `json:"distribution_p10_gram"`
	DistributionP50       float64             `json:"distribution_p50_gram"`
	DistributionP90       float64             `json:"distribution_p90_gram"`
	FormulaBreakdown      []FormulaTerm       `json:"formula_breakdown"`
	BurnWarningNotice     string              `json:"burn_warning_notice"`
	LockWarning           string              `json:"lock_warning,omitempty"`
	SimulatedIterations   int                 `json:"simulated_iterations"`
}

// FormulaTerm explains each step of the calculation
type FormulaTerm struct {
	TermName    string  `json:"term_name"`
	Value       string  `json:"value"`
	Description string  `json:"description"`
}

// OptimalCraftCombo is a recommended inventory combination
type OptimalCraftCombo struct {
	InputGiftIDs []string `json:"input_gift_ids"`
	InputNames   []string `json:"input_names"`
	CombinedCost float64  `json:"combined_cost_gram"`
	SuccessRate  float64  `json:"success_rate_pct"`
	ExpectedEV   float64  `json:"expected_ev_gram"`
	ROI          float64  `json:"roi_pct"`
}

// CalculateCraftingEV runs a deterministic 10,000-iteration Monte Carlo simulation
func CalculateCraftingEV(ctx context.Context, inputs []CraftInputItem, gramUsdRate float64, fixedSeed int64) (*CraftingEVResult, error) {
	if len(inputs) == 0 {
		return nil, fmt.Errorf("at least 1 input gift required")
	}
	if len(inputs) > 4 {
		return nil, fmt.Errorf("maximum 4 input gifts allowed per Telegram crafting rule")
	}

	if gramUsdRate <= 0 {
		gramUsdRate = 5.50
	}

	// 1. Calculate input burn cost & aggregate success chance
	totalCostGRAM := 0.0
	totalChancePermille := 0
	lockWarning := ""
	now := time.Now()

	for _, item := range inputs {
		totalCostGRAM += item.EstimatedValueGRAM
		totalChancePermille += item.CraftChancePermille
		if item.CanCraftAt != nil && item.CanCraftAt.After(now) {
			lockWarning = fmt.Sprintf("Gift %s is locked from crafting until %s", item.GiftID, item.CanCraftAt.Format(time.RFC3339))
		}
	}

	if totalChancePermille > 1000 {
		totalChancePermille = 1000 // Cap at 100%
	}
	pSuccess := float64(totalChancePermille) / 1000.0

	// Crafting fee in Stars (500 Stars ~ 2.5 GRAM)
	craftingFeeStars := 500
	craftingFeeGRAM := 2.50

	// 2. Monte Carlo Simulation (10,000 runs)
	iterations := 10000
	var r *rand.Rand
	if fixedSeed != 0 {
		r = rand.New(rand.NewSource(fixedSeed))
	} else {
		r = rand.New(rand.NewSource(time.Now().UnixNano()))
	}

	outcomes := make([]float64, iterations)
	// Base target tier multiplier if crafting succeeds (average 1.8x to 3.5x boost from persistence)
	potentialOutcomeBase := (totalCostGRAM * 1.65) + 30.0

	sumOutputs := 0.0
	for i := 0; i < iterations; i++ {
		roll := r.Float64()
		if roll <= pSuccess {
			// Successful craft roll: simulate attribute tier inheritance
			rarityVariance := 0.85 + (r.Float64() * 0.70) // 0.85x to 1.55x
			val := potentialOutcomeBase * rarityVariance
			outcomes[i] = val
			sumOutputs += val
		} else {
			// Failed craft: inputs are BURNED, output value is 0
			outcomes[i] = 0.0
		}
	}

	sort.Float64s(outcomes)
	p10 := outcomes[int(float64(iterations)*0.10)]
	p50 := outcomes[int(float64(iterations)*0.50)]
	p90 := outcomes[int(float64(iterations)*0.90)]

	expectedOutput := sumOutputs / float64(iterations)
	netEV := expectedOutput - totalCostGRAM - craftingFeeGRAM
	roi := 0.0
	if totalCostGRAM > 0 {
		roi = (netEV / totalCostGRAM) * 100.0
	}

	// 3. Recommendation logic
	recommendation := "NO"
	summaryEn := "Negative Expected Value. You are losing capital on average due to burn risk."
	summaryFa := "ارزش انتظاری (EV) منفی است. به دلیل خطر سوختن ورودی‌ها، در میانگین متضرر خواهید شد."

	if netEV > 0 && pSuccess >= 0.65 {
		recommendation = "YES"
		summaryEn = "Strong Positive EV with high success probability. Crafting is statistically favorable."
		summaryFa = "ارزش انتظاری مثبت قوی با شانس موفقیت بالا. کرفت کردن از نظر آماری کاملاً سودده است."
	} else if netEV > 0 {
		recommendation = "RISKY"
		summaryEn = "Positive EV but high variance (burn risk). Only proceed if you can absorb the downside."
		summaryFa = "ارزش انتظاری مثبت است اما ریسک سوختن بالاست. فقط در صورت توان تحمل ضرر کامل اقدام کنید."
	}

	formulaTerms := []FormulaTerm{
		{
			TermName:    "Total Inputs Value (Σ V_inputs)",
			Value:       fmt.Sprintf("%.2f GRAM ($%.2f)", totalCostGRAM, totalCostGRAM*gramUsdRate),
			Description: "Market value of all items submitted to the crafting forge",
		},
		{
			TermName:    "Success Probability (P_success)",
			Value:       fmt.Sprintf("%.1f%% (%d/1000 permille)", pSuccess*100.0, totalChancePermille),
			Description: "Aggregated roll probability from official craft_chance_permille attributes",
		},
		{
			TermName:    "Expected Output (E[V_output])",
			Value:       fmt.Sprintf("%.2f GRAM ($%.2f)", expectedOutput, expectedOutput*gramUsdRate),
			Description: "Probability-weighted yield across 10,000 Monte Carlo simulations",
		},
		{
			TermName:    "Crafting Network Fee",
			Value:       fmt.Sprintf("%d Stars (~%.2f GRAM)", craftingFeeStars, craftingFeeGRAM),
			Description: "Telegram smart contract execution and burning fee",
		},
		{
			TermName:    "Net Expected Value (Net EV)",
			Value:       fmt.Sprintf("%+.2f GRAM (%+.1f%% ROI)", netEV, roi),
			Description: "E[V_output] - Σ V_inputs - Fees",
		},
	}

	return &CraftingEVResult{
		TotalInputsCount:    len(inputs),
		TotalInputsCostGRAM: roundPrice(totalCostGRAM),
		TotalInputsCostUSD:  roundPrice(totalCostGRAM * gramUsdRate),
		SuccessProbability:  pSuccess * 100.0,
		ExpectedOutputGRAM:  roundPrice(expectedOutput),
		ExpectedOutputUSD:   roundPrice(expectedOutput * gramUsdRate),
		CraftingFeeStars:    craftingFeeStars,
		CraftingFeeGRAM:     craftingFeeGRAM,
		NetEVGRAM:           roundPrice(netEV),
		NetEVUSD:            roundPrice(netEV * gramUsdRate),
		ROIPercent:          roundPrice(roi),
		Recommendation:      recommendation,
		VerdictSummaryEn:    summaryEn,
		VerdictSummaryFa:    summaryFa,
		DistributionP10:     roundPrice(p10),
		DistributionP50:     roundPrice(p50),
		DistributionP90:     roundPrice(p90),
		FormulaBreakdown:    formulaTerms,
		BurnWarningNotice:   "⚠️ CRITICAL: All input gifts are irreversibly BURNED on both success and failure.",
		LockWarning:         lockWarning,
		SimulatedIterations: iterations,
	}, nil
}

// FindOptimalInventoryCombos performs local search across user inventory combinations (<=4 items)
func FindOptimalInventoryCombos(inventory []CraftInputItem, gramUsdRate float64) []OptimalCraftCombo {
	if len(inventory) == 0 {
		return []OptimalCraftCombo{}
	}

	bestCombos := make([]OptimalCraftCombo, 0)
	n := len(inventory)
	if n > 8 {
		n = 8 // limit search space
	}

	// Helper to evaluate a combo
	eval := func(subset []CraftInputItem) {
		res, err := CalculateCraftingEV(context.Background(), subset, gramUsdRate, 42)
		if err == nil && res.NetEVGRAM > 0 {
			ids := make([]string, len(subset))
			names := make([]string, len(subset))
			for i, s := range subset {
				ids[i] = s.GiftID
				names[i] = s.Name
			}
			bestCombos = append(bestCombos, OptimalCraftCombo{
				InputGiftIDs: ids,
				InputNames:   names,
				CombinedCost: res.TotalInputsCostGRAM,
				SuccessRate:  res.SuccessProbability,
				ExpectedEV:   res.NetEVGRAM,
				ROI:          res.ROIPercent,
			})
		}
	}

	// 1-item, 2-item, 3-item, 4-item combinations
	for i := 0; i < n; i++ {
		eval([]CraftInputItem{inventory[i]})
		for j := i + 1; j < n; j++ {
			eval([]CraftInputItem{inventory[i], inventory[j]})
			for k := j + 1; k < n; k++ {
				eval([]CraftInputItem{inventory[i], inventory[j], inventory[k]})
				for l := k + 1; l < n; l++ {
					eval([]CraftInputItem{inventory[i], inventory[j], inventory[k], inventory[l]})
				}
			}
		}
	}

	sort.Slice(bestCombos, func(i, j int) bool {
		return bestCombos[i].ExpectedEV > bestCombos[j].ExpectedEV
	})

	if len(bestCombos) > 3 {
		bestCombos = bestCombos[:3]
	}

	return bestCombos
}

func roundPrice(v float64) float64 {
	return math.Round(v*100.0) / 100.0
}
