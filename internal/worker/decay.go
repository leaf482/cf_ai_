package worker

import (
	"context"
	"log"
	"math"
	"os"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	defaultDecayIntervalSeconds = 5
	defaultDecayFactor          = 0.98

	decayLockKey = "ranking_decay_lock"
)

// StartDecayLoop runs a background task that periodically decays scores
// in the global ranking sorted set by multiplying all scores by a factor.
//
// It runs independently of heartbeat processing and exits when ctx is canceled.
//
// Env:
// - RANKING_DECAY_INTERVAL_SECONDS (default 5)
// - RANKING_DECAY_FACTOR (default 0.98)
func StartDecayLoop(ctx context.Context, rdb *redis.Client) {
	intervalSec := defaultDecayIntervalSeconds
	if raw := os.Getenv("RANKING_DECAY_INTERVAL_SECONDS"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			intervalSec = v
		}
	}

	decayFactor := defaultDecayFactor
	if raw := os.Getenv("RANKING_DECAY_FACTOR"); raw != "" {
		if v, err := strconv.ParseFloat(raw, 64); err == nil && v > 0 && v < 1 {
			decayFactor = v
		}
	}

	// Guard against NaN/Inf
	if math.IsNaN(decayFactor) || math.IsInf(decayFactor, 0) {
		decayFactor = defaultDecayFactor
	}

	workerID := os.Getenv("HOSTNAME")
	if workerID == "" {
		if h, err := os.Hostname(); err == nil && h != "" {
			workerID = h
		} else {
			workerID = "unknown-worker"
		}
	}
	// Ensure uniqueness across multiple processes on the same host.
	workerID = workerID + "-" + strconv.FormatInt(time.Now().UnixNano(), 10)

	ticker := time.NewTicker(time.Duration(intervalSec) * time.Second)
	log.Printf("worker: ranking decay enabled interval=%ds factor=%.4f", intervalSec, decayFactor)

	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				log.Println("worker: ranking decay loop stopped")
				return
			case <-ticker.C:
				// Leader election via Redis lock:
				// SET ranking_decay_lock <worker_id> NX EX 10
				// Only one worker should perform decay per interval.
				acquired, err := rdb.SetNX(ctx, decayLockKey, workerID, 10*time.Second).Result()
				if err != nil {
					if ctx.Err() != nil {
						return
					}
					log.Printf("worker: ranking decay lock error: %v", err)
					continue
				}
				if !acquired {
					continue
				}

				// ZINTERSTORE ranking:global ranking:global WEIGHTS <decayFactor>
				//
				// In go-redis this is represented by ZInterStore(dest, ZStore{Keys, Weights}).
				// This multiplies each score by decayFactor in-place (dest==source).
				if err := rdb.ZInterStore(ctx, rankingKey, &redis.ZStore{
					Keys:    []string{rankingKey},
					Weights: []float64{decayFactor},
				}).Err(); err != nil {
					if ctx.Err() != nil {
						return
					}
					log.Printf("worker: ranking decay error: %v", err)
				}
			}
		}
	}()
}

