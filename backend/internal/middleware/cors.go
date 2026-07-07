package middleware

import (
	"net/http"
	"strings"
)

// CORSWithOrigin accepts a comma-separated list of allowed origins.
// It reflects the request origin back only when it matches, which is
// required when Access-Control-Allow-Credentials is true.
func CORSWithOrigin(origins string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{})
	for _, o := range strings.Split(origins, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			allowed[o] = struct{}{}
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqOrigin := r.Header.Get("Origin")
			if _, ok := allowed[reqOrigin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", reqOrigin)
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key, X-Request-ID")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Add("Vary", "Origin")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
