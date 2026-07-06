package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const resendAPIURL = "https://api.resend.com/emails"

type ResendSender struct {
	apiKey    string
	fromEmail string
	fromName  string
	client    *http.Client
}

func NewResendSender(apiKey, fromEmail, fromName string) *ResendSender {
	return &ResendSender{
		apiKey:    apiKey,
		fromEmail: fromEmail,
		fromName:  fromName,
		client:    &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *ResendSender) Send(ctx context.Context, msg Message) error {
	from := fmt.Sprintf("%s <%s>", s.fromName, s.fromEmail)
	payload, err := json.Marshal(map[string]any{
		"from":    from,
		"to":      []string{msg.To},
		"subject": msg.Subject,
		"html":    msg.HTML,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, resendAPIURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend: unexpected status %d: %s", resp.StatusCode, body)
	}
	return nil
}
