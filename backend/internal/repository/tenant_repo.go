package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vector-10/kanall/internal/model"
)

type TenantRepo struct {
	pool *pgxpool.Pool
}

func (r *TenantRepo) Create(ctx context.Context, t *model.Tenant) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO tenants (id, name, email, api_key_hash, password_hash, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at, updated_at
	`, t.ID, t.Name, t.Email, t.APIKeyHash, t.PasswordHash, t.Status).Scan(&t.CreatedAt, &t.UpdatedAt)
}

func (r *TenantRepo) GetByAPIKeyHash(ctx context.Context, hash string) (*model.Tenant, error) {
	t := &model.Tenant{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, email, api_key_hash, password_hash, status, created_at, updated_at
		FROM tenants
		WHERE api_key_hash = $1 AND status = 'active'
	`, hash).Scan(&t.ID, &t.Name, &t.Email, &t.APIKeyHash, &t.PasswordHash, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *TenantRepo) GetByEmail(ctx context.Context, email string) (*model.Tenant, error) {
	t := &model.Tenant{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, email, api_key_hash, password_hash, status, created_at, updated_at
		FROM tenants
		WHERE email = $1
	`, email).Scan(&t.ID, &t.Name, &t.Email, &t.APIKeyHash, &t.PasswordHash, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *TenantRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Tenant, error) {
	t := &model.Tenant{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, email, api_key_hash, password_hash, status, created_at, updated_at
		FROM tenants
		WHERE id = $1
	`, id).Scan(&t.ID, &t.Name, &t.Email, &t.APIKeyHash, &t.PasswordHash, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

