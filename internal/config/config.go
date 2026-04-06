package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	KafkaBrokers []string
	KafkaTopic   string
	ServerPort   string
	RedisAddr    string

	BatchSize          int
	BatchFlushInterval time.Duration

	APIProducerQueueSize int
	APIProducerBatchSize int
	APIProducerLinger    time.Duration
}

func LoadConfig() *Config {

	kafkaBrokers := strings.Split(
		getEnv("KAFKA_BROKERS", "kafka:29092"),
		",",
	)

	kafkaTopic := getEnv("KAFKA_TOPIC", "video-heartbeats")

	serverPort := getEnv("PORT", "8080")

	redisAddr := getEnv("REDIS_ADDR", "redis:6379")

	batchSize := getEnvInt("BATCH_SIZE", 50)

	batchFlush := getEnvDuration("BATCH_FLUSH_INTERVAL", "100ms")

	apiQueue := getEnvInt("API_PRODUCER_QUEUE_SIZE", 10000)

	apiBatch := getEnvInt("API_PRODUCER_BATCH_SIZE", 100)

	apiLinger := getEnvDuration("API_PRODUCER_LINGER", "5ms")

	return &Config{
		KafkaBrokers: kafkaBrokers,
		KafkaTopic:   kafkaTopic,
		ServerPort:   serverPort,
		RedisAddr:    redisAddr,

		BatchSize:          batchSize,
		BatchFlushInterval: batchFlush,

		APIProducerQueueSize: apiQueue,
		APIProducerBatchSize: apiBatch,
		APIProducerLinger:    apiLinger,
	}
}

func getEnv(key, fallback string) string {

	if v := os.Getenv(key); v != "" {
		return v
	}

	return fallback
}

func getEnvInt(key string, fallback int) int {

	if v := os.Getenv(key); v != "" {

		i, err := strconv.Atoi(v)

		if err == nil {
			return i
		}
	}

	return fallback
}

func getEnvDuration(key string, fallback string) time.Duration {

	if v := os.Getenv(key); v != "" {

		d, err := time.ParseDuration(v)

		if err == nil {
			return d
		}
	}

	d, _ := time.ParseDuration(fallback)

	return d
}
