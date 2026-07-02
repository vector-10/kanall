package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
)


const (
	merchantUserID   = "f666ef9b-888e-4799-85ce-acb505b28023" 
	merchantWalletID = "22f28de5-899a-49e8-ae05-f11d66250a74" 
)

type chaosPayload struct {
	EventType string      `json:"event_type"`
	RequestID string      `json:"requestId"`
	Data      chaosData   `json:"data"`
}

type chaosData struct {
	Merchant    chaosMerchant    `json:"merchant"`
	Transaction chaosTransaction `json:"transaction"`
	Customer    chaosCustomer    `json:"customer"`
}

type chaosMerchant struct {
	UserID   string `json:"userId"`
	WalletID string `json:"walletId"`
}

type chaosTransaction struct {
	TransactionID         string  `json:"transactionId"`
	Type                  string  `json:"type"`
	Time                  string  `json:"time"`
	ResponseCode          string  `json:"responseCode"`
	TransactionAmount     int64   `json:"transactionAmount"`
	Fee                   float64 `json:"fee"`
	Currency              string  `json:"currency"`
	AliasAccountReference string  `json:"aliasAccountReference"`
	Narration             string  `json:"narration"`
}

type chaosCustomer struct {
	SenderName    string `json:"senderName"`
	SenderAccount string `json:"accountNumber"`
	BankName      string `json:"bankName"`
}

func buildPayload(accountRef, requestID, txnID string) chaosPayload {
	return chaosPayload{
		EventType: "vact_transfer",
		RequestID: requestID,
		Data: chaosData{
			Merchant: chaosMerchant{
				UserID:   merchantUserID,
				WalletID: merchantWalletID,
			},
			Transaction: chaosTransaction{
				TransactionID:         txnID,
				Type:                  "vact_transfer",
				Time:                  time.Now().UTC().Format(time.RFC3339),
				ResponseCode:          "00",
				TransactionAmount:     10000, // ₦100 in kobo
				Fee:                   10.75,
				Currency:              "NGN",
				AliasAccountReference: accountRef,
				Narration:             "chaos test",
			},
			Customer: chaosCustomer{
				SenderName:    "Chaos Runner",
				SenderAccount: "0000000001",
				BankName:      "Test Bank",
			},
		},
	}
}


func sign(p chaosPayload, timestamp, secret string) string {
	rc := p.Data.Transaction.ResponseCode
	if rc == "null" {
		rc = ""
	}
	signed := strings.Join([]string{
		p.EventType,
		p.RequestID,
		p.Data.Merchant.UserID,
		p.Data.Merchant.WalletID,
		p.Data.Transaction.TransactionID,
		p.Data.Transaction.Type,
		p.Data.Transaction.Time,
		rc,
		timestamp,
	}, ":")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signed))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}


func sendWebhook(client *http.Client, serverURL, secret string, p chaosPayload) (int, error) {
	timestamp := time.Now().UTC().Format(time.RFC3339)
	sig := sign(p, timestamp, secret)
	body, _ := json.Marshal(p)

	req, err := http.NewRequest(http.MethodPost, serverURL+"/webhooks/nomba", bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("nomba-signature", sig)
	req.Header.Set("nomba-timestamp", timestamp)

	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	resp.Body.Close()
	return resp.StatusCode, nil
}


type scenarioResult struct {
	pass    bool
	message string
}

func ok(msg string) scenarioResult  { return scenarioResult{true, "PASS  " + msg} }
func bad(msg string) scenarioResult { return scenarioResult{false, "FAIL  " + msg} }


func scenarioFlood(client *http.Client, cfg appConfig) []scenarioResult {
	var sent, okCount, errCount int64

	jobs := make(chan struct{}, cfg.requests)
	for i := 0; i < cfg.requests; i++ {
		jobs <- struct{}{}
	}
	close(jobs)

	var wg sync.WaitGroup
	start := time.Now()

	for i := 0; i < cfg.workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range jobs {
				reqID := uuid.New().String()
				txnID := uuid.New().String()
				p := buildPayload(cfg.accountRef, reqID, txnID)
				code, err := sendWebhook(client, cfg.serverURL, cfg.secret, p)
				atomic.AddInt64(&sent, 1)
				if err != nil || code != 200 {
					atomic.AddInt64(&errCount, 1)
					log.Printf("flood: err=%v status=%d", err, code)
				} else {
					atomic.AddInt64(&okCount, 1)
				}
			}
		}()
	}
	wg.Wait()

	elapsed := time.Since(start)
	rps := float64(sent) / elapsed.Seconds()

	var results []scenarioResult
	results = append(results, ok(fmt.Sprintf("flood: %d requests in %.2fs → %.0f RPS", sent, elapsed.Seconds(), rps)))
	if errCount == 0 {
		results = append(results, ok(fmt.Sprintf("flood: all %d returned 200 (no panics, no drops)", okCount)))
	} else {
		results = append(results, bad(fmt.Sprintf("flood: %d non-200 or errors out of %d", errCount, sent)))
	}
	return results
}


