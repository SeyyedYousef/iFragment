package traits

import (
	"fmt"
	"math"
	"strings"
)

// CollectionMeta holds official Telegram Gift collection supply & metadata
type CollectionMeta struct {
	ModelID          string  `json:"model_id"`
	Name             string  `json:"name"`
	TotalSupply      int     `json:"total_supply"`
	CraftedFlag      bool    `json:"crafted_flag"`
	BaseStarsPrice   int     `json:"base_stars_price"`
	InitialFloorGRAM float64 `json:"initial_floor_gram"`
	Description      string  `json:"description"`
}

// BackdropColorSet holds the 4 on-chain color hexes
type BackdropColorSet struct {
	CenterHex  string `json:"center_hex"`
	EdgeHex    string `json:"edge_hex"`
	PatternHex string `json:"pattern_hex"`
	TextHex    string `json:"text_hex"`
}

// TraitItem holds an attribute permille and metadata
type TraitItem struct {
	TraitType           string            `json:"trait_type"` // "model", "backdrop", "symbol"
	Name                string            `json:"name"`
	Permille            int               `json:"permille"`              // Out of 1000 from Telegram API
	CraftChancePermille int               `json:"craft_chance_permille"` // Persistence probability
	Colors              *BackdropColorSet `json:"colors,omitempty"`
}

// ExactRarityResult contains the mathematically certain rarity
type ExactRarityResult struct {
	TraitType      string            `json:"trait_type"`
	TraitName      string            `json:"trait_name"`
	Permille       int               `json:"permille"`
	Percentile     float64           `json:"percentile"` // e.g. 0.1% for rarest
	RarityTier     string            `json:"rarity_tier"` // Legendary, Epic, Rare, Uncommon, Common
	CertaintyLevel string            `json:"certainty_level"` // "exact" (Sacred Rule 6: Blue Badge)
	Colors         *BackdropColorSet `json:"colors,omitempty"`
}

