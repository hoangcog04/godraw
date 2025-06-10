package internal

import (
	"encoding/json"
)

type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type payload struct {
	msg    Message
	sender *client
}
