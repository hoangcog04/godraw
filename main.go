package main

import (
	"net/http"

	"godraw/internal"
)

func main() {
	hub := internal.NewGame()

	http.Handle("/", http.FileServer(http.Dir("./static")))
	http.HandleFunc("/join-room", hub.JoinRoom)
	http.HandleFunc("/rooms", hub.ListRoom)
	http.HandleFunc("/create-room", hub.CreateRoom)
	http.HandleFunc("/room-status", hub.RoomStatus)

	http.ListenAndServe(":8080", nil)
}
