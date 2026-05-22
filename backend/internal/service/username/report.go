package username

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/fragment"
	"ifragment-backend/internal/client/marketapp"
	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"log/slog"
	"math"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"golang.org/x/sync/singleflight"
)

//go:embed words.txt
var wordsData string

var englishWords map[string]bool

func init() {
	englishWords = make(map[string]bool)
	lines := strings.Split(wordsData, "\n")
	for _, line := range lines {
		word := strings.TrimSpace(strings.ToLower(line))
		if word != "" {
			englishWords[word] = true
		}
	}
	// Add critical custom/tech/crypto/brand names
	extra := []string{"auto", "bank", "bitcoin", "boss", "crypto", "ethereum", "money", "news", "pavel", "solana", "tesla", "wallet", "blockchain", "apple"}
	for _, w := range extra {
		englishWords[w] = true
	}
}

type RarityConfig struct {
	Length4Bonus      int
	Length5Bonus      int
	Length6to7Bonus   int
	Length8to10Bonus  int
	LengthOtherBonus  int
	NumericBonus      int
	Unique3Bonus      int
	Unique5Bonus      int
	NoUnderscoreBonus int
	DictionaryBonus   int
}

var DefaultRarityConfig = RarityConfig{
	Length4Bonus:      5000,
	Length5Bonus:      1000,
	Length6to7Bonus:   500,
	Length8to10Bonus:  200,
	LengthOtherBonus:  50,
	NumericBonus:      1000,
	Unique3Bonus:      1200,
	Unique5Bonus:      400,
	NoUnderscoreBonus: 300,
	DictionaryBonus:   2000,
}

type ReportTask struct {
	UserID   int64
	Username string
	Report   *FullReport
}

type ReportService struct {
	db              *repository.Database
	cache           *repository.Cache
	tonClient       *tonapi.Client
	fragmentClient  *fragment.Client
	marketappClient *marketapp.Client
	mtprotoClient   mtproto.Client
	saveQueue       chan ReportTask
	rarityConfig    RarityConfig
	pricingClient   *PricingClient
	sfGroup         singleflight.Group
}

func NewReportService(
	db *repository.Database,
	cache *repository.Cache,
	ton *tonapi.Client,
	frag *fragment.Client,
	mapp *marketapp.Client,
	mtp mtproto.Client,
) *ReportService {
	s := &ReportService{
		db:              db,
		cache:           cache,
		tonClient:       ton,
		fragmentClient:  frag,
		marketappClient: mapp,
		mtprotoClient:   mtp,
		saveQueue:       make(chan ReportTask, 1000),
		rarityConfig:    DefaultRarityConfig,
		pricingClient:   NewPricingClientFromEnv(),
	}
	go s.worker()
	return s
}

type OwnerWalletCache struct {
	Balance     float64 `json:"balance"`
	OtherAssets int     `json:"other_assets"`
}

type PriceEstimate struct {
	P10        float64  `json:"p10_ton"`
	P50        float64  `json:"p50_ton"`
	P90        float64  `json:"p90_ton"`
	Confidence float64  `json:"confidence"`
	Method     string   `json:"method"`
	Signals    []string `json:"signals,omitempty"`
}

func (s *ReportService) getCachedSearchPopularity(ctx context.Context, username string) (int, error) {
	if s.db == nil {
		return 0, fmt.Errorf("database not available")
	}

	cacheKey := fmt.Sprintf("popularity:%s", username)
	if s.cache != nil {
		val, err := s.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var count int
			if _, err := fmt.Sscanf(val, "%d", &count); err == nil {
				return count, nil
			}
		}
	}

	pop, err := s.db.GetSearchPopularity(ctx, username)
	if err != nil {
		return 0, err
	}

	if s.cache != nil {
		s.cache.Client.Set(ctx, cacheKey, fmt.Sprintf("%d", pop), 5*time.Minute)
	}

	return pop, nil
}