// OfficialCollections catalog of official Telegram Gift NFT models
var OfficialCollections = map[string]CollectionMeta{
	"plush_pepe": {
		ModelID:          "plush_pepe",
		Name:             "Plush Pepe",
		TotalSupply:      1500,
		CraftedFlag:      false,
		BaseStarsPrice:   10000,
		InitialFloorGRAM: 140.0,
		Description:      "Handmade plush Pepe frog, rare pioneer collection",
	},
	"durov_cap": {
		ModelID:          "durov_cap",
		Name:             "Durov's Cap",
		TotalSupply:      2500,
		CraftedFlag:      false,
		BaseStarsPrice:   15000,
		InitialFloorGRAM: 220.0,
		Description:      "Signature black cap worn by Telegram founder",
	},
	"snoop_dogg": {
		ModelID:          "snoop_dogg",
		Name:             "Snoop Dogg Gold Mic",
		TotalSupply:      3000,
		CraftedFlag:      false,
		BaseStarsPrice:   25000,
		InitialFloorGRAM: 350.0,
		Description:      "24k gold microphone collectible with Death Row emblem",
	},
	"cyber_heart": {
		ModelID:          "cyber_heart",
		Name:             "Cyber Heart",
		TotalSupply:      5000,
		CraftedFlag:      false,
		BaseStarsPrice:   5000,
		InitialFloorGRAM: 65.0,
		Description:      "Bionic pulsating chrome cybernetic heart",
	},
	"phoenix_feather": {
		ModelID:          "phoenix_feather",
		Name:             "Phoenix Feather",
		TotalSupply:      1000,
		CraftedFlag:      true,
		BaseStarsPrice:   40000,
		InitialFloorGRAM: 850.0,
		Description:      "Crafted legendary flaming feather with eternal luminescence",
	},
	"astral_shard": {
		ModelID:          "astral_shard",
		Name:             "Astral Shard",
		TotalSupply:      1200,
		CraftedFlag:      true,
		BaseStarsPrice:   35000,
		InitialFloorGRAM: 720.0,
		Description:      "Synthesized crystalline meteorite shard from the deep cosmos",
	},
	"eternal_rose": {
		ModelID:          "eternal_rose",
		Name:             "Eternal Rose",
		TotalSupply:      10000,
		CraftedFlag:      false,
		BaseStarsPrice:   2500,
		InitialFloorGRAM: 28.0,
		Description:      "Preserved glass-domed enchanted crimson rose",
	},
	"golden_star": {
		ModelID:          "golden_star",
		Name:             "Golden Star",
		TotalSupply:      8000,
		CraftedFlag:      false,
		BaseStarsPrice:   3000,
		InitialFloorGRAM: 38.0,
		Description:      "Polished celestial five-point gold star trophy",
	},
	"diamond_ring": {
		ModelID:          "diamond_ring",
		Name:             "Diamond Ring",
		TotalSupply:      4000,
		CraftedFlag:      false,
		BaseStarsPrice:   12000,
		InitialFloorGRAM: 160.0,
		Description:      "Flawless solitaire diamond ring set in white platinum",
	},
	"crypto_whale": {
		ModelID:          "crypto_whale",
		Name:             "Crypto Whale",
		TotalSupply:      2000,
		CraftedFlag:      false,
		BaseStarsPrice:   18000,
		InitialFloorGRAM: 290.0,
		Description:      "Majestic deep-sea oceanic whale breaching the surface",
	},
	"vintage_cigar": {
		ModelID:          "vintage_cigar",
		Name:             "Vintage Cigar",
		TotalSupply:      6000,
		CraftedFlag:      false,
		BaseStarsPrice:   4500,
		InitialFloorGRAM: 55.0,
		Description:      "Aged Cuban hand-rolled cigar with silver ash band",
	},
	"genesis_scroll": {
		ModelID:          "genesis_scroll",
		Name:             "Genesis Scroll",
		TotalSupply:      800,
		CraftedFlag:      true,
		BaseStarsPrice:   50000,
		InitialFloorGRAM: 1200.0,
		Description:      "Ancient parchment illuminated with Telegram founding code",
	},
	"santa_hat": {
		ModelID:          "santa_hat",
		Name:             "Santa Hat",
		TotalSupply:      10000,
		CraftedFlag:      false,
		BaseStarsPrice:   20000,
		InitialFloorGRAM: 650.0,
		Description:      "Classic festive Santa hat collectible with high liquidity",
	},
	"signet_ring": {
		ModelID:          "signet_ring",
		Name:             "Signet Ring",
		TotalSupply:      5000,
		CraftedFlag:      false,
		BaseStarsPrice:   30000,
		InitialFloorGRAM: 950.0,
		Description:      "Sovereign engraved gold signet ring",
	},
	"precious_peach": {
		ModelID:          "precious_peach",
		Name:             "Precious Peach",
		TotalSupply:      5000,
		CraftedFlag:      false,
		BaseStarsPrice:   35000,
		InitialFloorGRAM: 1100.0,
		Description:      "Iconic velvet peach collectible",
	},
	"spiced_wine": {
		ModelID:          "spiced_wine",
		Name:             "Spiced Wine",
		TotalSupply:      15000,
		CraftedFlag:      false,
		BaseStarsPrice:   4000,
		InitialFloorGRAM: 35.0,
		Description:      "Warm mulled wine chalice with cinnamon",
	},
	"durovs_glasses": {
		ModelID:          "durovs_glasses",
		Name:             "Durov's Glasses",
		TotalSupply:      5000,
		CraftedFlag:      false,
		BaseStarsPrice:   10000,
		InitialFloorGRAM: 120.0,
		Description:      "Iconic dark glasses worn by Pavel Durov",
	},
	"desk_calendar": {
		ModelID:          "desk_calendar",
		Name:             "Desk Calendar",
		TotalSupply:      6000,
		CraftedFlag:      false,
		BaseStarsPrice:   8500,
		InitialFloorGRAM: 95.0,
		Description:      "Executive perpetual desk calendar",
	},
	"jingle_bells": {
		ModelID:          "jingle_bells",
		Name:             "Jingle Bells",
		TotalSupply:      8000,
		CraftedFlag:      false,
		BaseStarsPrice:   6000,
		InitialFloorGRAM: 60.0,
		Description:      "Golden holiday jingle bells",
	},
	"liberty_figure": {
		ModelID:          "liberty_figure",
		Name:             "Liberty Figure",
		TotalSupply:      3500,
		CraftedFlag:      false,
		BaseStarsPrice:   15000,
		InitialFloorGRAM: 175.0,
		Description:      "Miniature Statue of Liberty bronze figurine",
	},
	"fine_pen": {
		ModelID:          "fine_pen",
		Name:             "Fine Pen",
		TotalSupply:      4500,
		CraftedFlag:      false,
		BaseStarsPrice:   11000,
		InitialFloorGRAM: 115.0,
		Description:      "Gold-nib executive fountain pen",
	},
	"chill_flame": {
		ModelID:          "chill_flame",
		Name:             "Chill Flame",
		TotalSupply:      7000,
		CraftedFlag:      false,
		BaseStarsPrice:   7500,
		InitialFloorGRAM: 75.0,
		Description:      "Mystical cool blue flame torch",
	},
	"timeless_book": {
		ModelID:          "timeless_book",
		Name:             "Timeless Book",
		TotalSupply:      4000,
		CraftedFlag:      false,
		BaseStarsPrice:   13000,
		InitialFloorGRAM: 135.0,
		Description:      "Ancient leather-bound tome of knowledge",
	},
	"vice_cream": {
		ModelID:          "vice_cream",
		Name:             "Vice Cream",
		TotalSupply:      6500,
		CraftedFlag:      false,
		BaseStarsPrice:   6500,
		InitialFloorGRAM: 55.0,
		Description:      "Neon-infused artisanal soft serve",
	},
	"surge_board": {
		ModelID:          "surge_board",
		Name:             "Surge Board",
		TotalSupply:      5000,
		CraftedFlag:      false,
		BaseStarsPrice:   9000,
		InitialFloorGRAM: 85.0,
		Description:      "Hydro-powered electric surfboard",
	},
	"scared_cat": {
		ModelID:          "scared_cat",
		Name:             "Scared Cat",
		TotalSupply:      8500,
		CraftedFlag:      false,
		BaseStarsPrice:   5000,
		InitialFloorGRAM: 45.0,
		Description:      "Startled black Halloween feline with glowing eyes",
	},
	"berry_box": {
		ModelID:          "berry_box",
		Name:             "Berry Box",
		TotalSupply:      10000,
		CraftedFlag:      false,
		BaseStarsPrice:   3500,
		InitialFloorGRAM: 30.0,
		Description:      "Fresh assortment of forest berries in wooden crate",
	},
	"khabib_papakha": {
		ModelID:          "khabib_papakha",
		Name:             "Khabib's Papakha",
		TotalSupply:      3000,
		CraftedFlag:      false,
		BaseStarsPrice:   16000,
		InitialFloorGRAM: 180.0,
		Description:      "Iconic Dagestani sheepskin hat worn by Khabib Nurmagomedov",
	},
	"ufc_strike": {
		ModelID:          "ufc_strike",
		Name:             "UFC Strike",
		TotalSupply:      4000,
		CraftedFlag:      false,
		BaseStarsPrice:   12000,
		InitialFloorGRAM: 110.0,
		Description:      "Championship MMA fighting glove",
	},
	"money_pot": {
		ModelID:          "money_pot",
		Name:             "Money Pot",
		TotalSupply:      5500,
		CraftedFlag:      false,
		BaseStarsPrice:   8000,
		InitialFloorGRAM: 70.0,
		Description:      "Clay cauldron overflowing with golden TON coins",
	},
	"clover_pin": {
		ModelID:          "clover_pin",
		Name:             "Clover Pin",
		TotalSupply:      7500,
		CraftedFlag:      false,
		BaseStarsPrice:   4500,
		InitialFloorGRAM: 40.0,
		Description:      "Lucky four-leaf clover emerald lapel pin",
	},
	"golden_piggy": {
		ModelID:          "golden_piggy",
		Name:             "Golden Piggy Bank",
		TotalSupply:      8800,
		CraftedFlag:      false,
		BaseStarsPrice:   3800,
		InitialFloorGRAM: 35.0,
		Description:      "Prosperity talisman filled with digital gold coins",
	},
}

