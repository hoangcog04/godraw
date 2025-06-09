package main

import (
	"net/http"

	"godraw/internal"
)

func main() {
	hub := internal.NewGame()
	hub.AddRoom()
	hub.AddRoom()

	http.Handle("/", http.FileServer(http.Dir("./static")))
	http.HandleFunc("/ws", hub.JoinRoom)
	http.HandleFunc("/rooms", hub.ListRoom)

	http.ListenAndServe(":8080", nil)
}
