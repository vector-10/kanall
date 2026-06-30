package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vector-10/kanall/internal/model"
)

type EmailVerificationRepo struct {
	pool *pgxpool.Pool
}

// Create inserts a new OTP record. The unique partial index on tenant_id WHERE
// verified_at IS NULL enforces only one pending record per tenant at a time —
// so a re-register or re-send naturally replaces the old pending OTP.
func (r *EmailVerificationRepo) Create(ctx context.Context, ev *model.EmailVerification) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO email_verifications (id, tenant_id, otp_hash, expires_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (tenant_id) WHERE verified_at IS NULL
		DO UPDATE SET otp_hash = EXCLUDED.otp_hash, expires_at = EXCLUDED.expires_at, created_at = now()
		RETURNING created_at
	`, ev.ID, ev.TenantID, ev.OTPHash, ev.ExpiresAt).Scan(&ev.CreatedAt)
}

// GetPending returns the active (unverified, not expired) OTP record for a tenant.
func (r *EmailVerificationRepo) GetPending(ctx context.Context, tenantID uuid.UUID) (*model.EmailVerification, error) {
	ev := &model.EmailVerification{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, tenant_id, otp_hash, expires_at, verified_at, created_at
		FROM email_verifications
		WHERE tenant_id = $1 AND verified_at IS NULL AND expires_at > $2
	`, tenantID, time.Now()).Scan(
		&ev.ID, &ev.TenantID, &ev.OTPHash, &ev.ExpiresAt, &ev.VerifiedAt, &ev.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return ev, nil
}

// MarkVerified stamps verified_at so the record can never be reused.
func (r *EmailVerificationRepo) MarkVerified(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE email_verifications SET verified_at = now() WHERE id = $1
	`, id)
	return err
}
