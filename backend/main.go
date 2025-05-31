package main

import (
	"log"
	"net/http"
)

func main() {
	setupAPI()

	log.Fatal(http.ListenAndServe(":8080", nil))
}

func setupAPI() {
	// manager := NewManager()

	http.Handle("/", http.FileServer(http.Dir("../frontend")))
	// whatever we get a new request at slash ws
	// the manager will take the request and upgrade it into ws
	// http.HandleFunc("/ws", manager.serveWS)
}
