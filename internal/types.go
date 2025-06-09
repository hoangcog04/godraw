package internal

import (
	"encoding/json"
)

const (
	listAction string = "list"
	oneAction  string = "one"
)

type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type ListRoomResp struct {
	Key     string `json:"id"`
	Players int    `json:"players"`
}

type payload struct {
	msg    Message
	sender *client
}

type oneEvent struct {
	room *room
	ok   bool
}
type listEvent map[string]*room

type roomWOp struct {
	key  string
	room *room
}

type roomROp struct {
	action string
	key    string
	one    chan oneEvent
	list   chan listEvent
}
