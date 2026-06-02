package telemetry

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// PricingPredictionsTotal counts pricing estimation request results
	PricingPredictionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pricing_predictions_total",
			Help: "Total number of pricing predictions performed, partitioned by result.",
		},
		[]string{"result"}, // success or fallback
	)

	// TonAPILatencySeconds tracks latency of requests made to TonAPI
	TonAPILatencySeconds = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "tonapi_latency_seconds",
			Help:    "Latency of HTTP requests made to TonAPI.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "status_code"},
	)

	// ChannelConnectTotal counts channel connect attempts
	ChannelConnectTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "channel_connect_total",
			Help: "Total number of channel connect attempts.",
		},
		[]string{"status"},
	)

	// ChannelWebhookLatencySeconds tracks latency of webhook processing
	ChannelWebhookLatencySeconds = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "channel_webhook_latency_seconds",
			Help:    "Latency of channel webhook update processing.",
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"status"},
	)

	// AutoresponderMatchTotal counts autoresponder keyword matches
	AutoresponderMatchTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "autoresponder_match_total",
			Help: "Total number of autoresponder keyword matches.",
		},
		[]string{"match_type"},
	)
)

// RecordPrediction records the prediction result
func RecordPrediction(result string) {
	PricingPredictionsTotal.WithLabelValues(result).Inc()
}

// RecordTonAPILatency records the latency of a TonAPI request
func RecordTonAPILatency(method string, statusCode string, duration float64) {
	TonAPILatencySeconds.WithLabelValues(method, statusCode).Observe(duration)
}

// RecordChannelConnect records a channel connection attempt
func RecordChannelConnect(status string) {
	ChannelConnectTotal.WithLabelValues(status).Inc()
}

// RecordChannelWebhookLatency records the latency of a webhook request
func RecordChannelWebhookLatency(botID string, status string, duration float64) {
	ChannelWebhookLatencySeconds.WithLabelValues(status).Observe(duration)
}

// RecordAutoresponderMatch records an autoresponder match event
func RecordAutoresponderMatch(matchType string) {
	AutoresponderMatchTotal.WithLabelValues(matchType).Inc()
}
