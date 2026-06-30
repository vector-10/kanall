package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/vector-10/kanall/internal/config"
)

type NombaProvider struct {
	cfg          *config.Config
	httpClient   *http.Client
	mu           sync.Mutex
	accessToken  string
	refreshToken string
	tokenExpiry  time.Time
}

func NewNombaProvider(cfg *config.Config) *NombaProvider {
	return &NombaProvider{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

type nombaAuthResponse struct {
	Data struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresAt    string `json:"expiresAt"` // ISO-8601 timestamp
	} `json:"data"`
}

func (n *NombaProvider) getToken(ctx context.Context) (string, error) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.accessToken != "" && time.Now().Before(n.tokenExpiry) {
		return n.accessToken, nil
	}

	if n.refreshToken != "" {
		if tok, err := n.doRefresh(ctx); err == nil {
			return tok, nil
		}
	}

	return n.doIssue(ctx)
}

func (n *NombaProvider) doIssue(ctx context.Context) (string, error) {
	body, _ := json.Marshal(map[string]string{
		"clientId":     n.cfg.NombaClientID,
		"clientSecret": n.cfg.NombaClientSecret,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		n.cfg.NombaBaseURL+"/v1/auth/token/issue",
		bytes.NewReader(body),
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("accountId", n.cfg.NombaAccountID)

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("nomba auth/issue failed: status %d", resp.StatusCode)
	}

	var authResp nombaAuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return "", err
	}
	n.accessToken = authResp.Data.AccessToken
	n.refreshToken = authResp.Data.RefreshToken
	n.tokenExpiry = parseTokenExpiry(authResp.Data.ExpiresAt)
	return n.accessToken, nil
}

func (n *NombaProvider) doRefresh(ctx context.Context) (string, error) {
	body, _ := json.Marshal(map[string]string{
		"grant_type":    "refresh_token",
		"refresh_token": n.refreshToken,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		n.cfg.NombaBaseURL+"/v1/auth/token/refresh",
		bytes.NewReader(body),
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("accountId", n.cfg.NombaAccountID)
	req.Header.Set("Authorization", "Bearer "+n.accessToken)

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("nomba auth/refresh failed: status %d", resp.StatusCode)
	}

	var authResp nombaAuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return "", err
	}
	n.accessToken = authResp.Data.AccessToken
	if authResp.Data.RefreshToken != "" {
		n.refreshToken = authResp.Data.RefreshToken
	}
	n.tokenExpiry = parseTokenExpiry(authResp.Data.ExpiresAt)
	return n.accessToken, nil
}

func parseTokenExpiry(expiresAt string) time.Time {
	t, err := time.Parse(time.RFC3339, expiresAt)
	if err != nil || t.Before(time.Now()) {
		return time.Now().Add(55 * time.Minute)
	}
	return t.Add(-5 * time.Minute)
}

func (n *NombaProvider) doRequest(ctx context.Context, method, path string, body any) (*http.Response, error) {
	token, err := n.getToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("auth failed: %w", err)
	}

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, n.cfg.NombaBaseURL+path, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("accountId", n.cfg.NombaAccountID)

	return n.httpClient.Do(req)
}

type nombaVAResponse struct {
	Data struct {
		AccountRef        string `json:"accountRef"`
		AccountHolderID   string `json:"accountHolderId"`
		AccountName       string `json:"accountName"`
		BankName          string `json:"bankName"`
		BankAccountNumber string `json:"bankAccountNumber"`
		BankAccountName   string `json:"bankAccountName"`
		Currency          string `json:"currency"`
		ExpiryDate        string `json:"expiryDate"` // "2026-08-30T12:15:00" — no timezone
		Expired           bool   `json:"expired"`
		CreatedAt         string `json:"createdAt"`
	} `json:"data"`
}

type nombaTxnListResponse struct {
	Data struct {
		Results []struct {
			TransactionID         string  `json:"transactionId"`
			TransactionAmount     int64   `json:"transactionAmount"` // kobo
			Fee                   float64 `json:"fee"`               // naira decimal
			Currency              string  `json:"currency"`
			Type                  string  `json:"type"`
			AliasAccountReference string  `json:"aliasAccountReference"`
			Narration             string  `json:"narration"`
			Time                  string  `json:"time"`
		} `json:"results"`
		Cursor string `json:"cursor"`
	} `json:"data"`
}