func (s *ReportService) worker() {
	for task := range s.saveQueue {
		var err error
		for i := 0; i < 3; i++ {
			err = s.db.SaveReport(context.Background(), task.UserID, task.Username, string(task.Report.Status), task.Report.RarityScore, task.Report)
			if err == nil {
				break
			}
			time.Sleep(time.Second * time.Duration(i+1))
		}
		if err != nil {
			slog.Error("Failed to save report after retries", "user_id", task.UserID, "error", err)
		}
	}
}

// ── Full Report Structure (Section 13, Category 2) ──

type FullReport struct {
	// ─ Text Analysis ─
	Username         string `json:"username"`
	Length           int    `json:"length"`
	ContainsNumbers  bool   `json:"contains_numbers"`
	IsDictionaryWord bool   `json:"is_dictionary_word"`

	// ─ Telegram Status ─
	Status   string `json:"status"`    // available, taken, on_auction, on_sale, purchase_available
	PeerType string `json:"peer_type"` // user, channel, bot, unknown

	// ─ Verification ─
	IsVerified bool `json:"is_verified"`
	IsPremium  bool `json:"is_premium"`
	IsScam     bool `json:"is_scam"`
	IsFake     bool `json:"is_fake"`

	// ─ Channel/Group ─
	ParticipantsCount int `json:"participants_count,omitempty"`

	// ─ Ownership ─
	OwnerAddress string `json:"owner_address,omitempty"`

	// ─ Sale Info ─
	SaleStatus  string  `json:"sale_status"` // not_for_sale, on_auction, on_sale
	HighestBid  float64 `json:"highest_bid,omitempty"`
	BuyNowPrice float64 `json:"buy_now_price,omitempty"`
	EndTime     string  `json:"end_time,omitempty"`

	// ─ History ─
	MintDate       string                 `json:"mint_date,omitempty"`
	PreviousOwners []string               `json:"previous_owners,omitempty"`
	PastSales      []marketapp.SaleRecord `json:"past_sales,omitempty"`

	// ─ Wallet Intel ─
	OwnerWalletBalance float64 `json:"owner_wallet_balance,omitempty"` // in TON
	OwnerOtherAssets   int     `json:"owner_other_assets,omitempty"`   // count of other username NFTs

	// ─ iFragment Analytics ─
	RarityScore      int            `json:"rarity_score"`
	LinguisticScore  float64        `json:"linguistic_score"`
	EstimatedValue   float64        `json:"estimated_value,omitempty"` // in TON
	ValueEstimate    *PriceEstimate `json:"value_estimate,omitempty"`
	SearchPopularity int            `json:"search_popularity"`
	FragmentURL      string         `json:"fragment_url"`

	// ─ Meta ─
	ExchangeRate float64   `json:"exchange_rate,omitempty"`
	GeneratedAt  time.Time `json:"generated_at"`
}

// ── Quick Check (Free - used by ActionArea) ──

type QuickCheck struct {
	Username         string  `json:"username"`
	Status           string  `json:"status"`
	Length           int     `json:"length"`
	RarityScore      int     `json:"rarity_score"`
	SaleStatus       string  `json:"sale_status"`
	BuyNowPrice      float64 `json:"buy_now_price,omitempty"`
	HighestBid       float64 `json:"highest_bid,omitempty"`
	EndTime          string  `json:"end_time,omitempty"`
	FragmentURL      string  `json:"fragment_url"`
	SearchPopularity int     `json:"search_popularity"`
	LinguisticScore  float64 `json:"linguistic_score"`
}

func (s *ReportService) QuickAnalysis(ctx context.Context, username string, userID int64) (*QuickCheck, error) {
	// Log search
	if s.db != nil {
		go s.db.LogSearch(context.Background(), username, userID)
	}

	result := &QuickCheck{
		Username:        username,
		Length:          usernameLength(username),
		RarityScore:     s.CalculateRarity(username),
		FragmentURL:     fmt.Sprintf("https://fragment.com/username/%s", username),
		LinguisticScore: calculateLinguisticScore(username),
	}

	// Get search popularity
	if s.db != nil {
		pop, err := s.getCachedSearchPopularity(ctx, username)
		if err == nil {
			result.SearchPopularity = pop
		}
	}

	// Get market data from Marketapp
	if s.marketappClient != nil {
		item, err := s.marketappClient.GetItem(ctx, username)
		if err == nil && item != nil {
			result.SaleStatus = item.SaleStatus
			result.BuyNowPrice = item.BuyNowPrice
			result.HighestBid = item.HighestBid
			result.EndTime = item.EndTime
		} else {
			result.SaleStatus = "not_for_sale"
		}
	}

	return result, nil
}

