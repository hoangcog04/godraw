package main

import (
	"log"
	"net/http"

	"godraw/core"
)

func main() {
	hub := core.NewHub()
	hub.AddRoom()
	hub.AddRoom()

	http.Handle("/", http.FileServer(http.Dir("./static")))
	http.HandleFunc("/ws", hub.Join)
	http.HandleFunc("/rooms", hub.ListRoomAPI)

	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
