package avm

import (
	"fmt"
	"strings"
	"sync"
)

// TrademarkSeverity represents the severity level of trademark infringement risk.
type TrademarkSeverity string

const (
	SeverityNone       TrademarkSeverity = "none"
	SeverityExactMatch TrademarkSeverity = "exact_match" // Username is the exact trademark handle
	SeveritySubstring  TrademarkSeverity = "substring"   // Username embeds trademark as a distinct sub-token
	SeverityTLDSquat   TrademarkSeverity = "tld_squat"    // Typo / deceptive variant (e.g. paypals, googlebot)
)

// TrademarkMatch details the detected trademark clash and entity behind it.
type TrademarkMatch struct {
	HasRisk  bool              `json:"has_risk"`
	Brand    string            `json:"brand,omitempty"`
	Entity   string            `json:"entity,omitempty"`
	Severity TrademarkSeverity `json:"severity"`
	Detail   string            `json:"detail,omitempty"`
}

// KnownBrandEntity maps brand keywords to their legal corporate owner / trademark entity.
var KnownBrandEntity = map[string]string{
	// ── Big Tech & AI (40) ──
	"google": "Google LLC / Alphabet Inc.", "apple": "Apple Inc.", "microsoft": "Microsoft Corp.",
	"amazon": "Amazon.com Inc.", "meta": "Meta Platforms Inc.", "tesla": "Tesla Inc.",
	"netflix": "Netflix Inc.", "spotify": "Spotify AB", "twitter": "X Corp. / Twitter",
	"instagram": "Meta Platforms Inc.", "tiktok": "ByteDance Ltd.", "youtube": "Google LLC",
	"openai": "OpenAI Inc.", "chatgpt": "OpenAI Inc.", "anthropic": "Anthropic PBC",
	"claude": "Anthropic PBC", "gemini": "Google LLC", "deepmind": "Google DeepMind",
	"nvidia": "NVIDIA Corp.", "intel": "Intel Corp.", "amd": "Advanced Micro Devices Inc.",
	"ibm": "IBM Corp.", "oracle": "Oracle Corp.", "salesforce": "Salesforce Inc.",
	"adobe": "Adobe Inc.", "uber": "Uber Technologies Inc.", "airbnb": "Airbnb Inc.",
	"midjourney": "Midjourney Inc.", "figma": "Figma Inc.", "github": "GitHub / Microsoft",
	"gitlab": "GitLab Inc.", "stripe": "Stripe Inc.", "shopify": "Shopify Inc.",
	"zoom": "Zoom Video Communications", "slack": "Salesforce / Slack", "discord": "Discord Inc.",
	"reddit": "Reddit Inc.", "pinterest": "Pinterest Inc.", "snapchat": "Snap Inc.", "quora": "Quora Inc.",

	// ── Fintech & Banking (25) ──
	"paypal": "PayPal Holdings Inc.", "revolut": "Revolut Ltd.", "wise": "Wise PLC",
	"klarna": "Klarna Bank AB", "monzo": "Monzo Bank Ltd.", "n26": "N26 GmbH",
	"robinhood": "Robinhood Markets Inc.", "chime": "Chime Financial Inc.",
	"visa": "Visa Inc.", "mastercard": "Mastercard Inc.", "amex": "American Express Co.",
	"jpmorgan": "JPMorgan Chase & Co.", "goldman": "Goldman Sachs Group Inc.", "citi": "Citigroup Inc.",
	"hsbc": "HSBC Holdings PLC", "barclays": "Barclays PLC", "santander": "Banco Santander S.A.",
	"sber": "Sberbank PJSC", "tinkoff": "TCS Group / Tinkoff", "alfa": "Alfa-Bank JSC",
	"checkout": "Checkout.com", "square": "Block Inc. / Square", "block": "Block Inc.",
	"coinbase": "Coinbase Global Inc.", "kraken": "Payward Inc. / Kraken",

	// ── Crypto & Web3 (30) ──
	"binance": "Binance Holdings Ltd.", "bybit": "Bybit Fintech Ltd.", "okx": "OKX Group",
	"kucoin": "KuCoin Exchange", "bitget": "Bitget Exchange", "gateio": "Gate.io",
	"bitfinex": "iFinex Inc.", "tether": "Tether Operations Ltd.", "usdt": "Tether Operations Ltd.",
	"usdc": "Circle Internet Financial", "circle": "Circle Internet Financial",
	"solana": "Solana Foundation", "polygon": "Polygon Labs", "avalanche": "Ava Labs",
	"cardano": "Cardano Foundation / IOHK", "ripple": "Ripple Labs Inc.", "xrp": "Ripple Labs Inc.",
	"toncoin": "TON Foundation", "ton": "TON Foundation", "notcoin": "Open Builders / Notcoin",
	"dogecoin": "Dogecoin Foundation", "uniswap": "Uniswap Labs", "pancakeswap": "PancakeSwap",
	"opensea": "Ozone Networks Inc. / OpenSea", "blur": "Blur Foundation", "magicden": "Magic Eden Inc.",
	"metamask": "ConsenSys Software Inc.", "phantom": "Phantom Technologies Inc.",
	"ledger": "Ledger SAS", "trezor": "SatoshiLabs / Trezor",

	// ── Gaming & Entertainment (25) ──
	"roblox": "Roblox Corp.", "minecraft": "Mojang Studios / Microsoft", "fortnite": "Epic Games Inc.",
	"epicgames": "Epic Games Inc.", "supercell": "Supercell Oy", "clash": "Supercell / Clash of Clans",
	"clashofclans": "Supercell Oy", "brawlstars": "Supercell Oy", "steam": "Valve Corp.",
	"valve": "Valve Corp.", "riotgames": "Riot Games Inc. / Tencent", "blizzard": "Activision Blizzard Inc.",
	"ea": "Electronic Arts Inc.", "playstation": "Sony Interactive Entertainment", "xbox": "Microsoft Corp.",
	"nintendo": "Nintendo Co. Ltd.", "ubisoft": "Ubisoft Entertainment SA", "twitch": "Twitch Interactive / Amazon",
	"disney": "The Walt Disney Company", "marvel": "Marvel Characters Inc. / Disney",
	"hbo": "Home Box Office Inc. / Warner Bros.", "warner": "Warner Bros. Discovery",
	"sony": "Sony Group Corp.", "paramount": "Paramount Global", "samsung": "Samsung Electronics Co.",

	// ── Apparel, Luxury & Consumer (20) ──
	"nike": "Nike Inc.", "adidas": "Adidas AG", "puma": "Puma SE",
	"gucci": "Kering S.A. / Gucci", "prada": "Prada S.p.A.", "louisvuitton": "LVMH Moët Hennessy",
	"chanel": "Chanel S.A.", "hermes": "Hermès International S.A.", "dior": "Christian Dior SE / LVMH",
	"rolex": "Rolex SA", "zara": "Inditex S.A. / Zara", "hm": "H&M Hennes & Mauritz AB",
	"uniqlo": "Fast Retailing Co. / Uniqlo", "balenciaga": "Kering / Balenciaga",
	"versace": "Capri Holdings / Versace", "armani": "Giorgio Armani S.p.A.",
	"burberry": "Burberry Group PLC", "cartier": "Richemont / Cartier", "omega": "The Swatch Group / Omega",
	"tiffany": "LVMH / Tiffany & Co.",

	// ── Telegram Ecosystem, Messaging & Regional (20) ──
	"telegram": "Telegram FZ-LLC", "durov": "Pavel Durov / Telegram", "fragment": "Fragment Auction Platform",
	"wallet": "Telegram Wallet / TOP", "whatsapp": "Meta / WhatsApp LLC", "wechat": "Tencent Holdings Ltd.",
	"signal": "Signal Technology Foundation", "viber": "Rakuten Viber", "line": "LY Corporation",
	"digikala": "Digikala Group", "snapp": "Snapp Group", "tapsi": "Tapsi Technologies",
	"cafebazaar": "Hezardastan / Cafe Bazaar", "divar": "Hezardastan / Divar",
	"rubika": "Rubika Messenger", "aparat": "Saba Idea / Aparat", "filimo": "Saba Idea / Filimo",
	"nobitex": "Nobitex Exchange", "wallex": "Wallex Platform", "yandex": "Yandex N.V.",
}