// ── Deep Report (Premium) ──

func (s *ReportService) GenerateDeepReport(ctx context.Context, userID int64, username string) (*FullReport, error) {
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	cacheKey := fmt.Sprintf("report:%s", username)
	if s.cache != nil {
		val, err := s.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var cached FullReport
			if json.Unmarshal([]byte(val), &cached) == nil {
				return &cached, nil
			}
		}
	}

	val, err, _ := s.sfGroup.Do(cacheKey, func() (interface{}, error) {
		if s.cache != nil {
			val, err := s.cache.Client.Get(ctx, cacheKey).Result()
			if err == nil {
				var cached FullReport
				if json.Unmarshal([]byte(val), &cached) == nil {
					return &cached, nil
				}
			}
		}

		report, err := s.generateDeepReport(ctx, userID, username)
		if err != nil {
			return nil, err
		}
		if s.cache != nil {
			data, _ := json.Marshal(report)
			s.cache.Client.Set(ctx, cacheKey, data, 24*time.Hour)
		}
		return report, nil
	})
	if err != nil {
		return nil, err
	}
	return val.(*FullReport), nil
}

func (s *ReportService) generateDeepReport(ctx context.Context, userID int64, username string) (*FullReport, error) {

	rateUSD, _ := s.GetTONRate(ctx)

	report := &FullReport{
		Username:         username,
		Length:           usernameLength(username),
		ContainsNumbers:  containsNumbers(username),
		IsDictionaryWord: isDictionaryWord(username),
		RarityScore:      s.CalculateRarity(username),
		LinguisticScore:  calculateLinguisticScore(username),
		FragmentURL:      fmt.Sprintf("https://fragment.com/username/%s", username),
		GeneratedAt:      time.Now(),
		ExchangeRate:     rateUSD,
		SaleStatus:       "not_for_sale",
		PeerType:         "unknown",
		Status:           "unknown",
	}

	// Log search
	if s.db != nil {
		go s.db.LogSearch(ctx, username, userID)
	}

	// Search popularity
	if s.db != nil {
		pop, _ := s.getCachedSearchPopularity(ctx, username)
		report.SearchPopularity = pop
	}

	// Parallel data fetching
	var wg sync.WaitGroup
	var mu sync.Mutex

	// ─ MTProto Data ─
	wg.Add(1)
	go func() {
		defer wg.Done()
		if s.mtprotoClient == nil {
			return
		}

		// Check status
		status, err := s.mtprotoClient.CheckUsername(ctx, username)
		if err == nil {
			mu.Lock()
			switch status {
			case mtproto.StatusAvailable:
				report.Status = "available"
			case mtproto.StatusOccupied:
				report.Status = "taken"
			case mtproto.StatusPurchase:
				report.Status = "purchase_available"
			default:
				report.Status = string(status)
			}
			mu.Unlock()
		}

		// Resolve peer for extra info
		peer, err := s.mtprotoClient.ResolveUsername(ctx, username)
		if err == nil && peer != nil {
			mu.Lock()

			// Simplified: set peer type based on what we got
			if len(peer.Users) > 0 {
				report.PeerType = "user"
			} else if len(peer.Chats) > 0 {
				report.PeerType = "channel"
			}
			mu.Unlock()
		}
	}()

	// ─ Marketapp Data ─
	wg.Add(1)
	go func() {
		defer wg.Done()
		if s.marketappClient == nil {
			return
		}

		item, err := s.marketappClient.GetItem(ctx, username)
		if err != nil || item == nil {
			return
		}

		mu.Lock()
		report.SaleStatus = item.SaleStatus
		report.HighestBid = item.HighestBid
		report.BuyNowPrice = item.BuyNowPrice
		report.EndTime = item.EndTime
		report.MintDate = item.MintDate
		report.PastSales = item.PastSales
		report.PreviousOwners = item.PreviousOwners
		if item.OwnerAddress != "" {
			report.OwnerAddress = item.OwnerAddress
		}
		mu.Unlock()
	}()

	// ─ TON Blockchain Data ─
	wg.Add(1)
	go func() {
		defer wg.Done()
		if s.tonClient == nil {
			return
		}

		// Resolve direct DNS for validation / verification
		dnsResolve, dnsErr := s.tonClient.ResolveDNS(ctx, username+".t.me")
		if dnsErr == nil && dnsResolve != nil && dnsResolve.Wallet.Address != "" {
			mu.Lock()
			report.OwnerAddress = dnsResolve.Wallet.Address
			mu.Unlock()
		}

		nft, err := s.tonClient.GetNFTByDNS(ctx, username)
		if err != nil || nft == nil {
			return
		}

		mu.Lock()
		if nft.Owner.Address != "" {
			report.OwnerAddress = nft.Owner.Address
		}
		if nft.Sale != nil {
			if report.SaleStatus == "not_for_sale" || report.SaleStatus == "" {
				report.SaleStatus = "on_sale"
			}
		}
		mu.Unlock()

		// Fetch transfers and history
		transfers, trErr := s.tonClient.GetNFTTransfers(ctx, nft.Address)
		if trErr == nil && transfers != nil {
			var tonapiOwners []string
			for _, tr := range transfers.Transfers {
				if tr.From.Address != "" {
					tonapiOwners = append(tonapiOwners, tr.From.Address)
				}
			}

			mu.Lock()
			if len(report.PreviousOwners) == 0 && len(tonapiOwners) > 0 {
				report.PreviousOwners = tonapiOwners
			}
			// If we don't have sales from marketapp/fragment, map them from transfers
			if len(report.PastSales) == 0 {
				for _, tr := range transfers.Transfers {
					report.PastSales = append(report.PastSales, marketapp.SaleRecord{
						Price: 0.0,
						Date:  time.Unix(tr.Timestamp, 0).Format(time.RFC3339),
						From:  tr.From.Address,
						To:    tr.To.Address,
					})
				}
			}
			mu.Unlock()
		}

		// Get wallet info for the owner
		if nft.Owner.Address != "" {
			ownerAddr := nft.Owner.Address
			var cachedData *OwnerWalletCache
			cacheKey := fmt.Sprintf("owner:%s", ownerAddr)

			if s.cache != nil {
				val, err := s.cache.Client.Get(ctx, cacheKey).Result()
				if err == nil {
					var cached OwnerWalletCache
					if json.Unmarshal([]byte(val), &cached) == nil {
						cachedData = &cached
					}
				}
			}

			if cachedData != nil {
				mu.Lock()
				report.OwnerWalletBalance = cachedData.Balance
				report.OwnerOtherAssets = cachedData.OtherAssets
				mu.Unlock()
			} else {
				var balance float64
				var otherAssets int

				walletInfo, err := s.tonClient.GetWalletInfo(ctx, ownerAddr)
				if err == nil && walletInfo != nil {
					balance = float64(walletInfo.Balance) / 1e9 // nanoTON to TON
				}

				otherNFTs, err := s.tonClient.GetOwnerNFTs(ctx, ownerAddr)
				if err == nil && otherNFTs != nil {
					otherAssets = len(otherNFTs.Items) - 1 // Exclude this one
					if otherAssets < 0 {
						otherAssets = 0
					}
				}

				mu.Lock()
				report.OwnerWalletBalance = balance
				report.OwnerOtherAssets = otherAssets
				mu.Unlock()

				// Cache the retrieved values in Redis
				if s.cache != nil {
					cData := OwnerWalletCache{
						Balance:     balance,
						OtherAssets: otherAssets,
					}
					cBytes, err := json.Marshal(cData)
					if err == nil {
						s.cache.Client.Set(ctx, cacheKey, cBytes, 1*time.Hour)
					}
				}
			}
		}
	}()

	// ─ Fragment Status ─
	wg.Add(1)
	go func() {
		defer wg.Done()
		if s.fragmentClient == nil {
			return
		}
		fragStatus, err := s.fragmentClient.CheckUsername(ctx, username)
		if err != nil {
			return
		}
		mu.Lock()
		switch fragStatus {
		case fragment.StatusAuction:
			report.SaleStatus = "on_auction"
			if report.Status == "unknown" {
				report.Status = "on_auction"
			}
		case fragment.StatusSale:
			report.SaleStatus = "on_sale"
			if report.Status == "unknown" {
				report.Status = "on_sale"
			}
		case fragment.StatusAvailable:
			if report.Status == "unknown" {
				report.Status = "available"
			}
		case fragment.StatusSold:
			if report.Status == "unknown" {
				report.Status = "taken"
			}
		}
		mu.Unlock()
	}()

	wg.Wait()

	// ─ Estimated Value (AI/Algorithm) ─
	report.ValueEstimate = s.estimateValue(ctx, report)
	report.EstimatedValue = report.ValueEstimate.P50

	return report, nil
}

