package email

import (
	"context"
	"log"
)

// NoopSender is used when BREVO_API_KEY is not configured.
// It logs what would have been sent so dev stays unblocked without real credentials.
type NoopSender struct{}

func NewNoopSender() *NoopSender { return &NoopSender{} }

func (s *NoopSender) Send(_ context.Context, msg Message) error {
	log.Printf("email [noop]: to=%s subject=%q (set BREVO_API_KEY to send real emails)", msg.To, msg.Subject)
	return nil
}
