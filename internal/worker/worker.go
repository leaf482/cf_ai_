package worker

import (
	"context"
	"log"
	"os"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
)

type Worker struct {
	reader        *kafka.Reader
	processor     *Processor
	batchSize     int
	flushInt      time.Duration
	processorPool int
}

func New(
	brokers []string,
	topic, groupID string,
	processor *Processor,
	batchSize int,
	flushInterval time.Duration,
) *Worker {

	if batchSize <= 0 {
		batchSize = 50
	}

	if flushInterval <= 0 {
		flushInterval = 100 * time.Millisecond
	}

	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		Topic:          topic,
		GroupID:        groupID,
		MinBytes:       1,
		MaxBytes:       10e6,
		CommitInterval: 0,
	})

	return &Worker{
		reader:        r,
		processor:     processor,
		batchSize:     batchSize,
		flushInt:      flushInterval,
		processorPool: 8,
	}
}

func debugLog(format string, args ...interface{}) {
	if os.Getenv("DEBUG") != "" {
		log.Printf("[worker] "+format, args...)
	}
}

func (w *Worker) Run(ctx context.Context) {

	log.Println("worker: starting consumer loop (processor pool mode)")
	log.Printf("worker: batch size=%d flush=%v processors=%d",
		w.batchSize, w.flushInt, w.processorPool)

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	msgCh := make(chan kafka.Message, w.batchSize*16)
	processCh := make(chan []kafka.Message, 100)

	var wg sync.WaitGroup

	// ------------------------------------------------
	// Fetcher goroutine
	// ------------------------------------------------

	wg.Add(1)

	go func() {

		defer wg.Done()
		defer close(msgCh)

		for {

			msg, err := w.reader.FetchMessage(ctx)

			if err != nil {

				if ctx.Err() != nil {
					log.Println("worker: context cancelled, stopping fetch")
					return
				}

				log.Printf("worker: fetch error: %v", err)
				continue
			}

			select {

			case msgCh <- msg:

			case <-ctx.Done():
				return
			}
		}

	}()

	// ------------------------------------------------
	// Processor Pool
	// ------------------------------------------------

	for i := 0; i < w.processorPool; i++ {

		wg.Add(1)

		go func(id int) {

			defer wg.Done()

			for {

				select {

				case batch, ok := <-processCh:

					if !ok {
						return
					}

					ranked, err := w.processor.ProcessBatch(ctx, batch)

					if err != nil {

						log.Printf("processor %d error: %v", id, err)
						continue
					}

					err = w.reader.CommitMessages(ctx, batch...)

					if err != nil {
						log.Printf("commit error: %v", err)
						continue
					}

					debugLog(
						"processor=%d processed batch=%d ranked=%d",
						id,
						len(batch),
						ranked,
					)

				case <-ctx.Done():
					return
				}
			}

		}(i)
	}

	// ------------------------------------------------
	// Batcher
	// ------------------------------------------------

	wg.Add(1)

	go func() {

		defer wg.Done()

		batch := make([]kafka.Message, 0, w.batchSize)

		ticker := time.NewTicker(w.flushInt)

		defer ticker.Stop()

		flush := func() {

			if len(batch) == 0 {
				return
			}

			toProcess := make([]kafka.Message, len(batch))

			copy(toProcess, batch)

			select {

			case processCh <- toProcess:

			case <-ctx.Done():
				return
			}

			batch = batch[:0]
		}

		for {

			select {

			case <-ctx.Done():

				flush()
				close(processCh)
				return

			case msg, ok := <-msgCh:

				if !ok {

					flush()
					close(processCh)
					return
				}

				batch = append(batch, msg)

				if len(batch) >= w.batchSize {

					flush()
					ticker.Reset(w.flushInt)
				}

			case <-ticker.C:

				flush()
			}
		}

	}()

	wg.Wait()

	log.Println("worker: consumer loop stopped")
}

func (w *Worker) Close() error {
	return w.reader.Close()
}
