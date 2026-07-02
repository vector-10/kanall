package model

import (
	"time"

	"github.com/google/uuid"
)

type WebhookEvent struct {
	ID             uuid.UUID
	NombaTxnRef    *string
	PayloadRaw     []byte
	SignatureValid bool
	Status         string
	Category       *string
	ErrorMessage   *string
	RetryCount     int
	ReceivedAt     time.Time
	ProcessedAt    *time.Time
}
