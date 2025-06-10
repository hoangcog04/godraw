package internal

import (
	"fmt"
	"time"
)

type GamePhase int

const TimeLimit = time.Second * 60

const (
	PhaseWaitingForPlayers GamePhase = iota
	PhaseChoosingWord
	PhaseRoundStart
	PhaseRoundEnd
	PhaseGameOver
)

var phaseName = map[GamePhase]string{
	PhaseWaitingForPlayers: "WaitingForPlayers",
	PhaseChoosingWord:      "ChoosingWord",
	PhaseRoundStart:        "RoundStart",
	PhaseRoundEnd:          "RoundEnd",
	PhaseGameOver:          "GameOver",
}

func (gp GamePhase) String() string {
	return phaseName[gp]
}

type GameState struct {
	// The current round number in the game.
	Round int
	// The uname of the player whose turn it is to draw.
	TurnPlayerUname string
	// The word the drawing player has to illustrate.
	WordToGuess string
	// The possible words the drawing player can choose from at the start of their turn.
	WordChoices []string
	// GuessedPlayers holds the uname of players who have correctly guessed the word.
	GuessedPlayers []string
	// GamePhase indicates the current phase of the game
	GamePhase GamePhase
	// The time limit in seconds for the current round.
	RoundTimeLimit int
	// Scores maps player unames to their current scores.
	Scores map[string]int
}

func NewGameState() *GameState {
	return &GameState{
		Round:          0,
		GamePhase:      PhaseWaitingForPlayers,
		RoundTimeLimit: int(TimeLimit),
		Scores:         map[string]int{},
	}
}

func Transition(gp GamePhase) GamePhase {
	switch gp {
	case PhaseWaitingForPlayers:
		return PhaseChoosingWord
	case PhaseChoosingWord:
		return PhaseRoundStart
	case PhaseRoundStart, PhaseGameOver:
		return PhaseRoundEnd
	default:
		panic(fmt.Errorf("unknown: %s", gp))
	}
}
