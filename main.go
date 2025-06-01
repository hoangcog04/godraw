package main

import (
	"log"
	"net/http"

	"godraw/core/ws"
)

func main() {
	hub := ws.NewHub()

	http.Handle("/", http.FileServer(http.Dir("./static")))
	http.HandleFunc("/ws", hub.Serve)

	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
