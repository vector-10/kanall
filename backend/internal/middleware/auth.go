package middleware

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/crypto"
	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/repository"
)

type tenantKeyType struct{}

var tenantCtxKey = tenantKeyType{}

func TenantAuth(store *repository.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 1. Session cookie (browser / dashboard)
			if cookie, err := r.Cookie("kanall_session"); err == nil && cookie.Value != "" {
				tokenHash := crypto.HashAPIKey(cookie.Value)
				session, err := store.Sessions.GetActiveByTokenHash(r.Context(), tokenHash)
				if err == nil {
					tenant, err := store.Tenants.GetByID(r.Context(), session.TenantID)
					if err == nil && tenant.Status == "active" {
						ctx := context.WithValue(r.Context(), tenantCtxKey, tenant)
						next.ServeHTTP(w, r.WithContext(ctx))
						return
					}
				}
			}

			// 2. X-API-Key header (server-to-server)
			apiKey := r.Header.Get("X-API-Key")
			if apiKey == "" {
				apierror.Respond(w, apierror.Unauthorized())
				return
			}

			hash := crypto.HashAPIKey(apiKey)
			tenant, err := store.Tenants.GetByAPIKeyHash(r.Context(), hash)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					apierror.Respond(w, apierror.Unauthorized())
					return
				}
				log.Printf("auth: DB error on API key lookup: %v", err)
				apierror.Respond(w, apierror.Internal())
				return
			}

			ctx := context.WithValue(r.Context(), tenantCtxKey, tenant)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetTenant(ctx context.Context) *model.Tenant {
	t, _ := ctx.Value(tenantCtxKey).(*model.Tenant)
	return t
}
