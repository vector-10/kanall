package model

import (
	"time"

	"github.com/google/uuid"
)

type WebhookEvent struct {
	ID              uuid.UUID
	NombaTxnRef     *string
	PayloadRaw      []byte // raw JSON, scanned from JSONB
	SignatureValid  bool
	Status          string
	ErrorMessage    *string
	RetryCount      int
	ReceivedAt      time.Time
	ProcessedAt     *time.Time
}
