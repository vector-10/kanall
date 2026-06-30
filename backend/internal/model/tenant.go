package model

import (
	"time"

	"github.com/google/uuid"
)


type Tenant struct {
	ID           uuid.UUID
	Name         string
	Email        *string
	APIKeyHash   string
	APIKeySuffix *string
	PasswordHash *string
	Status       string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