func (s *ReportService) CheckPayment(ctx context.Context, userID int64, username string) (bool, error) {
	if s.db == nil {
		return false, fmt.Errorf("database not available")
	}
	return s.db.HasPaidForReport(ctx, userID, username)
}

func (s *ReportService) GetUserHistory(ctx context.Context, userID int64) ([]repository.DBReport, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not available")
	}
	return s.db.GetUserReports(ctx, userID)
}

func (s *ReportService) SaveReportToDB(ctx context.Context, userID int64, username string, report *FullReport) {
	if s.db != nil {
		select {
		case s.saveQueue <- ReportTask{UserID: userID, Username: username, Report: report}:
		case <-time.After(2 * time.Second):
			slog.Warn("Dropping report save task because queue is full", "user_id", userID, "username", username)
		case <-ctx.Done():
			slog.Warn("Dropping report save task because request ended", "user_id", userID, "username", username)
		}
	}
}

// ── Utility Functions ──

func containsNumbers(u string) bool {
	for _, c := range u {
		if c >= '0' && c <= '9' {
			return true
		}
	}
	return false
}

func isDictionaryWord(u string) bool {
	lower := strings.ToLower(u)
	return englishWords[lower]
}

func calculateLinguisticScore(u string) float64 {
	vowels := "aeiou"
	consonants := "bcdfghjklmnpqrstvwxyz"
	var vowelCount, consonantCount int

	lower := strings.ToLower(u)
	for _, c := range lower {
		if strings.ContainsRune(vowels, c) {
			vowelCount++
		} else if strings.ContainsRune(consonants, c) {
			consonantCount++
		}
	}

	total := vowelCount + consonantCount
	if total == 0 {
		return 0
	}

	// Ideal ratio is ~40% vowels for pronounceability
	vowelRatio := float64(vowelCount) / float64(total)
	idealRatio := 0.40

	// Score: 100 = perfectly pronounceable
	diff := vowelRatio - idealRatio
	if diff < 0 {
		diff = -diff
	}
	score := (1 - diff*2.5) * 100
	if score < 0 {
		score = 0
	}

	// Bonus for starting with uppercase-friendly letter
	if first, ok := firstRune(u); ok && unicode.IsLetter(first) {
		score += 5
	}

	// Penalty for underscores
	if strings.Contains(u, "_") {
		score -= 15
	}

	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}

	return score
}

