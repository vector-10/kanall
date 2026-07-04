package email

import (
	"context"
	"log"
)

type NoopSender struct{}

func NewNoopSender() *NoopSender { return &NoopSender{} }

func (s *NoopSender) Send(_ context.Context, msg Message) error {
	log.Printf("email [noop]: to=%s subject=%q (set BREVO_API_KEY to send real emails)", msg.To, msg.Subject)
	return nil
}
