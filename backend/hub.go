package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type Hub struct {
	clients  map[*Client]bool
	handlers map[string]MsgHandler
	sync.Mutex
}

func newHub() *Hub {
	h := &Hub{
		clients:  make(map[*Client]bool),
		handlers: map[string]MsgHandler{},
	}
	h.setupHandlers()
	return h
}

func (h *Hub) setupHandlers() {
	h.handlers[BroadcaseMsgType] = SendMessage
}

func SendMessage(m IncomingMsg, c *Client) error {
	var outgoingMsg OutgoingMsg
	if err := json.Unmarshal(m.Payload, &outgoingMsg); err != nil {
		return err
	}

	// Broadcast message to all other clients
	c.hub.broadcast(outgoingMsg, c)
	return nil
}

func (h *Hub) broadcast(msg OutgoingMsg, sender *Client) {
	h.Lock()
	defer h.Unlock()

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("error marshaling message: %v", err)
		return
	}

	// Gửi tin nhắn đến tất cả client khác
	for client := range h.clients {
		if client != sender {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
}

func (h *Hub) routeEvent(m IncomingMsg, c *Client) error {
	if handler, ok := h.handlers[m.Type]; ok {
		if err := handler(m, c); err != nil {
			return err
		}
		return nil
	} else {
		return errors.New("there is no such event type")
	}
}

func (h *Hub) serveWS(w http.ResponseWriter, r *http.Request) {
	log.Println("new connection")

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	client := NewClient(conn, h)
	h.addClient(client)

	go client.ReadMessage()
	go client.WriteMessage()
}

func (h *Hub) addClient(c *Client) {
	h.Lock()
	defer h.Unlock()
	h.clients[c] = true
}

func (h *Hub) removeClient(c *Client) {
	h.Lock()
	defer h.Unlock()
	if _, ok := h.clients[c]; ok {
		c.conn.Close()
		delete(h.clients, c)
	}
}
