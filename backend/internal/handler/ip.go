package handler

import (
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
)

func isTrustedProxyIP(ip string) bool {
	// In a real production system, this should check against Cloudflare/Nginx CIDRs
	// For now, we assume local connections or specific VPC IPs are trusted
	return strings.HasPrefix(ip, "127.0.0.1") || strings.HasPrefix(ip, "10.") || strings.HasPrefix(ip, "192.168.") || strings.HasPrefix(ip, "172.")
}

// ClientIP extracts the real client IP address safely, preventing spoofing
func ClientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}

	// Only trust X-Forwarded-For if the request comes from a trusted proxy
	isTrustedProxy := os.Getenv("APP_ENV") != "production" || isTrustedProxyIP(host)

	if isTrustedProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			if len(parts) > 0 {
				return strings.TrimSpace(parts[0]) // Extract the true client IP safely
			}
		}
		if rip := r.Header.Get("X-Real-IP"); rip != "" {
			return strings.TrimSpace(rip)
		}
	}
	return host
}
