package service

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/shopspring/decimal"
	"github.com/vector-10/kanall/internal/crypto"
	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/provider"
	"github.com/vector-10/kanall/internal/repository"
)

type ProvisioningService struct {
	store         *repository.Store
	provider      provider.VirtualAccountProvider
	encryptionKey string
}

func NewProvisioningService(store *repository.Store, p provider.VirtualAccountProvider, encryptionKey string) *ProvisioningService {
	return &ProvisioningService{store: store, provider: p, encryptionKey: encryptionKey}
}

type ProvisionInput struct {
	TenantID       uuid.UUID
	ExternalRef    string
	Name           string
	BVN            string
	CallbackURL    string
	ExpectedAmount *decimal.Decimal
}

func (s *ProvisioningService) Provision(ctx context.Context, input ProvisionInput) (*model.VirtualAccount, error) {
	customer, created, err := s.getOrCreateCustomer(ctx, input)

	if err != nil {
		return nil, err
	}

	if !created {
		va, err := s.store.Accounts.GetByCustomerID(ctx, input.TenantID, customer.ID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("account lookup failed: %w", err)
		}
		if va != nil {
			return va, nil
		}
	}

	accountRef := uuid.New().String()

	pvdInput := provider.Customer{
		AccountRef:  accountRef,
		AccountName: input.Name,
		BVN:         input.BVN,
	}
	if input.ExpectedAmount != nil {
		f, _ := input.ExpectedAmount.Float64()
		pvdInput.ExpectedAmount = &f
	}
	pvd, err := s.provider.Provision(ctx, pvdInput)

	if err != nil {
		return nil, fmt.Errorf("provider provisioning failed: %w", err)
	}

	va := &model.VirtualAccount{
		ID:                uuid.New(),
		TenantID:          input.TenantID,
		CustomerID:        customer.ID,
		AccountRef:        accountRef,
		Provider:          "nomba",
		BankAccountNumber: &pvd.BankAccountNumber,
		BankAccountName:   &pvd.BankAccountName,
		BankName:          &pvd.BankName,
		Currency:          pvd.Currency,
		Status:            "active",
		ExpectedAmount:    input.ExpectedAmount,
	}
	if input.CallbackURL != "" {
		va.CallbackURL = &input.CallbackURL
	}

	if err := s.store.Accounts.Create(ctx, va); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			existing, fetchErr := s.store.Accounts.GetByCustomerID(ctx, input.TenantID, customer.ID)
			if fetchErr != nil {
				return nil, fmt.Errorf("va lookup after conflict: %w", fetchErr)
			}
			if expireErr := s.provider.Expire(ctx, accountRef); expireErr != nil {
				log.Printf("provisioning: failed to expire orphaned nomba VA %s: %v", accountRef, expireErr)
			}
			return existing, nil
		}
		if expireErr := s.provider.Expire(ctx, accountRef); expireErr != nil {
			log.Printf("provisioning: failed to expire orphaned nomba VA %s: %v", accountRef, expireErr)
		}
		return nil, fmt.Errorf("failed to save virtual account: %w", err)
	}

	reason := "initial provisioning"
	if err := s.store.Accounts.LogStateTransition(ctx, &model.AccountStateLog{
		ID:               uuid.New(),
		VirtualAccountID: va.ID,
		ToStatus:         "active",
		Reason:           &reason,
	}); err != nil {
		log.Printf("failed to log state transition for account %s: %v", va.ID, err)
	}

	return va, nil
}

func (s *ProvisioningService) getOrCreateCustomer(ctx context.Context, input ProvisionInput) (*model.Customer, bool, error) {
	existing, err := s.store.Customers.GetByExternalRef(ctx, input.TenantID, input.ExternalRef)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, fmt.Errorf("customer lookup failed: %w", err)
	}
	if existing != nil {
		return existing, false, nil
	}

	var bvnLast4 *string
	if input.BVN != "" {
		suffix := bvnSuffix(input.BVN)
		bvnLast4 = &suffix
	}
	c := &model.Customer{
		ID:          uuid.New(),
		TenantID:    input.TenantID,
		ExternalRef: input.ExternalRef,
		Name:        input.Name,
		BVNLast4:    bvnLast4,
		Status:      "active",
	}

	if input.BVN != "" && s.encryptionKey != "" {
		encrypted, err := crypto.Encrypt(input.BVN, s.encryptionKey)
		if err != nil {
			return nil, false, fmt.Errorf("failed to encrypt BVN: %w", err)
		}
		c.BVNEncrypted = &encrypted
	}

	if err := s.store.Customers.Create(ctx, c); err != nil {
		// concurrent request already created this customer — re-fetch and treat as existing
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			existing, fetchErr := s.store.Customers.GetByExternalRef(ctx, input.TenantID, input.ExternalRef)
			if fetchErr != nil {
				return nil, false, fmt.Errorf("customer lookup after conflict: %w", fetchErr)
			}
			return existing, false, nil
		}
		return nil, false, fmt.Errorf("failed to create customer: %w", err)
	}
	return c, true, nil
}

func bvnSuffix(bvn string) string {
	if len(bvn) < 4 {
		return bvn
	}
	return bvn[len(bvn)-4:]
}
