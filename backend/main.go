package main

import (
	"log"
	"net/http"
)

func main() {
	hub := NewHub()

	http.Handle("/", http.FileServer(http.Dir("../frontend")))
	http.HandleFunc("/ws", hub.Serve)

	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
