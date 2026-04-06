package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"

	"contents-ranking/internal/metrics"
	"contents-ranking/internal/models"
)

const (
	rankingKey        = "ranking:global"
	trendingKey       = "ranking:trending"
	velocityWindowSec = 60
	scoreDenominator  = 5_000.0 // ms per ranking point
)

// rankScript implements simplified per-heartbeat ranking and velocity updates.
// NOTE: Trending updates have been decoupled and are now computed periodically by background worker.
//
// For each heartbeat event:
//   - delta_ms           = ARGV[2]
//   - score_increment    = delta_ms / scoreDenominator
//   - ZINCRBY ranking:global score_increment video_id
//   - ZADD velocity:<video_id> now_ms now_ms
//   - INCR velocity_count:<video_id>
//   - removed = ZREMRANGEBYSCORE velocity:<video_id> -inf (now_ms - window_ms)
//   - if removed > 0: DECRBY velocity_count:<video_id> removed
//   - velocity = GET velocity_count:<video_id>
//   - SADD ranking:active_videos video_id (track for trending recompute)
//   - EXPIRE velocity:<video_id> (window_ms/1000)*2
//   - EXPIRE velocity_count:<video_id> (window_ms/1000)*2
//
// KEYS[1] = ranking key (not used but passed for consistency)
// KEYS[2] = trending key (not used but passed for consistency)
// ARGV[1] = video_id
// ARGV[2] = delta_ms
// ARGV[3] = window_ms
// Returns {score_increment, velocity, delta_ms}.
var rankScript = redis.NewScript(`
local ranking_key = KEYS[1]
local trending_key = KEYS[2]

local video_id = ARGV[1]
local delta_ms = tonumber(ARGV[2])
local window_ms = tonumber(ARGV[3])

if not delta_ms or delta_ms <= 0 then
    return {0, 0, delta_ms or 0}
end

local score_inc = delta_ms / ` + fmt.Sprintf("%f", scoreDenominator) + `
redis.call('ZINCRBY', ranking_key, score_inc, video_id)

local now_parts = redis.call('TIME')
local now_ms = now_parts[1] * 1000 + math.floor(now_parts[2] / 1000)
local velocity_key = 'ranking:velocity:' .. video_id
local velocity_count_key = 'ranking:velocity_count:' .. video_id

redis.call('ZADD', velocity_key, now_ms, now_ms)
redis.call('INCR', velocity_count_key)

local removed = redis.call('ZREMRANGEBYSCORE', velocity_key, '-inf', now_ms - window_ms)
if removed > 0 then
    redis.call('DECRBY', velocity_count_key, removed)
end

local velocity = tonumber(redis.call('GET', velocity_count_key)) or 0

redis.call('SADD', 'ranking:active_videos', video_id)

local ttl_seconds = math.ceil(window_ms / 1000 * 2)
redis.call('EXPIRE', velocity_key, ttl_seconds)
redis.call('EXPIRE', velocity_count_key, ttl_seconds)

return {score_inc, velocity, delta_ms}
`)

// Processor handles the business logic for a single heartbeat event.
type Processor struct {
	rdb *redis.Client

	playheads *playheadStore
}

func NewProcessor(rdb *redis.Client) *Processor {
	return &Processor{
		rdb:       rdb,
		playheads: newPlayheadStore(64),
	}
}

const (
	playheadStateMaxEntries = 100_000
	playheadEvictBatch      = 1_000
	playheadDeltaClampMs    = int64(10_000)
)

// computeDeltaMs returns (delta_ms, ok). ok==true means delta_ms > 0 and should be processed.
// This state is intentionally kept in-memory only (no Redis session keys).
func (p *Processor) computeDeltaMs(sessionID, videoID string, currentPlayhead int64) (int64, bool) {
	key := sessionID + ":" + videoID

	prev, exists := p.playheads.Get(key)
	p.playheads.Set(key, currentPlayhead)

	// Best-effort cleanup to bound memory under untrusted/high-cardinality traffic.
	if p.playheads.Size() > playheadStateMaxEntries {
		p.playheads.DeleteRandom(playheadEvictBatch)
	}

	if !exists {
		return 0, false
	}

	delta := currentPlayhead - prev
	if delta <= 0 {
		return 0, false
	}
	if delta > playheadDeltaClampMs {
		delta = playheadDeltaClampMs
	}
	return delta, true
}

func (p *Processor) Process(ctx context.Context, msg kafka.Message) error {
	start := time.Now()

	var event models.HeartbeatEvent
	if err := json.Unmarshal(msg.Value, &event); err != nil {
		metrics.WorkerEventsProcessedTotal.WithLabelValues("error").Inc()
		return fmt.Errorf("unmarshal: %w", err)
	}

	if os.Getenv("DEBUG") != "" {
		log.Printf("worker: received event session=%s user=%s video=%s playhead=%dms",
			event.SessionID, event.UserID, event.VideoID, event.Playhead)
	}

	deltaMs, ok := p.computeDeltaMs(event.SessionID, event.VideoID, event.Playhead)
	if !ok {
		metrics.WorkerEventsProcessedTotal.WithLabelValues("success").Inc()
		metrics.WorkerProcessingDuration.Observe(time.Since(start).Seconds())
		return nil
	}

	raw, err := rankScript.Run(ctx, p.rdb,
		[]string{rankingKey, trendingKey},
		event.VideoID,
		deltaMs,
		int64(velocityWindowSec*1000),
	).Result()
	if err != nil {
		metrics.RedisScriptErrorsTotal.Inc()
		metrics.WorkerEventsProcessedTotal.WithLabelValues("error").Inc()
		return fmt.Errorf("lua rankScript (session=%s video=%s): %w",
			event.SessionID, event.VideoID, err)
	}

	results, ok := raw.([]interface{})
	if !ok || len(results) < 3 {
		metrics.RedisScriptErrorsTotal.Inc()
		metrics.WorkerEventsProcessedTotal.WithLabelValues("error").Inc()
		return fmt.Errorf("lua rankScript (session=%s video=%s): unexpected return type %T",
			event.SessionID, event.VideoID, raw)
	}

	// Lua returns: {score_increment, velocity, delta_ms}
	toFloat := func(v interface{}) float64 {
		switch t := v.(type) {
		case int64:
			return float64(t)
		case int:
			return float64(t)
		case float64:
			return t
		case string:
			val, _ := strconv.ParseFloat(t, 64)
			return val
		default:
			return 0
		}
	}

	scoreInc := toFloat(results[0])
	velocity := toFloat(results[1])
	delta := toFloat(results[2])

	metrics.WorkerEventsProcessedTotal.WithLabelValues("success").Inc()
	metrics.WorkerProcessingDuration.Observe(time.Since(start).Seconds())

	if os.Getenv("DEBUG") != "" {
		log.Printf("lua debug video=%s delta_ms=%.0f score_inc=%.4f velocity=%.0f",
			event.VideoID, delta, scoreInc, velocity)
	}

	if scoreInc > 0 {
		metrics.WorkerRankingUpdatesTotal.Add(scoreInc)
		metrics.WorkerRankingVelocityUpdatesTotal.Add(scoreInc)
		if os.Getenv("DEBUG") != "" {
			log.Printf("[RANKING UPDATED] VideoID: %s, UserID: %s, score_inc=%.4f",
				event.VideoID, scoreInc)
		}
	}

	return nil
}
