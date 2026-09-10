package avm

import (
	"context"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/valuation/core"
	"github.com/shopspring/decimal"
)

// ModelCalibrationSummary encapsulates empirical backtesting accuracy metrics.
type ModelCalibrationSummary struct {
	ModelVersion        string    `json:"model_version"`
	EvaluatedAt         time.Time `json:"evaluated_at"`
	SampleSize          int       `json:"sample_size"`
	MeanAbsoluteError   float64   `json:"mean_absolute_error"`
	MedianAbsoluteError float64   `json:"median_absolute_error"`
	MedianErrorPct      float64   `json:"median_error_pct"`
	WithinBandPct       float64   `json:"within_band_pct"`
	UncertaintyMult     float64   `json:"uncertainty_mult"`
	CalibrationNote     string    `json:"calibration_note"`
}

var (
	calibrationMu    sync.RWMutex
	lastCalibration  *ModelCalibrationSummary
	lastCalibratedAt time.Time
)

// GetCalibratedConfidenceScore maps raw heuristic confidence (0-100) into an empirically calibrated probability.
// Generates an auditable calibration note summarizing post-valuation evaluation accuracy.
func GetCalibratedConfidenceScore(rawScore int16, sampleSize int) (int16, string) {
	return core.GetCalibratedConfidenceScore(rawScore, sampleSize, "AVM v7.0")
}

// ComputeAdaptiveUncertainty adjusts the uncertainty multiplier based on measured within-band accuracy.
func ComputeAdaptiveUncertainty(currentMult float64, withinBandPct float64) (newMult float64, changed bool, reason string) {
	return core.ComputeAdaptiveUncertainty(currentMult, withinBandPct)
}

// RunModelCalibration executes the backtest loop against the database to measure accuracy.
func RunModelCalibration(ctx context.Context, db *repository.Database, modelVersion string) (*ModelCalibrationSummary, error) {
	now := time.Now().UTC()
	if db == nil {
		return &ModelCalibrationSummary{
			ModelVersion:        modelVersion,
			EvaluatedAt:         now,
			SampleSize:          0,
			MeanAbsoluteError:   0,
			MedianAbsoluteError: 0,
			MedianErrorPct:      0,
			WithinBandPct:       0,
			UncertaintyMult:     1.5,
			CalibrationNote:     "Database unavailable; model uncalibrated",
		}, nil
	}

	points, err := db.GetBacktestPoints(ctx, modelVersion, 1000)
	if err != nil || len(points) == 0 {
		return &ModelCalibrationSummary{
			ModelVersion:        modelVersion,
			EvaluatedAt:         now,
			SampleSize:          0,
			MeanAbsoluteError:   0,
			MedianAbsoluteError: 0,
			MedianErrorPct:      0,
			WithinBandPct:       0,
			UncertaintyMult:     1.5,
			CalibrationNote:     "Insufficient backtest data; model uncalibrated",
		}, nil
	}

	var withinCount int
	var totalAbsDiff float64
	absDiffs := make([]float64, len(points))
	pctErrors := make([]float64, len(points))

	for i, pt := range points {
		if pt.WithinBand {
			withinCount++
		}
		diff := math.Abs(pt.PredictedTON - pt.ActualTON)
		totalAbsDiff += diff
		absDiffs[i] = diff

		if pt.ActualTON > 0 {
			pctErrors[i] = diff / pt.ActualTON * 100.0
		}
	}

	meanAbsError := totalAbsDiff / float64(len(points))

	sort.Float64s(absDiffs)
	medianAbsError := absDiffs[len(absDiffs)/2]

	medianPctError := 20.0
	if len(pctErrors) > 0 {
		sort.Float64s(pctErrors)
		medianPctError = pctErrors[len(pctErrors)/2]
	}
	withinBandPct := (float64(withinCount) / float64(len(points))) * 100.0

	summary := &ModelCalibrationSummary{
		ModelVersion:        modelVersion,
		EvaluatedAt:         now,
		SampleSize:          len(points),
		MeanAbsoluteError:   math.Round(meanAbsError*100) / 100,
		MedianAbsoluteError: math.Round(medianAbsError*100) / 100,
		MedianErrorPct:      math.Round(medianPctError*10) / 10,
		WithinBandPct:       math.Round(withinBandPct*10) / 10,
		UncertaintyMult:     1.5,
		CalibrationNote:     fmt.Sprintf("Empirical calibration across %d historical post-valuation sales (MAE: %.2f TON, Within Band: %.1f%%)", len(points), meanAbsError, withinBandPct),
	}

	// Persist snapshot to database valuation_backtests table
	backtestRecord := repository.ValuationBacktestRecord{
		ModelVersion:        modelVersion,
		HoldoutSampleSize:   len(points),
		MeanAbsoluteError:   decimal.NewFromFloat(summary.MeanAbsoluteError),
		MedianAbsoluteError: decimal.NewFromFloat(summary.MedianAbsoluteError),
		EvaluatedAt:         now,
	}
	_, _ = db.InsertValuationBacktest(ctx, backtestRecord)

	calibrationMu.Lock()
	lastCalibration = summary
	lastCalibratedAt = now
	calibrationMu.Unlock()

	return summary, nil
}
