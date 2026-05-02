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

type PremiumReport struct {
	Username    string            `json:"username"`
	Status      fragment.Status   `json:"status"`
	OnChainData map[string]interface{} `json:"on_chain"`
	Score       int               `json:"rarity_score"`
	GeneratedAt time.Time         `json:"generated_at"`
}

func (s *ReportService) GenerateDeepReport(ctx context.Context, username string) (*PremiumReport, error) {
	// 1. Check Cache first
	if s.cache != nil {
		val, err := s.cache.Client.Get(ctx, "report:"+username).Result()
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
		s.cache.Client.Set(ctx, "report:"+username, data, 24*time.Hour)
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
	// Simple rarity logic for now
	length := len(u)
	score := 100
	if length < 5 {
		score += 500
	} else if length < 8 {
		score += 200
	}
	// Add more logic later
	return score
}
