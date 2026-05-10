package username

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/fragment"
	"ifragment-backend/internal/client/marketapp"
	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"log/slog"
	"strings"
	"sync"
	"time"
	"unicode"
)

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
	}
	go s.worker()
	return s
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
	Username       string `json:"username"`
	Length         int    `json:"length"`
	ContainsNumbers bool  `json:"contains_numbers"`
	IsDictionaryWord bool `json:"is_dictionary_word"`

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
	SaleStatus  string  `json:"sale_status"`  // not_for_sale, on_auction, on_sale
	HighestBid  float64 `json:"highest_bid,omitempty"`
	BuyNowPrice float64 `json:"buy_now_price,omitempty"`
	EndTime     string  `json:"end_time,omitempty"`

	// ─ History ─
	MintDate       string   `json:"mint_date,omitempty"`
	PreviousOwners []string `json:"previous_owners,omitempty"`
	PastSales      []marketapp.SaleRecord `json:"past_sales,omitempty"`

	// ─ Wallet Intel ─
	OwnerWalletBalance float64 `json:"owner_wallet_balance,omitempty"` // in TON
	OwnerOtherAssets   int     `json:"owner_other_assets,omitempty"`   // count of other username NFTs

	// ─ iFragment Analytics ─
	RarityScore      int     `json:"rarity_score"`
	LinguisticScore  float64 `json:"linguistic_score"`
	EstimatedValue   float64 `json:"estimated_value,omitempty"` // in TON
	SearchPopularity int     `json:"search_popularity"`
	FragmentURL      string  `json:"fragment_url"`

	// ─ Meta ─
	GeneratedAt time.Time `json:"generated_at"`
}

// ── Quick Check (Free - used by ActionArea) ──

type QuickCheck struct {
	Username    string  `json:"username"`
	Status      string  `json:"status"`
	Length      int     `json:"length"`
	RarityScore int     `json:"rarity_score"`
	SaleStatus  string  `json:"sale_status"`
	BuyNowPrice float64 `json:"buy_now_price,omitempty"`
	HighestBid  float64 `json:"highest_bid,omitempty"`
	EndTime     string  `json:"end_time,omitempty"`
	FragmentURL string  `json:"fragment_url"`
	SearchPopularity int `json:"search_popularity"`
	LinguisticScore float64 `json:"linguistic_score"`
}

