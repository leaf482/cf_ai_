package models

// All time fields use milliseconds.
type HeartbeatEvent struct {
	SessionID string `json:"session_id"`
	UserID    string `json:"user_id"`
	VideoID   string `json:"video_id"`
	Playhead  int64  `json:"playhead"`  // ms
	Timestamp int64  `json:"timestamp"` // Unix ms
}
