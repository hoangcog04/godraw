package ws

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

type client struct {
	conn *websocket.Conn
	hub  *hub
	send chan []byte
}

func NewClient(c *websocket.Conn, h *hub) *client {
	return &client{c, h, make(chan []byte)}
}

func (c *client) readMessage() {
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

	// Loop to read messages from a single client
	for {
		_, payload, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error from readmsg: %v", err)
			}
			break
		}
		log.Println("Received message: ", payload)

		var msg Message
		if err := json.Unmarshal(payload, &msg); err != nil {
			log.Printf("error unmarshaling message from readmsg: %v, message: %s", err, string(payload))
		}

		c.hub.broadcast(msg, c)
	}
}

func (c *client) writeMessage() {
	ticker := time.NewTicker(pingPeriod)

	defer func() {
		ticker.Stop()
		c.hub.removeClient(c)
	}()

	for {
		select {
		case msg, ok := <-c.send:
			if !ok {
				if err := c.conn.WriteMessage(websocket.CloseMessage, nil); err != nil {
					log.Println("connection closed from writemsg", err)
				}
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				log.Printf("failed to send message from writemsg: %v", err)
			}

			log.Println("message sent")
		case <-ticker.C:
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
