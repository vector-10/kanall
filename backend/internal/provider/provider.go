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
}