// KnownGlobalBrands gives a 100 brand score for verified global brand dictionary lookups.
var KnownGlobalBrands = func() map[string]int {
	m := make(map[string]int, len(KnownBrandEntity))
	for b := range KnownBrandEntity {
		m[b] = 100
	}
	return m
}()

var (
	brandCache      = make(map[string]int)
	trademarkCache  = make(map[string]TrademarkMatch)
	brandMutex      sync.RWMutex
	trademarkMutex  sync.RWMutex
)

// CheckGlobalBrand detects if the username is an exact recognized brand name (0 or 100).
func CheckGlobalBrand(username string) int {
	lower := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(username), "@"))
	if len(lower) < 2 {
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

// CheckTrademarkSeverity performs 3-tier severity analysis on a username for trademark conflicts.
// It checks exact matches, boundary substrings, and typo/TLD squats.
func CheckTrademarkSeverity(username string) TrademarkMatch {
	raw := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(username)), "@")
	if len(raw) < 2 {
		return TrademarkMatch{Severity: SeverityNone}
	}

	trademarkMutex.RLock()
	cached, exists := trademarkCache[raw]
	trademarkMutex.RUnlock()
	if exists {
		return cached
	}

	match := evaluateTrademarkRisk(raw)

	trademarkMutex.Lock()
	if len(trademarkCache) >= 5000 {
		trademarkCache = make(map[string]TrademarkMatch)
	}
	trademarkCache[raw] = match
	trademarkMutex.Unlock()

	return match
}

