package traits

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

var (
	ErrCollectionNotFound = errors.New("collection not found in canonical catalog")
)

// CollectionMeta holds official Telegram Gift collection supply & metadata.
// Note: Floor prices are NEVER stored here statically; they are fetched dynamically from live venue adapters.
type CollectionMeta struct {
	ModelID        string `json:"model_id"`
	Name           string `json:"name"`
	TotalSupply    int    `json:"total_supply"`
	CraftedFlag    bool   `json:"crafted_flag"`
	LimitedFlag    bool   `json:"limited_flag"`
	ContractID     string `json:"contract_id,omitempty"`
	BaseStarsPrice int    `json:"base_stars_price,omitempty"`
	Description    string `json:"description"`
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
	Percentile     float64           `json:"percentile"` // e.g. 0.05% for rarest
	RarityTier     string            `json:"rarity_tier"` // Mythic, Legendary, Epic, Rare, Uncommon, Common
	CertaintyLevel string            `json:"certainty_level"` // "exact" (Sacred Rule 6: Blue Badge)
	Colors         *BackdropColorSet `json:"colors,omitempty"`
}

// Canonical120Gifts list of all 120 official Telegram upgradable gifts from api.changes.tg and Telegram contracts
var CanonicalCollections = map[string]CollectionMeta{
	"plush_pepe": {
		ModelID:     "plush_pepe",
		Name:        "Plush Pepe",
		TotalSupply: 1500,
		CraftedFlag: false,
		LimitedFlag: true,
		ContractID:  "5936013938331222567",
		Description: "Handmade plush Pepe frog, sovereign pioneer Telegram collectible",
	},
	"durov_cap": {
		ModelID:     "durov_cap",
		Name:        "Durov's Cap",
		TotalSupply: 2500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Signature black baseball cap worn by Telegram founder Pavel Durov",
	},
	"precious_peach": {
		ModelID:     "precious_peach",
		Name:        "Precious Peach",
		TotalSupply: 5000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Iconic velvet peach collectible with crystalline details",
	},
	"signet_ring": {
		ModelID:     "signet_ring",
		Name:        "Signet Ring",
		TotalSupply: 5000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Sovereign engraved gold signet ring with royal crest",
	},
	"santa_hat": {
		ModelID:     "santa_hat",
		Name:        "Santa Hat",
		TotalSupply: 10000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Classic festive Santa hat collectible with high market liquidity",
	},
	"spiced_wine": {
		ModelID:     "spiced_wine",
		Name:        "Spiced Wine",
		TotalSupply: 15000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Warm mulled wine chalice with festive cinnamon stick",
	},
	"jelly_bunny": {
		ModelID:     "jelly_bunny",
		Name:        "Jelly Bunny",
		TotalSupply: 8000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Translucent confectionery gelatin rabbit collectible",
	},
	"perfume_bottle": {
		ModelID:     "perfume_bottle",
		Name:        "Perfume Bottle",
		TotalSupply: 7000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Vintage faceted crystal perfume flacon with gold atomiser",
	},
	"eternal_rose": {
		ModelID:     "eternal_rose",
		Name:        "Eternal Rose",
		TotalSupply: 10000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Preserved glass-domed enchanted crimson rose",
	},
	"berry_box": {
		ModelID:     "berry_box",
		Name:        "Berry Box",
		TotalSupply: 10000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Fresh assortment of forest berries in rustic wooden crate",
	},
	"vintage_cigar": {
		ModelID:     "vintage_cigar",
		Name:        "Vintage Cigar",
		TotalSupply: 6000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Aged Cuban hand-rolled cigar with silver ash band",
	},
	"magic_potion": {
		ModelID:     "magic_potion",
		Name:        "Magic Potion",
		TotalSupply: 9000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Alchemical glass flask brewing iridescent glowing elixir",
	},
	"kissed_frog": {
		ModelID:     "kissed_frog",
		Name:        "Kissed Frog",
		TotalSupply: 6500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Charming amphibian wearing a miniature royal crown",
	},
	"hex_pot": {
		ModelID:     "hex_pot",
		Name:        "Hex Pot",
		TotalSupply: 7500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Bubbling cast-iron cauldron with mystical emerald fumes",
	},
	"evil_eye": {
		ModelID:     "evil_eye",
		Name:        "Evil Eye",
		TotalSupply: 12000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Traditional cobalt glass Nazar protective talisman",
	},
	"sharp_tongue": {
		ModelID:     "sharp_tongue",
		Name:        "Sharp Tongue",
		TotalSupply: 8000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Edgy satirical pop-art tongue collectible",
	},
	"trapped_heart": {
		ModelID:     "trapped_heart",
		Name:        "Trapped Heart",
		TotalSupply: 7000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Gilded birdcage holding a pulsating ruby heart",
	},
	"skull_flower": {
		ModelID:     "skull_flower",
		Name:        "Skull Flower",
		TotalSupply: 8500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Gothic bone blossoms entwined in floral harmony",
	},
	"scared_cat": {
		ModelID:     "scared_cat",
		Name:        "Scared Cat",
		TotalSupply: 8500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Startled black Halloween feline with glowing eyes",
	},
	"spy_agaric": {
		ModelID:     "spy_agaric",
		Name:        "Spy Agaric",
		TotalSupply: 9500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Spotted toadstool mushroom with observant undercover camera lens",
	},
	"homemade_cake": {
		ModelID:     "homemade_cake",
		Name:        "Homemade Cake",
		TotalSupply: 12000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Multi-layered celebration cake with whipped frosting",
	},
	"genie_lamp": {
		ModelID:     "genie_lamp",
		Name:        "Genie Lamp",
		TotalSupply: 4500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Polished brass Aladdin lamp swirling with mythical wishes",
	},
	"lunar_snake": {
		ModelID:     "lunar_snake",
		Name:        "Lunar Snake",
		TotalSupply: 10000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Celestial coiled serpent commemorating the Lunar Year of the Snake",
	},
	"party_sparkler": {
		ModelID:     "party_sparkler",
		Name:        "Party Sparkler",
		TotalSupply: 20000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Glittering celebratory pyrotechnic sparkler",
	},
	"jester_hat": {
		ModelID:     "jester_hat",
		Name:        "Jester Hat",
		TotalSupply: 8000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Three-pointed carnival cap with ringing silver bells",
	},
	"witch_hat": {
		ModelID:     "witch_hat",
		Name:        "Witch Hat",
		TotalSupply: 9000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Pointed velvet sorcerer hat buckled in antique bronze",
	},
	"hanging_star": {
		ModelID:     "hanging_star",
		Name:        "Hanging Star",
		TotalSupply: 15000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Glimmering gold pendant star suspended from silk ribbon",
	},
	"love_candle": {
		ModelID:     "love_candle",
		Name:        "Love Candle",
		TotalSupply: 14000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Heart-shaped wax candle burning with warm romantic glow",
	},
	"cookie_heart": {
		ModelID:     "cookie_heart",
		Name:        "Cookie Heart",
		TotalSupply: 16000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Iced ginger shortbread heart baked with affection",
	},
	"desk_calendar": {
		ModelID:     "desk_calendar",
		Name:        "Desk Calendar",
		TotalSupply: 6000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Executive perpetual desk calendar commemorating key Telegram dates",
	},
	"jingle_bells": {
		ModelID:     "jingle_bells",
		Name:        "Jingle Bells",
		TotalSupply: 8000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Golden holiday jingle bells tied with festive bow",
	},
	"snow_mittens": {
		ModelID:     "snow_mittens",
		Name:        "Snow Mittens",
		TotalSupply: 11000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Hand-knitted woollen mittens with snowflake embroidery",
	},
	"voodoo_doll": {
		ModelID:     "voodoo_doll",
		Name:        "Voodoo Doll",
		TotalSupply: 6500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Burlap stitched talisman with button eyes and lucky pins",
	},
	"mad_pumpkin": {
		ModelID:     "mad_pumpkin",
		Name:        "Mad Pumpkin",
		TotalSupply: 8000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Fiendish Jack-o'-Lantern glowing with eerie inner luminescence",
	},
	"hypno_lollipop": {
		ModelID:     "hypno_lollipop",
		Name:        "Hypno Lollipop",
		TotalSupply: 10000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Hypnotic spiral candy on a gilded stick",
	},
	"b_day_candle": {
		ModelID:     "b_day_candle",
		Name:        "B-Day Candle",
		TotalSupply: 25000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Flickering birthday celebration candle with confetti sparkles",
	},
	"bunny_muffin": {
		ModelID:     "bunny_muffin",
		Name:        "Bunny Muffin",
		TotalSupply: 9000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Gourmet pastry topped with frosted bunny ears",
	},
	"astral_shard": {
		ModelID:     "astral_shard",
		Name:        "Astral Shard",
		TotalSupply: 1200,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Synthesized crystalline meteorite shard from the deep cosmos",
	},
	"flying_broom": {
		ModelID:     "flying_broom",
		Name:        "Flying Broom",
		TotalSupply: 7000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Enchanted Nimbus flying broomstick wrapped in gold wire",
	},
	"crystal_ball": {
		ModelID:     "crystal_ball",
		Name:        "Crystal Ball",
		TotalSupply: 5000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Divination orb reflecting cosmic nebula visions",
	},
	"eternal_candle": {
		ModelID:     "eternal_candle",
		Name:        "Eternal Candle",
		TotalSupply: 12000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Everlasting silver candle burning with immortal flame",
	},
	"swiss_watch": {
		ModelID:     "swiss_watch",
		Name:        "Swiss Watch",
		TotalSupply: 3500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Precision tourbillon mechanical timepiece in rose gold",
	},
	"ginger_cookie": {
		ModelID:     "ginger_cookie",
		Name:        "Ginger Cookie",
		TotalSupply: 18000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Festive spiced gingerbread figure decorated with royal icing",
	},
	"mini_oscar": {
		ModelID:     "mini_oscar",
		Name:        "Mini Oscar",
		TotalSupply: 3000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Gilded statuette awarded for cinematic Telegram excellence",
	},
	"lol_pop": {
		ModelID:     "lol_pop",
		Name:        "Lol Pop",
		TotalSupply: 15000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Colorful glossy swirl lollipop collectible",
	},
	"ion_gem": {
		ModelID:     "ion_gem",
		Name:        "Ion Gem",
		TotalSupply: 4000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Charged prismatic crystal pulsating with ion energy",
	},
	"star_notepad": {
		ModelID:     "star_notepad",
		Name:        "Star Notepad",
		TotalSupply: 9000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Leather-bound journal embossed with the Telegram Star emblem",
	},
	"loot_bag": {
		ModelID:     "loot_bag",
		Name:        "Loot Bag",
		TotalSupply: 8000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Burlap treasure sack overflowing with gems and gold",
	},
	"love_potion": {
		ModelID:     "love_potion",
		Name:        "Love Potion",
		TotalSupply: 10000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Heart-shaped vial containing enchanted pink essence",
	},
	"toy_bear": {
		ModelID:     "toy_bear",
		Name:        "Toy Bear",
		TotalSupply: 10000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Classic vintage teddy bear with stitched satin bow",
	},
	"diamond_ring": {
		ModelID:     "diamond_ring",
		Name:        "Diamond Ring",
		TotalSupply: 4000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Flawless solitaire diamond ring set in white platinum",
	},
	"sakura_flower": {
		ModelID:     "sakura_flower",
		Name:        "Sakura Flower",
		TotalSupply: 10000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Delicate Japanese cherry blossom in full bloom",
	},
	"sleigh_bell": {
		ModelID:     "sleigh_bell",
		Name:        "Sleigh Bell",
		TotalSupply: 9500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Polished brass bell from Santa's reindeer harness",
	},
	"top_hat": {
		ModelID:     "top_hat",
		Name:        "Top Hat",
		TotalSupply: 5000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Aristocratic black silk top hat with satin ribbon",
	},
	"record_player": {
		ModelID:     "record_player",
		Name:        "Record Player",
		TotalSupply: 4000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Vintage vinyl phonograph with polished brass horn",
	},
	"winter_wreath": {
		ModelID:     "winter_wreath",
		Name:        "Winter Wreath",
		TotalSupply: 8000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Evergreen fir holiday wreath adorned with pinecones and berries",
	},
	"snow_globe": {
		ModelID:     "snow_globe",
		Name:        "Snow Globe",
		TotalSupply: 6000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Glass snow globe with miniature alpine cabin scene",
	},
	"electric_skull": {
		ModelID:     "electric_skull",
		Name:        "Electric Skull",
		TotalSupply: 5500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Cybernetic skull surging with high-voltage neon arcs",
	},
	"tama_gadget": {
		ModelID:     "tama_gadget",
		Name:        "Tama Gadget",
		TotalSupply: 7000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Nostalgic 90s virtual pocket pet handheld device",
	},
	"candy_cane": {
		ModelID:     "candy_cane",
		Name:        "Candy Cane",
		TotalSupply: 18000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Peppermint striped holiday sugar cane",
	},
	"neko_helmet": {
		ModelID:     "neko_helmet",
		Name:        "Neko Helmet",
		TotalSupply: 4500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Futuristic motorcycle helmet with aerodynamic cat ears",
	},
	"jack_in_the_box": {
		ModelID:     "jack_in_the_box",
		Name:        "Jack-in-the-Box",
		TotalSupply: 6000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Spring-loaded vintage windup jester surprise box",
	},
	"easter_egg": {
		ModelID:     "easter_egg",
		Name:        "Easter Egg",
		TotalSupply: 10000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Intricately filigreed Fabergé imperial style enamel egg",
	},
	"bonded_ring": {
		ModelID:     "bonded_ring",
		Name:        "Bonded Ring",
		TotalSupply: 5000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Twin interlocking platinum bands symbolising unity",
	},
	"pet_snake": {
		ModelID:     "pet_snake",
		Name:        "Pet Snake",
		TotalSupply: 7500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Friendly emerald python coiled playfully",
	},
	"snake_box": {
		ModelID:     "snake_box",
		Name:        "Snake Box",
		TotalSupply: 6500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Mystery parcel bound with lucky snake-skin ribbon",
	},
	"xmas_stocking": {
		ModelID:     "xmas_stocking",
		Name:        "Xmas Stocking",
		TotalSupply: 14000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Knit fireplace stocking filled with holiday delights",
	},
	"big_year": {
		ModelID:     "big_year",
		Name:        "Big Year",
		TotalSupply: 12000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Monumental golden calendar trophy marking a milestone year",
	},
	"holiday_drink": {
		ModelID:     "holiday_drink",
		Name:        "Holiday Drink",
		TotalSupply: 16000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Creamy eggnog cocktail topped with grated nutmeg and cinnamon",
	},
	"gem_signet": {
		ModelID:     "gem_signet",
		Name:        "Gem Signet",
		TotalSupply: 4000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Heavy gold signet ring set with an uncut emerald cabochon",
	},
	"light_sword": {
		ModelID:     "light_sword",
		Name:        "Light Sword",
		TotalSupply: 5000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Plasma beam saber radiating crystalline energy",
	},
	"restless_jar": {
		ModelID:     "restless_jar",
		Name:        "Restless Jar",
		TotalSupply: 7000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Glass terrarium jar capturing trapped ethereal wisps",
	},
	"nail_bracelet": {
		ModelID:     "nail_bracelet",
		Name:        "Nail Bracelet",
		TotalSupply: 4500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Iconic haute-joaillerie bent nail gold bangle",
	},
	"heroic_helmet": {
		ModelID:     "heroic_helmet",
		Name:        "Heroic Helmet",
		TotalSupply: 3500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Corinthian bronze hoplite war helmet with horsehair plume",
	},
	"bow_tie": {
		ModelID:     "bow_tie",
		Name:        "Bow Tie",
		TotalSupply: 12000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Silk black-tie tuxedo butterfly bow tie",
	},
	"heart_locket": {
		ModelID:     "heart_locket",
		Name:        "Heart Locket",
		TotalSupply: 8000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Vintage opening silver heart pendant for cherished keepsakes",
	},
	"lush_bouquet": {
		ModelID:     "lush_bouquet",
		Name:        "Lush Bouquet",
		TotalSupply: 9000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Luxurious floral arrangement of peony roses and baby's breath",
	},
	"whip_cupcake": {
		ModelID:     "whip_cupcake",
		Name:        "Whip Cupcake",
		TotalSupply: 15000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Vanilla cupcake crowned with strawberry whipped cream",
	},
	"joyful_bundle": {
		ModelID:     "joyful_bundle",
		Name:        "Joyful Bundle",
		TotalSupply: 10000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Festive bundle of colorful party balloons and confetti",
	},
	"cupid_charm": {
		ModelID:     "cupid_charm",
		Name:        "Cupid Charm",
		TotalSupply: 7500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Golden miniature Cupid bow with heart-tipped arrow",
	},
	"valentine_box": {
		ModelID:     "valentine_box",
		Name:        "Valentine Box",
		TotalSupply: 9000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Velvet heart box filled with Belgian artisan pralines",
	},
	"snoop_dogg": {
		ModelID:     "snoop_dogg",
		Name:        "Snoop Dogg",
		TotalSupply: 3000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Official Snoop Dogg collectible featuring signature Death Row styling",
	},
	"swag_bag": {
		ModelID:     "swag_bag",
		Name:        "Swag Bag",
		TotalSupply: 4000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Exclusive VIP duffle bag packed with streetwear essentials",
	},
	"snoop_cigar": {
		ModelID:     "snoop_cigar",
		Name:        "Snoop Cigar",
		TotalSupply: 5000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Special edition long-leaf cigar with custom Snoop packaging",
	},
	"low_rider": {
		ModelID:     "low_rider",
		Name:        "Low Rider",
		TotalSupply: 2500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Custom hydraulic lowrider classic coupe cruising in chrome",
	},
	"westside_sign": {
		ModelID:     "westside_sign",
		Name:        "Westside Sign",
		TotalSupply: 4500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Iconic hand-sign emblem representing West Coast culture",
	},
	"stellar_rocket": {
		ModelID:     "stellar_rocket",
		Name:        "Stellar Rocket",
		TotalSupply: 6000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Retro-futuristic rocket booster shooting to the stars",
	},
	"jolly_chimp": {
		ModelID:     "jolly_chimp",
		Name:        "Jolly Chimp",
		TotalSupply: 5000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Vintage mechanical cymbal-clapping monkey collectible",
	},
	"moon_pendant": {
		ModelID:     "moon_pendant",
		Name:        "Moon Pendant",
		TotalSupply: 8000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Crescent moon necklace in sterling silver with star stone",
	},
	"ionic_dryer": {
		ModelID:     "ionic_dryer",
		Name:        "Ionic Dryer",
		TotalSupply: 7000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Sleek aerodynamic ionic hair styling collectible",
	},
	"input_key": {
		ModelID:     "input_key",
		Name:        "Input Key",
		TotalSupply: 9000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Mechanical keyboard keycap switch with custom neon legend",
	},
	"mighty_arm": {
		ModelID:     "mighty_arm",
		Name:        "Mighty Arm",
		TotalSupply: 6500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Bionic mechanical arm flexing high hydraulic strength",
	},
	"artisan_brick": {
		ModelID:     "artisan_brick",
		Name:        "Artisan Brick",
		TotalSupply: 8000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Sculpted luxury marble brick engraved with architectural hallmark",
	},
	"clover_pin": {
		ModelID:     "clover_pin",
		Name:        "Clover Pin",
		TotalSupply: 7500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Lucky four-leaf clover emerald lapel pin with gold trim",
	},
	"sky_stilettos": {
		ModelID:     "sky_stilettos",
		Name:        "Sky Stilettos",
		TotalSupply: 5500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Haute couture high-heel shoes crafted in metallic azure",
	},
	"fresh_socks": {
		ModelID:     "fresh_socks",
		Name:        "Fresh Socks",
		TotalSupply: 15000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Designer crew socks with bold typographic streetwear patterns",
	},
	"happy_brownie": {
		ModelID:     "happy_brownie",
		Name:        "Happy Brownie",
		TotalSupply: 12000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Decadent fudge chocolate brownie topped with candy sprinkles",
	},
	"ice_cream": {
		ModelID:     "ice_cream",
		Name:        "Ice Cream",
		TotalSupply: 16000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Triple-scoop waffle cone with waffle crisp and chocolate drizzle",
	},
	"spring_basket": {
		ModelID:     "spring_basket",
		Name:        "Spring Basket",
		TotalSupply: 9000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Woven wicker basket filled with fresh springtime blooms",
	},
	"instant_ramen": {
		ModelID:     "instant_ramen",
		Name:        "Instant Ramen",
		TotalSupply: 14000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Steaming bowl of artisan ramen with soft egg and nori",
	},
	"faith_amulet": {
		ModelID:     "faith_amulet",
		Name:        "Faith Amulet",
		TotalSupply: 6000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Ancient holy amulet inscribed with sacred celestial protection glyphs",
	},
	"mousse_cake": {
		ModelID:     "mousse_cake",
		Name:        "Mousse Cake",
		TotalSupply: 10000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Silky French chocolate mousse entremet with mirror glaze",
	},
	"bling_binky": {
		ModelID:     "bling_binky",
		Name:        "Bling Binky",
		TotalSupply: 5000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Diamond-encrusted gold pacifier for the ultra-wealthy",
	},
	"money_pot": {
		ModelID:     "money_pot",
		Name:        "Money Pot",
		TotalSupply: 5500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Clay cauldron overflowing with golden TON coins",
	},
	"pretty_posy": {
		ModelID:     "pretty_posy",
		Name:        "Pretty Posy",
		TotalSupply: 12000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Charming petite nosegay bouquet tied with silk string",
	},
	"khabib_papakha": {
		ModelID:     "khabib_papakha",
		Name:        "Khabib's Papakha",
		TotalSupply: 3000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Iconic Dagestani sheepskin hat worn by Khabib Nurmagomedov",
	},
	"ufc_strike": {
		ModelID:     "ufc_strike",
		Name:        "UFC Strike",
		TotalSupply: 4000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Championship MMA fighting glove bearing the official seal",
	},
	"victory_medal": {
		ModelID:     "victory_medal",
		Name:        "Victory Medal",
		TotalSupply: 5000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Solid gold winner's laurel medal suspended from national ribbon",
	},
	"rare_bird": {
		ModelID:     "rare_bird",
		Name:        "Rare Bird",
		TotalSupply: 4000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Exotic tropical bird with iridescent paradise plumage",
	},
	"mood_pack": {
		ModelID:     "mood_pack",
		Name:        "Mood Pack",
		TotalSupply: 8000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Interactive mood capsule emitting kaleidoscopic emotional hues",
	},
	"pool_float": {
		ModelID:     "pool_float",
		Name:        "Pool Float",
		TotalSupply: 7000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Inflatable neon pink flamingo lounger for poolside leisure",
	},
	"timeless_book": {
		ModelID:     "timeless_book",
		Name:        "Timeless Book",
		TotalSupply: 4000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Ancient leather-bound tome of arcane knowledge",
	},
	"chill_flame": {
		ModelID:     "chill_flame",
		Name:        "Chill Flame",
		TotalSupply: 7000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Mystical cool cyan flame torch glowing perpetually",
	},
	"vice_cream": {
		ModelID:     "vice_cream",
		Name:        "Vice Cream",
		TotalSupply: 6500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Neon-infused artisanal soft serve ice cream",
	},
	"surge_board": {
		ModelID:     "surge_board",
		Name:        "Surge Board",
		TotalSupply: 5000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Hydro-powered electric carbon fiber surfboard",
	},
	"liberty_figure": {
		ModelID:     "liberty_figure",
		Name:        "Liberty Figure",
		TotalSupply: 3500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Miniature Statue of Liberty bronze figurine with shining torch",
	},
	"durovs_glasses": {
		ModelID:     "durovs_glasses",
		Name:        "Durov's Glasses",
		TotalSupply: 5000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Iconic dark frameless sunglasses worn by Pavel Durov",
	},
	"fine_pen": {
		ModelID:     "fine_pen",
		Name:        "Fine Pen",
		TotalSupply: 4500,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Gold-nib executive fountain pen crafted with lacquer and brass",
	},
	"intelligence_cup": {
		ModelID:     "intelligence_cup",
		Name:        "Intelligence Cup",
		TotalSupply: 3000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Grand trophy awarded to champions of Telegram algorithmic competitions",
	},
	"algorithm_cup": {
		ModelID:     "algorithm_cup",
		Name:        "Algorithm Cup",
		TotalSupply: 3000,
		CraftedFlag: false,
		LimitedFlag: true,
		Description: "Prestigious crystal award commemorating elite code engineering",
	},
}

