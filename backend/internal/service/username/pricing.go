package username

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/marketapp"
	"math"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode"
)

const pricingFeatureVersion = "pricing_features_v1"

type PricingClient struct {
	baseURL string
	http    *http.Client
}

type PriceFeatures struct {
	FeatureVersion          string  `json:"feature_version"`
	Username                string  `json:"username"`
	Length                  int     `json:"length"`
	ContainsNumbers         bool    `json:"contains_numbers"`
	IsNumeric               bool    `json:"is_numeric"`
	HasUnderscore           bool    `json:"has_underscore"`
	NoUnderscore            bool    `json:"no_underscore"`
	UniqueCharCount         int     `json:"unique_char_count"`
	UniqueCharRatio         float64 `json:"unique_char_ratio"`
	RepeatedCharCount       int     `json:"repeated_char_count"`
	MaxRunLength            int     `json:"max_run_length"`
	VowelRatio              float64 `json:"vowel_ratio"`
	ConsonantRatio          float64 `json:"consonant_ratio"`
	DigitRatio              float64 `json:"digit_ratio"`
	UnderscoreRatio         float64 `json:"underscore_ratio"`
	CharEntropy             float64 `json:"char_entropy"`
	StartsWithVowel         bool    `json:"starts_with_vowel"`
	EndsWithConsonant       bool    `json:"ends_with_consonant"`
	HasRepeatedChars        bool    `json:"has_repeated_chars"`
	PalindromeScore         float64 `json:"palindrome_score"`
	IsDictionaryWord        bool    `json:"is_dictionary_word"`
	IsBrandKeyword          bool    `json:"is_brand_keyword"`
	IsMarketKeyword         bool    `json:"is_market_keyword"`
	RarityScore             int     `json:"rarity_score"`
	LinguisticScore         float64 `json:"linguistic_score"`
	SearchPopularity        int     `json:"search_popularity"`
	ParticipantsCount       int     `json:"participants_count"`
	OwnerWalletBalanceTON   float64 `json:"owner_wallet_balance_ton"`
	OwnerOtherAssets        int     `json:"owner_other_assets"`
	PreviousOwnersCount     int     `json:"previous_owners_count"`
	PaidSalesCount          int     `json:"paid_sales_count"`
	AverageSaleTON          float64 `json:"average_sale_ton"`
	MedianSaleTON           float64 `json:"median_sale_ton"`
	HighestPastSaleTON      float64 `json:"highest_past_sale_ton"`
	DaysSinceLastPaidSale   float64 `json:"days_since_last_paid_sale"`
	MintAgeDays             float64 `json:"mint_age_days"`
	IsOnAuction             bool    `json:"is_on_auction"`
	IsOnSale                bool    `json:"is_on_sale"`
	HighestBidTON           float64 `json:"highest_bid_ton"`
	BuyNowPriceTON          float64 `json:"buy_now_price_ton"`
	TONUSDRate              float64 `json:"ton_usd_rate"`
	EstimatedLiquidityScore float64 `json:"estimated_liquidity_score"`
}

type pricingPredictionRequest struct {
	Features PriceFeatures `json:"features"`
}

func NewPricingClientFromEnv() *PricingClient {
	baseURL := strings.TrimSpace(os.Getenv("IFRAGMENT_PRICING_MODEL_URL"))
	if baseURL == "" {
		return nil
	}
	return NewPricingClient(baseURL)
}

