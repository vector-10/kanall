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
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at, updated_at
	`, t.ID, t.Name, t.Email, t.APIKeyHash, t.PasswordHash, t.Status).Scan(&t.CreatedAt, &t.UpdatedAt)
}

func (r *TenantRepo) Activate(ctx context.Context, id uuid.UUID, apiKeyHash, apiKeySuffix string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE tenants SET api_key_hash = $1, api_key_suffix = $2, status = 'active', updated_at = now()
		WHERE id = $3
	`, apiKeyHash, apiKeySuffix, id)
	return err
}

func (r *TenantRepo) RotateAPIKey(ctx context.Context, id uuid.UUID, apiKeyHash, apiKeySuffix string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE tenants SET api_key_hash = $1, api_key_suffix = $2, updated_at = now()
		WHERE id = $3
	`, apiKeyHash, apiKeySuffix, id)
	return err
}

func (r *TenantRepo) UpdatePending(ctx context.Context, id uuid.UUID, name, passwordHash string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE tenants SET name = $1, password_hash = $2, updated_at = now()
		WHERE id = $3 AND status = 'pending_verification'
	`, name, passwordHash, id)
	return err
}

func (r *TenantRepo) GetByAPIKeyHash(ctx context.Context, hash string) (*model.Tenant, error) {
	t := &model.Tenant{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, email, api_key_hash, api_key_suffix, password_hash, status, created_at, updated_at
		FROM tenants
		WHERE api_key_hash = $1 AND status = 'active'
	`, hash).Scan(&t.ID, &t.Name, &t.Email, &t.APIKeyHash, &t.APIKeySuffix, &t.PasswordHash, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *TenantRepo) GetByEmail(ctx context.Context, email string) (*model.Tenant, error) {
	t := &model.Tenant{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, email, api_key_hash, api_key_suffix, password_hash, status, created_at, updated_at
		FROM tenants
		WHERE email = $1
	`, email).Scan(&t.ID, &t.Name, &t.Email, &t.APIKeyHash, &t.APIKeySuffix, &t.PasswordHash, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *TenantRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Tenant, error) {
	t := &model.Tenant{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, email, api_key_hash, api_key_suffix, password_hash, status, created_at, updated_at
		FROM tenants
		WHERE id = $1
	`, id).Scan(&t.ID, &t.Name, &t.Email, &t.APIKeyHash, &t.APIKeySuffix, &t.PasswordHash, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}
