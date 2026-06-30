package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vector-10/kanall/internal/model"
)

type SessionRepo struct {
	pool *pgxpool.Pool
}

func (r *SessionRepo) Create(ctx context.Context, s *model.Session) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO sessions (id, tenant_id, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING created_at
	`, s.ID, s.TenantID, s.TokenHash, s.ExpiresAt).Scan(&s.CreatedAt)
}

func (r *SessionRepo) GetActiveByTokenHash(ctx context.Context, hash string) (*model.Session, error) {
	s := &model.Session{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, tenant_id, token_hash, created_at, expires_at, revoked_at
		FROM sessions
		WHERE token_hash = $1
		  AND revoked_at IS NULL
		  AND expires_at > now()
	`, hash).Scan(&s.ID, &s.TenantID, &s.TokenHash, &s.CreatedAt, &s.ExpiresAt, &s.RevokedAt)
	if err != nil {
		return nil, err
	}
	return s, nil
}


func (r *SessionRepo) Revoke(ctx context.Context, tokenHash string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE sessions SET revoked_at = now() WHERE token_hash = $1
	`, tokenHash)
	return err
}