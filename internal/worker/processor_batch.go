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

// rankBatchScript processes N events in one Redis call using the simplified
// per-heartbeat scoring and velocity semantics with counter-based velocity tracking.
// NOTE: Trending updates have been decoupled and are now computed periodically by background worker.
// Includes TTL expiration to prevent unbounded key growth.
// Active videos are tracked in ranking:active_videos for efficient trending recomputation.
//
// KEYS[1] = ranking key
// KEYS[2] = trending key (not used but passed for consistency)
// ARGV[1] = window_ms
// ARGV[2], ARGV[3] = video_id_1, delta_ms_1
// ARGV[4], ARGV[5] = video_id_2, delta_ms_2
// ...
// TTL Policy: velocity_key and velocity_count_key expire after (window_ms/1000)*2 seconds
// Returns {total_score_increment, last_delta_ms, last_velocity, now_ms, n}.
var rankBatchScript = redis.NewScript(`
local ranking_key = KEYS[1]
local trending_key = KEYS[2]

local window_ms = tonumber(ARGV[1])
local now_parts = redis.call('TIME')
local now_ms = now_parts[1] * 1000 + math.floor(now_parts[2] / 1000)

local total_score = 0
local last_delta = 0
local last_velocity = 0
local last_video = ''

local score_den = ` + fmt.Sprintf("%f", scoreDenominator) + `
local n = math.floor((#ARGV - 1) / 2)

for i = 1, n do
    local video_id = ARGV[1 + (i-1)*2 + 1]
    local delta_ms = tonumber(ARGV[1 + (i-1)*2 + 2])

    if delta_ms and delta_ms > 0 then
        local score_inc = delta_ms / score_den
        redis.call('ZINCRBY', ranking_key, score_inc, video_id)
        total_score = total_score + score_inc

        local velocity_key = 'ranking:velocity:' .. video_id
        local velocity_count_key = 'ranking:velocity_count:' .. video_id
        
        redis.call('ZADD', velocity_key, now_ms, tostring(now_ms) .. ':' .. tostring(i))
        local velocity = redis.call('INCR', velocity_count_key)
        
        local removed = redis.call('ZREMRANGEBYSCORE', velocity_key, '-inf', now_ms - window_ms)
        if removed > 0 then
            velocity = redis.call('DECRBY', velocity_count_key, removed)
        end
        
        redis.call('SADD', 'ranking:active_videos', video_id)
        
        local ttl_seconds = math.ceil(window_ms / 1000 * 2)
        redis.call('EXPIRE', velocity_key, ttl_seconds)
        redis.call('EXPIRE', velocity_count_key, ttl_seconds)

        last_delta = delta_ms
        last_velocity = velocity
        last_video = video_id
    end
end

return {total_score, last_delta, last_velocity, now_ms, n}
`)

// ProcessBatch runs the batch Lua script for multiple events in one Redis call.
func (p *Processor) ProcessBatch(ctx context.Context, msgs []kafka.Message) (ranked int, err error) {
	if len(msgs) == 0 {
		return 0, nil
	}

	start := time.Now()

	keys := []string{rankingKey, trendingKey}

	args := []interface{}{int64(velocityWindowSec * 1000)}
	eventsWithDelta := 0

	var firstEvent *models.HeartbeatEvent
	for _, msg := range msgs {
		var event models.HeartbeatEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			metrics.WorkerEventsProcessedTotal.WithLabelValues("error").Inc()
			return 0, fmt.Errorf("unmarshal: %w", err)
		}
		if firstEvent == nil {
			firstEvent = &event
		}

		deltaMs, ok := p.computeDeltaMs(event.SessionID, event.VideoID, event.Playhead)
		if !ok {
			continue
		}
		args = append(args, event.VideoID, deltaMs)
		eventsWithDelta++
	}

	// If no events produced a positive delta, treat as a successful no-op batch.
	if eventsWithDelta == 0 {
		for range msgs {
			metrics.WorkerEventsProcessedTotal.WithLabelValues("success").Inc()
		}
		duration := time.Since(start).Seconds()
		metrics.WorkerBatchDuration.Observe(duration)
		metrics.WorkerBatchSize.Observe(float64(len(msgs)))
		return 0, nil
	}

	raw, err := rankBatchScript.Run(ctx, p.rdb, keys, args...).Result()
	if err != nil {
		metrics.RedisScriptErrorsTotal.Inc()
		for range msgs {
			metrics.WorkerEventsProcessedTotal.WithLabelValues("error").Inc()
		}
		return 0, fmt.Errorf("lua rankBatchScript: %w", err)
	}

	results, ok := raw.([]interface{})
	if !ok || len(results) < 5 {
		metrics.RedisScriptErrorsTotal.Inc()
		for range msgs {
			metrics.WorkerEventsProcessedTotal.WithLabelValues("error").Inc()
		}
		return 0, fmt.Errorf("lua rankBatchScript: unexpected return type %T", raw)
	}

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

	increments := toFloat(results[0])
	debugDelta := toFloat(results[1])
	debugVelocity := toFloat(results[2])
	debugNow := toFloat(results[3])
	debugCount := toFloat(results[4])

	if os.Getenv("DEBUG") != "" {
		if firstEvent != nil {
			log.Printf("[worker:batch] first event session=%s video=%s playhead=%d",
				firstEvent.SessionID, firstEvent.VideoID, firstEvent.Playhead)
		}
		log.Printf("[worker:batch] batch_size=%d total_score=%.4f last_delta_ms=%.0f last_velocity=%.0f now_ms=%.0f events_in_lua=%0.f",
			len(msgs), increments, debugDelta, debugVelocity, debugNow, debugCount)
	}

	for range msgs {
		metrics.WorkerEventsProcessedTotal.WithLabelValues("success").Inc()
	}
	// Record batch-level metrics separately from per-event metrics to avoid
	// confusing per-event latency dashboards with whole-batch timings.
	duration := time.Since(start).Seconds()
	metrics.WorkerBatchDuration.Observe(duration)
	metrics.WorkerBatchSize.Observe(float64(len(msgs)))

	if increments > 0 {
		metrics.WorkerRankingUpdatesTotal.Add(increments)
		metrics.WorkerRankingVelocityUpdatesTotal.Add(increments)
	}

	return int(increments), nil
}