func estimateValue(r *FullReport) *PriceEstimate {
	var value float64
	var signals []string

	// Base value from rarity
	value = float64(r.RarityScore) * 0.5

	// Length premium
	switch {
	case r.Length == 4:
		value += 500
		value *= 2.2
		signals = append(signals, "short_4_char")
	case r.Length == 5:
		value += 100
		value *= 1.45
		signals = append(signals, "short_5_char")
	case r.Length <= 7:
		value += 30
	case r.Length <= 10:
		value += 10
	}

	// Dictionary word premium
	if r.IsDictionaryWord {
		value *= dictionaryPremium(r.Username)
		signals = append(signals, "dictionary_word")
	}

	// Linguistic bonus
	if r.LinguisticScore > 70 {
		value *= 1.15 + (r.LinguisticScore-70)/200
		signals = append(signals, "pronounceable")
	}

	if isBrandLikeKeyword(r.Username) {
		value *= 3.5
		signals = append(signals, "brand_keyword")
	}
	if isHighValueMarketKeyword(r.Username) {
		value *= 2.4
		signals = append(signals, "market_keyword")
	}
	if r.SearchPopularity > 0 {
		value *= 1 + math.Min(math.Log1p(float64(r.SearchPopularity))/18, 0.7)
		signals = append(signals, "search_popularity")
	}
	if r.ParticipantsCount > 0 {
		value *= 1 + math.Min(math.Log1p(float64(r.ParticipantsCount))/24, 0.5)
		signals = append(signals, "telegram_audience")
	}
	if r.OwnerWalletBalance > 0 {
		value *= 1 + math.Min(math.Log1p(r.OwnerWalletBalance)/40, 0.35)
		signals = append(signals, "owner_wallet_depth")
	}
	if r.OwnerOtherAssets > 0 {
		value *= 1 + math.Min(math.Log1p(float64(r.OwnerOtherAssets))/30, 0.25)
		signals = append(signals, "owner_collection_depth")
	}
	if len(r.PreviousOwners) > 0 {
		value *= 1 + math.Min(float64(len(r.PreviousOwners))*0.025, 0.25)
		signals = append(signals, "transfer_history")
	}

	// If there are paid past sales, use the median as the market anchor.
	if medianSale, ok := medianPositiveSale(r.PastSales); ok {
		value = medianSale*0.75 + value*0.25
		signals = append(signals, "past_sales_median")
	}

	// If on auction and has bids, use highest bid as floor
	if r.SaleStatus == "on_auction" && r.HighestBid > value {
		value = r.HighestBid * 1.1
		signals = append(signals, "auction_bid_floor")
	}

	// If buy now price exists, cap estimate below it
	if r.BuyNowPrice > 0 && value > r.BuyNowPrice*0.9 {
		value = r.BuyNowPrice * 0.85
		signals = append(signals, "buy_now_cap")
	}

	confidence := estimateConfidence(r)
	spread := 0.75 - confidence*0.35
	p10 := value * (1 - spread)
	p90 := value * (1 + spread*1.6)
	if r.BuyNowPrice > 0 && p90 > r.BuyNowPrice {
		p90 = r.BuyNowPrice
	}
	if p10 < 0 {
		p10 = 0
	}

	return &PriceEstimate{
		P10:        roundTON(p10),
		P50:        roundTON(value),
		P90:        roundTON(p90),
		Confidence: roundConfidence(confidence),
		Method:     "heuristic_v2_feature_weighted",
		Signals:    signals,
	}
}

