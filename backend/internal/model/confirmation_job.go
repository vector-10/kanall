package model

import (
	"time"

	"github.com/google/uuid"
)

type ConfirmationJob struct {
	ID                 uuid.UUID
	TenantID           uuid.UUID
	NombaTxnRef        string
	TransactionGroupID uuid.UUID
	Status             string
	AttemptCount       int
	LastError          *string
	NextRetryAt        time.Time
	CreatedAt          time.Time
}
