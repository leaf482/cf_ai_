package models

type RankingItem struct {
	VideoID string  `json:"video_id"`
	Score   float64 `json:"score"`
}

type RankingStats struct {
	GlobalVideos   int64  `json:"global_videos"`
	TrendingVideos int64  `json:"trending_videos"`
	VelocityKeys   int64  `json:"velocity_keys"`
	Timestamp      string `json:"timestamp"`
}

type TrendingItem struct {
	VideoID    string  `json:"video_id"`
	Velocity   float64 `json:"velocity"`
	Score      float64 `json:"score"`
	SpikeScore float64 `json:"spike_score"`
}