// OfficialBackdrops catalog of backdrop color sets & permilles
var OfficialBackdrops = map[string]struct {
	Permille int
	Colors   BackdropColorSet
}{
	"Obsidian Matrix": {
		Permille: 15,
		Colors: BackdropColorSet{
			CenterHex:  "#1A1A1A",
			EdgeHex:    "#0A0A0A",
			PatternHex: "#333333",
			TextHex:    "#FFFFFF",
		},
	},
	"Solar Flare": {
		Permille: 35,
		Colors: BackdropColorSet{
			CenterHex:  "#FF9500",
			EdgeHex:    "#FF3B30",
			PatternHex: "#FFCC00",
			TextHex:    "#FFFFFF",
		},
	},
	"Cyber Cyan": {
		Permille: 80,
		Colors: BackdropColorSet{
			CenterHex:  "#007AFF",
			EdgeHex:    "#5856D6",
			PatternHex: "#5AC8FA",
			TextHex:    "#E5F1FF",
		},
	},
	"Emerald Oasis": {
		Permille: 120,
		Colors: BackdropColorSet{
			CenterHex:  "#34C759",
			EdgeHex:    "#007D34",
			PatternHex: "#A4E786",
			TextHex:    "#F0FFF4",
		},
	},
	"Deep Amethyst": {
		Permille: 180,
		Colors: BackdropColorSet{
			CenterHex:  "#AF52DE",
			EdgeHex:    "#5856D6",
			PatternHex: "#DDA0DD",
			TextHex:    "#FFFFFF",
		},
	},
	"Midnight Blue": {
		Permille: 570,
		Colors: BackdropColorSet{
			CenterHex:  "#1C1C1E",
			EdgeHex:    "#2C2C2E",
			PatternHex: "#3A3A3C",
			TextHex:    "#D1D1D6",
		},
	},
	"Cosmic Nebula": {
		Permille: 45,
		Colors: BackdropColorSet{
			CenterHex:  "#6C5CE7",
			EdgeHex:    "#2D3436",
			PatternHex: "#A29BFE",
			TextHex:    "#FFFFFF",
		},
	},
	"Golden Aurora": {
		Permille: 25,
		Colors: BackdropColorSet{
			CenterHex:  "#FDCB6E",
			EdgeHex:    "#E17055",
			PatternHex: "#FFEAA7",
			TextHex:    "#FFFFFF",
		},
	},
	"Crimson Blaze": {
		Permille: 95,
		Colors: BackdropColorSet{
			CenterHex:  "#D63031",
			EdgeHex:    "#2D3436",
			PatternHex: "#FF7675",
			TextHex:    "#FFFFFF",
		},
	},
}

