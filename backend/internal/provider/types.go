package provider

import "time"

type Customer struct {
	AccountRef     string
	AccountName    string
	BVN            string
	ExpiryDate     *time.Time // formatted as "2006-01-02 15:04:05" for Nomba
	ExpectedAmount *float64
}

type VirtualAccount struct {
	AccountRef        string
	AccountHolderID   string
	BVN               string
	AccountName       string
	BankName          string
	BankAccountNumber string
	BankAccountName   string
	Currency          string
	CallbackURL       string
	Expired           bool
	CreatedAt         time.Time
}

type Transaction struct {
	TransactionRef string
	AccountRef     string
	Amount         float64
	Currency       string
	Direction      string // "credit" | "debit"
	Status         string
	SenderName     string
	SenderAccount  string
	Narration      string
	CreatedAt      time.Time
}

type AccountUpdate struct {
	AccountName    string
	CallbackURL    *string
	ExpectedAmount *string // naira decimal string e.g. "5000.00", nil = no change
}