func (s *ReportService) estimateValue(ctx context.Context, r *FullReport) *PriceEstimate {
	features := buildPricingFeatures(r)
	if s.pricingClient != nil {
		estimate, err := s.pricingClient.Predict(ctx, features)
		if err == nil && isUsablePriceEstimate(estimate) {
			if estimate.Method == "" {
				estimate.Method = "ml_external"
			}
			estimate.Signals = append([]string{"external_model", features.FeatureVersion}, estimate.Signals...)
			return estimate
		}
		slog.Warn("pricing model unavailable; falling back to heuristic", "username", r.Username, "error", err)
	}

	estimate := estimateValue(r)
	estimate.Signals = append([]string{features.FeatureVersion}, estimate.Signals...)
	return estimate
}

func (s *ReportService) CalculateRarity(u string) int {
	score := 0
	length := usernameLength(u)

	if length == 4 {
		score += s.rarityConfig.Length4Bonus
	} else if length == 5 {
		score += s.rarityConfig.Length5Bonus
	} else if length <= 7 {
		score += s.rarityConfig.Length6to7Bonus
	} else if length <= 10 {
		score += s.rarityConfig.Length8to10Bonus
	} else {
		score += s.rarityConfig.LengthOtherBonus
	}

	isNumeric := true
	for _, char := range u {
		if char < '0' || char > '9' {
			isNumeric = false
			break
		}
	}
	if isNumeric {
		score += s.rarityConfig.NumericBonus
	}

	uniqueChars := make(map[rune]bool)
	for _, char := range u {
		uniqueChars[char] = true
	}
	if len(uniqueChars) <= 3 {
		score += s.rarityConfig.Unique3Bonus
	} else if len(uniqueChars) <= 5 {
		score += s.rarityConfig.Unique5Bonus
	}

	if !strings.Contains(u, "_") {
		score += s.rarityConfig.NoUnderscoreBonus
	}

	if isDictionaryWord(u) {
		score += s.rarityConfig.DictionaryBonus
	}

	return score
}