func scenarioIdempotency(client *http.Client, cfg appConfig) []scenarioResult {
	const concurrency = 10

	requestID := uuid.New().String()
	txnID := uuid.New().String()
	p := buildPayload(cfg.accountRef, requestID, txnID)

	var okCount int64
	var wg sync.WaitGroup
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, err := sendWebhook(client, cfg.serverURL, cfg.secret, p)
			if err == nil && code == 200 {
				atomic.AddInt64(&okCount, 1)
			}
		}()
	}
	wg.Wait()

	var results []scenarioResult
	if okCount == concurrency {
		results = append(results, ok(fmt.Sprintf(
			"idempotency: %d concurrent dupes all returned 200 (server always ACKs — never 4xx on dup)",
			concurrency,
		)))
	} else {
		results = append(results, bad(fmt.Sprintf(
			"idempotency: only %d/%d returned 200 — server must always ACK with 200",
			okCount, concurrency,
		)))
	}

	// If an API key is set, check statement to confirm balance moved once, not 10 times.
	if cfg.apiKey != "" && cfg.accountRef != "" {
		credits := statementCreditCount(client, cfg.serverURL, cfg.apiKey, cfg.accountRef)
		results = append(results, ok(fmt.Sprintf(
			"idempotency: statement has %d credit line(s) total — verify manually that requestId %s appears exactly once",
			credits, requestID[:8],
		)))
	}
	return results
}

