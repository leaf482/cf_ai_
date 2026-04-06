package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"

	kafkapkg "contents-ranking/internal/kafka"
	"contents-ranking/internal/models"
)

type Handler struct {
	producer kafkapkg.Producer
}

func NewHandler(p kafkapkg.Producer) *Handler {
	return &Handler{producer: p}
}

func debugLog(format string, args ...interface{}) {
	if os.Getenv("DEBUG") != "" {
		log.Printf("[handler] "+format, args...)
	}
}

// validateHeartbeat checks required fields and returns an error message if invalid.
// Invalid events are rejected before publishing to Kafka.
func validateHeartbeat(e *models.HeartbeatEvent) string {
	if strings.TrimSpace(e.SessionID) == "" {
		return "session_id is required and must not be empty"
	}
	if strings.TrimSpace(e.VideoID) == "" {
		return "video_id is required and must not be empty"
	}
	if e.Playhead < 0 {
		return "playhead must be non-negative"
	}
	if e.Timestamp < 0 {
		return "timestamp must be non-negative when provided"
	}
	return ""
}

func (h *Handler) HandleHeartbeat(w http.ResponseWriter, r *http.Request) {
	debugLog("HandleHeartbeat entered")
	defer debugLog("HandleHeartbeat exited")

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var event models.HeartbeatEvent
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		log.Printf("handler: decode error: %v", err)
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Validation: reject malformed events before publishing to Kafka.
	if errMsg := validateHeartbeat(&event); errMsg != "" {
		log.Printf("handler: validation failed session=%s video=%s playhead=%d timestamp=%d: %s",
			event.SessionID, event.VideoID, event.Playhead, event.Timestamp, errMsg)
		http.Error(w, errMsg, http.StatusBadRequest)
		return
	}

	debugLog("received heartbeat session=%s user=%s video=%s playhead=%dms",
		event.SessionID, event.UserID, event.VideoID, event.Playhead)

	payload, err := json.Marshal(event)
	if err != nil {
		log.Printf("handler: marshal error: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	// Composite key (session_id:video_id) preserves ordering for the same user
	// watching the same video while distributing traffic across partitions when
	// many users watch the same viral video.
	partitionKey := event.SessionID + ":" + event.VideoID
	msg := kafka.Message{
		Key:   []byte(partitionKey),
		Value: payload,
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if err := h.producer.WriteMessages(ctx, msg); err != nil {
		log.Printf("handler: kafka write error (session=%s, video=%s): %v", event.SessionID, event.VideoID, err)
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
		return
	}

	debugLog("published event session=%s video=%s", event.SessionID, event.VideoID)
	w.WriteHeader(http.StatusAccepted)
}
