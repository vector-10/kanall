package config

import (
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                       string
	Env                        string
	FrontendOrigin             string
	DatabaseURL                string
	NombaEnv                   string
	NombaBaseURL               string
	NombaAccountID             string
	NombaSubAccountID          string
	NombaClientID              string
	NombaClientSecret          string
	NombaWebhooksSigningSecret string
	ConvergenceSweepInterval   time.Duration
	OutboxHTTPTimeout          time.Duration
	EncryptionKey              string
}

// the function below is called once at startup, returns config struct or fatal error
// all packages receive envs from here, no os.Getenv anywhere else
func LoadConfig() (*Config, error) {
	_ = godotenv.Load()

	sweepSeconds, err := strconv.Atoi(getEnv("CONVERGENCE_SWEEP_INTERVAL_SECONDS", "60"))
	if err != nil {
		return nil, fmt.Errorf("invalid CONVERGENCE_SWEEP_INTERVAL_SECONDS: %w", err)
	}
	outboxTimeoutSeconds, err := strconv.Atoi(getEnv("OUTBOX_HTTP_TIMEOUT_SECONDS", "10"))
	if err != nil {
		return nil, fmt.Errorf("invalid OUTBOX_HTTP_TIMEOUT_SECONDS: %w", err)
	}

	cfg := &Config{
		Port:                       getEnv("PORT", "8080"),
		Env:                        getEnv("ENV", "development"),
		FrontendOrigin:             getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
		DatabaseURL:                os.Getenv("DATABASE_URL"),
		NombaEnv:                   getEnv("NOMBA_ENV", "sandbox"),
		NombaBaseURL:               os.Getenv("NOMBA_BASE_URL"),
		NombaAccountID:             os.Getenv("NOMBA_ACCOUNT_ID"),
		NombaSubAccountID:          os.Getenv("NOMBA_SUB_ACCOUNT_ID"),
		NombaClientID:              os.Getenv("NOMBA_CLIENT_ID"),
		NombaClientSecret:          os.Getenv("NOMBA_CLIENT_SECRET"),
		NombaWebhooksSigningSecret: os.Getenv("NOMBA_WEBHOOKS_SIGNING_SECRET"),
		ConvergenceSweepInterval:   time.Duration(sweepSeconds) * time.Second,
		OutboxHTTPTimeout:          time.Duration(outboxTimeoutSeconds) * time.Second,
		EncryptionKey:              os.Getenv("ENCRYPTION_KEY"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.EncryptionKey != "" {
		decoded, err := hex.DecodeString(cfg.EncryptionKey)
		if err != nil {
			return nil, fmt.Errorf("ENCRYPTION_KEY is not valid hex: %w", err)
		}
		if len(decoded) != 32 {
			return nil, fmt.Errorf("ENCRYPTION_KEY must be 32 bytes (64 hex chars), got %d", len(decoded))
		}
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
