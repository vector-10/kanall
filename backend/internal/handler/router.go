package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/config"
	"github.com/vector-10/kanall/internal/email"
	"github.com/vector-10/kanall/internal/middleware"
	"github.com/vector-10/kanall/internal/provider"
	"github.com/vector-10/kanall/internal/repository"
	"github.com/vector-10/kanall/internal/service"
)

func NewRouter(
	cfg *config.Config,
	store *repository.Store,
	p provider.VirtualAccountProvider,
	mailer email.Sender,
	health http.HandlerFunc,
) http.Handler {
	reconciliationSvc := service.NewReconciliationService(store, cfg.NombaWebhooksSigningSecret)
	provisioningSvc   := service.NewProvisioningService(store, p, cfg.EncryptionKey)
	lifecycleSvc      := service.NewLifecycleService(store, p)
	statementSvc      := service.NewStatementService(store)
	registrationSvc   := service.NewRegistrationService(store, mailer)
	authSvc           := service.NewAuthService(store)
	verificationSvc   := service.NewVerificationService(store)

	webhookH      := &WebhookHandler{reconciliation: reconciliationSvc, store: store}
	accountH      := &AccountHandler{provisioning: provisioningSvc, lifecycle: lifecycleSvc, store: store}
	customerH     := &CustomerHandler{store: store}
	statementH    := &StatementHandler{statement: statementSvc}
	registrationH := &RegistrationHandler{registration: registrationSvc}
	authH         := &AuthHandler{auth: authSvc, verification: verificationSvc, store: store, env: cfg.Env}

	registerRL     := middleware.NewRateLimiter(5)
	loginRL        := middleware.NewRateLimiter(10)
	accountWriteRL := middleware.NewRateLimiter(20)
	accountReadRL  := middleware.NewRateLimiter(100)
	statementRL    := middleware.NewRateLimiter(60)
	customerRL     := middleware.NewRateLimiter(100)

	r := chi.NewRouter()
	r.Use(chimiddleware.RealIP)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.CORSWithOrigin(cfg.FrontendOrigin))
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
			next.ServeHTTP(w, r)
		})
	})

	r.Get("/health", health)
	r.Get("/webhooks/nomba", func(w http.ResponseWriter, r *http.Request) {
		apierror.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Post("/webhooks/nomba", webhookH.Handle)
	r.With(registerRL.ByIP).Post("/register", registrationH.Register)

	r.Route("/auth", func(r chi.Router) {
		r.With(loginRL.ByIP).Post("/login", authH.Login)
		r.Post("/logout", authH.Logout)
		r.With(registerRL.ByIP).Post("/verify-email", authH.VerifyEmail)
		r.With(middleware.TenantAuth(store)).Get("/me", authH.Me)
		r.With(middleware.TenantAuth(store)).Post("/rotate-key", authH.RotateKey)
	})

	r.Route("/v1", func(r chi.Router) {
		r.Use(middleware.TenantAuth(store))

		r.With(accountWriteRL.ByAPIKey).Post("/accounts", accountH.Provision)
		r.With(accountReadRL.ByAPIKey).Get("/accounts", accountH.List)
		r.With(accountReadRL.ByAPIKey).Get("/accounts/{accountRef}", accountH.Get)
		r.With(accountWriteRL.ByAPIKey).Patch("/accounts/{accountRef}", accountH.Update)
		r.With(accountWriteRL.ByAPIKey).Post("/accounts/{accountRef}/suspend", accountH.Suspend)
		r.With(accountWriteRL.ByAPIKey).Post("/accounts/{accountRef}/expire", accountH.Expire)
		r.With(accountWriteRL.ByAPIKey).Post("/accounts/{accountRef}/reactivate", accountH.Reactivate)
		r.With(statementRL.ByAPIKey).Get("/accounts/{accountRef}/statement", statementH.Get)

		r.With(customerRL.ByAPIKey).Get("/customers", customerH.List)
		r.With(customerRL.ByAPIKey).Get("/customers/{id}", customerH.Get)

		r.With(accountReadRL.ByAPIKey).Get("/webhooks/dead-letters", webhookH.ListDeadLetters)
	})

	return r
}
