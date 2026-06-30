package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vector-10/kanall/internal/crypto"
	"github.com/vector-10/kanall/internal/repository"
)

var (
	ErrInvalidOTP    = errors.New("invalid or expired verification code")
	ErrAlreadyActive = errors.New("account is already verified")
)

type VerificationService struct {
	store *repository.Store
}

func NewVerificationService(store *repository.Store) *VerificationService {
	return &VerificationService{store: store}
}

type VerifyResult struct {
	APIKey string
}

func (s *VerificationService) VerifyEmail(ctx context.Context, tenantID uuid.UUID, otp string) (*VerifyResult, error) {
	tenant, err := s.store.Tenants.GetByID(ctx, tenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidOTP
		}
		return nil, fmt.Errorf("tenant lookup failed: %w", err)
	}
	if tenant.Status == "active" {
		return nil, ErrAlreadyActive
	}

	ev, err := s.store.EmailVerifications.GetPending(ctx, tenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidOTP
		}
		return nil, fmt.Errorf("verification lookup failed: %w", err)
	}

	if crypto.HashAPIKey(otp) != ev.OTPHash {
		return nil, ErrInvalidOTP
	}

	if err := s.store.EmailVerifications.MarkVerified(ctx, ev.ID); err != nil {
		return nil, fmt.Errorf("failed to mark OTP verified: %w", err)
	}

	rawKey, keyHash, err := GenerateAPIKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate API key: %w", err)
	}

	suffix := rawKey[len(rawKey)-4:]
	if err := s.store.Tenants.Activate(ctx, tenantID, keyHash, suffix); err != nil {
		return nil, fmt.Errorf("failed to activate tenant: %w", err)
	}

	return &VerifyResult{APIKey: rawKey}, nil
}
