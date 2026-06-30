package repository

import (
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	Tenants           *TenantRepo
	Sessions          *SessionRepo
	Customers         *CustomerRepo
	Accounts          *AccountRepo
	Ledger            *LedgerRepo
	Webhooks          *WebhookRepo
	WebhookDeliveries *WebhookDeliveryRepo
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{
		Tenants:           &TenantRepo{pool: pool},
		Sessions:          &SessionRepo{pool: pool},
		Customers:         &CustomerRepo{pool: pool},
		Accounts:          &AccountRepo{pool: pool},
		Ledger:            &LedgerRepo{pool: pool},
		Webhooks:          &WebhookRepo{pool: pool},
		WebhookDeliveries: &WebhookDeliveryRepo{pool: pool},
	}
}
