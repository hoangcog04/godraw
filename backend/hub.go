package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{ReadBufferSize: 1024, WriteBufferSize: 1024}

type hub struct {
	clients map[*client]bool
	sync.Mutex
}

func NewHub() *hub {
	return &hub{clients: make(map[*client]bool)}
}

func (h *hub) broadcast(msg Message, sender *client) {
	h.Lock()
	defer h.Unlock()

	data, err := json.Marshal(msg) // to json
	if err != nil {
		log.Printf("error marshaling broadcast message: %v", err)
		return
	}

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

func (h *hub) Serve(w http.ResponseWriter, r *http.Request) {
	log.Println("new connection")

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	client := NewClient(conn, h)
	h.addClient(client)

	go client.readMessage()
	go client.writeMessage()
}

func (h *hub) addClient(c *client) {
	h.Lock()
	defer h.Unlock()
	h.clients[c] = true
}

func (h *hub) removeClient(c *client) {
	h.Lock()
	defer h.Unlock()
	if _, ok := h.clients[c]; ok {
		c.conn.Close()
		delete(h.clients, c)
	}
}
