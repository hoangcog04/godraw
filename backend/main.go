package main

import (
	"log"
	"net/http"
)

func main() {
	hub := newHub()

	http.Handle("/", http.FileServer(http.Dir("../frontend")))
	http.HandleFunc("/ws", hub.serveWS)

	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
