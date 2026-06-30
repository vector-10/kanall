package email

import "context"

// Message is the provider-agnostic payload passed to any Sender.
// All template output ends up here before being handed to the provider.
type Message struct {
	To      string
	ToName  string
	Subject string
	HTML    string
}

// Sender is the single interface all email providers must implement.
// To swap Brevo for any other provider, create a new struct that satisfies
// this interface and change one line in main.go — nothing else moves.
type Sender interface {
	Send(ctx context.Context, msg Message) error
}
