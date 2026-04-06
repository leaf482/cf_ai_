package worker

import (
	"hash/fnv"
	"sync"
	"sync/atomic"
)

type playheadShard struct {
	mu sync.Mutex
	m  map[string]int64
}

type playheadStore struct {
	shards []playheadShard
	size   int64
}

func newPlayheadStore(nShards int) *playheadStore {
	if nShards <= 0 {
		nShards = 64
	}
	s := &playheadStore{shards: make([]playheadShard, nShards)}
	for i := range s.shards {
		s.shards[i].m = make(map[string]int64, 1024)
	}
	return s
}

func (s *playheadStore) shardFor(key string) *playheadShard {
	h := fnv.New32a()
	_, _ = h.Write([]byte(key))
	idx := int(h.Sum32()) % len(s.shards)
	return &s.shards[idx]
}

func (s *playheadStore) Get(key string) (value int64, ok bool) {
	sh := s.shardFor(key)
	sh.mu.Lock()
	defer sh.mu.Unlock()
	value, ok = sh.m[key]
	return value, ok
}

func (s *playheadStore) Set(key string, value int64) {
	sh := s.shardFor(key)
	sh.mu.Lock()
	defer sh.mu.Unlock()
	if _, exists := sh.m[key]; !exists {
		atomic.AddInt64(&s.size, 1)
	}
	sh.m[key] = value
}

func (s *playheadStore) DeleteRandom(n int) int {
	if n <= 0 {
		return 0
	}
	deleted := 0
	// Best-effort "random-ish" eviction: map iteration order is randomized by Go.
	for i := range s.shards {
		if deleted >= n {
			break
		}
		sh := &s.shards[i]
		sh.mu.Lock()
		for k := range sh.m {
			delete(sh.m, k)
			atomic.AddInt64(&s.size, -1)
			deleted++
			if deleted >= n {
				break
			}
		}
		sh.mu.Unlock()
	}
	return deleted
}

func (s *playheadStore) Size() int {
	return int(atomic.LoadInt64(&s.size))
}