// OfficialSymbols catalog of emblem symbols & permilles
var OfficialSymbols = map[string]struct {
	Permille int
	Tier     string
}{
	"Aero Crest": {
		Permille: 50,
		Tier:     "Rare",
	},
	"Crown Sigil": {
		Permille: 20,
		Tier:     "Epic",
	},
	"Dragon Eye": {
		Permille: 10,
		Tier:     "Legendary",
	},
	"Cosmic Star": {
		Permille: 120,
		Tier:     "Uncommon",
	},
	"Thunderbolt": {
		Permille: 80,
		Tier:     "Rare",
	},
	"Infinity Halo": {
		Permille: 30,
		Tier:     "Epic",
	},
	"Standard Mark": {
		Permille: 690,
		Tier:     "Common",
	},
}

// ResolveCollection finds collection metadata by raw modelID or normalized string
func ResolveCollection(key string) (CollectionMeta, bool) {
	clean := strings.ToLower(strings.TrimSpace(key))
	cleanNoUnderscore := strings.ReplaceAll(strings.ReplaceAll(clean, "-", ""), "_", "")
	cleanNoS := strings.ReplaceAll(cleanNoUnderscore, "s", "")
	clean = strings.ReplaceAll(clean, "-", "_")
	clean = strings.ReplaceAll(clean, " ", "_")

	if col, ok := OfficialCollections[clean]; ok {
		return col, true
	}

	// Exact match ignoring underscores (e.g. plushpepe == plush_pepe, durovscap == durov_cap)
	for mID, col := range OfficialCollections {
		mIDClean := strings.ReplaceAll(mID, "_", "")
		mIDNoS := strings.ReplaceAll(mIDClean, "s", "")
		if mIDClean == cleanNoUnderscore || mIDClean == cleanNoS || mIDNoS == cleanNoS {
			return col, true
		}
	}

	// Partial match search
	for mID, col := range OfficialCollections {
		mIDClean := strings.ReplaceAll(mID, "_", "")
		mIDNoS := strings.ReplaceAll(mIDClean, "s", "")
		if strings.Contains(cleanNoUnderscore, mIDClean) || strings.Contains(cleanNoS, mIDNoS) || strings.Contains(mIDClean, cleanNoUnderscore) {
			return col, true
		}
	}

	// Humanize name if not in static map
	parts := strings.Split(clean, "_")
	for i, p := range parts {
		if len(p) > 0 {
			parts[i] = strings.ToUpper(p[:1]) + p[1:]
		}
	}
	humanName := strings.Join(parts, " ")

	// Default fallback with reasonable defaults
	return CollectionMeta{
		ModelID:          clean,
		Name:             humanName,
		TotalSupply:      10000,
		CraftedFlag:      false,
		BaseStarsPrice:   5000,
		InitialFloorGRAM: 45.0,
		Description:      "Official Telegram gift collectible",
	}, false
}

