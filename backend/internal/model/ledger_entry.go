package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)


type LedgerEntry struct {
	ID                  uuid.UUID
	TenantID            uuid.UUID
	TransactionGroupID  uuid.UUID
	NombaTxnRef         string
	AccountType         string
	AccountID           uuid.UUID
	Direction           string
	Amount              decimal.Decimal
	Fee                 decimal.Decimal
	Currency            string
	Status              string
	ReversesGroupID     uuid.NullUUID
	Narration           *string
	CreatedAt           time.Time
}
