package service

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/provider"
	"github.com/vector-10/kanall/internal/repository"
)

var ErrInvalidTransition = errors.New("invalid state transition")

var validTransitions = map[string]map[string]bool{
	"active":    {"suspended": true, "expired": true},
	"suspended": {"active": true, "expired": true},
	"expired":   {},
}

type LifecycleService struct {
	store    *repository.Store
	provider provider.VirtualAccountProvider
}

func NewLifecycleService(store *repository.Store, p provider.VirtualAccountProvider) *LifecycleService {
	return &LifecycleService{store: store, provider: p}
}

func (s *LifecycleService) Transition(ctx context.Context, tenantID uuid.UUID, accountRef, toStatus string, reason *string) (*model.VirtualAccount, error) {
	va, err := s.store.Accounts.GetByAccountRef(ctx, tenantID, accountRef)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAccountNotFound
		}
		return nil, fmt.Errorf("account lookup: %w", err)
	}

	if !validTransitions[va.Status][toStatus] {
		return nil, fmt.Errorf("%w: %s → %s", ErrInvalidTransition, va.Status, toStatus)
	}

	if toStatus == "expired" {
		if err := s.provider.Expire(ctx, va.AccountRef); err != nil {
			log.Printf("lifecycle: nomba expire failed for %s: %v", accountRef, err)
		}
	}

	if err := s.store.Accounts.UpdateStatus(ctx, tenantID, accountRef, toStatus); err != nil {
		return nil, fmt.Errorf("status update: %w", err)
	}

	if err := s.store.Accounts.LogStateTransition(ctx, &model.AccountStateLog{
		ID:               uuid.New(),
		VirtualAccountID: va.ID,
		FromStatus:       &va.Status,
		ToStatus:         toStatus,
		Reason:           reason,
	}); err != nil {
		log.Printf("lifecycle: state log failed for %s: %v", accountRef, err)
	}

	va.Status = toStatus
	return va, nil
}
