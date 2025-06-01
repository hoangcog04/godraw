package main

import "encoding/json"

const BroadcaseMsgType string = "broadcast"

type IncomingMsg struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type OutgoingMsg struct {
	Message string `json:"message"`
	From    string `json:"from"`
}

type MsgHandler func(m IncomingMsg, c *Client) error
