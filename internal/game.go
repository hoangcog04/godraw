package internal

import (
	"encoding/json"
	"log"
	"maps"
	"sync"
)

type game struct {
	// In-server rooms.
	rooms map[string]*room
	mu    sync.RWMutex
}

func NewGame() *game {
	g := &game{rooms: make(map[string]*room)}
	return g
}

func (g *game) getRoom(k string) (*room, bool) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	r, ok := g.rooms[k]
	return r, ok
}

func (g *game) getRooms() map[string]*room {
	g.mu.RLock()
	defer g.mu.RUnlock()

	return maps.Clone(g.rooms)
}

func (g *game) addRoom(k string, r *room) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.rooms[k] = r
	log.Println("Size of room: ", len(g.rooms))
}

func (g *game) removeRoom(k string) {
	g.mu.Lock()
	defer g.mu.Unlock()

	r, ok := g.rooms[k]
	if !ok {
		return
	}

	msg := Message{
		Type: "-1",
		Data: json.RawMessage(`{"message": "This room is deleted"}`),
	}
	r.broadcast <- payload{msg: msg, sender: nil}

	for c := range r.clients {
		r.removeClient(c)
	}
	delete(g.rooms, k)
	log.Printf("Room %s expired and removed\n", k)
}
