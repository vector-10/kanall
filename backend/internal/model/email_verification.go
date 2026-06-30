package model

import (
	"time"

	"github.com/google/uuid"
)

type EmailVerification struct {
	ID         uuid.UUID
	TenantID   uuid.UUID
	OTPHash    string
	ExpiresAt  time.Time
	VerifiedAt *time.Time
	CreatedAt  time.Time
}
