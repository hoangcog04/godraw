package core

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	PongWait       = time.Second * 60
	PingPeriod     = (PongWait * 9) / 10
	MaxMessageSize = 512
)

type client struct {
	conn *websocket.Conn
	room *room
	send chan []byte
}

func newClient(c *websocket.Conn, r *room) *client {
	return &client{c, r, make(chan []byte, 16)}
}

func (c *client) readMessage() {
	defer func() { c.room.delClient(c) }()

	c.conn.SetReadLimit(MaxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(PongWait))
	c.conn.SetPongHandler(func(string) error {
		log.Println("pong")
		c.conn.SetReadDeadline(time.Now().Add(PongWait))
		return nil
	})

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

		c.room.broadcast(msg, c)
	}
}

func (c *client) writeMessage() {
	ticker := time.NewTicker(PingPeriod)

	defer func() {
		ticker.Stop()
		c.room.delClient(c)
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
