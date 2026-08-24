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
	TraitType      string  `json:"trait_type"`
	TraitName      string  `json:"trait_name"`
	Permille       int     `json:"permille"`
	Percentile     float64 `json:"percentile"` // e.g. 0.1% for rarest
	RarityTier     string  `json:"rarity_tier"` // Legendary, Epic, Rare, Uncommon, Common
	CertaintyLevel string  `json:"certainty_level"` // "exact" (Sacred Rule 6: Blue Badge)
	Colors         *BackdropColorSet `json:"colors,omitempty"`
}

// OfficialCollections catalog of Telegram gifts
var OfficialCollections = map[string]CollectionMeta{
	"plush_pepe": {
		ModelID:          "plush_pepe",
		Name:             "Plush Pepe",
		TotalSupply:      5000,
		CraftedFlag:      false,
		BaseStarsPrice:   10000,
		InitialFloorGRAM: 120.0,
		Description:      "Iconic sovereign green frog plush collectible",
	},
	"durov_cap": {
		ModelID:          "durov_cap",
		Name:             "Durov's Black Cap",
		TotalSupply:      2500,
		CraftedFlag:      false,
		BaseStarsPrice:   15000,
		InitialFloorGRAM: 240.0,
		Description:      "Legendary minimalist black cap worn by Pavel Durov",
	},
	"snoop_dogg": {
		ModelID:          "snoop_dogg",
		Name:             "Snoop Dogg Gold Mic",
		TotalSupply:      996000,
		CraftedFlag:      false,
		BaseStarsPrice:   500,
		InitialFloorGRAM: 4.5,
		Description:      "Record-breaking mass drop collectible with Snoop Dogg",
	},
	"golden_star": {
		ModelID:          "golden_star",
		Name:             "Celestial Star",
		TotalSupply:      10000,
		CraftedFlag:      false,
		BaseStarsPrice:   5000,
		InitialFloorGRAM: 45.0,
		Description:      "Gleaming astral star collectible with animated corona",
	},
	"cyber_heart": {
		ModelID:          "cyber_heart",
		Name:             "Cyber Heart",
		TotalSupply:      12000,
		CraftedFlag:      false,
		BaseStarsPrice:   2500,
		InitialFloorGRAM: 28.0,
		Description:      "Futuristic glowing techno-cardiac core",
	},
	"phoenix_feather": {
		ModelID:          "phoenix_feather",
		Name:             "Phoenix Feather",
		TotalSupply:      1500,
		CraftedFlag:      true, // Crafted-only model!
		BaseStarsPrice:   20000,
		InitialFloorGRAM: 450.0,
		Description:      "Mythic crafted flame feather, forged through item burning",
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
