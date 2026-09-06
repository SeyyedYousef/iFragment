package avm

import (
	"strings"
)

// SemanticCandidate represents a conceptual equivalent or synonym for a username.
type SemanticCandidate struct {
	Username string
	Reason   string
}

// ConceptThesaurus maps core concept words to genuine semantic synonyms,
// category equivalents, and market benchmarks. It strictly avoids trivial affixes (no -x, -s, -hq, -app).
var ConceptThesaurus = map[string][]SemanticCandidate{
	// ── Rarity, Exclusivity & Collectibility ──
	"rare": {
		{"unique", "Exclusivity & Rarity Benchmark"},
		{"uncommon", "Rarity & Scarcity Synonym"},
		{"scarce", "High Scarcity Benchmark"},
		{"singular", "One-of-a-Kind Concept"},
		{"exclusive", "Premium Status Tier"},
		{"limited", "Limited Edition Concept"},
		{"grail", "Legendary Collectible Tier"},
		{"precious", "High Value Commodity"},
		{"peerless", "Unrivaled Status Concept"},
		{"legendary", "Historic Tier Handle"},
	},
	"unique": {
		{"rare", "Rarity Benchmark"},
		{"singular", "One-of-a-Kind Synonym"},
		{"scarce", "Scarcity Benchmark"},
		{"uncommon", "Exclusivity Synonym"},
		{"exclusive", "Status Tier"},
		{"limited", "Limited Availability"},
		{"original", "Genesis Concept"},
	},
	"scarce": {
		{"rare", "Rarity Benchmark"},
		{"unique", "Exclusivity Benchmark"},
		{"uncommon", "Scarcity Synonym"},
		{"limited", "Limited Edition"},
		{"grail", "Legendary Tier"},
	},
	"singular": {
		{"unique", "One-of-a-Kind Synonym"},
		{"rare", "Rarity Benchmark"},
		{"solo", "Individuality Concept"},
		{"prime", "Premier Category"},
		{"exclusive", "Status Tier"},
	},
	"uncommon": {
		{"rare", "Rarity Benchmark"},
		{"unique", "Exclusivity Concept"},
		{"scarce", "Scarcity Synonym"},
		{"singular", "One-of-a-Kind Concept"},
		{"limited", "Limited Availability"},
	},
	"exclusive": {
		{"private", "Confidential & Elite"},
		{"premium", "High Tier Concept"},
		{"elite", "Top Echelon Handle"},
		{"rare", "Rarity Benchmark"},
		{"limited", "Limited Access"},
		{"select", "Curated Selection"},
	},
	"limited": {
		{"exclusive", "Exclusivity Benchmark"},
		{"rare", "Rarity Concept"},
		{"select", "Curated Tier"},
		{"special", "Distinction Concept"},
		{"reserve", "High Tier Reserve"},
	},

	// ── Automotive & Transportation ──
	"cars": {
		{"auto", "Automotive Category Benchmark"},
		{"vehicle", "Transport Category"},
		{"motors", "Motor & Engine Concept"},
		{"wheels", "Automotive Metaphor"},
		{"drive", "Action & Transport"},
		{"racing", "Motorsport Category"},
		{"supercar", "Exotic Automotive Tier"},
		{"ride", "Personal Transit Concept"},
		{"speed", "High Performance Concept"},
	},
	"car": {
		{"auto", "Automotive Category Benchmark"},
		{"vehicle", "Transport Category"},
		{"motors", "Motor & Engine Concept"},
		{"wheels", "Automotive Metaphor"},
		{"drive", "Action & Transport"},
		{"ride", "Personal Transit Concept"},
		{"supercar", "Exotic Automotive Tier"},
	},
	"auto": {
		{"cars", "Automotive Category Benchmark"},
		{"vehicle", "Transport Category"},
		{"motors", "Motor Concept"},
		{"drive", "Action & Driving"},
		{"wheels", "Automotive Metaphor"},
		{"racing", "Motorsport Concept"},
	},
	"drive": {
		{"auto", "Automotive Category Benchmark"},
		{"ride", "Movement & Transit"},
		{"cars", "Vehicular Concept"},
		{"pilot", "Navigation & Control"},
		{"speed", "Velocity Concept"},
	},
	"motors": {
		{"auto", "Automotive Category Benchmark"},
		{"cars", "Vehicular Concept"},
		{"engine", "Power Unit Concept"},
		{"wheels", "Automotive Metaphor"},
		{"power", "Mechanical Force Concept"},
	},
	"wheels": {
		{"cars", "Automotive Category Benchmark"},
		{"auto", "Vehicle Concept"},
		{"ride", "Transit Metaphor"},
		{"motors", "Motor Concept"},
		{"drive", "Action & Movement"},
	},

	// ── Crypto, Web3 & Blockchain ──
	"bitcoin": {
		{"ethereum", "Tier-1 Crypto Benchmark"},
		{"solana", "Top Blockchain Handle"},
		{"crypto", "Category Benchmark"},
		{"btc", "Ticker Equivalent"},
		{"satoshi", "Genesis Creator Concept"},
		{"blockchain", "Core Web3 Technology"},
		{"token", "Digital Asset Category"},
	},
	"btc": {
		{"bitcoin", "Full Name Equivalent"},
		{"eth", "Tier-1 Ticker Peer"},
		{"crypto", "Category Benchmark"},
		{"sol", "Top Ticker Peer"},
		{"satoshi", "Genesis Creator Concept"},
	},
	"crypto": {
		{"bitcoin", "Crypto Pioneer Benchmark"},
		{"ethereum", "Smart Contract Platform"},
		{"solana", "High-Throughput Chain"},
		{"blockchain", "Core Tech Category"},
		{"tokens", "Digital Assets Category"},
		{"defi", "Decentralized Finance"},
		{"wallet", "Asset Storage Benchmark"},
	},
	"ethereum": {
		{"bitcoin", "Crypto Pioneer Benchmark"},
		{"solana", "Smart Contract Rival"},
		{"crypto", "Category Benchmark"},
		{"eth", "Ticker Equivalent"},
		{"vitalik", "Genesis Founder Concept"},
		{"defi", "Ecosystem Category"},
	},
	"eth": {
		{"btc", "Tier-1 Ticker Equivalent"},
		{"ethereum", "Full Name Equivalent"},
		{"crypto", "Category Benchmark"},
		{"sol", "Ticker Peer"},
	},
	"ton": {
		{"wallet", "Official Ecosystem Service"},
		{"stars", "Telegram Ecosystem Currency"},
		{"notcoin", "Ecosystem Legend"},
		{"gram", "Genesis Ecosystem Name"},
		{"jetton", "TON Token Standard"},
	},
	"wallet": {
		{"pay", "Payment Action Benchmark"},
		{"vault", "Secure Storage Concept"},
		{"bank", "Financial Institution"},
		{"ton", "Ecosystem Currency Hub"},
		{"cash", "Liquidity Category"},
		{"safe", "Security Benchmark"},
	},

	// ── Finance, Wealth & Money ──
	"money": {
		{"cash", "Liquidity & Currency"},
		{"wealth", "High Net Worth Concept"},
		{"capital", "Financial Asset Benchmark"},
		{"gold", "Precious Store of Value"},
		{"finance", "Economic Sector"},
		{"funds", "Liquidity Category"},
		{"banking", "Financial Infrastructure"},
	},
	"cash": {
		{"money", "Currency Benchmark"},
		{"funds", "Liquidity Category"},
		{"pay", "Transaction Action"},
		{"wealth", "Affluence Concept"},
		{"gold", "Precious Commodity"},
		{"capital", "Financial Category"},
	},
	"gold": {
		{"silver", "Precious Metal Peer"},
		{"diamond", "Luxury Commodity"},
		{"wealth", "Financial Status Concept"},
		{"bullion", "Store of Value Benchmark"},
		{"precious", "High Value Category"},
	},
	"silver": {
		{"gold", "Precious Metal Benchmark"},
		{"diamond", "Luxury Commodity"},
		{"platinum", "Precious Commodity"},
		{"bullion", "Store of Value"},
	},
	"rich": {
		{"wealthy", "Affluence Synonym"},
		{"luxury", "High Status Category"},
		{"money", "Financial Benchmark"},
		{"royal", "High Aristocracy Concept"},
		{"elite", "Top Social Class"},
	},
	"bank": {
		{"vault", "Security Storage"},
		{"finance", "Financial Sector"},
		{"capital", "Economic Benchmark"},
		{"credit", "Financial Instrument"},
		{"pay", "Payment Service"},
	},
	"trade": {
		{"market", "Commerce Benchmark"},
		{"swap", "Exchange Action Concept"},
		{"invest", "Capital Allocation"},
		{"crypto", "Digital Trading Concept"},
		{"deals", "Transaction Category"},
	},

	// ── Status, Royalty & Power ──
	"king": {
		{"lord", "Aristocracy Benchmark"},
		{"emperor", "Imperial Ruler Concept"},
		{"crown", "Monarchy Symbol"},
		{"royal", "Sovereign Category"},
		{"monarch", "Ruler Concept"},
		{"prince", "Noble Status Tier"},
		{"boss", "Authority Metaphor"},
	},
	"queen": {
		{"princess", "Noble Status Tier"},
		{"crown", "Monarchy Symbol"},
		{"royal", "Sovereign Category"},
		{"empress", "Imperial Ruler Concept"},
		{"majesty", "Royalty Concept"},
	},
	"vip": {
		{"elite", "Top Tier Benchmark"},
		{"premium", "High Tier Commercial"},
		{"prime", "Premier Category"},
		{"pro", "Professional Status"},
		{"exclusive", "Exclusivity Benchmark"},
	},
	"boss": {
		{"leader", "Leadership Benchmark"},
		{"chief", "Executive Status"},
		{"master", "Authority Concept"},
		{"king", "Power Metaphor"},
		{"captain", "Command Concept"},
	},

	// ── Tech, AI & Digital Giants ──
	"chatgpt": {
		{"gemini", "Top AI Model Competitor"},
		{"claude", "AI Intelligence Benchmark"},
		{"copilot", "AI Assistant Brand"},
		{"openai", "Parent AI Laboratory"},
		{"deepseek", "AI Frontier Model"},
		{"ai", "Core Tech Category"},
	},
	"gemini": {
		{"chatgpt", "AI Frontier Competitor"},
		{"claude", "AI Intelligence Benchmark"},
		{"copilot", "AI Assistant Brand"},
		{"deepmind", "AI Research Lab"},
		{"ai", "Core Tech Category"},
	},
	"claude": {
		{"gemini", "AI Frontier Competitor"},
		{"chatgpt", "AI Model Benchmark"},
		{"anthropic", "Creator Lab"},
		{"ai", "Core Tech Category"},
	},
	"ai": {
		{"bot", "Autonomous Agent"},
		{"robot", "Automation Benchmark"},
		{"neural", "Cognitive Architecture"},
		{"agent", "Autonomous System"},
		{"brain", "Intelligence Metaphor"},
	},
	"bot": {
		{"ai", "Intelligence Benchmark"},
		{"agent", "Autonomous System"},
		{"robot", "Automation Concept"},
		{"helper", "Service Assistant"},
	},
	"tiktok": {
		{"instagram", "Social Media Giant"},
		{"youtube", "Video Platform Giant"},
		{"reels", "Short Video Brand"},
		{"shorts", "Video Concept"},
		{"social", "Media Category"},
	},
	"game": {
		{"play", "Action & Gaming"},
		{"arcade", "Classic Gaming Concept"},
		{"quest", "Adventure Gaming Concept"},
		{"player", "Gaming Persona"},
		{"gamer", "Gaming Identity"},
		{"esports", "Competitive Gaming"},
	},
	"games": {
		{"play", "Action & Gaming"},
		{"arcade", "Classic Gaming Concept"},
		{"game", "Singular Category Root"},
		{"quest", "Adventure Gaming"},
		{"esports", "Competitive Category"},
	},
	"pubg": {
		{"fortnite", "Battle Royale Legend"},
		{"apex", "Esports Gaming Legend"},
		{"roblox", "Gaming Platform"},
		{"clashofclans", "Top Mobile Game Benchmark"},
		{"dota", "Esports Landmark"},
	},

	// ── Emotions & Lifestyle ──
	"love": {
		{"heart", "Symbolic Metaphor"},
		{"romance", "Relationship Concept"},
		{"passion", "Deep Emotion Concept"},
		{"soul", "Spiritual Affinity"},
		{"desire", "Aspiration Concept"},
		{"beloved", "Cherished Descriptor"},
	},
	"music": {
		{"sound", "Acoustic Benchmark"},
		{"audio", "Media Category"},
		{"tune", "Melodic Concept"},
		{"melody", "Musical Art Concept"},
		{"track", "Music Production Unit"},
		{"song", "Vocal Expression"},
		{"beat", "Rhythm Concept"},
	},
	"news": {
		{"daily", "Journalistic Frequency"},
		{"press", "Journalism Benchmark"},
		{"media", "Information Category"},
		{"times", "Historic Press Brand Concept"},
		{"report", "Information Concept"},
		{"wire", "News Agency Concept"},
	},
	"shop": {
		{"store", "Retail Concept"},
		{"market", "Commerce Benchmark"},
		{"mall", "Retail Aggregation"},
		{"boutique", "Curated Luxury Store"},
		{"buy", "Consumer Action"},
	},
	"fast": {
		{"speed", "Velocity Benchmark"},
		{"quick", "Rapid Action"},
		{"swift", "Agile Movement Concept"},
		{"turbo", "Boost Mechanism"},
		{"rapid", "High Velocity Concept"},
	},
	"dark": {
		{"shadow", "Silhouette Metaphor"},
		{"night", "Temporal Descriptor"},
		{"black", "Chromatics Benchmark"},
		{"phantom", "Mystique Concept"},
		{"eclipse", "Cosmic Event Concept"},
	},
	"light": {
		{"bright", "Luminance Concept"},
		{"sun", "Solar Benchmark"},
		{"shine", "Radiance Action"},
		{"glow", "Ambient Illumination"},
		{"spark", "Ignition Concept"},
	},
}

