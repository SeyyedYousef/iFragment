package intelcredit

import (
	"context"
	"time"

	"github.com/google/uuid"
	"ifragment-backend/internal/repository"
)

type IntelCreditService struct {
	repo *repository.IntelCreditRepo
}

func NewIntelCreditService(db *repository.Database) *IntelCreditService {
	return &IntelCreditService{
		repo: repository.NewIntelCreditRepo(db),
	}
}

func (s *IntelCreditService) GetBalance(ctx context.Context, userID int64) (*repository.IntelCreditBalance, error) {
	return s.repo.GetUserBalance(ctx, userID)
}

func (s *IntelCreditService) ConsumeCredit(ctx context.Context, userID int64, reason, entity, idemKey string) (int, error) {
	return s.repo.ConsumeCreditFIFO(ctx, userID, reason, entity, idemKey)
}

func (s *IntelCreditService) GrantCredits(ctx context.Context, userID int64, kind string, amount int, source, referenceID string, expiresAt *time.Time) (uuid.UUID, error) {
	return s.repo.GrantCredits(ctx, userID, kind, amount, source, referenceID, expiresAt)
}

func (s *IntelCreditService) RefundCredit(ctx context.Context, userID int64, reason, entity string) error {
	return s.repo.RefundCredit(ctx, userID, reason, entity)
}
