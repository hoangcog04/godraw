package ws

import (
	"encoding/json"
	"log"
	"sync"
	"time"
)

const RoomTimeout = time.Second * 20

type room struct {
	clients map[*client]bool
	key     string
	created time.Time
	timeout *time.Timer
	sync.Mutex
}

func NewRoom(k string, onTimeout func()) *room {
	return &room{
		clients: make(map[*client]bool),
		key:     k,
		created: time.Now(),
		timeout: time.AfterFunc(RoomTimeout, onTimeout),
	}
}

func (r *room) broadcast(msg Message, sender *client) {
	r.Lock()
	defer r.Unlock()

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("error marshaling broadcast message: %v", err)
		return
	}

	for c := range r.clients {
		if c != sender {
			select {
			case c.send <- data:
			default:
				log.Println("forced to close client")
				close(c.send)
				r.delClient(c)
			}
		}
	}
}

func (r *room) addClient(c *client) {
	r.Lock()
	defer r.Unlock()

	r.clients[c] = true
}

func (r *room) delClient(c *client) {
	r.Lock()
	defer r.Unlock()

	if _, exists := r.clients[c]; exists {
		c.conn.Close()
		delete(r.clients, c)
	}
}
