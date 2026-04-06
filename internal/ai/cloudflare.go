package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"contents-ranking/internal/models"
)

const (
	requestTimeout = 5 * time.Second
	retryDelay     = 500 * time.Millisecond
	maxAttempts    = 2
)

// httpClient is package-level so it is reused across calls (connection pooling).
var httpClient = &http.Client{Timeout: requestTimeout}

// Send POSTs a HeartbeatEvent to the Cloudflare Worker URL as JSON.
// It retries once (total 2 attempts) on any network or non-2xx error.
func Send(workerURL string, event models.HeartbeatEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("cf: marshal event: %w", err)
	}

	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if attempt > 1 {
			time.Sleep(retryDelay)
		}

		lastErr = doPost(workerURL, payload, event.VideoID, attempt)
		if lastErr == nil {
			return nil
		}
	}

	return lastErr
}

func doPost(url string, payload []byte, videoID string, attempt int) error {
	ctx, cancel := context.WithTimeout(context.Background(), requestTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("cf: build request (attempt %d): %w", attempt, err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		log.Printf("ai-worker: cloudflare send error video=%s attempt=%d err=%v", videoID, attempt, err)
		return fmt.Errorf("cf: http post (attempt %d): %w", attempt, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("ai-worker: cloudflare bad status video=%s attempt=%d status=%d", videoID, attempt, resp.StatusCode)
		return fmt.Errorf("cf: unexpected status %d (attempt %d)", resp.StatusCode, attempt)
	}

	log.Printf("ai-worker: cloudflare ok video=%s attempt=%d status=%d", videoID, attempt, resp.StatusCode)
	return nil
}
