package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// BrevoSender delivers email via Brevo's transactional API.
// endpoint comes from config (BREVO_API_URL) so it can be overridden without
// touching code — same pattern as NOMBA_BASE_URL.
type BrevoSender struct {
	apiKey    string
	endpoint  string
	fromEmail string
	fromName  string
	client    *http.Client
}

func NewBrevoSender(apiKey, endpoint, fromEmail, fromName string) *BrevoSender {
	return &BrevoSender{
		apiKey:    apiKey,
		endpoint:  endpoint,
		fromEmail: fromEmail,
		fromName:  fromName,
		client:    &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *BrevoSender) Send(ctx context.Context, msg Message) error {
	payload, err := json.Marshal(map[string]any{
		"sender":      map[string]string{"name": s.fromName, "email": s.fromEmail},
		"to":          []map[string]string{{"email": msg.To, "name": msg.ToName}},
		"subject":     msg.Subject,
		"htmlContent": msg.HTML,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", s.apiKey) // Brevo uses "api-key", not "Authorization"

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("brevo: unexpected status %d", resp.StatusCode)
	}
	return nil
}
