package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type IdentityVerification struct {
	Ref string
}

type IdentityProvider interface {
	VerifyNIN(ctx context.Context, nin string) (*IdentityVerification, error)
}

type MonoIdentityProvider struct {
	secretKey  string
	httpClient *http.Client
}

func NewMonoIdentityProvider(secretKey string) *MonoIdentityProvider {
	return &MonoIdentityProvider{
		secretKey:  secretKey,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (p *MonoIdentityProvider) VerifyNIN(ctx context.Context, nin string) (*IdentityVerification, error) {
	body, err := json.Marshal(map[string]string{"nin": nin})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.withmono.com/v3/lookup/nin", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("mono-sec-key", p.secretKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mono: NIN verification failed (status %d)", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &IdentityVerification{Ref: nin}, nil
}
