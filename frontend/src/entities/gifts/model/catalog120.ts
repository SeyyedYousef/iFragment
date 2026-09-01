// Official Telegram 120 Gifts Catalog with real primary models, emojis & CDN artwork
export interface OfficialGiftItem {
	id: string;
	name: string;
	slug: string;
	tag: 'Bluechip' | 'Luxury' | 'Seasonal' | 'Talisman' | 'Classic' | 'Special' | 'Tech';
	supply?: number;
	floorTon?: number;
	primaryModel: string;
	emoji: string;
}

export const OFFICIAL_GIFTS_120: OfficialGiftItem[] = [
  {
    "id": "1",
    "name": "Santa Hat",
    "slug": "santa-hat",
    "tag": "Bluechip",
    "primaryModel": "Jingle Volts",
    "supply": 10000,
    "emoji": "\ud83c\udf85"
  },
  {
    "id": "2",
    "name": "Signet Ring",
    "slug": "signet-ring",
    "tag": "Bluechip",
    "primaryModel": "Skibidi",
    "supply": 10000,
    "emoji": "\ud83d\udc8d"
  },
  {
    "id": "3",
    "name": "Precious Peach",
    "slug": "precious-peach",
    "tag": "Bluechip",
    "primaryModel": "Spanked",
    "supply": 10000,
    "emoji": "\ud83c\udf51"
  },
  {
    "id": "4",
    "name": "Plush Pepe",
    "slug": "plush-pepe",
    "tag": "Bluechip",
    "primaryModel": "Ninja Mike",
    "supply": 10000,
    "emoji": "\ud83d\udc38"
  },
  {
    "id": "5",
    "name": "Spiced Wine",
    "slug": "spiced-wine",
    "tag": "Classic",
    "primaryModel": "Moon Rocks",
    "supply": 10000,
    "emoji": "\ud83c\udf77"
  },
  {
    "id": "6",
    "name": "Jelly Bunny",
    "slug": "jelly-bunny",
    "tag": "Classic",
    "primaryModel": "Sticky Red",
    "supply": 10000,
    "emoji": "\ud83d\udc30"
  },
  {
    "id": "7",
    "name": "Durov's Cap",
    "slug": "durovs-cap",
    "tag": "Bluechip",
    "primaryModel": "Asterix",
    "supply": 10000,
    "emoji": "\ud83e\udde2"
  },
  {
    "id": "8",
    "name": "Perfume Bottle",
    "slug": "perfume-bottle",
    "tag": "Luxury",
    "primaryModel": "Blizzard",
    "supply": 10000,
    "emoji": "\ud83e\uddf4"
  },
  {
    "id": "9",
    "name": "Eternal Rose",
    "slug": "eternal-rose",
    "tag": "Special",
    "primaryModel": "Quantum",
    "supply": 10000,
    "emoji": "\ud83c\udf39"
  },
  {
    "id": "10",
    "name": "Berry Box",
    "slug": "berry-box",
    "tag": "Classic",
    "primaryModel": "Sweet Kiss",
    "supply": 10000,
    "emoji": "\ud83e\uded0"
  },
  {
    "id": "11",
    "name": "Vintage Cigar",
    "slug": "vintage-cigar",
    "tag": "Classic",
    "primaryModel": "Spectral Smoke",
    "supply": 10000,
    "emoji": "\ud83d\udeac"
  },
  {
    "id": "12",
    "name": "Magic Potion",
    "slug": "magic-potion",
    "tag": "Talisman",
    "primaryModel": "Deep Freeze",
    "supply": 10000,
    "emoji": "\ud83e\uddea"
  },
  {
    "id": "13",
    "name": "Kissed Frog",
    "slug": "kissed-frog",
    "tag": "Classic",
    "primaryModel": "Tree Frog",
    "supply": 10000,
    "emoji": "\ud83d\udc38"
  },
  {
    "id": "14",
    "name": "Hex Pot",
    "slug": "hex-pot",
    "tag": "Talisman",
    "primaryModel": "Amortentia",
    "supply": 10000,
    "emoji": "\ud83e\uded5"
  },
  {
    "id": "15",
    "name": "Evil Eye",
    "slug": "evil-eye",
    "tag": "Talisman",
    "primaryModel": "Tesla Coil",
    "supply": 10000,
    "emoji": "\ud83e\uddff"
  },
  {
    "id": "16",
    "name": "Sharp Tongue",
    "slug": "sharp-tongue",
    "tag": "Special",
    "primaryModel": "Secret Look",
    "supply": 10000,
    "emoji": "\ud83d\udc45"
  },
  {
    "id": "17",
    "name": "Trapped Heart",
    "slug": "trapped-heart",
    "tag": "Special",
    "primaryModel": "Jinx",
    "supply": 10000,
    "emoji": "\ud83d\udc96"
  },
  {
    "id": "18",
    "name": "Skull Flower",
    "slug": "skull-flower",
    "tag": "Special",
    "primaryModel": "Black Cat",
    "supply": 10000,
    "emoji": "\ud83d\udc80"
  },
  {
    "id": "19",
    "name": "Scared Cat",
    "slug": "scared-cat",
    "tag": "Special",
    "primaryModel": "Bubblegum",
    "supply": 10000,
    "emoji": "\ud83d\ude40"
  },
  {
    "id": "20",
    "name": "Spy Agaric",
    "slug": "spy-agaric",
    "tag": "Special",
    "primaryModel": "Nosferatu",
    "supply": 10000,
    "emoji": "\ud83c\udf44"
  },
  {
    "id": "21",
    "name": "Homemade Cake",
    "slug": "homemade-cake",
    "tag": "Special",
    "primaryModel": "Candy Cane",
    "supply": 10000,
    "emoji": "\ud83c\udf82"
  },
  {
    "id": "22",
    "name": "Genie Lamp",
    "slug": "genie-lamp",
    "tag": "Talisman",
    "primaryModel": "Aladdin",
    "supply": 10000,
    "emoji": "\ud83e\ude94"
  },
  {
    "id": "23",
    "name": "Lunar Snake",
    "slug": "lunar-snake",
    "tag": "Special",
    "primaryModel": "Hot Cherry",
    "supply": 10000,
    "emoji": "\ud83d\udc0d"
  },
  {
    "id": "24",
    "name": "Party Sparkler",
    "slug": "party-sparkler",
    "tag": "Special",
    "primaryModel": "Power Line",
    "supply": 10000,
    "emoji": "\ud83c\udf87"
  },
  {
    "id": "25",
    "name": "Jester Hat",
    "slug": "jester-hat",
    "tag": "Special",
    "primaryModel": "Hellscape",
    "supply": 10000,
    "emoji": "\ud83c\udccf"
  },
  {
    "id": "26",
    "name": "Witch Hat",
    "slug": "witch-hat",
    "tag": "Special",
    "primaryModel": "Bat Swarm",
    "supply": 10000,
    "emoji": "\ud83e\uddd9"
  },
  {
    "id": "27",
    "name": "Hanging Star",
    "slug": "hanging-star",
    "tag": "Special",
    "primaryModel": "Shamrock",
    "supply": 10000,
    "emoji": "\u2b50"
  },
  {
    "id": "28",
    "name": "Love Candle",
    "slug": "love-candle",
    "tag": "Special",
    "primaryModel": "Love Bubbles",
    "supply": 10000,
    "emoji": "\ud83d\udd6f\ufe0f"
  },
  {
    "id": "29",
    "name": "Cookie Heart",
    "slug": "cookie-heart",
    "tag": "Special",
    "primaryModel": "Yamete Kudasai",
    "supply": 10000,
    "emoji": "\ud83c\udf6a"
  },
  {
    "id": "30",
    "name": "Desk Calendar",
    "slug": "desk-calendar",
    "tag": "Special",
    "primaryModel": "\u00d3\u00f0insdagr",
    "supply": 10000,
    "emoji": "\ud83d\udcc5"
  },
  {
    "id": "31",
    "name": "Jingle Bells",
    "slug": "jingle-bells",
    "tag": "Seasonal",
    "primaryModel": "Hot Cherry",
    "supply": 10000,
    "emoji": "\ud83d\udd14"
  },
  {
    "id": "32",
    "name": "Snow Mittens",
    "slug": "snow-mittens",
    "tag": "Special",
    "primaryModel": "Diamond Hands",
    "supply": 10000,
    "emoji": "\ud83e\udde4"
  },
  {
    "id": "33",
    "name": "Voodoo Doll",
    "slug": "voodoo-doll",
    "tag": "Talisman",
    "primaryModel": "Scribble Stab",
    "supply": 10000,
    "emoji": "\ud83e\ude86"
  },
  {
    "id": "34",
    "name": "Mad Pumpkin",
    "slug": "mad-pumpkin",
    "tag": "Special",
    "primaryModel": "Dark Dipsy",
    "supply": 10000,
    "emoji": "\ud83c\udf83"
  },
  {
    "id": "35",
    "name": "Hypno Lollipop",
    "slug": "hypno-lollipop",
    "tag": "Special",
    "primaryModel": "Reward",
    "supply": 10000,
    "emoji": "\ud83c\udf6d"
  },
  {
    "id": "36",
    "name": "B-Day Candle",
    "slug": "b-day-candle",
    "tag": "Special",
    "primaryModel": "On Fire",
    "supply": 10000,
    "emoji": "\ud83d\udd6f\ufe0f"
  },
  {
    "id": "37",
    "name": "Bunny Muffin",
    "slug": "bunny-muffin",
    "tag": "Special",
    "primaryModel": "Gold",
    "supply": 10000,
    "emoji": "\ud83e\uddc1"
  },
  {
    "id": "38",
    "name": "Astral Shard",
    "slug": "astral-shard",
    "tag": "Talisman",
    "primaryModel": "Elven Might",
    "supply": 10000,
    "emoji": "\ud83d\udc8e"
  },
  {
    "id": "39",
    "name": "Flying Broom",
    "slug": "flying-broom",
    "tag": "Special",
    "primaryModel": "Gryffindor",
    "supply": 10000,
    "emoji": "\ud83e\uddf9"
  },
  {
    "id": "40",
    "name": "Crystal Ball",
    "slug": "crystal-ball",
    "tag": "Talisman",
    "primaryModel": "The Seeker",
    "supply": 10000,
    "emoji": "\ud83d\udd2e"
  },
  {
    "id": "41",
    "name": "Eternal Candle",
    "slug": "eternal-candle",
    "tag": "Special",
    "primaryModel": "Cherry Burn",
    "supply": 10000,
    "emoji": "\ud83d\udd6f\ufe0f"
  },
  {
    "id": "42",
    "name": "Swiss Watch",
    "slug": "swiss-watch",
    "tag": "Luxury",
    "primaryModel": "Dr. Strange",
    "supply": 10000,
    "emoji": "\u231a"
  },
  {
    "id": "43",
    "name": "Ginger Cookie",
    "slug": "ginger-cookie",
    "tag": "Special",
    "primaryModel": "Universe",
    "supply": 10000,
    "emoji": "\ud83c\udf6a"
  },
  {
    "id": "44",
    "name": "Mini Oscar",
    "slug": "mini-oscar",
    "tag": "Luxury",
    "primaryModel": "Boulevard",
    "supply": 10000,
    "emoji": "\ud83c\udfc6"
  },
  {
    "id": "45",
    "name": "Lol Pop",
    "slug": "lol-pop",
    "tag": "Special",
    "primaryModel": "Celestia",
    "supply": 10000,
    "emoji": "\ud83c\udf6d"
  },
  {
    "id": "46",
    "name": "Ion Gem",
    "slug": "ion-gem",
    "tag": "Special",
    "primaryModel": "Elements",
    "supply": 10000,
    "emoji": "\ud83d\udc8e"
  },
  {
    "id": "47",
    "name": "Star Notepad",
    "slug": "star-notepad",
    "tag": "Special",
    "primaryModel": "Clown",
    "supply": 10000,
    "emoji": "\ud83d\udcdd"
  },
  {
    "id": "48",
    "name": "Loot Bag",
    "slug": "loot-bag",
    "tag": "Special",
    "primaryModel": "Lust Beat",
    "supply": 10000,
    "emoji": "\ud83c\udf92"
  },
  {
    "id": "49",
    "name": "Love Potion",
    "slug": "love-potion",
    "tag": "Special",
    "primaryModel": "Espresso",
    "supply": 10000,
    "emoji": "\ud83e\uddea"
  },
  {
    "id": "50",
    "name": "Toy Bear",
    "slug": "toy-bear",
    "tag": "Special",
    "primaryModel": "Golden Cub",
    "supply": 10000,
    "emoji": "\ud83e\uddf8"
  },
  {
    "id": "51",
    "name": "Diamond Ring",
    "slug": "diamond-ring",
    "tag": "Bluechip",
    "primaryModel": "Graffiti",
    "supply": 10000,
    "emoji": "\ud83d\udc8d"
  },
  {
    "id": "52",
    "name": "Sakura Flower",
    "slug": "sakura-flower",
    "tag": "Special",
    "primaryModel": "Flowey",
    "supply": 10000,
    "emoji": "\ud83c\udf38"
  },
  {
    "id": "53",
    "name": "Sleigh Bell",
    "slug": "sleigh-bell",
    "tag": "Special",
    "primaryModel": "Darth Vader",
    "supply": 10000,
    "emoji": "\ud83d\udd14"
  },
  {
    "id": "54",
    "name": "Top Hat",
    "slug": "top-hat",
    "tag": "Special",
    "primaryModel": "Pixel Perfect",
    "supply": 10000,
    "emoji": "\ud83c\udfa9"
  },
  {
    "id": "55",
    "name": "Record Player",
    "slug": "record-player",
    "tag": "Special",
    "primaryModel": "Broken Record",
    "supply": 10000,
    "emoji": "\ud83d\udcfb"
  },
  {
    "id": "56",
    "name": "Winter Wreath",
    "slug": "winter-wreath",
    "tag": "Seasonal",
    "primaryModel": "Telegram",
    "supply": 10000,
    "emoji": "\ud83c\udf84"
  },
  {
    "id": "57",
    "name": "Snow Globe",
    "slug": "snow-globe",
    "tag": "Seasonal",
    "primaryModel": "Musk",
    "supply": 10000,
    "emoji": "\ud83d\udd2e"
  },
  {
    "id": "58",
    "name": "Electric Skull",
    "slug": "electric-skull",
    "tag": "Special",
    "primaryModel": "Nightmare",
    "supply": 10000,
    "emoji": "\u26a1"
  },
  {
    "id": "59",
    "name": "Tama Gadget",
    "slug": "tama-gadget",
    "tag": "Tech",
    "primaryModel": "Diamond Ton",
    "supply": 10000,
    "emoji": "\ud83d\udc7e"
  },
  {
    "id": "60",
    "name": "Candy Cane",
    "slug": "candy-cane",
    "tag": "Seasonal",
    "primaryModel": "Hex Pot",
    "supply": 10000,
    "emoji": "\ud83e\uddaf"
  },
  {
    "id": "61",
    "name": "Neko Helmet",
    "slug": "neko-helmet",
    "tag": "Special",
    "primaryModel": "White Rabbit",
    "supply": 10000,
    "emoji": "\ud83d\udc31"
  },
  {
    "id": "62",
    "name": "Jack-in-the-Box",
    "slug": "jack-in-the-box",
    "tag": "Special",
    "primaryModel": "Haunted House",
    "supply": 10000,
    "emoji": "\ud83c\udf81"
  },
  {
    "id": "63",
    "name": "Easter Egg",
    "slug": "easter-egg",
    "tag": "Seasonal",
    "primaryModel": "Baby Turtle",
    "supply": 10000,
    "emoji": "\ud83e\udd5a"
  },
  {
    "id": "64",
    "name": "Bonded Ring",
    "slug": "bonded-ring",
    "tag": "Special",
    "primaryModel": "Ring of Roots",
    "supply": 10000,
    "emoji": "\ud83d\udc8d"
  },
  {
    "id": "65",
    "name": "Pet Snake",
    "slug": "pet-snake",
    "tag": "Special",
    "primaryModel": "Portal",
    "supply": 10000,
    "emoji": "\ud83d\udc0d"
  },
  {
    "id": "66",
    "name": "Snake Box",
    "slug": "snake-box",
    "tag": "Special",
    "primaryModel": "1",
    "supply": 10000,
    "emoji": "\ud83d\udce6"
  },
  {
    "id": "67",
    "name": "Xmas Stocking",
    "slug": "xmas-stocking",
    "tag": "Seasonal",
    "primaryModel": "1",
    "supply": 10000,
    "emoji": "\ud83e\udde6"
  },
  {
    "id": "68",
    "name": "Big Year",
    "slug": "big-year",
    "tag": "Special",
    "primaryModel": "Creator",
    "supply": 10000,
    "emoji": "\ud83c\udf86"
  },
  {
    "id": "69",
    "name": "Holiday Drink",
    "slug": "holiday-drink",
    "tag": "Special",
    "primaryModel": "Gold Dust",
    "supply": 10000,
    "emoji": "\ud83c\udf79"
  },
  {
    "id": "70",
    "name": "Gem Signet",
    "slug": "gem-signet",
    "tag": "Special",
    "primaryModel": "Spinny Boi",
    "supply": 10000,
    "emoji": "\ud83d\udc8d"
  },
  {
    "id": "71",
    "name": "Light Sword",
    "slug": "light-sword",
    "tag": "Special",
    "primaryModel": "Wrath of Vader",
    "supply": 10000,
    "emoji": "\u2694\ufe0f"
  },
  {
    "id": "72",
    "name": "Restless Jar",
    "slug": "restless-jar",
    "tag": "Special",
    "primaryModel": "Gift Holder",
    "supply": 10000,
    "emoji": "\ud83c\udffa"
  },
  {
    "id": "73",
    "name": "Nail Bracelet",
    "slug": "nail-bracelet",
    "tag": "Luxury",
    "primaryModel": "Diamond",
    "supply": 10000,
    "emoji": "\ud83d\udcff"
  },
  {
    "id": "74",
    "name": "Heroic Helmet",
    "slug": "heroic-helmet",
    "tag": "Special",
    "primaryModel": "Dynamo",
    "supply": 10000,
    "emoji": "\ud83e\ude96"
  },
  {
    "id": "75",
    "name": "Bow Tie",
    "slug": "bow-tie",
    "tag": "Special",
    "primaryModel": "Velvet Gold",
    "supply": 10000,
    "emoji": "\ud83c\udf80"
  },
  {
    "id": "76",
    "name": "Heart Locket",
    "slug": "heart-locket",
    "tag": "Special",
    "primaryModel": "Tuxedo Mask",
    "supply": 10000,
    "emoji": "\ud83d\udc96"
  },
  {
    "id": "77",
    "name": "Lush Bouquet",
    "slug": "lush-bouquet",
    "tag": "Special",
    "primaryModel": "Million Roses",
    "supply": 10000,
    "emoji": "\ud83d\udc90"
  },
  {
    "id": "78",
    "name": "Whip Cupcake",
    "slug": "whip-cupcake",
    "tag": "Special",
    "primaryModel": "Deep State",
    "supply": 10000,
    "emoji": "\ud83e\uddc1"
  },
  {
    "id": "79",
    "name": "Joyful Bundle",
    "slug": "joyful-bundle",
    "tag": "Special",
    "primaryModel": "Pure Gold",
    "supply": 10000,
    "emoji": "\ud83c\udf81"
  },
  {
    "id": "80",
    "name": "Cupid Charm",
    "slug": "cupid-charm",
    "tag": "Special",
    "primaryModel": "Moon Prism",
    "supply": 10000,
    "emoji": "\ud83d\udc98"
  },
  {
    "id": "81",
    "name": "Valentine Box",
    "slug": "valentine-box",
    "tag": "Special",
    "primaryModel": "Toncoin",
    "supply": 10000,
    "emoji": "\ud83d\udc9d"
  },
  {
    "id": "82",
    "name": "Snoop Dogg",
    "slug": "snoop-dogg",
    "tag": "Special",
    "primaryModel": "Goldizzle",
    "supply": 10000,
    "emoji": "\ud83d\udc36"
  },
  {
    "id": "83",
    "name": "Swag Bag",
    "slug": "swag-bag",
    "tag": "Special",
    "primaryModel": "Snoop Life",
    "supply": 10000,
    "emoji": "\ud83d\udc5c"
  },
  {
    "id": "84",
    "name": "Snoop Cigar",
    "slug": "snoop-cigar",
    "tag": "Special",
    "primaryModel": "Cartoon Roll",
    "supply": 10000,
    "emoji": "\ud83d\udeac"
  },
  {
    "id": "85",
    "name": "Low Rider",
    "slug": "low-rider",
    "tag": "Special",
    "primaryModel": "DeLorean",
    "supply": 10000,
    "emoji": "\ud83d\ude97"
  },
  {
    "id": "86",
    "name": "Westside Sign",
    "slug": "westside-sign",
    "tag": "Special",
    "primaryModel": "Champion",
    "supply": 10000,
    "emoji": "\ud83e\udd19"
  },
  {
    "id": "87",
    "name": "Stellar Rocket",
    "slug": "stellar-rocket",
    "tag": "Tech",
    "primaryModel": "Mission Uranus",
    "supply": 10000,
    "emoji": "\ud83d\ude80"
  },
  {
    "id": "88",
    "name": "Jolly Chimp",
    "slug": "jolly-chimp",
    "tag": "Special",
    "primaryModel": "Smash King",
    "supply": 10000,
    "emoji": "\ud83d\udc35"
  },
  {
    "id": "89",
    "name": "Moon Pendant",
    "slug": "moon-pendant",
    "tag": "Special",
    "primaryModel": "Princess",
    "supply": 10000,
    "emoji": "\ud83c\udf19"
  },
  {
    "id": "90",
    "name": "Ionic Dryer",
    "slug": "ionic-dryer",
    "tag": "Tech",
    "primaryModel": "Simpsonic",
    "supply": 10000,
    "emoji": "\ud83d\udca8"
  },
  {
    "id": "91",
    "name": "Input Key",
    "slug": "input-key",
    "tag": "Tech",
    "primaryModel": "Quad Damage",
    "supply": 10000,
    "emoji": "\u2328\ufe0f"
  },
  {
    "id": "92",
    "name": "Mighty Arm",
    "slug": "mighty-arm",
    "tag": "Special",
    "primaryModel": "Best Muscles",
    "supply": 10000,
    "emoji": "\ud83d\udcaa"
  },
  {
    "id": "93",
    "name": "Artisan Brick",
    "slug": "artisan-brick",
    "tag": "Special",
    "primaryModel": "Gold Block",
    "supply": 10000,
    "emoji": "\ud83e\uddf1"
  },
  {
    "id": "94",
    "name": "Clover Pin",
    "slug": "clover-pin",
    "tag": "Special",
    "primaryModel": "Kelly Green",
    "supply": 10000,
    "emoji": "\ud83c\udf40"
  },
  {
    "id": "95",
    "name": "Sky Stilettos",
    "slug": "sky-stilettos",
    "tag": "Special",
    "primaryModel": "Spidergirl",
    "supply": 10000,
    "emoji": "\ud83d\udc60"
  },
  {
    "id": "96",
    "name": "Fresh Socks",
    "slug": "fresh-socks",
    "tag": "Special",
    "primaryModel": "Billie Jean",
    "supply": 10000,
    "emoji": "\ud83e\udde6"
  },
  {
    "id": "97",
    "name": "Happy Brownie",
    "slug": "happy-brownie",
    "tag": "Special",
    "primaryModel": "Kinky Stinky",
    "supply": 10000,
    "emoji": "\ud83c\udf6b"
  },
  {
    "id": "98",
    "name": "Ice Cream",
    "slug": "ice-cream",
    "tag": "Special",
    "primaryModel": "Cryo Pepe",
    "supply": 10000,
    "emoji": "\ud83c\udf66"
  },
  {
    "id": "99",
    "name": "Spring Basket",
    "slug": "spring-basket",
    "tag": "Special",
    "primaryModel": "Meme God",
    "supply": 10000,
    "emoji": "\ud83e\uddfa"
  },
  {
    "id": "100",
    "name": "Instant Ramen",
    "slug": "instant-ramen",
    "tag": "Special",
    "primaryModel": "Kraken",
    "supply": 10000,
    "emoji": "\ud83c\udf5c"
  },
  {
    "id": "101",
    "name": "Faith Amulet",
    "slug": "faith-amulet",
    "tag": "Talisman",
    "primaryModel": "Golden Lace",
    "supply": 10000,
    "emoji": "\ud83e\uddff"
  },
  {
    "id": "102",
    "name": "Mousse Cake",
    "slug": "mousse-cake",
    "tag": "Special",
    "primaryModel": "Still Alive",
    "supply": 10000,
    "emoji": "\ud83c\udf70"
  },
  {
    "id": "103",
    "name": "Bling Binky",
    "slug": "bling-binky",
    "tag": "Special",
    "primaryModel": "Red Lipstick",
    "supply": 10000,
    "emoji": "\ud83c\udf7c"
  },
  {
    "id": "104",
    "name": "Money Pot",
    "slug": "money-pot",
    "tag": "Special",
    "primaryModel": "Skibidi Toilet",
    "supply": 10000,
    "emoji": "\ud83c\udf6f"
  },
  {
    "id": "105",
    "name": "Pretty Posy",
    "slug": "pretty-posy",
    "tag": "Special",
    "primaryModel": "Roadworks",
    "supply": 10000,
    "emoji": "\ud83d\udc90"
  },
  {
    "id": "106",
    "name": "Khabib's Papakha",
    "slug": "khabibs-papakha",
    "tag": "Special",
    "primaryModel": "Legendary Item",
    "supply": 10000,
    "emoji": "\ud83e\udd4a"
  },
  {
    "id": "107",
    "name": "UFC Strike",
    "slug": "ufc-strike",
    "tag": "Special",
    "primaryModel": "Gold Topuria",
    "supply": 10000,
    "emoji": "\ud83e\udd4b"
  },
  {
    "id": "108",
    "name": "Victory Medal",
    "slug": "victory-medal",
    "tag": "Special",
    "primaryModel": "First Finisher",
    "supply": 10000,
    "emoji": "\ud83e\udd47"
  },
  {
    "id": "109",
    "name": "Rare Bird",
    "slug": "rare-bird",
    "tag": "Special",
    "primaryModel": "Zombie Rider",
    "supply": 10000,
    "emoji": "\ud83e\udd85"
  },
  {
    "id": "110",
    "name": "Mood Pack",
    "slug": "mood-pack",
    "tag": "Special",
    "primaryModel": "Proton Pack",
    "supply": 10000,
    "emoji": "\ud83c\udfad"
  },
  {
    "id": "111",
    "name": "Pool Float",
    "slug": "pool-float",
    "tag": "Special",
    "primaryModel": "Luxury Yacht",
    "supply": 10000,
    "emoji": "\ud83d\udedf"
  },
  {
    "id": "112",
    "name": "Timeless Book",
    "slug": "timeless-book",
    "tag": "Special",
    "primaryModel": "Death Note",
    "supply": 10000,
    "emoji": "\ud83d\udcd6"
  },
  {
    "id": "113",
    "name": "Chill Flame",
    "slug": "chill-flame",
    "tag": "Special",
    "primaryModel": "Satis-fire",
    "supply": 10000,
    "emoji": "\ud83d\udd25"
  },
  {
    "id": "114",
    "name": "Vice Cream",
    "slug": "vice-cream",
    "tag": "Special",
    "primaryModel": "Tralashark",
    "supply": 10000,
    "emoji": "\ud83c\udf68"
  },
  {
    "id": "115",
    "name": "Surge Board",
    "slug": "surge-board",
    "tag": "Special",
    "primaryModel": "Duke",
    "supply": 10000,
    "emoji": "\ud83c\udfc4"
  },
  {
    "id": "116",
    "name": "Liberty Figure",
    "slug": "liberty-figure",
    "tag": "Luxury",
    "primaryModel": "Marilyn",
    "supply": 10000,
    "emoji": "\ud83d\uddfd"
  },
  {
    "id": "117",
    "name": "Durov's Glasses",
    "slug": "durovs-glasses",
    "tag": "Special",
    "primaryModel": "Thug Life",
    "supply": 10000,
    "emoji": "\ud83d\udc53"
  },
  {
    "id": "118",
    "name": "Fine Pen",
    "slug": "fine-pen",
    "tag": "Luxury",
    "primaryModel": "Survivalist",
    "supply": 10000,
    "emoji": "\u2712\ufe0f"
  },
  {
    "id": "119",
    "name": "Intelligence Cup",
    "slug": "intelligence-cup",
    "tag": "Special",
    "primaryModel": "Gold",
    "supply": 10000,
    "emoji": "\ud83c\udfc6"
  },
  {
    "id": "120",
    "name": "Algorithm Cup",
    "slug": "algorithm-cup",
    "tag": "Special",
    "primaryModel": "Gold",
    "supply": 10000,
    "emoji": "\ud83c\udfc6"
  }
];