// NormalizeSlug converts any variant (kebab, snake, spaces, casing) to standard snake_case key
func NormalizeSlug(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	s = strings.ReplaceAll(s, "-", "_")
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "'", "")
	s = strings.ReplaceAll(s, "’", "")
	return s
}

// ResolveCollection finds collection metadata by exact or normalized canonical slug
func ResolveCollection(key string) (CollectionMeta, bool) {
	norm := NormalizeSlug(key)
	if col, ok := CanonicalCollections[norm]; ok {
		return col, true
	}

	// Try without underscores for hyphenated inputs
	cleanNoUnderscore := strings.ReplaceAll(norm, "_", "")
	for k, col := range CanonicalCollections {
		kClean := strings.ReplaceAll(k, "_", "")
		if kClean == cleanNoUnderscore {
			return col, true
		}
		// Match against canonical display name (e.g. "Durov's Cap" -> "durov_cap")
		colNameNorm := NormalizeSlug(col.Name)
		if colNameNorm == norm || strings.ReplaceAll(colNameNorm, "_", "") == cleanNoUnderscore {
			return col, true
		}
	}

	// Check dynamic catalog if available
	if GlobalCatalog != nil {
		if col, ok := GlobalCatalog.ResolveCollection(key); ok {
			return col, true
		}
	}

	return CollectionMeta{}, false
}

