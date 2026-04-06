package worker

import (
	"context"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	defaultTrendingRecomputeIntervalSeconds = 10
	trendingTmpKey                          = "ranking:trending_tmp"
	activeVideosKey                         = "ranking:active_videos"
	velocityCountKeyPrefix                  = "ranking:velocity_count:"
)

// StartTrendingRecompute runs a background task that periodically recomputes the trending
// sorted set from velocity counters.
//
// Algorithm:
// 1. Every N seconds:
// 2. Create a temporary ZSET: ranking:trending_tmp
// 3. Get all active videos from: ranking:active_videos (maintained by heartbeat processors)
// 4. For each video_id, read velocity_count and build trending ZSET
// 5. RENAME ranking:trending_tmp -> ranking:trending (atomic swap)
//
// This decouples trending computation from the heartbeat hot path and avoids expensive SCANs.
//
// Env:
// - TRENDING_RECOMPUTE_INTERVAL_SECONDS (default 10)
func StartTrendingRecompute(ctx context.Context, rdb *redis.Client) {
	intervalSec := defaultTrendingRecomputeIntervalSeconds
	if raw := os.Getenv("TRENDING_RECOMPUTE_INTERVAL_SECONDS"); raw != "" {
		if v, err := strconv.Atoi(raw); v > 0 && err == nil {
			intervalSec = v
		}
	}

	ticker := time.NewTicker(time.Duration(intervalSec) * time.Second)
	log.Printf("worker: trending recompute enabled interval=%ds", intervalSec)

	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				log.Println("worker: trending recompute loop stopped")
				return
			case <-ticker.C:
				if err := recomputeTrending(ctx, rdb); err != nil {
					if ctx.Err() != nil {
						return
					}
					log.Printf("worker: trending recompute error: %v", err)
				}
			}
		}
	}()
}

// recomputeTrending rebuilds the trending ZSET from velocity counters.
// Also performs cleanup by removing inactive videos from ranking:active_videos.
func recomputeTrending(ctx context.Context, rdb *redis.Client) error {
	start := time.Now()

	// Delete any stale tmp key from previous failed runs
	if err := rdb.Del(ctx, trendingTmpKey).Err(); err != nil {
		return err
	}

	// Get all active videos from the set
	activeVideos, err := rdb.SMembers(ctx, activeVideosKey).Result()
	if err != nil {
		return err
	}

	videosProcessed := 0
	entriesAdded := 0
	inactiveRemoved := 0

	// Process each active video
	for _, videoID := range activeVideos {
		videosProcessed++

		// GET velocity_count:<video_id>
		velocityCountKey := velocityCountKeyPrefix + videoID
		velocity, err := rdb.Get(ctx, velocityCountKey).Float64()
		if err != nil && err != redis.Nil {
			return err
		}

		// If velocity counter expired or is zero, remove from active set
		if err == redis.Nil || velocity <= 0 {
			// SREM ranking:active_videos video_id
			if err := rdb.SRem(ctx, activeVideosKey, videoID).Err(); err != nil {
				return err
			}
			inactiveRemoved++
			continue
		}

		// Only add to trending if velocity > 0
		if velocity > 0 {
			// ZADD ranking:trending_tmp velocity video_id
			if err := rdb.ZAdd(ctx, trendingTmpKey, redis.Z{
				Score:  velocity,
				Member: videoID,
			}).Err(); err != nil {
				return err
			}
			entriesAdded++
		}
	}

	// Atomic swap: RENAME ranking:trending_tmp ranking:trending
	if err := rdb.Rename(ctx, trendingTmpKey, "ranking:trending").Err(); err != nil {
		// If the rename fails, clean up the tmp key
		_ = rdb.Del(ctx, trendingTmpKey).Err()
		return err
	}

	duration := time.Since(start)
	if os.Getenv("DEBUG") != "" {
		log.Printf("worker: trending recomputed videos_processed=%d entries_added=%d inactive_removed=%d duration=%v",
			videosProcessed, entriesAdded, inactiveRemoved, duration)
	}

	return nil
}
