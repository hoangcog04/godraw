package main

import "encoding/json"

type Message struct {
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
	RoomId    string          `json:"roomId"`
	PlayerId  string          `json:"playerId"`
	Timestamp int64           `json:"timestamp"`
}
