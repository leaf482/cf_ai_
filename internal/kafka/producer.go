package kafka

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"os"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/segmentio/kafka-go"

	"contents-ranking/internal/metrics"
)

// Producer interface keeps handler testable
type Producer interface {
	WriteMessages(ctx context.Context, msgs ...kafka.Message) error
	Close() error
}

var (
	ErrQueueFull      = errors.New("kafka producer queue is full")
	ErrProducerClosed = errors.New("kafka producer is closed")
)

type kafkaProducer struct {
	writer *kafka.Writer
}

func NewProducer(brokers []string, topic string) Producer {

	requiredAcks := kafka.RequireOne
	if os.Getenv("KAFKA_REQUIRED_ACKS") == "all" {
		requiredAcks = kafka.RequireAll
	}

	w := &kafka.Writer{
		Addr:                   kafka.TCP(brokers...),
		Topic:                  topic,
		Balancer:               &kafka.Hash{},
		Async:                  false,
		BatchSize:              1,
		BatchTimeout:           5 * time.Millisecond,
		BatchBytes:             1 << 20,
		WriteTimeout:           2 * time.Second,
		ReadTimeout:            2 * time.Second,
		RequiredAcks:           requiredAcks,
		AllowAutoTopicCreation: false,
	}

	return &kafkaProducer{writer: w}
}

func (p *kafkaProducer) WriteMessages(ctx context.Context, msgs ...kafka.Message) error {
	return p.writer.WriteMessages(ctx, msgs...)
}

func (p *kafkaProducer) Close() error {
	return p.writer.Close()
}

type bufferedProducer struct {
	base      *kafkaProducer
	queue     chan kafka.Message
	maxBatch  int
	linger    time.Duration
	wg        sync.WaitGroup
	debugLogs bool
	mu        sync.RWMutex
	closed    uint32
}

func NewBufferedProducer(
	brokers []string,
	topic string,
	queueSize int,
	maxBatch int,
	linger time.Duration,
) Producer {

	base := NewProducer(brokers, topic).(*kafkaProducer)

	if queueSize <= 0 {
		queueSize = 10000
	}

	if maxBatch <= 0 {
		maxBatch = 100
	}

	if linger <= 0 {
		linger = 5 * time.Millisecond
	}

	p := &bufferedProducer{
		base:      base,
		queue:     make(chan kafka.Message, queueSize),
		maxBatch:  maxBatch,
		linger:    linger,
		debugLogs: os.Getenv("DEBUG") != "",
	}

	metrics.ProducerQueueDepth.Set(0)
	p.wg.Add(1)
	go p.run()

	return p
}

func (p *bufferedProducer) WriteMessages(ctx context.Context, msgs ...kafka.Message) error {

	if atomic.LoadUint32(&p.closed) != 0 {
		return ErrProducerClosed
	}

	p.mu.RLock()
	defer p.mu.RUnlock()

	if atomic.LoadUint32(&p.closed) != 0 {
		return ErrProducerClosed
	}

	for _, m := range msgs {

		select {

		case p.queue <- m:
			metrics.ProducerQueueDepth.Set(float64(len(p.queue)))

		default:

			metrics.KafkaEnqueueFailuresTotal.Inc()

			if p.debugLogs {
				log.Printf("api: kafka queue full key=%s", string(m.Key))
			}

			return ErrQueueFull
		}
	}
	return nil
}

func (p *bufferedProducer) run() {

	defer p.wg.Done()
	ticker := time.NewTicker(p.linger)
	defer ticker.Stop()
	batch := make([]kafka.Message, 0, p.maxBatch)

	flush := func() {

		if len(batch) == 0 {
			return
		}

		start := time.Now()
		size := len(batch)
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		err := p.base.WriteMessages(ctx, batch...)
		cancel()
		elapsed := time.Since(start)

		if err != nil {

			log.Printf(
				"api: kafka batch write error batch=%d elapsed=%s err=%v",
				size,
				elapsed,
				err,
			)

		} else if p.debugLogs {

			log.Printf(
				"api: kafka flush ok batch=%d elapsed=%s",
				size,
				elapsed,
			)
		}

		metrics.APIKafkaBatchSize.Observe(float64(size))
		metrics.APIKafkaBatchFlushTotal.Inc()
		batch = batch[:0]
	}

	for {

		select {

		case msg, ok := <-p.queue:

			if !ok {
				flush()
				metrics.ProducerQueueDepth.Set(0)
				return
			}

			batch = append(batch, msg)
			metrics.ProducerQueueDepth.Set(float64(len(p.queue)))

			if len(batch) >= p.maxBatch {
				flush()
			}

		case <-ticker.C:
			flush()
		}
	}
}

func (p *bufferedProducer) Close() error {

	if !atomic.CompareAndSwapUint32(&p.closed, 0, 1) {
		return nil
	}

	p.mu.Lock()
	close(p.queue)
	p.mu.Unlock()
	p.wg.Wait()

	return p.base.Close()
}

func EnsureTopicExists(brokers []string, topic string) error {

	if len(brokers) == 0 {
		return fmt.Errorf("kafka: no brokers provided")
	}

	conn, err := kafka.DialContext(context.Background(), "tcp", brokers[0])

	if err != nil {
		return fmt.Errorf("kafka: dial %s: %w", brokers[0], err)
	}

	defer conn.Close()
	controller, err := conn.Controller()

	if err != nil {
		return fmt.Errorf("kafka: fetch controller: %w", err)
	}

	controllerAddr := net.JoinHostPort(controller.Host, strconv.Itoa(controller.Port))
	ctrlConn, err := kafka.DialContext(context.Background(), "tcp", controllerAddr)

	if err != nil {
		return fmt.Errorf("kafka: dial controller %s: %w", controllerAddr, err)
	}

	defer ctrlConn.Close()
	err = ctrlConn.CreateTopics(kafka.TopicConfig{
		Topic:             topic,
		NumPartitions:     24,
		ReplicationFactor: 1,
	})

	if err != nil {
		return fmt.Errorf("kafka: create topic %q: %w", topic, err)
	}

	log.Printf("kafka: topic %q is ready", topic)

	return nil
}