func (s *ReportService) QuickAnalysis(ctx context.Context, username string, userID int64) (*QuickCheck, error) {
	// Log search
	if s.db != nil {
		go s.db.LogSearch(ctx, username, userID)
	}

	result := &QuickCheck{
		Username:    username,
		Length:      len(username),
		RarityScore: CalculateRarity(username),
		FragmentURL: fmt.Sprintf("https://fragment.com/username/%s", username),
		LinguisticScore: calculateLinguisticScore(username),
	}

	// Get search popularity
	if s.db != nil {
		pop, err := s.db.GetSearchPopularity(ctx, username)
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
	// 1. Check Cache
	if s.cache != nil {
		cacheKey := fmt.Sprintf("report:%d:%s", userID, username)
		val, err := s.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var cached FullReport
			if json.Unmarshal([]byte(val), &cached) == nil {
				return &cached, nil
			}
		}
	}

	report := &FullReport{
		Username:        username,
		Length:          len(username),
		ContainsNumbers: containsNumbers(username),
		IsDictionaryWord: isDictionaryWord(username),
		RarityScore:     CalculateRarity(username),
		LinguisticScore: calculateLinguisticScore(username),
		FragmentURL:     fmt.Sprintf("https://fragment.com/username/%s", username),
		GeneratedAt:     time.Now(),
		SaleStatus:      "not_for_sale",
		PeerType:        "unknown",
		Status:          "unknown",
	}

	// Log search
	if s.db != nil {
		go s.db.LogSearch(ctx, username, userID)
	}

	// Search popularity
	if s.db != nil {
		pop, _ := s.db.GetSearchPopularity(ctx, username)
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

		// Get wallet info for the owner
		if nft.Owner.Address != "" {
			walletInfo, err := s.tonClient.GetWalletInfo(ctx, nft.Owner.Address)
			if err == nil && walletInfo != nil {
				mu.Lock()
				report.OwnerWalletBalance = float64(walletInfo.Balance) / 1e9 // nanoTON to TON
				mu.Unlock()
			}

			// Get other assets owned by same wallet
			otherNFTs, err := s.tonClient.GetOwnerNFTs(ctx, nft.Owner.Address)
			if err == nil && otherNFTs != nil {
				mu.Lock()
				report.OwnerOtherAssets = len(otherNFTs.Items) - 1 // Exclude this one
				if report.OwnerOtherAssets < 0 {
					report.OwnerOtherAssets = 0
				}
				mu.Unlock()
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
	report.EstimatedValue = estimateValue(report)

	// Save to cache
	if s.cache != nil {
		data, _ := json.Marshal(report)
		cacheKey := fmt.Sprintf("report:%d:%s", userID, username)
		s.cache.Client.Set(ctx, cacheKey, data, 24*time.Hour)
	}

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
		default:
			go s.db.SaveReport(context.Background(), userID, username, report.Status, report.RarityScore, report)
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
	commonWords := []string{
		"bank", "news", "auto", "shop", "tech", "game", "love", "life", "home",
		"code", "data", "gold", "star", "moon", "fire", "king", "blue", "dark",
		"cool", "fast", "free", "rich", "work", "play", "mind", "soul", "meta",
		"cash", "coin", "swap", "deal", "sale", "fund", "boss", "lord", "hero",
		"club", "zone", "labs", "plus", "visa", "uber", "zoom", "link", "mail",
		"chat", "food", "wine", "beer", "cafe", "cars", "bike", "moto", "taxi",
	}
	lower := strings.ToLower(u)
	for _, w := range commonWords {
		if lower == w {
			return true
		}
	}
	return false
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
	if len(u) > 0 && unicode.IsLetter(rune(u[0])) {
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

func estimateValue(r *FullReport) float64 {
	var value float64

	// Base value from rarity
	value = float64(r.RarityScore) * 0.5

	// Length premium
	switch {
	case r.Length == 4:
		value += 500
	case r.Length == 5:
		value += 100
	case r.Length <= 7:
		value += 30
	case r.Length <= 10:
		value += 10
	}

	// Dictionary word premium
	if r.IsDictionaryWord {
		value *= 3.0
	}

	// Linguistic bonus
	if r.LinguisticScore > 70 {
		value *= 1.5
	}

	// If there are past sales, use average as anchor
	if len(r.PastSales) > 0 {
		var total float64
		for _, s := range r.PastSales {
			total += s.Price
		}
		avgSale := total / float64(len(r.PastSales))
		// Weight: 70% market data, 30% our algorithm
		value = avgSale*0.7 + value*0.3
	}

	// If on auction and has bids, use highest bid as floor
	if r.SaleStatus == "on_auction" && r.HighestBid > value {
		value = r.HighestBid * 1.1
	}

	// If buy now price exists, cap estimate below it
	if r.BuyNowPrice > 0 && value > r.BuyNowPrice*0.9 {
		value = r.BuyNowPrice * 0.85
	}

	return value
}

func CalculateRarity(u string) int {
	score := 0
	length := len(u)

	if length == 4 {
		score += 5000
	} else if length == 5 {
		score += 1000
	} else if length <= 7 {
		score += 500
	} else if length <= 10 {
		score += 200
	} else {
		score += 50
	}

	isNumeric := true
	for _, char := range u {
		if char < '0' || char > '9' {
			isNumeric = false
			break
		}
	}
	if isNumeric {
		score += 1000
	}

	uniqueChars := make(map[rune]bool)
	for _, char := range u {
		uniqueChars[char] = true
	}
	if len(uniqueChars) <= 3 {
		score += 1200
	} else if len(uniqueChars) <= 5 {
		score += 400
	}

	if !strings.Contains(u, "_") {
		score += 300
	}

	if isDictionaryWord(u) {
		score += 2000
	}

	return score
}
