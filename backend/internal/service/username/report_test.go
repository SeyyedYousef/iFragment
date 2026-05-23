package username

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"ifragment-backend/internal/client/marketapp"
)

func TestUsernameLengthCountsRunes(t *testing.T) {
	if got := usernameLength("\u0627\u0628\u062c\u062d"); got != 4 {
		t.Fatalf("usernameLength() = %d, want 4", got)
	}
}

func TestCalculateRarityUsesRuneLength(t *testing.T) {
	service := NewReportService(context.Background(), nil, nil, nil, nil, nil, nil)
	got := service.CalculateRarity("\u0627\u0628\u062c\u062d")

	want := DefaultRarityConfig.Length4Bonus + DefaultRarityConfig.Unique5Bonus + DefaultRarityConfig.NoUnderscoreBonus
	if got != want {
		t.Fatalf("CalculateRarity() = %d, want %d", got, want)
	}
}

func TestEstimateValueUsesMarketAndReportSignals(t *testing.T) {
	report := &FullReport{
		Username:           "news",
		Length:             4,
		IsDictionaryWord:   true,
		RarityScore:        7700,
		LinguisticScore:    80,
		SearchPopularity:   1200,
		OwnerWalletBalance: 5000,
		OwnerOtherAssets:   12,
		PreviousOwners:     []string{"a", "b", "c"},
		PastSales: []marketapp.SaleRecord{
			{Price: 1000},
			{Price: 9000},
			{Price: 5000},
			{Price: 0},
		},
		ExchangeRate: 7.25,
	}

	estimate := estimateValue(report, DefaultPricingHeuristicsConfig)

	if estimate.P50 <= 5000 {
		t.Fatalf("P50 = %.2f, want market median and feature signals to lift value above 5000", estimate.P50)
	}
	if estimate.P10 <= 0 || estimate.P10 >= estimate.P50 || estimate.P90 <= estimate.P50 {
		t.Fatalf("invalid price interval: %+v", estimate)
	}
	if estimate.Confidence <= 0.6 {
		t.Fatalf("confidence = %.2f, want paid market data to increase confidence", estimate.Confidence)
	}
	if len(estimate.Signals) == 0 {
		t.Fatal("expected pricing signals")
	}
}

func TestEstimateValueIgnoresZeroPriceTransferHistoryAsSaleAnchor(t *testing.T) {
	report := &FullReport{
		Username:        "plain",
		Length:          5,
		RarityScore:     1700,
		LinguisticScore: 75,
		PastSales: []marketapp.SaleRecord{
			{Price: 0},
			{Price: 0},
		},
	}

	estimate := estimateValue(report, DefaultPricingHeuristicsConfig)

	if estimate.P50 == 0 {
		t.Fatal("zero-price transfer history should not collapse estimate to zero")
	}
	if estimate.Confidence >= 0.6 {
		t.Fatalf("confidence = %.2f, want no paid sales to keep confidence modest", estimate.Confidence)
	}
}

func TestBuildPricingFeaturesIncludesMarketTextAndOwnerSignals(t *testing.T) {
	report := &FullReport{
		Username:           "auto",
		Length:             4,
		ContainsNumbers:    false,
		IsDictionaryWord:   true,
		RarityScore:        7700,
		LinguisticScore:    80,
		SearchPopularity:   50,
		OwnerWalletBalance: 42,
		OwnerOtherAssets:   3,
		PreviousOwners:     []string{"a", "b"},
		MintDate:           "2025-01-01",
		PastSales: []marketapp.SaleRecord{
			{Price: 100, Date: "2025-02-01"},
			{Price: 300, Date: "2025-03-01"},
		},
		SaleStatus:   "on_sale",
		BuyNowPrice:  500,
		ExchangeRate: 7.25,
	}

	features := buildPricingFeatures(report)

	if features.FeatureVersion != pricingFeatureVersion {
		t.Fatalf("FeatureVersion = %q, want %q", features.FeatureVersion, pricingFeatureVersion)
	}
	if !features.IsMarketKeyword || features.MedianSaleTON != 200 || features.PaidSalesCount != 2 {
		t.Fatalf("unexpected market features: %+v", features)
	}
	if features.OwnerWalletBalanceTON != 42 || features.OwnerOtherAssets != 3 || features.EstimatedLiquidityScore <= 0 {
		t.Fatalf("unexpected owner/liquidity features: %+v", features)
	}
}

func TestReportServiceUsesExternalPricingModelWhenConfigured(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/predict" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		var req pricingPredictionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req.Features.Username != "news" {
			t.Fatalf("username = %q, want news", req.Features.Username)
		}
		json.NewEncoder(w).Encode(PriceEstimate{
			P10:        100,
			P50:        200,
			P90:        300,
			Confidence: 0.82,
			Method:     "xgboost_test",
		})
	}))
	defer server.Close()

	service := NewReportService(context.Background(), nil, nil, nil, nil, nil, nil)
	service.pricingClient = NewPricingClient(server.URL)

	estimate := service.estimateValue(context.Background(), &FullReport{
		Username:        "news",
		Length:          4,
		RarityScore:     7700,
		LinguisticScore: 80,
	})

	if estimate.Method != "xgboost_test" || estimate.P50 != 200 {
		t.Fatalf("unexpected estimate: %+v", estimate)
	}
}

func TestFindSimilarUsernamesReturnsRankedCandidates(t *testing.T) {
	service := NewReportService(context.Background(), nil, nil, nil, nil, nil, nil)

	results, err := service.FindSimilarUsernames(context.Background(), "news", 5)
	if err != nil {
		t.Fatalf("FindSimilarUsernames() error = %v", err)
	}
	if len(results) == 0 {
		t.Fatal("expected similar usernames")
	}
	if results[0].Username == "news" {
		t.Fatal("input username must not be returned")
	}
	for i := 1; i < len(results); i++ {
		if results[i].Score > results[i-1].Score {
			t.Fatalf("results are not sorted: %+v", results)
		}
	}
}
