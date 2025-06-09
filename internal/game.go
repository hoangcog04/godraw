package internal

import (
	"encoding/json"
	"log"
	"maps"
)

type game struct {
	// In-server rooms.
	rooms map[string]*room
	// Add room.
	add chan roomWOp
	// Remove room.
	remove chan string
	// Get room.
	get chan roomROp
}

func NewGame() *game {
	g := &game{
		rooms:  make(map[string]*room),
		add:    make(chan roomWOp),
		remove: make(chan string),
		get:    make(chan roomROp),
	}
	go g.runManager()
	return g
}

func (g *game) runManager() {
	for {
		select {
		case wOp := <-g.add:
			g.rooms[wOp.key] = wOp.room
			log.Println("Size of room: ", len(g.rooms))
		case key := <-g.remove:
			g.removeRoom(key)
			log.Printf("Room %s expired and removed\n", key)
		case rOp := <-g.get:
			if rOp.action == listAction {
				copy := make(map[string]*room)
				maps.Copy(copy, g.rooms)
				rOp.list <- copy
			} else if rOp.action == oneAction {
				r, ok := g.rooms[rOp.key]
				rOp.one <- oneEvent{r, ok}
			}
		}
	}
}

func (g *game) getRoom(k string) (*room, bool) {
	req := roomROp{
		action: oneAction,
		key:    k,
		one:    make(chan oneEvent),
	}
	g.get <- req
	resp := <-req.one
	return resp.room, resp.ok
}

func (g *game) getRooms() map[string]*room {
	req := roomROp{
		action: listAction,
		list:   make(chan listEvent),
	}
	g.get <- req
	return <-req.list
}

func (g *game) addRoom(k string, r *room) {
	g.add <- roomWOp{k, r}
}

func (g *game) removeRoom(k string) {
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
		c.room.unregister <- c
	}
	delete(g.rooms, k)
}
