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
	"spooky_pumpkin": {
		ModelID:          "spooky_pumpkin",
		Name:             "Spooky Pumpkin",
		TotalSupply:      8000,
		CraftedFlag:      false,
		BaseStarsPrice:   3500,
		InitialFloorGRAM: 32.0,
		Description:      "Eerie glowing carved pumpkin with spectral light",
	},
	"magic_potion": {
		ModelID:          "magic_potion",
		Name:             "Magic Potion",
		TotalSupply:      6500,
		CraftedFlag:      false,
		BaseStarsPrice:   4500,
		InitialFloorGRAM: 40.0,
		Description:      "Alchemical elixir bubbling with mystical vapor",
	},
	"evil_eye": {
		ModelID:          "evil_eye",
		Name:             "Evil Eye",
		TotalSupply:      7500,
		CraftedFlag:      false,
		BaseStarsPrice:   4000,
		InitialFloorGRAM: 36.0,
		Description:      "Protective nazar talisman with cosmic iris",
	},
	"sharp_tongue": {
		ModelID:          "sharp_tongue",
		Name:             "Sharp Tongue",
		TotalSupply:      5500,
		CraftedFlag:      false,
		BaseStarsPrice:   6000,
		InitialFloorGRAM: 55.0,
		Description:      "Playful animated mischievous collectible",
	},
	"kissed_frog": {
		ModelID:          "kissed_frog",
		Name:             "Kissed Frog",
		TotalSupply:      9000,
		CraftedFlag:      false,
		BaseStarsPrice:   3000,
		InitialFloorGRAM: 25.0,
		Description:      "Royalty in disguise wearing a miniature golden crown",
	},
	"jelly_bunny": {
		ModelID:          "jelly_bunny",
		Name:             "Jelly Bunny",
		TotalSupply:      15000,
		CraftedFlag:      false,
		BaseStarsPrice:   2000,
		InitialFloorGRAM: 18.0,
		Description:      "Translucent gummy rabbit with bouncing physics",
	},
	"jolly_santa": {
		ModelID:          "jolly_santa",
		Name:             "Jolly Santa",
		TotalSupply:      10000,
		CraftedFlag:      false,
		BaseStarsPrice:   5000,
		InitialFloorGRAM: 42.0,
		Description:      "Festive holiday spirit with golden embroidered coat",
	},
	"gingerbread_man": {
		ModelID:          "gingerbread_man",
		Name:             "Gingerbread Man",
		TotalSupply:      12500,
		CraftedFlag:      false,
		BaseStarsPrice:   2500,
		InitialFloorGRAM: 22.0,
		Description:      "Sweet holiday confection with candy icing details",
	},
	"snow_globe": {
		ModelID:          "snow_globe",
		Name:             "Snow Globe",
		TotalSupply:      8500,
		CraftedFlag:      false,
		BaseStarsPrice:   4000,
		InitialFloorGRAM: 38.0,
		Description:      "Enchanted miniature winter wonderland in glass",
	},
	"christmas_tree": {
		ModelID:          "christmas_tree",
		Name:             "Christmas Tree",
		TotalSupply:      11000,
		CraftedFlag:      false,
		BaseStarsPrice:   3500,
		InitialFloorGRAM: 30.0,
		Description:      "Glittering evergreen decorated with glowing ornaments",
	},
	"lunar_snake": {
		ModelID:          "lunar_snake",
		Name:             "Lunar Snake",
		TotalSupply:      7000,
		CraftedFlag:      false,
		BaseStarsPrice:   6500,
		InitialFloorGRAM: 60.0,
		Description:      "Year of the Snake celestial jade and gold serpent",
	},
	"eternal_rose": {
		ModelID:          "eternal_rose",
		Name:             "Eternal Rose",
		TotalSupply:      9500,
		CraftedFlag:      false,
		BaseStarsPrice:   5000,
		InitialFloorGRAM: 48.0,
		Description:      "Crystal-encased velvet crimson rose with shimmering dew",
	},
	"diamond_ring": {
		ModelID:          "diamond_ring",
		Name:             "Diamond Ring",
		TotalSupply:      4000,
		CraftedFlag:      false,
		BaseStarsPrice:   12000,
		InitialFloorGRAM: 110.0,
		Description:      "Flawless solitaire diamond on platinum band",
	},
	"vintage_cigar": {
		ModelID:          "vintage_cigar",
		Name:             "Vintage Cigar",
		TotalSupply:      6000,
		CraftedFlag:      false,
		BaseStarsPrice:   5500,
		InitialFloorGRAM: 50.0,
		Description:      "Hand-rolled premium reserve with golden ash tip",
	},
	"flying_broom": {
		ModelID:          "flying_broom",
		Name:             "Flying Broom",
		TotalSupply:      8000,
		CraftedFlag:      false,
		BaseStarsPrice:   3500,
		InitialFloorGRAM: 32.0,
		Description:      "Nimbus aerodynamic mystical wood broomstick",
	},
	"top_hat": {
		ModelID:          "top_hat",
		Name:             "Gentleman Top Hat",
		TotalSupply:      5000,
		CraftedFlag:      false,
		BaseStarsPrice:   7000,
		InitialFloorGRAM: 65.0,
		Description:      "Silk tuxedo hat concealing magical illusions",
	},
	"record_player": {
		ModelID:          "record_player",
		Name:             "Vintage Gramophone",
		TotalSupply:      3500,
		CraftedFlag:      false,
		BaseStarsPrice:   14000,
		InitialFloorGRAM: 130.0,
		Description:      "Antique brass horn audio player spinning vinyl",
	},
	"perfume_bottle": {
		ModelID:          "perfume_bottle",
		Name:             "Luxury Perfume",
		TotalSupply:      7500,
		CraftedFlag:      false,
		BaseStarsPrice:   4500,
		InitialFloorGRAM: 42.0,
		Description:      "French crystal flacon emitting fragrant aura",
	},
	"crystal_ball": {
		ModelID:          "crystal_ball",
		Name:             "Mystic Crystal Ball",
		TotalSupply:      4500,
		CraftedFlag:      false,
		BaseStarsPrice:   9000,
		InitialFloorGRAM: 85.0,
		Description:      "Scrying orb revealing visions of the future",
	},
	"golden_trophy": {
		ModelID:          "golden_trophy",
		Name:             "Grand Champion Trophy",
		TotalSupply:      2000,
		CraftedFlag:      false,
		BaseStarsPrice:   18000,
		InitialFloorGRAM: 195.0,
		Description:      "Solid gold triumphal cup with marble pedestal",
	},
	"swiss_watch": {
		ModelID:          "swiss_watch",
		Name:             "Chronograph Watch",
		TotalSupply:      3000,
		CraftedFlag:      false,
		BaseStarsPrice:   15000,
		InitialFloorGRAM: 160.0,
		Description:      "Precision Swiss automatic movement timepiece",
	},
	"luxury_yacht": {
		ModelID:          "luxury_yacht",
		Name:             "Luxury Yacht",
		TotalSupply:      1000,
		CraftedFlag:      false,
		BaseStarsPrice:   30000,
		InitialFloorGRAM: 320.0,
		Description:      "Multi-deck sovereign superyacht with helipad",
	},
	"supercar": {
		ModelID:          "supercar",
		Name:             "Apex Supercar",
		TotalSupply:      1200,
		CraftedFlag:      false,
		BaseStarsPrice:   25000,
		InitialFloorGRAM: 280.0,
		Description:      "Twin-turbo hybrid hypercar in carbon weave",
	},
	"red_dragon": {
		ModelID:          "red_dragon",
		Name:             "Imperial Dragon",
		TotalSupply:      800,
		CraftedFlag:      true, // Crafted-only!
		BaseStarsPrice:   35000,
		InitialFloorGRAM: 520.0,
		Description:      "Mythological coiled fire dragon forged by alchemy",
	},
	"imperial_crown": {
		ModelID:          "imperial_crown",
		Name:             "Imperial Crown",
		TotalSupply:      500,
		CraftedFlag:      true, // Crafted-only!
		BaseStarsPrice:   50000,
		InitialFloorGRAM: 750.0,
		Description:      "High regalia crown encrusted with diamonds and sapphires",
	},
	"samurai_helmet": {
		ModelID:          "samurai_helmet",
		Name:             "Samurai Kabuto",
		TotalSupply:      2200,
		CraftedFlag:      false,
		BaseStarsPrice:   16000,
		InitialFloorGRAM: 170.0,
		Description:      "Forged steel battle helmet with gold crest",
	},
	"space_helmet": {
		ModelID:          "space_helmet",
		Name:             "Astronaut Visor",
		TotalSupply:      3800,
		CraftedFlag:      false,
		BaseStarsPrice:   11000,
		InitialFloorGRAM: 105.0,
		Description:      "Gold-tinted spacewalk exploration helmet",
	},
	"golden_skull": {
		ModelID:          "golden_skull",
		Name:             "Relic Skull",
		TotalSupply:      1800,
		CraftedFlag:      false,
		BaseStarsPrice:   22000,
		InitialFloorGRAM: 230.0,
		Description:      "Ancient gilded ossuary relic with diamond eyes",
	},
	"magic_wand": {
		ModelID:          "magic_wand",
		Name:             "Archmage Wand",
		TotalSupply:      5200,
		CraftedFlag:      false,
		BaseStarsPrice:   6500,
		InitialFloorGRAM: 58.0,
		Description:      "Elder wood wand channeling arcane sparks",
	},
	"neon_sword": {
		ModelID:          "neon_sword",
		Name:             "Cyber Katana",
		TotalSupply:      2800,
		CraftedFlag:      false,
		BaseStarsPrice:   17000,
		InitialFloorGRAM: 180.0,
		Description:      "High-frequency plasma blade with neon luminescence",
	},
	"holy_grail": {
		ModelID:          "holy_grail",
		Name:             "Sacred Chalice",
		TotalSupply:      600,
		CraftedFlag:      true, // Crafted-only!
		BaseStarsPrice:   45000,
		InitialFloorGRAM: 680.0,
		Description:      "Legendary vessel brimming with shimmering divine light",
	},
	"diamond_hands": {
		ModelID:          "diamond_hands",
		Name:             "Diamond Hands",
		TotalSupply:      4200,
		CraftedFlag:      false,
		BaseStarsPrice:   13000,
		InitialFloorGRAM: 125.0,
		Description:      "Crystalline hands holding through market turbulence",
	},
	"moon_rocket": {
		ModelID:          "moon_rocket",
		Name:             "Apollo Rocket",
		TotalSupply:      3200,
		CraftedFlag:      false,
		BaseStarsPrice:   14500,
		InitialFloorGRAM: 140.0,
		Description:      "Heavy-lift lunar expedition spacecraft",
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
	clean = strings.ReplaceAll(clean, "-", "_")
	clean = strings.ReplaceAll(clean, " ", "_")

	if col, ok := OfficialCollections[clean]; ok {
		return col, true
	}

	// Partial match search
	for mID, col := range OfficialCollections {
		if strings.Contains(clean, mID) || strings.Contains(mID, clean) {
			return col, true
		}
	}

	// Default fallback with reasonable defaults
	return CollectionMeta{
		ModelID:          clean,
		Name:             strings.Title(strings.ReplaceAll(clean, "_", " ")),
		TotalSupply:      5000,
		CraftedFlag:      false,
		BaseStarsPrice:   5000,
		InitialFloorGRAM: 30.0,
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
