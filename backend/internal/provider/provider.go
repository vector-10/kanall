package provider

import (
	"context"
	"time"
)

type VirtualAccountProvider interface {
	Provision(ctx context.Context, customer Customer) (VirtualAccount, error)
	Fetch(ctx context.Context, accountRef string) (VirtualAccount, error)
	Update(ctx context.Context, accountRef string, updates AccountUpdate) (VirtualAccount, error)
	Expire(ctx context.Context, accountRef string) error
	FetchTransactions(ctx context.Context, from, to time.Time) ([]Transaction, error)
	FetchInboundTxn(ctx context.Context, txnRef string) (bool, error)
	ListBanks(ctx context.Context) ([]Bank, error)
	LookupAccount(ctx context.Context, accountNumber, bankCode string) (BankAccount, error)
	Transfer(ctx context.Context, input TransferInput) (TransferResult, error)
	Requery(ctx context.Context, merchantTxRef string) (TransferResult, error)
}

type Bank struct {
	Code string
	Name string
}

type BankAccount struct {
	AccountNumber string
	AccountName   string
}

type TransferInput struct {
	AmountNaira   float64
	AccountNumber string
	AccountName   string
	BankCode      string
	MerchantTxRef string
	SenderName    string
	Narration     string
}

type TransferResult struct {
	ID            string
	Status        string
	MerchantTxRef string
}
