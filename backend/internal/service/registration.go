package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vector-10/kanall/internal/crypto"
	"github.com/vector-10/kanall/internal/email"
	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

var ErrEmailTaken = errors.New("email already registered")

type RegistrationService struct {
	store  *repository.Store
	mailer email.Sender
}

func NewRegistrationService(store *repository.Store, mailer email.Sender) *RegistrationService {
	return &RegistrationService{store: store, mailer: mailer}
}

type RegisterInput struct {
	Name     string
	Email    string
	Password string
}

type RegisterResult struct {
	TenantID uuid.UUID
	Created  bool
}

func (s *RegistrationService) Register(ctx context.Context, input RegisterInput) (*RegisterResult, error) {
	existing, err := s.store.Tenants.GetByEmail(ctx, input.Email)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("failed to look up email: %w", err)
	}

	if existing != nil {
		if existing.Status == "active" {
			return nil, ErrEmailTaken
		}
		passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("failed to hash password: %w", err)
		}
		if err := s.store.Tenants.UpdatePending(ctx, existing.ID, input.Name, string(passwordHash)); err != nil {
			return nil, fmt.Errorf("failed to update pending tenant: %w", err)
		}
		if err := s.issueOTP(ctx, existing.ID, input.Name, input.Email); err != nil {
			return nil, err
		}
		return &RegisterResult{TenantID: existing.ID, Created: false}, nil
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}
	hash := string(passwordHash)
	inputEmail := input.Email

	tenant := &model.Tenant{
		ID:           uuid.New(),
		Name:         input.Name,
		Email:        &inputEmail,
		APIKeyHash:   "",
		PasswordHash: &hash,
		Status:       "pending_verification",
	}
	if err := s.store.Tenants.Create(ctx, tenant); err != nil {
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}
	if err := s.issueOTP(ctx, tenant.ID, input.Name, input.Email); err != nil {
		return nil, err
	}
	return &RegisterResult{TenantID: tenant.ID, Created: true}, nil
}

func (s *RegistrationService) issueOTP(ctx context.Context, tenantID uuid.UUID, name, toEmail string) error {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return fmt.Errorf("failed to generate OTP: %w", err)
	}
	otp := fmt.Sprintf("%06d", n.Int64())

	ev := &model.EmailVerification{
		ID:        uuid.New(),
		TenantID:  tenantID,
		OTPHash:   crypto.HashAPIKey(otp),
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}
	if err := s.store.EmailVerifications.Create(ctx, ev); err != nil {
		return fmt.Errorf("failed to store OTP: %w", err)
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		log.Printf("registration: sending OTP email to %s for tenant %s", toEmail, tenantID)
		html := email.OTPVerificationHTML(name, otp)
		if err := s.mailer.Send(ctx, email.Message{
			To:      toEmail,
			ToName:  name,
			Subject: "Your Kanall verification code",
			HTML:    html,
		}); err != nil {
			log.Printf("registration: OTP email FAILED for tenant %s: %v", tenantID, err)
			return
		}
		log.Printf("registration: OTP email sent OK to %s", toEmail)
	}()

	return nil
}

func GenerateAPIKey() (raw, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Reader.Read(b); err != nil {
		return
	}
	raw = hex.EncodeToString(b)
	hash = crypto.HashAPIKey(raw)
	return
}
