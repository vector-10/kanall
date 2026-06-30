package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
	"github.com/vector-10/kanall/internal/model"
)

type AccountRepo struct {
	pool *pgxpool.Pool
}

func (r *AccountRepo) Create(ctx context.Context, va *model.VirtualAccount) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO virtual_accounts
		(id, tenant_id, customer_id, account_ref, provider, bank_account_number,
		 bank_account_name, bank_name, currency, status, callback_url, expected_amount)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING created_at, updated_at
	`, va.ID, va.TenantID, va.CustomerID, va.AccountRef, va.Provider,
		va.BankAccountNumber, va.BankAccountName, va.BankName,
		va.Currency, va.Status, va.CallbackURL, va.ExpectedAmount,
	).Scan(&va.CreatedAt, &va.UpdatedAt)
}

func (r *AccountRepo) GetByAccountRef(ctx context.Context, tenantID uuid.UUID, accountRef string) (*model.VirtualAccount, error) {
	va := &model.VirtualAccount{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, tenant_id, customer_id, account_ref, provider,
		       bank_account_number, bank_account_name, bank_name,
		       currency, status, callback_url, expected_amount, created_at, updated_at
		FROM virtual_accounts
		WHERE tenant_id = $1 AND account_ref = $2
	`, tenantID, accountRef).Scan(
		&va.ID, &va.TenantID, &va.CustomerID, &va.AccountRef, &va.Provider,
		&va.BankAccountNumber, &va.BankAccountName, &va.BankName,
		&va.Currency, &va.Status, &va.CallbackURL, &va.ExpectedAmount,
		&va.CreatedAt, &va.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return va, nil
}

func (r *AccountRepo) UpdateStatus(ctx context.Context, tenantID uuid.UUID, accountRef, newStatus string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE virtual_accounts
		SET status = $1, updated_at = now()
		WHERE tenant_id = $2 AND account_ref = $3
	`, newStatus, tenantID, accountRef)
	return err
}

func (r *AccountRepo) LogStateTransition(ctx context.Context, entry *model.AccountStateLog) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO account_state_log (id, virtual_account_id, from_status, to_status, reason)
		VALUES ($1, $2, $3, $4, $5)
	`, entry.ID, entry.VirtualAccountID, entry.FromStatus, entry.ToStatus, entry.Reason)
	return err
}

func (r *AccountRepo) GetByAccountRefGlobal(ctx context.Context, accountRef string) (*model.VirtualAccount, error) {
	va := &model.VirtualAccount{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, tenant_id, customer_id, account_ref, provider,
		       bank_account_number, bank_account_name, bank_name,
		       currency, status, callback_url, expected_amount, created_at, updated_at
		FROM virtual_accounts
		WHERE account_ref = $1
	`, accountRef).Scan(
		&va.ID, &va.TenantID, &va.CustomerID, &va.AccountRef, &va.Provider,
		&va.BankAccountNumber, &va.BankAccountName, &va.BankName,
		&va.Currency, &va.Status, &va.CallbackURL, &va.ExpectedAmount,
		&va.CreatedAt, &va.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return va, nil
}

func (r *AccountRepo) GetByCustomerID(ctx context.Context, tenantID, customerID uuid.UUID) (*model.VirtualAccount, error) {
	va := &model.VirtualAccount{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, tenant_id, customer_id, account_ref, provider,
		       bank_account_number, bank_account_name, bank_name,
		       currency, status, callback_url, expected_amount, created_at, updated_at
		FROM virtual_accounts
		WHERE tenant_id = $1 AND customer_id = $2
		LIMIT 1
	`, tenantID, customerID).Scan(
		&va.ID, &va.TenantID, &va.CustomerID, &va.AccountRef, &va.Provider,
		&va.BankAccountNumber, &va.BankAccountName, &va.BankName,
		&va.Currency, &va.Status, &va.CallbackURL, &va.ExpectedAmount,
		&va.CreatedAt, &va.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return va, nil
}

func (r *AccountRepo) Update(ctx context.Context, tenantID uuid.UUID, accountRef string, callbackURL *string, expectedAmount *decimal.Decimal) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE virtual_accounts
		SET callback_url    = COALESCE($3, callback_url),
		    expected_amount = COALESCE($4, expected_amount),
		    updated_at      = now()
		WHERE tenant_id = $1 AND account_ref = $2
	`, tenantID, accountRef, callbackURL, expectedAmount)
	return err
}

func (r *AccountRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, cursorID *uuid.UUID) ([]model.VirtualAccount, error) {
	var (
		rows pgx.Rows
		err  error
	)
	const cols = `id, tenant_id, customer_id, account_ref, provider,
		bank_account_number, bank_account_name, bank_name,
		currency, status, callback_url, expected_amount, created_at, updated_at`

	if cursorID == nil {
		rows, err = r.pool.Query(ctx, `
			SELECT `+cols+`
			FROM virtual_accounts
			WHERE tenant_id = $1
			ORDER BY created_at ASC, id ASC
			LIMIT $2
		`, tenantID, limit)
	} else {
		rows, err = r.pool.Query(ctx, `
			SELECT `+cols+`
			FROM virtual_accounts
			WHERE tenant_id = $1
			  AND (created_at, id) > (
			      SELECT created_at, id FROM virtual_accounts WHERE id = $2
			  )
			ORDER BY created_at ASC, id ASC
			LIMIT $3
		`, tenantID, *cursorID, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []model.VirtualAccount
	for rows.Next() {
		var va model.VirtualAccount
		if err := rows.Scan(
			&va.ID, &va.TenantID, &va.CustomerID, &va.AccountRef, &va.Provider,
			&va.BankAccountNumber, &va.BankAccountName, &va.BankName,
			&va.Currency, &va.Status, &va.CallbackURL, &va.ExpectedAmount,
			&va.CreatedAt, &va.UpdatedAt,
		); err != nil {
			return nil, err
		}
		accounts = append(accounts, va)
	}
	return accounts, rows.Err()
}

func (r *AccountRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.VirtualAccount, error) {
	va := &model.VirtualAccount{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, tenant_id, customer_id, account_ref, provider,
		       bank_account_number, bank_account_name, bank_name,
		       currency, status, callback_url, expected_amount, created_at, updated_at
		FROM virtual_accounts
		WHERE id = $1
	`, id).Scan(
		&va.ID, &va.TenantID, &va.CustomerID, &va.AccountRef, &va.Provider,
		&va.BankAccountNumber, &va.BankAccountName, &va.BankName,
		&va.Currency, &va.Status, &va.CallbackURL, &va.ExpectedAmount,
		&va.CreatedAt, &va.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return va, nil
}
