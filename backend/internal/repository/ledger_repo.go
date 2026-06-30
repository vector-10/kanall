package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
	"github.com/vector-10/kanall/internal/model"
)

type LedgerRepo struct {
	pool *pgxpool.Pool
}

func (r *LedgerRepo) PostDoubleEntry(ctx context.Context, credit, debit model.LedgerEntry, pe model.ProcessedEvent) (posted bool, err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		INSERT INTO processed_events (request_id, transaction_group_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, pe.RequestID, pe.TransactionGroupID)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 0 {
		return false, nil
	}

	const insertSQL = `
		INSERT INTO ledger_entries
			(id, tenant_id, transaction_group_id, nomba_txn_ref, account_type, account_id,
			 direction, amount, fee, currency, status, reverses_group_id, narration)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
	`
	for _, e := range []model.LedgerEntry{credit, debit} {
		if _, err = tx.Exec(ctx, insertSQL,
			e.ID, e.TenantID, e.TransactionGroupID, e.NombaTxnRef,
			e.AccountType, e.AccountID, e.Direction, e.Amount, e.Fee,
			e.Currency, e.Status, e.ReversesGroupID, e.Narration,
		); err != nil {
			return false, err
		}
	}

	return true, tx.Commit(ctx)
}

func (r *LedgerRepo) ConfirmByTxnRef(ctx context.Context, nombaTxnRef string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE ledger_entries SET status = 'confirmed'
		WHERE nomba_txn_ref = $1 AND status = 'provisional'
	`, nombaTxnRef)
	return err
}

func (r *LedgerRepo) MarkAsReversed(ctx context.Context, nombaTxnRef string) error {
	_, err := r.pool.Exec(ctx, `
	UPDATE ledger_entries SET status = 'reversed'
	WHERE nomba_txn_ref = $1 AND status = 'provisional'`, nombaTxnRef)
	return err
}

func (r *LedgerRepo) ListProvisional(ctx context.Context) ([]model.LedgerEntry, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, tenant_id, transaction_group_id, nomba_txn_ref, account_type, account_id,
		       direction, amount, currency, status, reverses_group_id, narration, created_at
		FROM ledger_entries
		WHERE status = 'provisional' AND account_type = 'virtual_account'
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEntries(rows)
}

func (r *LedgerRepo) ListByAccount(ctx context.Context, tenantID, accountID uuid.UUID) ([]model.LedgerEntry, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, tenant_id, transaction_group_id, nomba_txn_ref, account_type, account_id,
		       direction, amount, currency, status, reverses_group_id, narration, created_at
		FROM ledger_entries
		WHERE tenant_id = $1 AND account_id = $2
		ORDER BY created_at ASC
	`, tenantID, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEntries(rows)
}

// SumByAccount returns the all-time total credits and debits for an account.
// Used to compute the accurate closing balance regardless of pagination.
func (r *LedgerRepo) SumByAccount(ctx context.Context, tenantID, accountID uuid.UUID) (credits, debits decimal.Decimal, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(amount) FILTER (WHERE direction = 'credit'), 0::numeric),
			COALESCE(SUM(amount) FILTER (WHERE direction = 'debit'),  0::numeric)
		FROM ledger_entries
		WHERE tenant_id = $1 AND account_id = $2
	`, tenantID, accountID).Scan(&credits, &debits)
	return
}

// OpeningBalance returns the net balance of all entries up to and including
// the cursor entry. This is the starting balance for the current page so
// per-line running balances are accurate across page boundaries.
// Returns zero when cursorID is nil (first page).
func (r *LedgerRepo) OpeningBalance(ctx context.Context, tenantID, accountID uuid.UUID, cursorID *uuid.UUID) (decimal.Decimal, error) {
	if cursorID == nil {
		return decimal.Zero, nil
	}
	var balance decimal.Decimal
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(
			SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END),
			0::numeric
		)
		FROM ledger_entries
		WHERE tenant_id = $1 AND account_id = $2
		  AND (created_at, id) <= (
		      SELECT created_at, id FROM ledger_entries WHERE id = $3
		  )
	`, tenantID, accountID, *cursorID).Scan(&balance)
	return balance, err
}

// ListByAccountPaginated returns up to limit entries that come after the cursor
// entry (ordered by created_at ASC, id ASC). Pass nil cursorID to start from
// the beginning. Fetch limit+1 in the caller to detect whether more pages exist.
func (r *LedgerRepo) ListByAccountPaginated(ctx context.Context, tenantID, accountID uuid.UUID, limit int, cursorID *uuid.UUID) ([]model.LedgerEntry, error) {
	var (
		rows pgx.Rows
		err  error
	)
	if cursorID == nil {
		rows, err = r.pool.Query(ctx, `
			SELECT id, tenant_id, transaction_group_id, nomba_txn_ref, account_type, account_id,
			       direction, amount, fee, currency, status, reverses_group_id, narration, created_at
			FROM ledger_entries
			WHERE tenant_id = $1 AND account_id = $2
			ORDER BY created_at ASC, id ASC
			LIMIT $3
		`, tenantID, accountID, limit)
	} else {
		rows, err = r.pool.Query(ctx, `
			SELECT id, tenant_id, transaction_group_id, nomba_txn_ref, account_type, account_id,
			       direction, amount, fee, currency, status, reverses_group_id, narration, created_at
			FROM ledger_entries
			WHERE tenant_id = $1 AND account_id = $2
			  AND (created_at, id) > (
			      SELECT created_at, id FROM ledger_entries WHERE id = $3
			  )
			ORDER BY created_at ASC, id ASC
			LIMIT $4
		`, tenantID, accountID, *cursorID, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEntries(rows)
}

func scanEntries(rows pgx.Rows) ([]model.LedgerEntry, error) {
	var entries []model.LedgerEntry
	for rows.Next() {
		var e model.LedgerEntry
		if err := rows.Scan(
			&e.ID, &e.TenantID, &e.TransactionGroupID, &e.NombaTxnRef,
			&e.AccountType, &e.AccountID, &e.Direction, &e.Amount, &e.Fee,
			&e.Currency, &e.Status, &e.ReversesGroupID, &e.Narration, &e.CreatedAt,
		); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}