func parseNombaVA(r nombaVAResponse) VirtualAccount {
	va := VirtualAccount{
		AccountRef:        r.Data.AccountRef,
		AccountHolderID:   r.Data.AccountHolderID,
		AccountName:       r.Data.BankAccountName, // accountName = sub-account name; customer name is in bankAccountName
		BankName:          r.Data.BankName,
		BankAccountNumber: r.Data.BankAccountNumber,
		BankAccountName:   r.Data.BankAccountName,
		Currency:          r.Data.Currency,
		Expired:           r.Data.Expired,
	}
	if t, err := time.Parse(time.RFC3339, r.Data.CreatedAt); err == nil {
		va.CreatedAt = t
	}
	return va
}

func (n *NombaProvider) Provision(ctx context.Context, customer Customer) (VirtualAccount, error) {
	reqBody := map[string]any{
		"accountRef":  customer.AccountRef,
		"accountName": customer.AccountName,
		"bvn":         customer.BVN,
	}
	if customer.ExpectedAmount != nil {
		// Nomba expects amount in kobo
		reqBody["expectedAmount"] = int64(*customer.ExpectedAmount * 100)
	}

	resp, err := n.doRequest(ctx, http.MethodPost, "/v1/accounts/virtual", reqBody)
	if err != nil {
		return VirtualAccount{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return VirtualAccount{}, fmt.Errorf("nomba provision failed: status %d", resp.StatusCode)
	}

	var r nombaVAResponse
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return VirtualAccount{}, err
	}
	return parseNombaVA(r), nil
}

func (n *NombaProvider) Fetch(ctx context.Context, accountRef string) (VirtualAccount, error) {
	resp, err := n.doRequest(ctx, http.MethodGet, "/v1/accounts/virtual/"+accountRef, nil)
	if err != nil {
		return VirtualAccount{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return VirtualAccount{}, fmt.Errorf("nomba fetch failed: status %d", resp.StatusCode)
	}

	var r nombaVAResponse
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return VirtualAccount{}, err
	}
	return parseNombaVA(r), nil
}

func (n *NombaProvider) Update(ctx context.Context, accountRef string, updates AccountUpdate) (VirtualAccount, error) {
	resp, err := n.doRequest(ctx, http.MethodPut, "/v1/accounts/virtual/"+accountRef, map[string]string{
		"accountName": updates.AccountName,
	})
	if err != nil {
		return VirtualAccount{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return VirtualAccount{}, fmt.Errorf("nomba update failed: status %d", resp.StatusCode)
	}

	// PUT returns only {"data": {"updated": true}} — fetch current state
	return n.Fetch(ctx, accountRef)
}

func (n *NombaProvider) Expire(ctx context.Context, accountRef string) error {
	resp, err := n.doRequest(ctx, http.MethodDelete, "/v1/accounts/virtual/"+accountRef, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("nomba expire failed: status %d", resp.StatusCode)
	}
	return nil
}

func (n *NombaProvider) FetchTransactions(ctx context.Context, from, to time.Time) ([]Transaction, error) {
	const layout = "2006-01-02T15:04:05"
	var all []Transaction
	cursor := ""

	for {
		path := fmt.Sprintf(
			"/v1/transactions/accounts/%s?limit=100&dateFrom=%s&dateTo=%s",
			n.cfg.NombaSubAccountID,
			from.Format(layout),
			to.Format(layout),
		)
		if cursor != "" {
			path += "&cursor=" + cursor
		}

		resp, err := n.doRequest(ctx, http.MethodGet, path, nil)
		if err != nil {
			return nil, err
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("nomba fetch transactions failed: status %d", resp.StatusCode)
		}

		var r nombaTxnListResponse
		if err := json.Unmarshal(body, &r); err != nil {
			return nil, err
		}

		for _, t := range r.Data.Results {
			txn := Transaction{
				TransactionRef: t.TransactionID,
				AccountRef:     t.AliasAccountReference,
				Amount:         float64(t.TransactionAmount) / 100,
				Currency:       t.Currency,
				Direction:      t.Type,
				Narration:      t.Narration,
			}
			if ts, err := time.Parse(time.RFC3339, t.Time); err == nil {
				txn.CreatedAt = ts
			}
			all = append(all, txn)
		}

		if r.Data.Cursor == "" {
			break
		}
		cursor = r.Data.Cursor
	}

	return all, nil
}
