export const TRENDING_USERNAMES = [
	"danbao", "news", "auto", "bank", "avia", "chat", "king", "fifa", "devil", "game", "sber", "meta", 
	"casino", "hotels", "doge", "pizza", "nike", "dubai", "gram", "play", "xinqun", "alfa", "coin", 
	"cash", "rich", "checkout", "amazon", "ecom", "defi", "adidas", "cryptoholder", "trade", "chief", 
	"trip", "web3", "fuck", "payment", "fund", "interior", "delivery", "meet", "secret", "love", 
	"connect", "adviser", "promo", "tiger", "baseball", "mancity", "usdt", "chef", "travels", 
	"forecast", "investor", "jpmorgan", "prestige", "fans", "insane", "potus", "esport", "balance", 
	"insurance", "neobank", "dapp", "join", "land", "elite", "crypto", "events", "gold", "lord", 
	"server", "mail", "visa", "plate", "cars", "chart", "sale", "swap", "bars", "msnbc", "start", 
	"scores", "union", "aero", "payme", "football", "poker", "usdc", "home", "checkup", "trauma", 
	"alphabet", "listing", "hack", "bets", "gbots", "paybox", "name", "putin", "rare", "chatgpt",

	// Animals & Nature (4+ letters)
	"lion", "bear", "wolf", "eagle", "shark", "hawk", "dragon", "snake", "panda", "koala",
	"bird", "fish", "whale", "bull", "monkey", "horse", "tiger", "zebra", "panther", "falcon",
	"tree", "wood", "rock", "stone", "jewel", "silver", "bronze", "iron", "steel", "diamond",
	"moon", "star", "earth", "mars", "fire", "snow", "rain", "wind", "storm", "ocean", "river",

	// Finance & Crypto (4+ letters)
	"finance", "money", "wealth", "wallet", "ledger", "capital", "equity", "forex", "broker", 
	"profit", "margin", "fiat", "token", "bitcoin", "ethereum", "solana", "tether", "binance",
	"matic", "avax", "link", "aave", "maker", "yield", "farm", "stake", "mint", "chain",
	"airdrop", "hodl", "pump", "dump", "bullish", "bearish", "long", "short", "margin", "leverage",
	"trading", "exchange", "market", "stock", "bond", "option", "future", "swap", "pool", "liquidity",

	// Tech & Internet (4+ letters)
	"tech", "code", "cloud", "data", "cyber", "linux", "host", "ping", "admin", "root", "sudo", 
	"repo", "node", "react", "java", "rust", "python", "ruby", "sass", "html", "json", "yaml", 
	"toml", "bash", "shell", "script", "byte", "pixel", "vector", "raster", "font", "type", 
	"design", "logo", "brand", "server", "domain", "hosting", "network", "router", "switch",

	// Gaming & Entertainment (4+ letters)
	"xbox", "sony", "steam", "epic", "loot", "mage", "heal", "tank", "guild", "raid", "clan", 
	"noob", "esports", "twitch", "stream", "live", "video", "clip", "music", "song", "film", 
	"movie", "cinema", "actor", "star", "idol", "hero", "villain", "boss", "level", "gold", 
	"mana", "stat", "buff", "nerf", "quest", "magic", "sword", "shield", "armor", "weapon",

	// Global & Places (4+ letters)
	"qatar", "tokyo", "paris", "london", "moscow", "berlin", "rome", "miami", "vegas", "texas", 
	"cali", "asia", "europe", "africa", "latam", "mena", "world", "globe", "earth", "planet", 
	"city", "town", "village", "street", "road", "avenue", "spain", "italy", "china", "japan",

	// Action & Descriptor (4+ letters)
	"fast", "slow", "cold", "small", "good", "nice", "cool", "best", "ultra", "super", 
	"mega", "epic", "real", "fake", "true", "false", "high", "deep", "dark", "light",
	"bright", "clear", "blur", "sharp", "soft", "hard", "easy", "free", "paid", "premium",

	// Names & Titles (4+ letters)
	"john", "jane", "alex", "alice", "mallory", "sybil", "admin", "user", "guest", "member", 
	"staff", "owner", "boss", "leader", "chief", "manager", "director", "founder", "creator",

	// Brands & Concepts (4+ letters)
	"apple", "google", "tesla", "ford", "audi", "benz", "lambo", "ferrari", "porsche", "gucci", 
	"prada", "dior", "chanel", "hermes", "rolex", "omega", "casio", "seiko", "coke", "pepsi", 
	"redbull", "monster", "water", "juice", "milk", "coffee", "beer", "wine", "drink", "food",

	// Miscellaneous highly requested (4+ letters)
	"shop", "store", "mall", "market", "bazaar", "deal", "offer", "discount", "coupon", "code",
	"work", "career", "hire", "resume", "portfolio", "project", "task", "goal", "idea", "plan", 
	"strategy", "vision", "mission", "core", "base", "root", "seed", "leaf", "growth", "scale",
	"build", "create", "launch", "founder", "startup", "venture", "fund", "capital", "angel"
];

// Helper to get exactly N random elements from the list
export function getRandomTrending(count: number = 4): string[] {
	const shuffled = [...TRENDING_USERNAMES].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, count);
}
