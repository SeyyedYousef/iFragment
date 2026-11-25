package cardgen

import (
	"bytes"
	"image/png"
	"math"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func buildSampleRecapTicks(open, close float64, n int, bullish bool) []DailyRecapTick {
	base := time.Date(2026, 11, 24, 0, 0, 0, 0, time.UTC)
	ticks := make([]DailyRecapTick, n)
	for i := 0; i < n; i++ {
		frac := float64(i) / float64(n-1)
		trend := open + (close-open)*frac
		envelope := math.Sin(frac * math.Pi)
		wave := (math.Sin(frac*math.Pi*3.5)*0.15 + math.Cos(frac*math.Pi*6.5)*0.05) * envelope
		if !bullish {
			wave = -wave
		}
		p := trend + wave
		if i == 0 {
			p = open
		}
		if i == n-1 {
			p = close
		}
		ticks[i] = DailyRecapTick{
			Price:     math.Round(p*1000) / 1000,
			Timestamp: base.Add(time.Duration(i*10) * time.Minute),
		}
	}
	return ticks
}

func TestGenerateDailyRecapCard_BullishBearishAndFlat(t *testing.T) {
	cg := NewCardGenerator()

	cases := []struct {
		name   string
		params DailyRecapCardParams
	}{
		{
			name: "Bullish Day With Streak And 7D",
			params: DailyRecapCardParams{
				DateLabel:     "24 NOV 2026",
				ChannelHandle: "@TheGramPrice",
				OpenPrice:     5.17,
				HighPrice:     5.56,
				HighTimeUTC:   "18:40",
				LowPrice:      5.08,
				LowTimeUTC:    "04:10",
				ClosePrice:    5.42,
				AvgPrice:      5.34,
				NetChange:     0.25,
				PctChange:     4.835,
				SpreadPct:     9.45,
				RangePosPct:   70.83,
				TicksCount:    144,
				Has7DChange:   true,
				Change7DPct:   11.42,
				StreakDays:    3,
				Ticks:         buildSampleRecapTicks(5.17, 5.42, 144, true),
			},
		},
		{
			name: "Bearish Day",
			params: DailyRecapCardParams{
				DateLabel:     "24 NOV 2026",
				ChannelHandle: "@TheGramPrice",
				OpenPrice:     5.42,
				HighPrice:     5.51,
				HighTimeUTC:   "02:20",
				LowPrice:      5.01,
				LowTimeUTC:    "21:10",
				ClosePrice:    5.12,
				AvgPrice:      5.24,
				NetChange:     -0.30,
				PctChange:     -5.535,
				SpreadPct:     9.98,
				RangePosPct:   22.0,
				TicksCount:    144,
				Has7DChange:   true,
				Change7DPct:   -3.85,
				StreakDays:    -2,
				Ticks:         buildSampleRecapTicks(5.42, 5.12, 144, false),
			},
		},
		{
			name: "Flat Single Tick Edge Case",
			params: DailyRecapCardParams{
				DateLabel:     "24 NOV 2026",
				ChannelHandle: "@TheGramPrice",
				OpenPrice:     3.25,
				HighPrice:     3.25,
				HighTimeUTC:   "00:00",
				LowPrice:      3.25,
				LowTimeUTC:    "00:00",
				ClosePrice:    3.25,
				AvgPrice:      3.25,
				NetChange:     0,
				PctChange:     0,
				SpreadPct:     0,
				RangePosPct:   50,
				TicksCount:    1,
				Ticks: []DailyRecapTick{
					{Price: 3.25, Timestamp: time.Date(2026, 11, 24, 0, 0, 0, 0, time.UTC)},
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := cg.GenerateDailyRecapCard(tc.params)
			if err != nil {
				t.Fatalf("GenerateDailyRecapCard failed: %v", err)
			}
			img, err := png.Decode(bytes.NewReader(data))
			if err != nil {
				t.Fatalf("invalid PNG output: %v", err)
			}
			if img.Bounds().Dx() != 1200 || img.Bounds().Dy() != 900 {
				t.Fatalf("expected 1200x900, got %dx%d", img.Bounds().Dx(), img.Bounds().Dy())
			}
		})
	}
}

func TestExportDailyRecapSamples(t *testing.T) {
	outDir := os.Getenv("IFR_EXPORT_RECAP_SAMPLES")
	if outDir == "" {
		return
	}
	cg := NewCardGenerator()
	if err := os.MkdirAll(outDir, 0755); err != nil {
		t.Fatal(err)
	}

	bullTicks := buildSampleRecapTicks(5.17, 5.42, 144, true)
	highP, lowP := bullTicks[0].Price, bullTicks[0].Price
	highT, lowT := bullTicks[0].Timestamp, bullTicks[0].Timestamp
	sum := 0.0
	for _, tk := range bullTicks {
		sum += tk.Price
		if tk.Price > highP {
			highP = tk.Price
			highT = tk.Timestamp
		}
		if tk.Price < lowP {
			lowP = tk.Price
			lowT = tk.Timestamp
		}
	}

	bullData, err := cg.GenerateDailyRecapCard(DailyRecapCardParams{
		DateLabel:     "24 NOV 2026",
		ChannelHandle: "@TheGramPrice",
		OpenPrice:     bullTicks[0].Price,
		HighPrice:     highP,
		HighTimeUTC:   highT.Format("15:04"),
		LowPrice:      lowP,
		LowTimeUTC:    lowT.Format("15:04"),
		ClosePrice:    bullTicks[len(bullTicks)-1].Price,
		AvgPrice:      sum / float64(len(bullTicks)),
		NetChange:     bullTicks[len(bullTicks)-1].Price - bullTicks[0].Price,
		PctChange:     ((bullTicks[len(bullTicks)-1].Price - bullTicks[0].Price) / bullTicks[0].Price) * 100,
		SpreadPct:     ((highP - lowP) / lowP) * 100,
		RangePosPct:   ((bullTicks[len(bullTicks)-1].Price - lowP) / (highP - lowP)) * 100,
		TicksCount:    len(bullTicks),
		Has7DChange:   true,
		Change7DPct:   11.42,
		StreakDays:    3,
		Ticks:         bullTicks,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outDir, "daily_recap_bullish.png"), bullData, 0644); err != nil {
		t.Fatal(err)
	}

	bearTicks := buildSampleRecapTicks(5.42, 5.08, 144, false)
	highP, lowP = bearTicks[0].Price, bearTicks[0].Price
	highT, lowT = bearTicks[0].Timestamp, bearTicks[0].Timestamp
	sum = 0.0
	for _, tk := range bearTicks {
		sum += tk.Price
		if tk.Price > highP {
			highP = tk.Price
			highT = tk.Timestamp
		}
		if tk.Price < lowP {
			lowP = tk.Price
			lowT = tk.Timestamp
		}
	}

	bearData, err := cg.GenerateDailyRecapCard(DailyRecapCardParams{
		DateLabel:     "24 NOV 2026",
		ChannelHandle: "@TheGramPrice",
		OpenPrice:     bearTicks[0].Price,
		HighPrice:     highP,
		HighTimeUTC:   highT.Format("15:04"),
		LowPrice:      lowP,
		LowTimeUTC:    lowT.Format("15:04"),
		ClosePrice:    bearTicks[len(bearTicks)-1].Price,
		AvgPrice:      sum / float64(len(bearTicks)),
		NetChange:     bearTicks[len(bearTicks)-1].Price - bearTicks[0].Price,
		PctChange:     ((bearTicks[len(bearTicks)-1].Price - bearTicks[0].Price) / bearTicks[0].Price) * 100,
		SpreadPct:     ((highP - lowP) / lowP) * 100,
		RangePosPct:   ((bearTicks[len(bearTicks)-1].Price - lowP) / (highP - lowP)) * 100,
		TicksCount:    len(bearTicks),
		Has7DChange:   true,
		Change7DPct:   -4.18,
		StreakDays:    -2,
		Ticks:         bearTicks,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outDir, "daily_recap_bearish.png"), bearData, 0644); err != nil {
		t.Fatal(err)
	}
}