func evaluateTrademarkRisk(u string) TrademarkMatch {
	// 1. Tier 1: Exact Match
	if entity, ok := KnownBrandEntity[u]; ok {
		return TrademarkMatch{
			HasRisk:  true,
			Brand:    u,
			Entity:   entity,
			Severity: SeverityExactMatch,
			Detail:   fmt.Sprintf("Exact trademark match: %s (%s)", u, entity),
		}
	}

	// 2. Tier 2 & Tier 3: Substring & TLD/Typo squatting
	for brand, entity := range KnownBrandEntity {
		if len(brand) < 3 {
			continue
		}

		// TLD squatting, domain spoofing or plural squatting (e.g. paypals, googles, telegramapp, nike_com, apple_io)
		if strings.HasPrefix(u, brand) {
			suffix := strings.TrimPrefix(u, brand)
			if suffix == "s" || suffix == "app" || suffix == "bot" || suffix == "official" || suffix == "pay" || suffix == "hub" || suffix == "net" || suffix == "org" || suffix == "io" ||
				suffix == "_com" || suffix == "_org" || suffix == "_net" || suffix == "_io" || suffix == "_app" || suffix == "_hub" || suffix == "_pay" || suffix == "_site" || suffix == "_bot" {
				return TrademarkMatch{
					HasRisk:  true,
					Brand:    brand,
					Entity:   entity,
					Severity: SeverityTLDSquat,
					Detail:   fmt.Sprintf("Potential trademark squatting / spoofing of '%s' (%s)", brand, entity),
				}
			}
		}

		// Exact substring with underscore/hyphen boundaries (e.g. real_paypal, openai_channel)
		if strings.HasPrefix(u, brand+"_") || strings.HasSuffix(u, "_"+brand) || strings.Contains(u, "_"+brand+"_") {
			return TrademarkMatch{
				HasRisk:  true,
				Brand:    brand,
				Entity:   entity,
				Severity: SeveritySubstring,
				Detail:   fmt.Sprintf("Trademark token match: contains '%s' (%s)", brand, entity),
			}
		}


		// Deep substring match for longer brands (len >= 5)
		if len(brand) >= 5 && strings.Contains(u, brand) {
			return TrademarkMatch{
				HasRisk:  true,
				Brand:    brand,
				Entity:   entity,
				Severity: SeveritySubstring,
				Detail:   fmt.Sprintf("Contains protected brand sequence '%s' (%s)", brand, entity),
			}
		}
	}

	return TrademarkMatch{
		HasRisk:  false,
		Severity: SeverityNone,
	}
}

