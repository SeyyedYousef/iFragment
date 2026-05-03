package username

import (
	"regexp"
)

var (
	usernameRegex = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]{3,31}$`)
	consecutiveUnderscoreRegex = regexp.MustCompile(`__`)
)

func ValidateUsername(u string) bool {
	// Length and chars check
	if !usernameRegex.MatchString(u) {
		return false
	}
	// No consecutive underscores
	if consecutiveUnderscoreRegex.MatchString(u) {
		return false
	}
	// No trailing underscores
	if u[len(u)-1] == '_' {
		return false
	}
	return true
}
