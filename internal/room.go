package internal

import (
	"encoding/json"
	"log"
)

type room struct {
	// Room key.
	key string
	// Clients in room.
	clients map[*client]bool
	// Register a client.
	register chan *client
	// Unregister a client.
	unregister chan *client
	// Broadcast to every all clients.
	broadcast chan payload
}

func NewRoom(k string) *room {
	r := &room{
		key:        k,
		clients:    make(map[*client]bool),
		register:   make(chan *client),
		unregister: make(chan *client),
		broadcast:  make(chan payload),
	}
	go r.runManager()
	return r
}

func (r *room) runManager() {
	for {
		select {
		case c := <-r.register:
			r.clients[c] = true
			log.Println("Size of connected clients: ", len(r.clients))
		case c := <-r.unregister:
			c.conn.Close()
			// fix
			_, ok := <-c.send
			if !ok {
				close(c.send)
			}
			delete(r.clients, c)
			log.Println("Size of connected clients: ", len(r.clients))
		case p := <-r.broadcast:
			log.Println("Sending message to all clients")
			r.sendAll(p.msg, p.sender)
		}
	}
}

func (r *room) addClient(c *client) {
	r.register <- c
}

func (r *room) sendAll(msg Message, sender *client) {
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
				c.room.unregister <- c
			}
		}
	}
}
