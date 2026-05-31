package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type errResp struct {
	Error     string `json:"error"`
	RequestID string `json:"request_id,omitempty"`
}

// RespondError wraps errors securely. Internal errors are logged, publicMsg is sent to the client.
func RespondError(w http.ResponseWriter, r *http.Request, code int, publicMsg string, internalErr error) {
	reqID := r.Header.Get("X-Request-ID")
	
	// Structured logging for the internal error
	slog.Error("handler error",
		"request_id", reqID,
		"path", r.URL.Path,
		"code", code,
		"err", internalErr,
	)
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(errResp{
		Error:     publicMsg,
		RequestID: reqID,
	})
}

// RespondJSON sends a JSON response with status code and payload, logging any serialization errors.
func RespondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		slog.Error("failed to encode JSON response", "error", err)
	}
}
