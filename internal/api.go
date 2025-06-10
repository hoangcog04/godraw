package internal

import (
	"encoding/json"
	"log"
	"net/http"
)

func (g *game) JoinRoom(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	uname := r.URL.Query().Get("username")

	if room, ok := g.getRoom(key); ok {
		for c := range room.clients {
			if c.username == uname {
				w.WriteHeader(http.StatusBadRequest)
				log.Println("Duplicate name")
				return
			}
		}

		conn, err := upgradeWs(w, r)
		if err != nil {
			log.Println(err)
			return
		}

		client := NewClient(conn, room, uname)
		room.addClient(client)
		go client.readMessage()
		go client.writeMessage()

		log.Println("new connection")
	} else {
		w.WriteHeader(http.StatusNotFound)
		log.Println("room not found")
	}
}

func (g *game) ListRoom(w http.ResponseWriter, r *http.Request) {
	rooms := g.getRooms()

	var resp []map[string]any
	for _, r := range rooms {
		resp = append(resp, map[string]any{"id": r.key, "players": len(r.clients)})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (g *game) CreateRoom(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	var data map[string]any
	err := json.NewDecoder(r.Body).Decode(&data)
	if err != nil {
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	key := genKey()
	room := NewRoom(key)
	g.addRoom(key, room)

	resp := map[string]any{"key": key, "username": data["username"]}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

func (g *game) RoomStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	key := r.URL.Query().Get("key")
	if key == "" {
		http.Error(w, "Room key is required", http.StatusBadRequest)
		return
	}

	if room, ok := g.getRoom(key); ok {
		players := make([]Player, 0)
		for client := range room.clients {
			role := "guesser"
			if client.username == room.hostname {
				role = "drawer"
			}
			players = append(players, Player{
				Username: client.username,
				Role:     role,
			})
		}

		resp := RoomStatusResponse{
			Players:  players,
			Hostname: room.hostname,
			Key:      room.key,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	} else {
		http.Error(w, "Room not found", http.StatusNotFound)
		return
	}
}

type RoomStatusResponse struct {
	Players  []Player `json:"players"`
	Hostname string   `json:"hostname"`
	Key      string   `json:"key"`
}

type Player struct {
	Username string `json:"username"`
	Role     string `json:"role"`
}
