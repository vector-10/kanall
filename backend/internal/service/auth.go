package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vector-10/kanall/internal/crypto"
	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrAccountSuspended   = errors.New("account suspended")
)

const sessionDuration = 7 * 24 * time.Hour

type AuthService struct {
	store *repository.Store
}

func NewAuthService(store *repository.Store) *AuthService {
	return &AuthService{store: store}
}

func (s *AuthService) Login(ctx context.Context, email, password string) (string, error) {
	tenant, err := s.store.Tenants.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrInvalidCredentials
		}
		return "", fmt.Errorf("lookup failed: %w", err)
	}

	if tenant.PasswordHash == nil {
		return "", ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*tenant.PasswordHash), []byte(password)); err != nil {
		return "", ErrInvalidCredentials
	}

	if tenant.Status == "pending_verification" {
		return "", ErrInvalidCredentials
	}
	if tenant.Status == "suspended" {
		return "", ErrAccountSuspended
	}

	return s.createSession(ctx, tenant.ID)
}

func (s *AuthService) CreateSession(ctx context.Context, tenantID uuid.UUID) (string, error) {
	return s.createSession(ctx, tenantID)
}

func (s *AuthService) Logout(ctx context.Context, tokenHash string) error {
	return s.store.Sessions.Revoke(ctx, tokenHash)
}

func (s *AuthService) createSession(ctx context.Context, tenantID uuid.UUID) (string, error) {
	raw := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, raw); err != nil {
		return "", fmt.Errorf("failed to generate session token: %w", err)
	}
	rawToken := hex.EncodeToString(raw)

	session := &model.Session{
		ID:        uuid.New(),
		TenantID:  tenantID,
		TokenHash: crypto.HashAPIKey(rawToken),
		ExpiresAt: time.Now().Add(sessionDuration),
	}

	if err := s.store.Sessions.Create(ctx, session); err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}

	return rawToken, nil
}