func NewPricingClient(baseURL string) *PricingClient {
	return &PricingClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		http: &http.Client{
			Timeout: 5 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 20,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

func (c *PricingClient) Predict(ctx context.Context, features PriceFeatures) (*PriceEstimate, error) {
	if c == nil || c.baseURL == "" {
		return nil, fmt.Errorf("pricing model URL is not configured")
	}

	endpoint, err := url.JoinPath(c.baseURL, "predict")
	if err != nil {
		return nil, fmt.Errorf("invalid pricing model URL: %w", err)
	}

	body, err := json.Marshal(pricingPredictionRequest{Features: features})
	if err != nil {
		return nil, fmt.Errorf("pricing request encode failed: %w", err)
	}

	maxAttempts := 3
	var lastErr error
	backoff := 100 * time.Millisecond

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		// Re-create the body reader for each attempt
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
		if err != nil {
			return nil, fmt.Errorf("pricing request create failed: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")

		resp, err := c.http.Do(req)
		if err == nil {
			if resp.StatusCode >= 200 && resp.StatusCode <= 299 {
				defer resp.Body.Close()
				var estimate PriceEstimate
				if err := json.NewDecoder(resp.Body).Decode(&estimate); err != nil {
					return nil, fmt.Errorf("pricing response decode failed: %w", err)
				}
				return &estimate, nil
			}
			resp.Body.Close()
			lastErr = fmt.Errorf("pricing model returned %s", resp.Status)
		} else {
			lastErr = err
		}

		if attempt < maxAttempts {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
				backoff *= 2
			}
		}
	}

	return nil, fmt.Errorf("pricing request failed after %d attempts: %w", maxAttempts, lastErr)
}

func buildPricingFeatures(r *FullReport) PriceFeatures {
	if r == nil {
		return PriceFeatures{}
	}
	text := analyzeUsernameText(r.Username)
	stats := paidSaleStats(r.PastSales)

	return PriceFeatures{
		FeatureVersion:          pricingFeatureVersion,
		Username:                r.Username,
		Length:                  r.Length,
		ContainsNumbers:         r.ContainsNumbers,
		IsNumeric:               text.isNumeric,
		HasUnderscore:           text.hasUnderscore,
		NoUnderscore:            !text.hasUnderscore,
		UniqueCharCount:         text.uniqueCharCount,
		UniqueCharRatio:         roundFeature(text.uniqueCharRatio),
		RepeatedCharCount:       text.repeatedCharCount,
		MaxRunLength:            text.maxRunLength,
		VowelRatio:              roundFeature(text.vowelRatio),
		ConsonantRatio:          roundFeature(text.consonantRatio),
		DigitRatio:              roundFeature(text.digitRatio),
		UnderscoreRatio:         roundFeature(text.underscoreRatio),
		CharEntropy:             roundFeature(text.charEntropy),
		StartsWithVowel:         text.startsWithVowel,
		EndsWithConsonant:       text.endsWithConsonant,
		HasRepeatedChars:        text.repeatedCharCount > 0,
		PalindromeScore:         roundFeature(text.palindromeScore),
		IsDictionaryWord:        r.IsDictionaryWord,
		IsBrandKeyword:          isBrandLikeKeyword(r.Username),
		IsMarketKeyword:         isHighValueMarketKeyword(r.Username),
		RarityScore:             r.RarityScore,
		LinguisticScore:         roundFeature(r.LinguisticScore),
		SearchPopularity:        r.SearchPopularity,
		ParticipantsCount:       r.ParticipantsCount,
		OwnerWalletBalanceTON:   roundFeature(r.OwnerWalletBalance),
		OwnerOtherAssets:        r.OwnerOtherAssets,
		PreviousOwnersCount:     len(r.PreviousOwners),
		PaidSalesCount:          stats.count,
		AverageSaleTON:          roundFeature(stats.average),
		MedianSaleTON:           roundFeature(stats.median),
		HighestPastSaleTON:      roundFeature(stats.highest),
		DaysSinceLastPaidSale:   roundFeature(daysSince(stats.lastSaleAt)),
		MintAgeDays:             roundFeature(ageDays(r.MintDate)),
		IsOnAuction:             r.SaleStatus == "on_auction",
		IsOnSale:                r.SaleStatus == "on_sale",
		HighestBidTON:           r.HighestBid,
		BuyNowPriceTON:          r.BuyNowPrice,
		TONUSDRate:              r.ExchangeRate,
		EstimatedLiquidityScore: roundFeature(estimatedLiquidityScore(r, stats.count)),
	}
}

func isUsablePriceEstimate(estimate *PriceEstimate) bool {
	if estimate == nil {
		return false
	}
	if estimate.P10 < 0 || estimate.P50 <= 0 || estimate.P90 <= 0 {
		return false
	}
	if estimate.P10 > estimate.P50 || estimate.P50 > estimate.P90 {
		return false
	}
	return estimate.Confidence >= 0 && estimate.Confidence <= 1
}

type usernameTextStats struct {
	isNumeric         bool
	hasUnderscore     bool
	uniqueCharCount   int
	uniqueCharRatio   float64
	repeatedCharCount int
	maxRunLength      int
	vowelRatio        float64
	consonantRatio    float64
	digitRatio        float64
	underscoreRatio   float64
	charEntropy       float64
	startsWithVowel   bool
	endsWithConsonant bool
	palindromeScore   float64
}

func analyzeUsernameText(username string) usernameTextStats {
	lower := strings.ToLower(username)
	runes := []rune(lower)
	length := len(runes)
	if length == 0 {
		return usernameTextStats{}
	}

	counts := make(map[rune]int, length)
	var vowels, consonants, digits, underscores int
	isNumeric := true
	maxRun := 1
	currentRun := 1

	for i, r := range runes {
		counts[r]++
		switch {
		case r >= '0' && r <= '9':
			digits++
		default:
			isNumeric = false
		}
		if r == '_' {
			underscores++
		}
		if isASCIIVowel(r) {
			vowels++
		} else if r >= 'a' && r <= 'z' {
			consonants++
		}
		if i > 0 {
			if runes[i-1] == r {
				currentRun++
				if currentRun > maxRun {
					maxRun = currentRun
				}
			} else {
				currentRun = 1
			}
		}
	}

	var repeated int
	var entropy float64
	for _, count := range counts {
		if count > 1 {
			repeated += count - 1
		}
		p := float64(count) / float64(length)
		entropy -= p * math.Log2(p)
	}

	alphaTotal := vowels + consonants
	var vowelRatio, consonantRatio float64
	if alphaTotal > 0 {
		vowelRatio = float64(vowels) / float64(alphaTotal)
		consonantRatio = float64(consonants) / float64(alphaTotal)
	}

	return usernameTextStats{
		isNumeric:         isNumeric,
		hasUnderscore:     underscores > 0,
		uniqueCharCount:   len(counts),
		uniqueCharRatio:   float64(len(counts)) / float64(length),
		repeatedCharCount: repeated,
		maxRunLength:      maxRun,
		vowelRatio:        vowelRatio,
		consonantRatio:    consonantRatio,
		digitRatio:        float64(digits) / float64(length),
		underscoreRatio:   float64(underscores) / float64(length),
		charEntropy:       entropy,
		startsWithVowel:   isASCIIVowel(runes[0]),
		endsWithConsonant: isASCIIConsonant(runes[length-1]),
		palindromeScore:   palindromeScore(runes),
	}
}

type saleStats struct {
	count      int
	average    float64
	median     float64
	highest    float64
	lastSaleAt time.Time
}

func paidSaleStats(sales []marketapp.SaleRecord) saleStats {
	prices := make([]float64, 0, len(sales))
	var total, highest float64
	var lastSaleAt time.Time

	for _, sale := range sales {
		if sale.Price <= 1.0 {
			continue
		}
		prices = append(prices, sale.Price)
		total += sale.Price
		if sale.Price > highest {
			highest = sale.Price
		}
		if parsed, ok := parseMarketTime(sale.Date); ok && parsed.After(lastSaleAt) {
			lastSaleAt = parsed
		}
	}
	if len(prices) == 0 {
		return saleStats{}
	}

	median, _ := medianPositiveSale(sales)
	return saleStats{
		count:      len(prices),
		average:    total / float64(len(prices)),
		median:     median,
		highest:    highest,
		lastSaleAt: lastSaleAt,
	}
}

func estimatedLiquidityScore(r *FullReport, paidSalesCount int) float64 {
	if r == nil {
		return 0
	}
	// Fixed: Removed logarithmic dampening to allow linear scale up to 100
	score := (float64(r.SearchPopularity) * 0.5) + float64(paidSalesCount)*12 + float64(len(r.PreviousOwners))*4
	if r.BuyNowPrice > 0 || r.HighestBid > 0 {
		score += 15
	}
	if score > 100 {
		return 100
	}
	return score
}

func parseMarketTime(raw string) (time.Time, bool) {
	if raw == "" {
		return time.Time{}, false
	}
	formats := []string{time.RFC3339, "2006-01-02", "2006-01-02 15:04:05"}
	for _, format := range formats {
		if parsed, err := time.Parse(format, raw); err == nil {
			return parsed, true
		}
	}
	return time.Time{}, false
}

func ageDays(raw string) float64 {
	parsed, ok := parseMarketTime(raw)
	if !ok {
		return 0
	}
	return daysSince(parsed)
}

func daysSince(t time.Time) float64 {
	if t.IsZero() {
		return 0
	}
	days := time.Since(t).Hours() / 24
	if days < 0 {
		return 0
	}
	return days
}

func palindromeScore(runes []rune) float64 {
	if len(runes) == 0 {
		return 0
	}
	matches := 0
	for i := 0; i < len(runes)/2; i++ {
		if runes[i] == runes[len(runes)-1-i] {
			matches++
		}
	}
	if len(runes) == 1 {
		return 1
	}
	totalMatches := matches * 2
	if len(runes)%2 != 0 {
		totalMatches++
	}
	return float64(totalMatches) / float64(len(runes))
}

func isASCIIVowel(r rune) bool {
	return strings.ContainsRune("aeiou", unicode.ToLower(r))
}

func isASCIIConsonant(r rune) bool {
	r = unicode.ToLower(r)
	return r >= 'a' && r <= 'z' && !isASCIIVowel(r)
}

func roundFeature(v float64) float64 {
	return math.Round(v*10000) / 10000
}
