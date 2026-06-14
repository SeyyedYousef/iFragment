package username

import (
	"regexp"
)

var (
	// Collectible: 4-32 chars
	collectibleUsernameRegex   = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]{0,31}$`)
	// Standard: 5-32 chars
	standardUsernameRegex      = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]{4,31}$`)
	consecutiveUnderscoreRegex = regexp.MustCompile(`__`)
)

func ValidateUsername(u string) bool {
	return IsCollectibleEligible(u)
}

func IsCollectibleEligible(u string) bool {
	if !collectibleUsernameRegex.MatchString(u) {
		return false
	}
	if consecutiveUnderscoreRegex.MatchString(u) {
		return false
	}
	if u[len(u)-1] == '_' {
		return false
	}
	return true
}

// IsBasicEligible checks if a username meets the minimum length (5) for a basic (free) username.
// Any username under 5 characters long is strictly collectible.
func IsBasicEligible(u string) bool {
	if !standardUsernameRegex.MatchString(u) {
		return false
	}
	if consecutiveUnderscoreRegex.MatchString(u) {
		return false
	}
	if u[len(u)-1] == '_' {
		return false
	}
	return true
}
