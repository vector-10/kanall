package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vector-10/kanall/internal/model"
)

type CustomerRepo struct {
	pool *pgxpool.Pool
}

func (r *CustomerRepo) Create(ctx context.Context, c *model.Customer) error {
	return r.pool.QueryRow(ctx, `
	INSERT INTO customers (id, tenant_id, external_ref, name, bvn_encrypted, bvn_last4, status)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	RETURNING created_at, updated_at
	`, c.ID, c.TenantID, c.ExternalRef, c.Name, c.BVNEncrypted, c.BVNLast4, c.Status).Scan(&c.CreatedAt, &c.UpdatedAt)
}

func (r *CustomerRepo) GetByExternalRef(ctx context.Context, tenantID uuid.UUID, externalRef string) (*model.Customer, error) {
	c := &model.Customer{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, tenant_id, external_ref, name, bvn_encrypted, bvn_last4, status, created_at, updated_at
		FROM customers
		WHERE tenant_id = $1 AND external_ref = $2
	`, tenantID, externalRef).Scan(
		&c.ID, &c.TenantID, &c.ExternalRef, &c.Name,
		&c.BVNEncrypted, &c.BVNLast4, &c.Status,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *CustomerRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, cursorID *uuid.UUID) ([]model.Customer, error) {
	var (
		rows pgx.Rows
		err  error
	)
	const cols = `id, tenant_id, external_ref, name, bvn_encrypted, bvn_last4, status, created_at, updated_at`

	if cursorID == nil {
		rows, err = r.pool.Query(ctx, `
			SELECT `+cols+`
			FROM customers
			WHERE tenant_id = $1
			ORDER BY created_at ASC, id ASC
			LIMIT $2
		`, tenantID, limit)
	} else {
		rows, err = r.pool.Query(ctx, `
			SELECT `+cols+`
			FROM customers
			WHERE tenant_id = $1
			  AND (created_at, id) > (
			      SELECT created_at, id FROM customers WHERE id = $2
			  )
			ORDER BY created_at ASC, id ASC
			LIMIT $3
		`, tenantID, *cursorID, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var customers []model.Customer
	for rows.Next() {
		var c model.Customer
		if err := rows.Scan(
			&c.ID, &c.TenantID, &c.ExternalRef, &c.Name,
			&c.BVNEncrypted, &c.BVNLast4, &c.Status,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		customers = append(customers, c)
	}
	return customers, rows.Err()
}

func (r *CustomerRepo) GetByID(ctx context.Context, tenantID, customerID uuid.UUID) (*model.Customer, error) {
	c := &model.Customer{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, tenant_id, external_ref, name, bvn_encrypted, bvn_last4, status, created_at, updated_at
		FROM customers
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, customerID).Scan(
		&c.ID, &c.TenantID, &c.ExternalRef, &c.Name,
		&c.BVNEncrypted, &c.BVNLast4, &c.Status,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return c, nil
}