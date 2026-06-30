package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/config"
	"github.com/vector-10/kanall/internal/email"
	"github.com/vector-10/kanall/internal/handler"
	"github.com/vector-10/kanall/internal/provider"
	"github.com/vector-10/kanall/internal/repository"
	"github.com/vector-10/kanall/internal/service"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	pgxConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to parse database config: %v", err)
	}
	pgxConfig.MaxConns = 25
	pgxConfig.MinConns = 5
	pgxConfig.MaxConnLifetime = time.Hour
	pgxConfig.MaxConnIdleTime = 10 * time.Minute
	pgxConfig.ConnConfig.ConnectTimeout = 10 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, pgxConfig)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("failed to ping database: %v", err)
	}

	log.Println("using NombaProvider")
	p := provider.NewNombaProvider(cfg)

	// Use BrevoSender when BREVO_API_KEY is set; NoopSender logs instead (dev-friendly)
	var mailer email.Sender
	if cfg.BrevoAPIKey != "" {
		log.Println("email: using BrevoSender")
		mailer = email.NewBrevoSender(cfg.BrevoAPIKey, cfg.BrevoAPIURL, cfg.EmailFrom, cfg.EmailFromName)
	} else {
		log.Println("email: no BREVO_API_KEY set, using NoopSender")
		mailer = email.NewNoopSender()
	}

	store := repository.NewStore(pool)

	convergenceSvc := service.NewConvergenceService(store, p, cfg.ConvergenceSweepInterval)
	go convergenceSvc.Start(ctx)

	outboxWorker := service.NewOutboxWorker(store, cfg.OutboxHTTPTimeout)
	go outboxWorker.Start(ctx)

	health := func(w http.ResponseWriter, r *http.Request) {
		if err := pool.Ping(r.Context()); err != nil {
			apierror.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{
				"status":  "down",
				"message": err.Error(),
			})
			return
		}
		apierror.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}

	router := handler.NewRouter(cfg, store, p, mailer, health)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("kanall server listening on :%s [%s]", cfg.Port, cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutdown signal received, draining connections...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown error: %v", err)
	}
}
