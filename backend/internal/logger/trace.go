package logger

import (
	"context"
	"log/slog"

	"go.opentelemetry.io/otel/trace"
)

// TracingHandler wraps an existing slog.Handler and injects trace_id and request_id
// from context if they exist.
type TracingHandler struct {
	slog.Handler
}

func NewTracingHandler(h slog.Handler) *TracingHandler {
	return &TracingHandler{Handler: h}
}

func (h *TracingHandler) Handle(ctx context.Context, r slog.Record) error {
	if ctx == nil {
		return h.Handler.Handle(ctx, r)
	}

	// Extract request_id from context
	if reqID, ok := ctx.Value("request_id").(string); ok && reqID != "" {
		r.AddAttrs(slog.String("request_id", reqID))
	}

	// Extract trace_id and span_id from OpenTelemetry context
	spanContext := trace.SpanContextFromContext(ctx)
	if spanContext.IsValid() {
		r.AddAttrs(
			slog.String("trace_id", spanContext.TraceID().String()),
			slog.String("span_id", spanContext.SpanID().String()),
		)
	}

	return h.Handler.Handle(ctx, r)
}

func (h *TracingHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &TracingHandler{Handler: h.Handler.WithAttrs(attrs)}
}

func (h *TracingHandler) WithGroup(name string) slog.Handler {
	return &TracingHandler{Handler: h.Handler.WithGroup(name)}
}
