package logger

import (
	"io"
	"log/slog"
	"regexp"
)

var (
	phoneRegex   = regexp.MustCompile(`(?i)(?:^|[\s:+=])(\+?\d{10,14})(?:$|[\s:])`)
	digitPattern = regexp.MustCompile(`\+?\d{10,14}`)
	uuidRegex    = regexp.MustCompile(`(?i)[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}`)
	payloadRegex = regexp.MustCompile(`(?i)(stars_premium_1m:|report_pay:)(\d+)`)
)

// MaskPII replaces sensitive data patterns in log strings with masks
func MaskPII(s string) string {
	s = payloadRegex.ReplaceAllString(s, "$1[MASKED]")
	s = uuidRegex.ReplaceAllString(s, "[MASKED_ID]")
	s = phoneRegex.ReplaceAllStringFunc(s, func(match string) string {
		return digitPattern.ReplaceAllString(match, "[MASKED_PHONE]")
	})
	return s
}

// MaskPIIAttr is a ReplaceAttr function for slog.HandlerOptions
func MaskPIIAttr(groups []string, a slog.Attr) slog.Attr {
	if a.Value.Kind() == slog.KindString {
		a.Value = slog.StringValue(MaskPII(a.Value.String()))
	}
	return a
}

// PIIMaskingWriter wraps an io.Writer and masks PII in written logs
type PIIMaskingWriter struct {
	Out io.Writer
}

func (w *PIIMaskingWriter) Write(p []byte) (n int, err error) {
	masked := MaskPII(string(p))
	_, err = w.Out.Write([]byte(masked))
	return len(p), err
}
