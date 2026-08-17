package avm

import (
	"strings"
	"sync"
)

// KnownGlobalBrands contains high-profile global brands, companies, and platforms.
var KnownGlobalBrands = map[string]int{
	"google": 100, "apple": 100, "microsoft": 100, "amazon": 100, "meta": 100,
	"tesla": 100, "netflix": 100, "spotify": 100, "twitter": 100, "instagram": 100,
	"tiktok": 100, "youtube": 100, "telegram": 100, "whatsapp": 100, "paypal": 100,
	"stripe": 100, "uber": 100, "airbnb": 100, "nvidia": 100, "intel": 100,
	"binance": 100, "coinbase": 100, "bybit": 100, "okx": 100, "kraken": 100,
	"toncoin": 100, "tether": 100, "solana": 100, "polygon": 100, "avalanche": 100,
	"nike": 100, "adidas": 100, "puma": 100, "gucci": 100, "rolex": 100,
	"disney": 100, "marvel": 100, "sony": 100, "samsung": 100, "canon": 100,
}

var (
	brandCache = make(map[string]int)
	brandMutex sync.RWMutex
)

// CheckGlobalBrand detects if the username is a recognized global brand.
// Returns 100 for verified global brand matches, and 0 otherwise without external HTTP latency.
func CheckGlobalBrand(username string) int {
	lower := strings.ToLower(strings.TrimSpace(username))
	if len(lower) < 3 {
		return 0
	}

	brandMutex.RLock()
	cachedScore, exists := brandCache[lower]
	brandMutex.RUnlock()
	if exists {
		return cachedScore
	}

	score := 0
	if val, isBrand := KnownGlobalBrands[lower]; isBrand {
		score = val
	}

	brandMutex.Lock()
	if len(brandCache) >= 5000 {
		brandCache = make(map[string]int)
	}
	brandCache[lower] = score
	brandMutex.Unlock()

	return score
}
