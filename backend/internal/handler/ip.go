package handler

import (
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
)

// ClientIP extracts the real client IP address from request headers,
// accounting for reverse proxies (like Cloudflare, Nginx, etc.).
func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// X-Forwarded-For can contain multiple IPs separated by comma.
		parts := strings.Split(xff, ",")
		n := len(parts)
		if n > 0 {
			trustedProxyCount := 1
			if envVal := os.Getenv("TRUSTED_PROXY_COUNT"); envVal != "" {
				if parsed, err := strconv.Atoi(envVal); err == nil && parsed >= 0 {
					trustedProxyCount = parsed
				}
			}
			idx := n - trustedProxyCount
			if idx < 0 {
				idx = 0
			}
			if ip := strings.TrimSpace(parts[idx]); ip != "" {
				return ip
			}
		}
	}
	if rip := r.Header.Get("X-Real-IP"); rip != "" {
		return strings.TrimSpace(rip)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