// GetSemanticSynonyms returns curated semantic synonyms and conceptual peers for a username.
func GetSemanticSynonyms(username string) []SemanticCandidate {
	u := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(username, "@")))
	if u == "" {
		return nil
	}

	// 1. Direct thesaurus match
	if list, ok := ConceptThesaurus[u]; ok && len(list) > 0 {
		return list
	}

	// 2. Grammatical / inflectional pivots (e.g., cars -> car, games -> game)
	if strings.HasSuffix(u, "s") && len(u) > 3 {
		singular := strings.TrimSuffix(u, "s")
		if list, ok := ConceptThesaurus[singular]; ok && len(list) > 0 {
			res := make([]SemanticCandidate, 0, len(list)+1)
			res = append(res, SemanticCandidate{Username: singular, Reason: "Singular Root Handle"})
			for _, item := range list {
				if item.Username != u {
					res = append(res, item)
				}
			}
			return res
		}
	} else {
		plural := u + "s"
		if list, ok := ConceptThesaurus[plural]; ok && len(list) > 0 {
			res := make([]SemanticCandidate, 0, len(list)+1)
			res = append(res, SemanticCandidate{Username: plural, Reason: "Plural Category Handle"})
			for _, item := range list {
				if item.Username != u {
					res = append(res, item)
				}
			}
			return res
		}
	}

	// 3. Thematic / subcategory heuristics
	switch {
	case strings.Contains(u, "car") || strings.Contains(u, "auto") || strings.Contains(u, "drive") || strings.Contains(u, "moto"):
		return []SemanticCandidate{
			{"auto", "Automotive Category Benchmark"},
			{"vehicle", "Transport Category"},
			{"motors", "Motor & Engine Concept"},
			{"wheels", "Automotive Metaphor"},
			{"drive", "Action & Transport"},
		}
	case strings.Contains(u, "crypto") || strings.Contains(u, "coin") || strings.Contains(u, "token") || strings.Contains(u, "chain"):
		return []SemanticCandidate{
			{"bitcoin", "Crypto Pioneer Benchmark"},
			{"ethereum", "Smart Contract Platform"},
			{"solana", "High Performance Chain"},
			{"wallet", "Asset Storage Benchmark"},
			{"ton", "Telegram Ecosystem Currency"},
		}
	case strings.Contains(u, "pay") || strings.Contains(u, "bank") || strings.Contains(u, "cash") || strings.Contains(u, "money"):
		return []SemanticCandidate{
			{"money", "Currency Benchmark"},
			{"cash", "Liquidity Category"},
			{"vault", "Secure Storage Concept"},
			{"wallet", "Payment Hub"},
			{"finance", "Economic Sector"},
		}
	case strings.Contains(u, "game") || strings.Contains(u, "play") || strings.Contains(u, "arcade"):
		return []SemanticCandidate{
			{"play", "Gaming Action Concept"},
			{"game", "Gaming Category Benchmark"},
			{"esports", "Competitive Gaming"},
			{"quest", "Adventure Gaming Concept"},
		}
	case strings.Contains(u, "rare") || strings.Contains(u, "gem") || strings.Contains(u, "precious"):
		return []SemanticCandidate{
			{"unique", "Exclusivity Benchmark"},
			{"uncommon", "Rarity Synonym"},
			{"scarce", "Scarcity Benchmark"},
			{"singular", "One-of-a-Kind Concept"},
			{"exclusive", "Status Tier"},
		}
	case strings.Contains(u, "king") || strings.Contains(u, "lord") || strings.Contains(u, "boss") || strings.Contains(u, "crown"):
		return []SemanticCandidate{
			{"crown", "Monarchy Symbol"},
			{"royal", "Sovereign Category"},
			{"emperor", "Imperial Ruler Concept"},
			{"prince", "Noble Status Tier"},
		}
	case strings.Contains(u, "bot") || strings.Contains(u, "ai") || strings.Contains(u, "gpt") || strings.Contains(u, "agent"):
		return []SemanticCandidate{
			{"chatgpt", "AI Frontier Benchmark"},
			{"gemini", "AI Intelligence Benchmark"},
			{"claude", "Frontier AI Competitor"},
			{"ai", "Core Tech Category"},
		}
	}

	// 4. Default high-signal fallback for short generic handles (no suffix spam!)
	if len(u) <= 4 {
		return []SemanticCandidate{
			{"vip", "Short Status Benchmark"},
			{"gem", "Short Collectible Word"},
			{"king", "Short Monarchy Handle"},
			{"gold", "Precious Store of Value"},
		}
	}

	return []SemanticCandidate{
		{"unique", "Exclusivity Benchmark"},
		{"premium", "High Tier Commercial Category"},
		{"exclusive", "Status Benchmark"},
		{"limited", "Limited Availability Tier"},
	}
}

// IsSemanticSynonym checks if candidate is a known synonym or peer of base.
func IsSemanticSynonym(base, candidate string) (bool, string) {
	candidates := GetSemanticSynonyms(base)
	cLower := strings.ToLower(candidate)
	for _, item := range candidates {
		if strings.ToLower(item.Username) == cLower {
			return true, item.Reason
		}
	}
	return false, ""
}
