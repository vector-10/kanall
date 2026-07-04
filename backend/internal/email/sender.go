package email

import "context"

type Message struct {
	To      string
	ToName  string
	Subject string
	HTML    string
}


type Sender interface {
	Send(ctx context.Context, msg Message) error
}
