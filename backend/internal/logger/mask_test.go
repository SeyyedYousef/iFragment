package logger

import (
	"testing"
)

func TestMaskPII(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{
			input:    "Successful payment received for payload: stars_premium_1m:123456789",
			expected: "Successful payment received for payload: stars_premium_1m:[MASKED]",
		},
		{
			input:    "Report payload report_pay:987654321:username",
			expected: "Report payload report_pay:[MASKED]:username",
		},
		{
			input:    "Order ID 550e8400-e29b-41d4-a716-446655440000 completed",
			expected: "Order ID [MASKED_ID] completed",
		},
		{
			input:    "User phone +989123456789 is verified",
			expected: "User phone [MASKED_PHONE] is verified",
		},
		{
			input:    "Contact: 989123456789",
			expected: "Contact: [MASKED_PHONE]",
		},
	}

	for _, tc := range tests {
		got := MaskPII(tc.input)
		if got != tc.expected {
			t.Errorf("MaskPII(%q) = %q; want %q", tc.input, got, tc.expected)
		}
	}
}
