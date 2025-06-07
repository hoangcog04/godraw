package main

import (
	"log"
	"net/http"

	"godraw/core/ws"
)

func main() {
	hub := ws.NewHub()
	hub.AddRoom()
	hub.AddRoom()

	http.Handle("/", http.FileServer(http.Dir("./static")))
	http.HandleFunc("/ws", hub.Join)
	http.HandleFunc("/rooms", hub.ShowRooms)

	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
