package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)



type VirtualAccount struct {
	ID                uuid.UUID
	TenantID          uuid.UUID
	CustomerID        uuid.UUID
	AccountRef        string
	Provider          string
	BankAccountNumber *string
	BankAccountName   *string
	BankName          *string
	Currency          string
	Status            string
	CallbackURL       *string
	ExpectedAmount    *decimal.Decimal
	CreatedAt         time.Time
	UpdatedAt         time.Time
}
