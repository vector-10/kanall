package model

import (
	"time"

	"github.com/google/uuid"
)

type AccountStateLog struct {
	ID               uuid.UUID
	VirtualAccountID uuid.UUID
	FromStatus       *string
	ToStatus         string
	Reason           *string
	CreatedAt        time.Time
}
