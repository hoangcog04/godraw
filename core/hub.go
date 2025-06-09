package core

import (
	"encoding/json"
	"log"
	"maps"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{ReadBufferSize: 1024, WriteBufferSize: 1024}

type roomResp struct {
	room *room
	ok   bool
}

type roomWOp struct {
	key  string
	room *room
}

type roomROp struct {
	key        string
	returnOne  chan roomResp
	returnList chan map[string]*room
}

type hub struct {
	// In-server rooms.
	rooms map[string]*room
	// Add room.
	add chan roomWOp
	// Remove room.
	remove chan string
	// Get room.
	get chan roomROp
}

func NewHub() *hub {
	h := &hub{
		rooms:  make(map[string]*room),
		add:    make(chan roomWOp),
		remove: make(chan string),
		get:    make(chan roomROp),
	}
	go h.roomManager()
	return h
}

func (h *hub) roomManager() {
	for {
		select {
		case wReq := <-h.add:
			h.rooms[wReq.key] = wReq.room

		case key := <-h.remove:
			h.delRoomHandler(key)

		case rReq := <-h.get:
			if rReq.returnList != nil {
				copy := make(map[string]*room)
				maps.Copy(copy, h.rooms)
				rReq.returnList <- copy
			} else {
				r, ok := h.rooms[rReq.key]
				rReq.returnOne <- roomResp{r, ok}
			}
		}
	}
}

func (h *hub) Join(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")

	if room, ok := h.getRoom(key); ok {
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

func (h *hub) GetRooms() map[string]*room {
	resultChan := make(chan map[string]*room)
	h.get <- roomROp{returnList: resultChan}
	return <-resultChan
}

func (h *hub) ListRoomAPI(w http.ResponseWriter, r *http.Request) {
	rooms := h.GetRooms()

	var resp []Room
	for _, r := range rooms {
		resp = append(resp, Room{Key: r.key, Players: len(r.clients)})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (h *hub) getRoom(k string) (*room, bool) {
	req := roomROp{key: k, returnOne: make(chan roomResp)}
	h.get <- req
	resp := <-req.returnOne
	return resp.room, resp.ok
}

func (h *hub) AddRoom() {
	// TODO: check the room is exists
	key := genKey(MaxLength)
	room := NewRoom(key, func() { h.delRoom(key) })
	h.add <- roomWOp{key, room}
}

func (h *hub) delRoom(k string) {
	h.remove <- k
}

func (h *hub) delRoomHandler(k string) {
	r, ok := h.rooms[k]
	if !ok {
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
