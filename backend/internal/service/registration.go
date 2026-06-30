package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/vector-10/kanall/internal/crypto"
	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

var ErrEmailTaken = errors.New("email already registered")

type RegistrationService struct {
	store *repository.Store
}

func NewRegistrationService(store *repository.Store) *RegistrationService {
	return &RegistrationService{store: store}
}

type RegisterInput struct {
	Name  string
	Email string
	Password string
}

type RegisterResult struct {
	TenantID uuid.UUID
	APIKey   string 
}

func (s *RegistrationService) Register(ctx context.Context, input RegisterInput) (*RegisterResult, error) {
	raw := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, raw); err != nil {
		return nil, fmt.Errorf("failed to generate api key: %w", err)
	}
	rawKey := hex.EncodeToString(raw)

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}
	hash := string(passwordHash)

	email := input.Email
	tenant := &model.Tenant{
		ID:           uuid.New(),
		Name:         input.Name,
		Email:        &email,
		APIKeyHash:   crypto.HashAPIKey(rawKey),
		PasswordHash: &hash,
		Status:       "active",
	}

	if err := s.store.Tenants.Create(ctx, tenant); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrEmailTaken
		}
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}

	return &RegisterResult{TenantID: tenant.ID, APIKey: rawKey}, nil
}
