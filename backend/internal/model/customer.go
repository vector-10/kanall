package model

import (
	"time"

	"github.com/google/uuid"
)

type Customer struct {
	ID                   uuid.UUID
	TenantID             uuid.UUID
	ExternalRef          string
	Name                 string
	BVNEncrypted         *string
	BVNLast4             *string
	NINEncrypted         *string
	NINDocumentEncrypted *string
	NINLast4             *string
	KYCTier              int
	KYCStatus            string
	Status               string
	CreatedAt            time.Time
	UpdatedAt            time.Time
}
