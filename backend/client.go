package main

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

type Client struct {
	conn *websocket.Conn
	hub  *Hub
	send chan []byte
}

func NewClient(c *websocket.Conn, h *Hub) *Client {
	return &Client{c, h, make(chan []byte)}
}

func (c *Client) ReadMessage() {
	defer func() {
		c.hub.removeClient(c)
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		log.Println("pong")
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	// Vòng lặp liên tục đọc tin nhắn từ một client
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		var incomingMsg IncomingMsg
		if err := json.Unmarshal(message, &incomingMsg); err != nil {
			log.Printf("error unmarshaling message: %v", err)
			continue
		}

		if err := c.hub.routeEvent(incomingMsg, c); err != nil {
			log.Printf("error routing event: %v", err)
		}
	}
}

func (c *Client) WriteMessage() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.hub.removeClient(c)
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				if err := c.conn.WriteMessage(websocket.CloseMessage, nil); err != nil {
					log.Println("connection closed", err)
				}
				return
			}

			data, err := json.Marshal(message)
			if err != nil {
				log.Println(err)
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				log.Printf("failed to send message: %v", err)
			}

			log.Println("message sent")
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