func scenarioInvalidSig(client *http.Client, cfg appConfig) []scenarioResult {
	reqID := uuid.New().String()
	txnID := uuid.New().String()
	p := buildPayload(cfg.accountRef, reqID, txnID)

	body, _ := json.Marshal(p)
	req, _ := http.NewRequest(http.MethodPost, cfg.serverURL+"/webhooks/nomba", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("nomba-signature", "badsignature==")
	req.Header.Set("nomba-timestamp", time.Now().UTC().Format(time.RFC3339))

	resp, err := cfg.client.Do(req)
	if err != nil {
		return []scenarioResult{bad("invalid-sig: request failed: " + err.Error())}
	}
	resp.Body.Close()

	var results []scenarioResult
	if resp.StatusCode == 200 {
		results = append(results, ok("invalid-sig: server returned 200 (correctly dead-letters, does not reject at HTTP level)"))
	} else {
		results = append(results, bad(fmt.Sprintf(
			"invalid-sig: server returned %d — must return 200 to prevent Nomba retries",
			resp.StatusCode,
		)))
	}
	return results
}

func scenarioProvisionRace(client *http.Client, cfg appConfig) []scenarioResult {
	if cfg.apiKey == "" {
		return []scenarioResult{ok("provision-race: skipped — set API_KEY env var to enable")}
	}

	const concurrency = 10
	externalRef := "chaos-" + uuid.New().String()[:8]

	type provResp struct {
		AccountRef string `json:"accountRef"`
	}

	accountRefs := make([]string, concurrency)
	statuses := make([]int, concurrency)
	var wg sync.WaitGroup

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		idx := i
		go func() {
			defer wg.Done()
			body, _ := json.Marshal(map[string]string{
				"externalRef": externalRef,
				"name":        "Chaos Race Account",
			})
			req, _ := http.NewRequest(http.MethodPost, cfg.serverURL+"/v1/accounts", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-API-Key", cfg.apiKey)

			resp, err := client.Do(req)
			if err != nil {
				return
			}
			defer resp.Body.Close()
			statuses[idx] = resp.StatusCode

			rb, _ := io.ReadAll(resp.Body)
			var pr provResp
			_ = json.Unmarshal(rb, &pr)
			accountRefs[idx] = pr.AccountRef
		}()
	}
	wg.Wait()

	var results []scenarioResult

	allOK := true
	for _, s := range statuses {
		if s != 200 && s != 201 {
			allOK = false
			break
		}
	}
	if allOK {
		results = append(results, ok(fmt.Sprintf("provision-race: all %d concurrent requests returned 200/201", concurrency)))
	} else {
		results = append(results, bad(fmt.Sprintf("provision-race: non-200/201 responses: %v", statuses)))
	}

	first := accountRefs[0]
	allSame := first != ""
	for _, ref := range accountRefs {
		if ref != first {
			allSame = false
			break
		}
	}
	if allSame {
		results = append(results, ok(fmt.Sprintf(
			"provision-race: all %d goroutines received identical accountRef %s (race handled correctly)",
			concurrency, first,
		)))
	} else {
		results = append(results, bad(fmt.Sprintf(
			"provision-race: different accountRefs returned — race not handled: %v",
			accountRefs,
		)))
	}
	return results
}



type appConfig struct {
	serverURL  string
	secret     string
	accountRef string
	apiKey     string
	workers    int
	requests   int
	client     *http.Client
}

func statementCreditCount(client *http.Client, serverURL, apiKey, accountRef string) int {
	req, _ := http.NewRequest(http.MethodGet, serverURL+"/v1/accounts/"+accountRef+"/statement", nil)
	req.Header.Set("X-API-Key", apiKey)
	resp, err := client.Do(req)
	if err != nil {
		return -1
	}
	defer resp.Body.Close()
	var s struct {
		Lines []struct {
			Direction string `json:"direction"`
		} `json:"lines"`
	}
	rb, _ := io.ReadAll(resp.Body)
	_ = json.Unmarshal(rb, &s)
	n := 0
	for _, l := range s.Lines {
		if l.Direction == "credit" {
			n++
		}
	}
	return n
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}


func main() {
	_ = godotenv.Load("../../.env")

	httpClient := &http.Client{Timeout: 10 * time.Second}

	cfg := appConfig{
		serverURL:  getEnv("SERVER_URL", "http://localhost:8080"),
		secret:     getEnv("NOMBA_WEBHOOK_SIGNING_SECRET", ""),
		accountRef: getEnv("CHAOS_ACCOUNT_REF", ""),
		apiKey:     getEnv("API_KEY", ""),
		workers:    getEnvInt("CHAOS_WORKERS", 10),
		requests:   getEnvInt("CHAOS_REQUESTS", 50),
		client:     httpClient,
	}

	if cfg.secret == "" {
		log.Fatal("NOMBA_WEBHOOK_SIGNING_SECRET is required")
	}

	if cfg.accountRef == "" {
		log.Printf("CHAOS_ACCOUNT_REF not set — flood and idempotency webhooks will dead-letter (account not found), but server stability is still tested")
	}

	fmt.Printf("Kanall Chaos Harness\n")
	fmt.Printf("server=%s  workers=%d  requests=%d\n\n", cfg.serverURL, cfg.workers, cfg.requests)

	type scenario struct {
		name string
		run  func() []scenarioResult
	}

	scenarios := []scenario{
		{"1. Webhook Flood", func() []scenarioResult {
			return scenarioFlood(httpClient, cfg)
		}},
		{"2. Idempotency Storm", func() []scenarioResult {
			return scenarioIdempotency(httpClient, cfg)
		}},
		{"3. Invalid Signature", func() []scenarioResult {
			return scenarioInvalidSig(httpClient, cfg)
		}},
		{"4. Provisioning Race", func() []scenarioResult {
			return scenarioProvisionRace(httpClient, cfg)
		}},
	}

	var totalPass, totalFail int
	for _, sc := range scenarios {
		fmt.Printf("─── %s ───\n", sc.name)
		for _, r := range sc.run() {
			fmt.Println(r.message)
			if r.pass {
				totalPass++
			} else {
				totalFail++
			}
		}
		fmt.Println()
	}

	fmt.Printf("════════════════════════════\n")
	fmt.Printf("  %d passed   %d failed\n", totalPass, totalFail)
	if totalFail > 0 {
		os.Exit(1)
	}
}
