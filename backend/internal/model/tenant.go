package model

import (
	"time"

	"github.com/google/uuid"
)


type Tenant struct {
	ID                     uuid.UUID
	Name                   string
	Email                  *string
	APIKeyHash             string
	APIKeySuffix           *string
	PasswordHash           *string
	Status                 string
	BusinessType           *string
	CACNumber              *string
	KYCStatus              string
	KYCSubmittedAt         *time.Time
	WebhookSecretEncrypted *string
	WebhookURL             *string
	CreatedAt              time.Time
	UpdatedAt              time.Time
}
