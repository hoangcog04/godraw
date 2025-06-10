package internal

import "math/rand"

const (
	CharSet   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	MaxLength = 6
)

func genKey() string {
	b := make([]byte, MaxLength)
	for i := range b {
		b[i] = CharSet[rand.Intn(len(CharSet))]
	}
	return string(b)
}
