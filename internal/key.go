package internal

import "math/rand"

const (
	CharSet   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	MaxLength = 6
)

func genKey(length int) string {
	b := make([]byte, length)
	for i := range b {
		b[i] = CharSet[rand.Intn(len(CharSet))]
	}
	return string(b)
}
