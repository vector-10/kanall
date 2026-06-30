package model

import (
	"time"

	"github.com/google/uuid"
)



type ProcessedEvent struct {
	RequestID          string
	TransactionGroupID uuid.UUID
	ProcessedAt        time.Time
}
