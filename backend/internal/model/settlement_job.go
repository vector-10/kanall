package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type SettlementJob struct {
	ID                 uuid.UUID
	TenantID           uuid.UUID
	VirtualAccountID   uuid.UUID
	TransactionGroupID uuid.UUID
	MerchantTxRef      string
	AmountNaira        decimal.Decimal
	BankCode           string
	AccountNumber      string
	AccountName        string
	Narration          string
	Status             string
	AttemptCount       int
	LastError          *string
	NextRetryAt        *time.Time
	CreatedAt          time.Time
	UpdatedAt          time.Time
}
