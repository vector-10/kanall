package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/vector-10/kanall/internal/apierror"
	"golang.org/x/time/rate"
)

type limiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	entries map[string]*limiterEntry
	limit   rate.Limit
	burst   int
}

func NewRateLimiter(requestsPerMinute int) *RateLimiter {
	rl := &RateLimiter{
		entries: make(map[string]*limiterEntry),
		limit:   rate.Limit(float64(requestsPerMinute) / 60.0),
		burst:   requestsPerMinute,
	}
	go rl.cleanup()
	return rl
}

func (rl *RateLimiter) get(key string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	e, ok := rl.entries[key]
	if !ok {
		l := rate.NewLimiter(rl.limit, rl.burst)
		rl.entries[key] = &limiterEntry{limiter: l, lastSeen: time.Now()}
		return l
	}
	e.lastSeen = time.Now()
	return e.limiter
}

func (rl *RateLimiter) cleanup() {
	for {
		time.Sleep(time.Minute)
		rl.mu.Lock()
		for key, e := range rl.entries {
			if time.Since(e.lastSeen) > 3*time.Minute {
				delete(rl.entries, key)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *RateLimiter) ByAPIKey(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-API-Key")
		if key == "" {
			key = r.RemoteAddr
		}
		if !rl.get(key).Allow() {
			apierror.Respond(w, apierror.TooManyRequests())
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (rl *RateLimiter) ByIP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rl.get(r.RemoteAddr).Allow() {
			apierror.Respond(w, apierror.TooManyRequests())
			return
		}
		next.ServeHTTP(w, r)
	})
}