func usernameLength(u string) int {
	return utf8.RuneCountInString(u)
}

func firstRune(u string) (rune, bool) {
	r, size := utf8.DecodeRuneInString(u)
	return r, size > 0 && r != utf8.RuneError
}

func dictionaryPremium(u string) float64 {
	switch {
	case isHighValueMarketKeyword(u):
		return 5.0
	case usernameLength(u) <= 5:
		return 4.2
	default:
		return 3.0
	}
}

func isBrandLikeKeyword(u string) bool {
	brands := map[string]bool{
		"apple":  true,
		"amazon": true,
		"bank":   true,
		"boss":   true,
		"google": true,
		"meta":   true,
		"nike":   true,
		"pavel":  true,
		"tesla":  true,
		"visa":   true,
	}
	return brands[strings.ToLower(u)]
}

func isHighValueMarketKeyword(u string) bool {
	keywords := map[string]bool{
		"auto":    true,
		"bitcoin": true,
		"cars":    true,
		"casino":  true,
		"crypto":  true,
		"money":   true,
		"news":    true,
		"nft":     true,
		"ton":     true,
		"wallet":  true,
	}
	return keywords[strings.ToLower(u)]
}

func medianPositiveSale(sales []marketapp.SaleRecord) (float64, bool) {
	prices := make([]float64, 0, len(sales))
	for _, sale := range sales {
		if sale.Price > 0 {
			prices = append(prices, sale.Price)
		}
	}
	if len(prices) == 0 {
		return 0, false
	}
	sort.Float64s(prices)
	mid := len(prices) / 2
	if len(prices)%2 == 1 {
		return prices[mid], true
	}
	return (prices[mid-1] + prices[mid]) / 2, true
}

func estimateConfidence(r *FullReport) float64 {
	confidence := 0.25
	if _, ok := medianPositiveSale(r.PastSales); ok {
		confidence += 0.35
	}
	if r.BuyNowPrice > 0 || r.HighestBid > 0 {
		confidence += 0.18
	}
	if r.SearchPopularity > 0 {
		confidence += 0.08
	}
	if r.OwnerWalletBalance > 0 || r.OwnerOtherAssets > 0 {
		confidence += 0.08
	}
	if r.ExchangeRate > 0 {
		confidence += 0.04
	}
	if confidence > 0.9 {
		return 0.9
	}
	return confidence
}

func roundTON(v float64) float64 {
	return math.Round(v*100) / 100
}

func roundConfidence(v float64) float64 {
	return math.Round(v*100) / 100
}

// GetTONRate fetches the current TON to USD exchange rate from TonAPI with caching
func (s *ReportService) GetTONRate(ctx context.Context) (float64, error) {
	cacheKey := "ton_rate_usd"
	if s.cache != nil {
		val, err := s.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var price float64
			if _, err := fmt.Sscanf(val, "%f", &price); err == nil {
				return price, nil
			}
		}
	}

	if s.tonClient == nil {
		return 7.25, nil
	}

	price, err := s.tonClient.GetTONRates(ctx)
	if err != nil {
		// Return a fallback price
		return 7.25, nil
	}

	if s.cache != nil {
		s.cache.Client.Set(ctx, cacheKey, fmt.Sprintf("%f", price), 5*time.Minute)
	}

	return price, nil
}
