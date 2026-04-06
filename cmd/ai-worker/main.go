package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/segmentio/kafka-go"

	"contents-ranking/internal/ai"
	"contents-ranking/internal/config"
	"contents-ranking/internal/models"
)

// aiConsumerGroupID is intentionally different from the ranking worker group
// ("contents-ranking-worker") so both consumers receive every message
// independently — no shared offset state.
const aiConsumerGroupID = "contents-ranking-ai-worker"

func main() {
	cfg := config.LoadConfig()

	workerURL := os.Getenv("CLOUDFLARE_WORKER_URL")
	if workerURL == "" {
		log.Fatal("ai-worker: CLOUDFLARE_WORKER_URL is required")
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        cfg.KafkaBrokers,
		Topic:          cfg.KafkaTopic,
		GroupID:        aiConsumerGroupID,
		MinBytes:       1,
		MaxBytes:       10e6,
		CommitInterval: 0, // manual commit for at-least-once delivery
	})
	defer func() {
		if err := reader.Close(); err != nil {
			log.Printf("ai-worker: kafka reader close error: %v", err)
		}
	}()

	ctx, cancel := context.WithCancel(context.Background())

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-quit
		log.Println("ai-worker: shutdown signal received")
		cancel()
	}()

	log.Printf("ai-worker: consuming topic=%s group=%s url=%s",
		cfg.KafkaTopic, aiConsumerGroupID, workerURL)

	for {
		msg, err := reader.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				log.Println("ai-worker: context cancelled, stopping")
				break
			}
			log.Printf("ai-worker: fetch error: %v", err)
			continue
		}

		var event models.HeartbeatEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("ai-worker: unmarshal error offset=%d: %v", msg.Offset, err)
			// Commit and skip — malformed messages won't parse on retry either.
			commitMessage(ctx, reader, msg)
			continue
		}

		if err := ai.Send(workerURL, event); err != nil {
			log.Printf("ai-worker: send failed video=%s session=%s offset=%d: %v",
				event.VideoID, event.SessionID, msg.Offset, err)
			// Commit anyway to avoid blocking the partition on a single bad event.
			// TODO: route to a dead-letter topic for deeper inspection if needed.
		}

		commitMessage(ctx, reader, msg)
	}

	log.Println("ai-worker: shutdown complete")
}

func commitMessage(ctx context.Context, r *kafka.Reader, msg kafka.Message) {
	if err := r.CommitMessages(ctx, msg); err != nil {
		log.Printf("ai-worker: commit error offset=%d: %v", msg.Offset, err)
	}
}
