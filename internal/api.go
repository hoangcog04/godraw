package internal

import (
	"encoding/json"
	"log"
	"net/http"
)

func (g *game) JoinRoom(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")

	if room, ok := g.getRoom(key); ok {
		conn, err := upgradeWs(w, r)
		if err != nil {
			log.Println(err)
			return
		}

		client := NewClient(conn, room)
		room.addClient(client)
		go client.ReadMessage()
		go client.WriteMessage()

		log.Println("new connection")
	} else {
		w.WriteHeader(http.StatusNotFound)
		log.Println("room not found")
	}
}

func (g *game) ListRoom(w http.ResponseWriter, r *http.Request) {
	rooms := g.getRooms()

	var resp []ListRoomResp
	for _, r := range rooms {
		resp = append(resp, ListRoomResp{Key: r.key, Players: len(r.clients)})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (g *game) AddRoom() {
	key := genKey(MaxLength)
	room := NewRoom(key)
	g.addRoom(key, room)
}
