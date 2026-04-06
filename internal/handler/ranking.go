package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"contents-ranking/internal/models"
	"contents-ranking/internal/repository"
)

const (
	defaultLimit = 10
	maxLimit     = 100
	cacheTTL     = 1 * time.Second
)

type rankingCache struct {
	mu        sync.RWMutex
	data      []models.RankingItem
	expiresAt time.Time
}

func (c *rankingCache) get() ([]models.RankingItem, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	now := time.Now()
	if now.Before(c.expiresAt) {
		return c.data, true
	}
	return nil, false
}

func (c *rankingCache) set(data []models.RankingItem) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data = data
	c.expiresAt = time.Now().Add(cacheTTL)
}

type trendingCache struct {
	mu        sync.RWMutex
	data      []models.TrendingItem
	expiresAt time.Time
}

func (c *trendingCache) get() ([]models.TrendingItem, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	now := time.Now()
	if now.Before(c.expiresAt) {
		return c.data, true
	}
	return nil, false
}

func (c *trendingCache) set(data []models.TrendingItem) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data = data
	c.expiresAt = time.Now().Add(cacheTTL)
}

type RankingHandler struct {
	repo          *repository.RankingRepo
	cache         rankingCache
	trendingCache trendingCache
}

func NewRankingHandler(repo *repository.RankingRepo) *RankingHandler {
	return &RankingHandler{repo: repo}
}

func (h *RankingHandler) HandleGetRanking(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := int64(defaultLimit)
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || n <= 0 {
			http.Error(w, "invalid limit", http.StatusBadRequest)
			return
		}
		if n > maxLimit {
			n = maxLimit
		}
		limit = n
	}

	// Serve from cache when fresh. Cache stores up to maxLimit items,
	// so any valid limit can be satisfied without a Redis call.
	if full, ok := h.cache.get(); ok {
		h.writeJSON(w, slice(full, limit))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	items, err := h.repo.GetTopRankings(ctx, maxLimit)
	if err != nil {
		log.Printf("handler: GetTopRankings error: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	if os.Getenv("DEBUG") != "" && len(items) > 0 {
		log.Printf("handler: ranking from ranking:global count=%d first=%q score=%.0f",
			len(items), items[0].VideoID, items[0].Score)
	}

	h.cache.set(items)
	h.writeJSON(w, slice(items, limit))
}

// HandleGetTrending returns the top videos by velocity score over the last
// sliding window (60s), highest first. Separate cache from main ranking.
func (h *RankingHandler) HandleGetTrending(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := int64(defaultLimit)
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || n <= 0 {
			http.Error(w, "invalid limit", http.StatusBadRequest)
			return
		}
		if n > maxLimit {
			n = maxLimit
		}
		limit = n
	}

	if full, ok := h.trendingCache.get(); ok {
		h.writeTrendingJSON(w, sliceTrending(full, limit))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	velocities, err := h.repo.GetTopTrending(ctx, maxLimit)
	if err != nil {
		log.Printf("handler: GetTopTrending error: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	ids := make([]string, 0, len(velocities))
	for _, v := range velocities {
		ids = append(ids, v.VideoID)
	}
	globalScores, err := h.repo.GetGlobalScores(ctx, ids)
	if err != nil {
		log.Printf("handler: GetGlobalScores error: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	items := make([]models.TrendingItem, len(velocities))
	for i, v := range velocities {
		score := globalScores[v.VideoID]
		velocity := v.Score
		items[i] = models.TrendingItem{
			VideoID:    v.VideoID,
			Velocity:   velocity,
			Score:      score,
			SpikeScore: velocity / (score + 1),
		}
	}

	h.trendingCache.set(items)
	h.writeTrendingJSON(w, sliceTrending(items, limit))
}

// HandleGetRankingStats returns basic ranking-related stats for observability.
func (h *RankingHandler) HandleGetRankingStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	globalVideos, trendingVideos, velocityKeys, err := h.repo.GetRankingStats(ctx)
	if err != nil {
		log.Printf("handler: GetRankingStats error: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	resp := models.RankingStats{
		GlobalVideos:   globalVideos,
		TrendingVideos: trendingVideos,
		VelocityKeys:   velocityKeys,
		Timestamp:      time.Now().UTC().Format(time.RFC3339Nano),
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("handler: ranking stats encode error: %v", err)
	}
}

func (h *RankingHandler) writeJSON(w http.ResponseWriter, items []models.RankingItem) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(items); err != nil {
		log.Printf("handler: ranking encode error: %v", err)
	}
}

func (h *RankingHandler) writeTrendingJSON(w http.ResponseWriter, items []models.TrendingItem) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(items); err != nil {
		log.Printf("handler: trending encode error: %v", err)
	}
}

// slice returns at most n items without allocating a new backing array.
func slice(items []models.RankingItem, n int64) []models.RankingItem {
	if int64(len(items)) <= n {
		return items
	}
	return items[:n]
}

func sliceTrending(items []models.TrendingItem, n int64) []models.TrendingItem {
	if int64(len(items)) <= n {
		return items
	}
	return items[:n]
}
