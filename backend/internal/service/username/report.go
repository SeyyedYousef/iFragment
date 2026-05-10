package username

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/fragment"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"time"
)

type ReportService struct {
	db             *repository.Database
	cache          *repository.Cache
	tonClient      *tonapi.Client
	fragmentClient *fragment.Client
}

func NewReportService(db *repository.Database, cache *repository.Cache, ton *tonapi.Client, frag *fragment.Client) *ReportService {
	return &ReportService{
		db:             db,
		cache:          cache,
		tonClient:      ton,
		fragmentClient: frag,
	}
}

func (s *ReportService) CheckPayment(ctx context.Context, userID int64, username string) (bool, error) {
	if s.db == nil {
		return false, fmt.Errorf("database not available")
	}
	return s.db.HasPaidForReport(ctx, userID, username)
}

type PremiumReport struct {
	Username    string            `json:"username"`
	Status      fragment.Status   `json:"status"`
	OnChainData map[string]interface{} `json:"on_chain"`
	Score       int               `json:"rarity_score"`
	GeneratedAt time.Time         `json:"generated_at"`
}

func (s *ReportService) GenerateDeepReport(ctx context.Context, userID int64, username string) (*PremiumReport, error) {
	// 1. Check Cache first (Patch 3: User-Scoped)
	if s.cache != nil {
		cacheKey := fmt.Sprintf("report:%d:%s", userID, username)
		val, err := s.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var cachedReport PremiumReport
			if json.Unmarshal([]byte(val), &cachedReport) == nil {
				return &cachedReport, nil
			}
		}
	}

	// 2. Fetch Data
	status, err := s.fragmentClient.CheckUsername(username)
	if err != nil {
		return nil, err
	}

	// 3. Generate Mock/Deep Data (In Phase C we'll make this even deeper)
	report := &PremiumReport{
		Username: username,
		Status:   status,
		OnChainData: map[string]interface{}{
			"collection": "Usernames",
			"market":     "Fragment",
		},
		Score:       CalculateRarity(username),
		GeneratedAt: time.Now(),
	}

	// 4. Save to Cache (24h TTL)
	if s.cache != nil {
		data, _ := json.Marshal(report)
		cacheKey := fmt.Sprintf("report:%d:%s", userID, username)
		s.cache.Client.Set(ctx, cacheKey, data, 24*time.Hour)
	}

	return report, nil
}

func (s *ReportService) GetUserHistory(ctx context.Context, userID int64) ([]repository.DBReport, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not available")
	}
	return s.db.GetUserReports(ctx, userID)
}

func (s *ReportService) SaveReportToDB(ctx context.Context, userID int64, username string, report *PremiumReport) {
	if s.db != nil {
		// Async save to not block response
		go s.db.SaveReport(context.Background(), userID, username, report)
	}
}

func CalculateRarity(u string) int {
	// 2026-Ready Rarity Algorithm
	score := 0
	length := len(u)

	// 1. Length Factor (Shorter is much rarer)
	if length == 4 {
		score += 2000
	} else if length == 5 {
		score += 1000
	} else if length <= 7 {
		score += 500
	} else if length <= 10 {
		score += 200
	}

	// 2. Pattern Factor
	isNumeric := true
	for _, char := range u {
		if char < '0' || char > '9' {
			isNumeric = false
			break
		}
	}
	if isNumeric {
		score += 800 // Pure numeric handles are rare
	}

	// 3. Character Diversity (Fewer unique characters = rarer)
	uniqueChars := make(map[rune]bool)
	for _, char := range u {
		uniqueChars[char] = true
	}
	if len(uniqueChars) <= 3 {
		score += 1200 // Patterns like 'aaaa', 'abab'
	} else if len(uniqueChars) <= 5 {
		score += 400
	}

	// 4. No Underscores Bonus
	if !containsUnderscore(u) {
		score += 300
	}

	// Normalizing to 0-1000 range or higher
	return score
}

func containsUnderscore(u string) bool {
	for _, c := range u {
		if c == '_' {
			return true
		}
	}
	return false
}
