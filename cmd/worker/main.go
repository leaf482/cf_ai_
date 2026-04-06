package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"contents-ranking/internal/config"
	redispkg "contents-ranking/internal/redis"
	"contents-ranking/internal/worker"
)

const (
	consumerGroupID = "contents-ranking-worker"
	metricsAddr     = ":8081"
)

func main() {
	cfg := config.LoadConfig()

	// Metrics server — runs independently so shutdown of the worker
	// loop doesn't block scraping in-flight.
	go func() {
		mux := http.NewServeMux()
		mux.Handle("/metrics", promhttp.Handler())
		log.Printf("worker: metrics server listening on %s", metricsAddr)
		if err := http.ListenAndServe(metricsAddr, mux); err != nil {
			log.Printf("worker: metrics server error: %v", err)
		}
	}()

	rdb, err := redispkg.NewClient(cfg.RedisAddr)
	if err != nil {
		log.Fatalf("startup: redis connection failed: %v", err)
	}
	defer func() {
		if cerr := rdb.Close(); cerr != nil {
			log.Printf("worker: redis close error: %v", cerr)
		}
	}()

	log.Printf("worker: connected to Redis at %s", cfg.RedisAddr)

	processor := worker.NewProcessor(rdb)
	w := worker.New(cfg.KafkaBrokers, cfg.KafkaTopic, consumerGroupID, processor, cfg.BatchSize, cfg.BatchFlushInterval)
	defer func() {
		if cerr := w.Close(); cerr != nil {
			log.Printf("worker: kafka reader close error: %v", cerr)
		}
	}()

	ctx, cancel := context.WithCancel(context.Background())

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		<-quit
		log.Println("worker: shutdown signal received")
		cancel()
	}()

	// Ranking score decay loop — runs independently of heartbeat processing.
	worker.StartDecayLoop(ctx, rdb)

	// Trending recompute loop — runs independently of heartbeat processing.
	worker.StartTrendingRecompute(ctx, rdb)

	log.Printf("worker: consuming topic=%s group=%s", cfg.KafkaTopic, consumerGroupID)
	w.Run(ctx)

	log.Println("worker: shutdown complete")
}
