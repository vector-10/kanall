package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

type webhookPayload struct {
	Event string      `json:"event"`
	Data  payloadData `json:"data"`
}

type payloadData struct {
	TransactionRef string `json:"transactionRef"`
	AccountRef     string `json:"accountRef"`
	Amount         string `json:"amount"`
	Currency       string `json:"currency"`
	Type           string `json:"type"`
	SenderName     string `json:"senderName"`
	SenderAccount  string `json:"senderAccount"`
	Narration      string `json:"narration"`
}

func sign(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	_ = godotenv.Load()

	serverURL  := getEnv("SERVER_URL", "http://localhost:8080")
	secret     := os.Getenv("NOMBA_WEBHOOKS_SIGNING_SECRET")
	accountRef := os.Getenv("CHAOS_ACCOUNT_REF")
	workers, _ := strconv.Atoi(getEnv("CHAOS_WORKERS", "10"))
	requests, _ := strconv.Atoi(getEnv("CHAOS_REQUESTS", "50"))

	if secret == "" {
		log.Fatal("NOMBA_WEBHOOKS_SIGNING_SECRET is required")
	}
	if accountRef == "" {
		log.Fatal("CHAOS_ACCOUNT_REF is required — set it to the accountRef of a provisioned virtual account")
	}

	log.Printf("chaos: server=%s workers=%d requests=%d", serverURL, workers, requests)

	// Build refs: last slot is a duplicate of the first to stress idempotency
	refs := make([]string, requests)
	for i := range refs {
		refs[i] = uuid.New().String()
	}
	if requests > 1 {
		refs[requests-1] = refs[0]
		log.Printf("chaos: ref[0]=%s will be sent twice (idempotency check)", refs[0][:8])
	}

	jobs := make(chan string, requests)
	for _, ref := range refs {
		jobs <- ref
	}
	close(jobs)

	var success, failed int64
	client := &http.Client{Timeout: 10 * time.Second}

	var wg sync.WaitGroup
	start := time.Now()

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for ref := range jobs {
				payload := webhookPayload{
					Event: "transaction.completed",
					Data: payloadData{
						TransactionRef: ref,
						AccountRef:     accountRef,
						Amount:         "5000.00",
						Currency:       "NGN",
						Type:           "credit",
						SenderName:     "Chaos Harness",
						SenderAccount:  "0000000000",
						Narration:      fmt.Sprintf("chaos txn %.8s", ref),
					},
				}

				body, _ := json.Marshal(payload)
				sig := sign(body, secret)

				req, _ := http.NewRequest(http.MethodPost, serverURL+"/webhooks/nomba", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("X-Nomba-Signature", sig)

				resp, err := client.Do(req)
				if err != nil {
					log.Printf("chaos: request error ref=%.8s: %v", ref, err)
					atomic.AddInt64(&failed, 1)
					continue
				}
				resp.Body.Close()

				if resp.StatusCode == http.StatusOK {
					atomic.AddInt64(&success, 1)
				} else {
					atomic.AddInt64(&failed, 1)
					log.Printf("chaos: unexpected status %d for ref=%.8s", resp.StatusCode, ref)
				}
			}
		}()
	}

	wg.Wait()
	elapsed := time.Since(start)

	total := success + failed
	uniqueExpected := int64(requests - 1)
	log.Printf("chaos: completed in %v", elapsed)
	log.Printf("  total sent:       %d", total)
	log.Printf("  200 OK:           %d (unique+idempotent duplicates — server returns 200 for both)", success)
	log.Printf("  failed:           %d", failed)
	log.Printf("  unique refs:      %d (1 duplicate sent to verify idempotency)", uniqueExpected)
	log.Printf("  rps:              %.1f", float64(total)/elapsed.Seconds())
}