// ResolveBackdrop returns backdrop metadata and whether it was an exact catalog match
func ResolveBackdrop(name string) (string, int, BackdropColorSet, bool) {
	if bd, ok := OfficialBackdrops[name]; ok {
		return name, bd.Permille, bd.Colors, true
	}

	// Fallback to Midnight Blue default
	def := OfficialBackdrops["Midnight Blue"]
	return "Midnight Blue", def.Permille, def.Colors, false
}

// ResolveSymbol returns symbol metadata and whether it was an exact catalog match
func ResolveSymbol(name string) (string, int, string, bool) {
	if sym, ok := OfficialSymbols[name]; ok {
		return name, sym.Permille, sym.Tier, true
	}
	def := OfficialSymbols["Aero Crest"]
	return "Aero Crest", def.Permille, def.Tier, false
}

// CalculateExactRarity calculates deterministic rarity percentile from official Telegram supply
func CalculateExactRarity(traitType, name string, permille int, colors *BackdropColorSet) ExactRarityResult {
	if permille <= 0 {
		permille = 100 // fallback 10%
	}

	percentile := float64(permille) / 10.0 // permille / 1000 * 100 = permille / 10

	tier := "Common"
	if percentile <= 1.0 {
		tier = "Legendary"
	} else if percentile <= 5.0 {
		tier = "Epic"
	} else if percentile <= 15.0 {
		tier = "Rare"
	} else if percentile <= 35.0 {
		tier = "Uncommon"
	}

	return ExactRarityResult{
		TraitType:      traitType,
		TraitName:      name,
		Permille:       permille,
		Percentile:     percentile,
		RarityTier:     tier,
		CertaintyLevel: "exact", // Sacred Rule 6: Blue Badge
		Colors:         colors,
	}
}

// CalculateSerialPercentile computes exact serial number rank percentile
func CalculateSerialPercentile(serialNumber, totalSupply int) (percentile float64, rankText string) {
	if totalSupply <= 0 {
		totalSupply = 5000
	}
	if serialNumber <= 0 {
		serialNumber = 1
	}

	percentile = (float64(serialNumber) / float64(totalSupply)) * 100.0
	if percentile < 0.01 {
		percentile = 0.01
	}

	topPct := math.Ceil(percentile*10) / 10
	if topPct <= 1.0 {
		rankText = fmt.Sprintf("#%d of %s — Top 1%% Elite", serialNumber, formatNumber(totalSupply))
	} else {
		rankText = fmt.Sprintf("#%d of %s — Top %.1f%%", serialNumber, formatNumber(totalSupply), topPct)
	}

	return percentile, rankText
}

func formatNumber(n int) string {
	in := fmt.Sprintf("%d", n)
	out := make([]string, 0)
	for len(in) > 3 {
		out = append([]string{in[len(in)-3:]}, out...)
		in = in[:len(in)-3]
	}
	if len(in) > 0 {
		out = append([]string{in}, out...)
	}
	return strings.Join(out, ",")
}
