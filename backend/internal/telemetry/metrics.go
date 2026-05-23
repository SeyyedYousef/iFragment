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
)

// RecordPrediction records the prediction result
func RecordPrediction(result string) {
	PricingPredictionsTotal.WithLabelValues(result).Inc()
}

// RecordTonAPILatency records the latency of a TonAPI request
func RecordTonAPILatency(method string, statusCode string, duration float64) {
	TonAPILatencySeconds.WithLabelValues(method, statusCode).Observe(duration)
}
