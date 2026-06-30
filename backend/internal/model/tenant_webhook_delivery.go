package model

import (
	"time"

	"github.com/google/uuid"
)

type TenantWebhookDelivery struct {
	ID                 uuid.UUID
	TenantID           uuid.UUID
	TransactionGroupID uuid.UUID
	Payload            []byte
	CallbackURL        string
	Status             string
	AttemptCount       int
	LastError          *string
	NextRetryAt        *time.Time
	CreatedAt          time.Time
	DeliveredAt        *time.Time
}
