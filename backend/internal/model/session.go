package model

import (
	"time"

	"github.com/google/uuid"
)

type Session struct {
	ID uuid.UUID
	TenantID uuid.UUID
	TokenHash string
	CreatedAt time.Time
	ExpiresAt time.Time
	RevokedAt *time.Time
}