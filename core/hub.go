package core

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{ReadBufferSize: 1024, WriteBufferSize: 1024}

type hub struct {
	rooms map[string]*room
	sync.Mutex
}

func NewHub() *hub {
	return &hub{rooms: make(map[string]*room)}
}

func (h *hub) Join(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")

	if room, exists := h.getRoom(key); exists {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println(err)
			return
		}

		client := newClient(conn, room)
		client.room.addClient(client)

		go client.readMessage()
		go client.writeMessage()

		log.Println("new connection")
	} else {
		w.WriteHeader(http.StatusNotFound)
		log.Println("room not found")
	}
}

func (h *hub) ShowRooms(w http.ResponseWriter, r *http.Request) {
	h.Lock()
	defer h.Unlock()

	var resp []Room
	for _, r := range h.rooms {
		resp = append(resp, Room{Key: r.key, Players: len(r.clients)})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (h *hub) AddRoom() {
	h.Lock()
	defer h.Unlock()

	// TODO: check the room is exists
	key := genKey(MaxLength)
	room := NewRoom(key, func() { h.delRoom(key) })
	h.rooms[key] = room
}

func (h *hub) getRoom(k string) (*room, bool) {
	h.Lock()
	defer h.Unlock()

	if r, exists := h.rooms[k]; exists {
		return r, true
	}
	return nil, false
}

func (h *hub) delRoom(k string) {
	h.Lock()
	defer h.Unlock()

	r, exists := h.rooms[k]
	if !exists {
		return
	}

	msg := Message{Type: "expired"}
	r.broadcast(msg, nil)

	r.Lock()
	defer r.Unlock()

	if r.timeout != nil {
		r.timeout.Stop()
	}

	for c := range r.clients {
		if c.conn != nil {
			c.conn.Close()
		}
		select {
		case <-c.send:
		default:
			close(c.send)
		}
	}

	delete(h.rooms, k)

	log.Printf("Room %s expired and removed\n", k)
}
