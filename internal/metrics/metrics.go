package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// API metrics
	APIRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "api_requests_total",
			Help: "Total number of HTTP requests handled by the API server.",
		},
		[]string{"method", "path", "status"},
	)

	APIRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "api_request_duration_seconds",
			Help:    "HTTP request latency in seconds.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	// API Kafka producer batching metrics
	APIKafkaBatchSize = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "api_kafka_batch_size",
			Help:    "Number of messages flushed in a single Kafka batch from the API.",
			Buckets: prometheus.ExponentialBuckets(1, 2, 10), // 1,2,4,...,512
		},
	)

	APIKafkaBatchFlushTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "api_kafka_batch_flush_total",
			Help: "Total number of Kafka batch flushes performed by the API.",
		},
	)

	APIKafkaQueueDroppedTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "api_kafka_queue_dropped_total",
			Help: "Total number of heartbeat events dropped because the API Kafka queue was full.",
		},
	)

	// P0 observability metrics (explicit names required)
	KafkaEnqueueFailuresTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "kafka_enqueue_failures_total",
			Help: "Total number of Kafka enqueue attempts that failed (e.g., producer queue full).",
		},
	)

	ProducerQueueDepth = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "producer_queue_depth",
			Help: "Current number of messages waiting in the API Kafka producer queue.",
		},
	)

	RedisScriptErrorsTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "redis_script_errors_total",
			Help: "Total number of Redis Lua script execution errors.",
		},
	)

	// Worker metrics
	WorkerEventsProcessedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "worker_events_processed_total",
			Help: "Total number of Kafka messages processed by the worker.",
		},
		[]string{"status"}, // "success" | "error"
	)

	WorkerProcessingDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "worker_processing_duration_seconds",
			Help:    "Time spent processing a single Kafka message in the worker (non-batch path).",
			Buckets: prometheus.DefBuckets,
		},
	)

	WorkerBatchDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "worker_batch_duration_seconds",
			Help:    "Time spent processing a batch of Kafka messages in the worker.",
			Buckets: prometheus.DefBuckets,
		},
	)

	WorkerBatchSize = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "worker_batch_size",
			Help:    "Number of Kafka messages processed in a single worker batch.",
			Buckets: prometheus.ExponentialBuckets(1, 2, 10), // 1,2,4,...,512
		},
	)

	WorkerRankingUpdatesTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "worker_ranking_updates_total",
			Help: "Total number of ranking points awarded (ZINCRBY fired).",
		},
	)

	WorkerRankingVelocityUpdatesTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "ranking_velocity_updates_total",
			Help: "Total number of trending velocity updates (per ranking point).",
		},
	)
)