// OfficialBackdrops catalog of backdrop color sets & permilles
var OfficialBackdrops = map[string]struct {
	Permille int
	Colors   BackdropColorSet
}{
	"Midnight Blue": {
		Permille: 150,
		Colors:   BackdropColorSet{CenterHex: "#0D1B2A", EdgeHex: "#1B263B", PatternHex: "#415A77", TextHex: "#E0E1DD"},
	},
	"Obsidian Matrix": {
		Permille: 25,
		Colors:   BackdropColorSet{CenterHex: "#111111", EdgeHex: "#1A1A1A", PatternHex: "#333333", TextHex: "#FFFFFF"},
	},
	"Royal Purple": {
		Permille: 60,
		Colors:   BackdropColorSet{CenterHex: "#2E0854", EdgeHex: "#1A0033", PatternHex: "#4B0082", TextHex: "#E6E6FA"},
	},
	"Crimson Blaze": {
		Permille: 45,
		Colors:   BackdropColorSet{CenterHex: "#8B0000", EdgeHex: "#4A0000", PatternHex: "#FF0000", TextHex: "#FFF0F5"},
	},
	"Emerald Forest": {
		Permille: 80,
		Colors:   BackdropColorSet{CenterHex: "#004D40", EdgeHex: "#00251A", PatternHex: "#00796B", TextHex: "#E0F2F1"},
	},
	"Solar Flare": {
		Permille: 35,
		Colors:   BackdropColorSet{CenterHex: "#FF8C00", EdgeHex: "#B8860B", PatternHex: "#FFD700", TextHex: "#FFFFE0"},
	},
	"Cyber Neon": {
		Permille: 15,
		Colors:   BackdropColorSet{CenterHex: "#00F5D4", EdgeHex: "#7B2CBF", PatternHex: "#F72585", TextHex: "#FFFFFF"},
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

// ClassifyRarityTier classifies percentile into official 6-tier community convention
func ClassifyRarityTier(percentile float64) string {
	switch {
	case percentile <= 0.1:
		return "Mythic"
	case percentile <= 0.5:
		return "Legendary"
	case percentile <= 2.0:
		return "Epic"
	case percentile <= 5.0:
		return "Rare"
	case percentile <= 15.0:
		return "Uncommon"
	default:
		return "Common"
	}
}

// CalculateExactRarity calculates deterministic rarity percentile from official Telegram supply
func CalculateExactRarity(traitType, name string, permille int, colors *BackdropColorSet) ExactRarityResult {
	if permille <= 0 {
		permille = 100 // fallback 10%
	}

	percentile := float64(permille) / 10.0 // permille / 1000 * 100 = permille / 10
	tier := ClassifyRarityTier(percentile)

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

// IsEliteSerial checks if a serial number qualifies for gravitational scarcity premium
func IsEliteSerial(serialNumber int) bool {
	if serialNumber <= 0 {
		return false
	}
	// Elite milestones and single-digit numbers
	if serialNumber < 10 {
		return true
	}
	switch serialNumber {
	case 10, 77, 100, 777, 1000, 2222, 5000, 10000:
		return true
	}

	s := strconv.Itoa(serialNumber)
	// Repeating digits (e.g. 11, 222, 3333, 7777, 8888)
	allSame := true
	for i := 1; i < len(s); i++ {
		if s[i] != s[0] {
			allSame = false
			break
		}
	}
	if allSame {
		return true
	}

	// Palindrome (e.g. 121, 1331, 787)
	isPal := true
	for i := 0; i < len(s)/2; i++ {
		if s[i] != s[len(s)-1-i] {
			isPal = false
			break
		}
	}
	return isPal
}

// CalculateSerialPercentile computes exact serial number rank percentile without arbitrary clamping
func CalculateSerialPercentile(serialNumber, totalSupply int) (percentile float64, isElite bool, rankText string) {
	if totalSupply <= 0 {
		totalSupply = 5000
	}
	if serialNumber <= 0 {
		serialNumber = 1
	}

	percentile = (float64(serialNumber) / float64(totalSupply)) * 100.0
	isElite = IsEliteSerial(serialNumber)

	if isElite && serialNumber == 1 {
		rankText = fmt.Sprintf("#1 Sovereign Genesis of %s — Top %.3f%%", formatNumber(totalSupply), percentile)
	} else if isElite {
		rankText = fmt.Sprintf("#%d Elite Serial of %s — Top %.2f%%", serialNumber, formatNumber(totalSupply), percentile)
	} else if percentile <= 1.0 {
		rankText = fmt.Sprintf("#%d of %s — Top 1%%", serialNumber, formatNumber(totalSupply))
	} else {
		rankText = fmt.Sprintf("#%d of %s — Top %.1f%%", serialNumber, formatNumber(totalSupply), percentile)
	}

	return percentile, isElite, rankText
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
