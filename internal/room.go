package internal

import (
	"encoding/json"
	"log"
	"sync"
)

type room struct {
	// Room key.
	key string
	// Clients in room.
	clients map[*client]bool
	// Name of the host who created the game
	hostname string
	// Broadcast to every all clients.
	broadcast chan payload
	// Game state
	gamestate *GameState
	mu        sync.RWMutex
}

func NewRoom(k string) *room {
	gs := NewGameState()
	r := &room{
		key:       k,
		clients:   make(map[*client]bool),
		broadcast: make(chan payload),
		gamestate: gs,
	}
	go r.runManager()
	return r
}

func (r *room) runManager() {
	for {
		select {
		case p := <-r.broadcast:
			log.Println("Sending message to all clients")
			r.sendAll(p.msg, p.sender)
		}
	}
}

func (r *room) addClient(c *client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clients[c] = true
	log.Println("Size of connected clients: ", len(r.clients))
	if len(r.clients) == 1 {
		r.hostname = c.username
		log.Println("You got promoted to head of the lobby")
	}
}

func (r *room) removeClient(c *client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.clients, c)
	c.conn.Close()
	log.Println("Size of connected clients: ", len(r.clients))
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
				r.removeClient(c)
			}
		}
	}
}
