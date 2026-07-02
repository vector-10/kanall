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

const tenantCols = `id, name, email, api_key_hash, api_key_suffix, password_hash, status,
	business_type, cac_number, kyc_status, kyc_submitted_at, webhook_secret_encrypted,
	created_at, updated_at`

func scanTenant(row interface{ Scan(...any) error }, t *model.Tenant) error {
	return row.Scan(
		&t.ID, &t.Name, &t.Email, &t.APIKeyHash, &t.APIKeySuffix, &t.PasswordHash, &t.Status,
		&t.BusinessType, &t.CACNumber, &t.KYCStatus, &t.KYCSubmittedAt, &t.WebhookSecretEncrypted,
		&t.CreatedAt, &t.UpdatedAt,
	)
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
	err := scanTenant(r.pool.QueryRow(ctx, `
		SELECT `+tenantCols+`
		FROM tenants
		WHERE api_key_hash = $1 AND status = 'active'
	`, hash), t)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *TenantRepo) GetByEmail(ctx context.Context, email string) (*model.Tenant, error) {
	t := &model.Tenant{}
	err := scanTenant(r.pool.QueryRow(ctx, `
		SELECT `+tenantCols+`
		FROM tenants
		WHERE email = $1
	`, email), t)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *TenantRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Tenant, error) {
	t := &model.Tenant{}
	err := scanTenant(r.pool.QueryRow(ctx, `
		SELECT `+tenantCols+`
		FROM tenants
		WHERE id = $1
	`, id), t)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *TenantRepo) SubmitBusinessKYC(ctx context.Context, id uuid.UUID, businessType, cacNumber string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE tenants
		SET business_type    = $1,
		    cac_number       = $2,
		    kyc_status       = 'verified',
		    kyc_submitted_at = now(),
		    updated_at       = now()
		WHERE id = $3
	`, businessType, cacNumber, id)
	return err
}

func (r *TenantRepo) UpdateWebhookSecret(ctx context.Context, id uuid.UUID, encryptedSecret string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE tenants SET webhook_secret_encrypted = $1, updated_at = now()
		WHERE id = $2
	`, encryptedSecret, id)
	return err
}
