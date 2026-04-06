package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"contents-ranking/internal/config"
	"contents-ranking/internal/handler"
	"contents-ranking/internal/kafka"
	"contents-ranking/internal/metrics"
	redispkg "contents-ranking/internal/redis"
	"contents-ranking/internal/repository"
)

func main() {
	cfg := config.LoadConfig()

	if err := kafka.EnsureTopicExists(cfg.KafkaBrokers, cfg.KafkaTopic); err != nil {
		log.Fatalf("startup: kafka topic check failed: %v", err)
	}

	// Buffered Kafka producer: API enqueues heartbeats to an in-memory buffer,
	// and a background worker flushes batches to Kafka.
	producer := kafka.NewBufferedProducer(
		cfg.KafkaBrokers,
		cfg.KafkaTopic,
		cfg.APIProducerQueueSize,
		cfg.APIProducerBatchSize,
		cfg.APIProducerLinger,
	)

	rdb, err := redispkg.NewClient(cfg.RedisAddr)
	if err != nil {
		log.Fatalf("startup: redis connection failed: %v", err)
	}
	defer func() {
		if cerr := rdb.Close(); cerr != nil {
			log.Printf("api: redis close error: %v", cerr)
		}
	}()

	rankingRepo := repository.NewRankingRepo(rdb)
	seedCtx, seedCancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := rankingRepo.SeedRankingIfEmpty(seedCtx); err != nil {
		log.Printf("startup: ranking seed warning (non-fatal): %v", err)
	}
	seedCancel()

	h := handler.NewHandler(producer)
	rh := handler.NewRankingHandler(rankingRepo)

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/v1/heartbeat", instrument("/v1/heartbeat", h.HandleHeartbeat))
	mux.HandleFunc("/v1/ranking", instrument("/v1/ranking", rh.HandleGetRanking))
	mux.HandleFunc("/v1/ranking/stats", instrument("/v1/ranking/stats", rh.HandleGetRankingStats))
	// Backwards-compatible trending endpoints:
	mux.HandleFunc("/v1/trending", instrument("/v1/trending", rh.HandleGetTrending))
	mux.HandleFunc("/v1/ranking/trending", instrument("/v1/ranking/trending", rh.HandleGetTrending))

	srv := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: mux,
	}

	go func() {
		log.Printf("API Server is running on port %s", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("api: server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit

	log.Println("api: shutdown signal received")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("api: http shutdown error: %v", err)
	}

	if err := producer.Close(); err != nil {
		log.Printf("api: kafka producer close error: %v", err)
	}

	log.Println("api: shutdown complete")
}

// instrument wraps a HandlerFunc to record request count and latency.
func instrument(path string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next(rw, r)
		metrics.APIRequestDuration.WithLabelValues(r.Method, path).
			Observe(time.Since(start).Seconds())
		metrics.APIRequestsTotal.WithLabelValues(r.Method, path, strconv.Itoa(rw.status)).
			Inc()
	}
}

// statusWriter captures the HTTP status code written by a handler.
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}
