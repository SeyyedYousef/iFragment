package registry

// Collection Constants
const (
	AnonymousNumbersCollectionAddr = "EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N"
	TotalSupply                    = 136566
	RecordATHSaleTON               = 1500000.0 // Dynamic 2026 ATH ceiling (accommodates top auctions exceeding 650K-864K TON)
	StandardInitialFloorTON        = 2450.0    // 2026 live secondary market floor for standard 8-digit numbers (~2,400-2,500 TON)
	GenesisInitialFloorTON         = 42000.0   // 2026 live secondary market floor for 4-digit Genesis numbers (+888 8000..8999, 1,000 total supply)
	InitialFloorTON                = 2450.0    // Standard baseline floor (2026 market)
	FragmentFeePercent             = 0.05
)

// Official 19 NFT Colors in Telegram Anonymous Numbers
type ColorInfo struct {
	Name        string  `json:"name"`
	Hex         string  `json:"hex"`
	Multiplier  float64 `json:"multiplier"` // Hedonic color premium estimate
	Description string  `json:"description"`
}

var OfficialColors = map[string]ColorInfo{
	"Gold":      {Name: "Gold", Hex: "#FFD700", Multiplier: 1.45, Description: "Ultra-rare imperial gold tier"},
	"Pink":      {Name: "Pink", Hex: "#FF69B4", Multiplier: 1.35, Description: "High aesthetic premium tier"},
	"Black":     {Name: "Black", Hex: "#1A1A1A", Multiplier: 1.25, Description: "Sleek obsidian premium"},
	"Green":     {Name: "Green", Hex: "#2ECC71", Multiplier: 1.15, Description: "Vibrant emerald tier"},
	"Rose":      {Name: "Rose", Hex: "#FF007F", Multiplier: 1.15, Description: "Vivid magenta rose tier"},
	"Purple":    {Name: "Purple", Hex: "#9B59B6", Multiplier: 1.12, Description: "Royal amethyst tier"},
	"Red":       {Name: "Red", Hex: "#E74C3C", Multiplier: 1.10, Description: "Fiery crimson tier"},
	"Teal":      {Name: "Teal", Hex: "#008080", Multiplier: 1.08, Description: "Deep cyan-teal tier"},
	"Turquoise": {Name: "Turquoise", Hex: "#40E0D0", Multiplier: 1.08, Description: "Tropical turquoise tier"},
	"Mint":      {Name: "Mint", Hex: "#98FF98", Multiplier: 1.05, Description: "Fresh mint pastel tier"},
	"Sky":       {Name: "Sky", Hex: "#87CEEB", Multiplier: 1.05, Description: "Bright azure sky tier"},
	"Violet":    {Name: "Violet", Hex: "#8A2BE2", Multiplier: 1.03, Description: "Deep electric violet tier"},
	"Lavender":  {Name: "Lavender", Hex: "#E6E6FA", Multiplier: 1.02, Description: "Soft lavender floral tier"},
	"Blue":      {Name: "Blue", Hex: "#3498DB", Multiplier: 1.00, Description: "Standard Telegram blue"},
	"Blue Gray": {Name: "Blue Gray", Hex: "#6699CC", Multiplier: 0.98, Description: "Muted metallic slate blue"},
	"Orange":    {Name: "Orange", Hex: "#E67E22", Multiplier: 0.98, Description: "Warm amber orange"},
	"Olive":     {Name: "Olive", Hex: "#808000", Multiplier: 0.95, Description: "Earth tone olive drab"},
	"Tan":       {Name: "Tan", Hex: "#D2B48C", Multiplier: 0.95, Description: "Desert tan neutral"},
	"Brown":     {Name: "Brown", Hex: "#8B4513", Multiplier: 0.92, Description: "Warm sepia earth tier"},
	"Gray":      {Name: "Gray", Hex: "#95A5A6", Multiplier: 0.90, Description: "Base monochromatic gray tier"},
}

// GetColorMultiplier returns the empirical hedonic color multiplier
func GetColorMultiplier(colorName string) float64 {
	if c, exists := OfficialColors[colorName]; exists {
		return c.Multiplier
	}
	return 1.0
}

// Cultural Weights Matrix per Target Region
type CulturalMarketWeight struct {
	MarketName    string
	RegionKey     string
	FavoredDigits map[rune]float64
	PenalizedDigits map[rune]float64
	DescriptionEn string
	DescriptionFa string
}

var CulturalMarkets = []CulturalMarketWeight{
	{
		MarketName: "East Asia (China / HK / SG)",
		RegionKey:  "east_asia",
		FavoredDigits: map[rune]float64{
			'8': 2.0, // Fa (Wealth / Prosperity)
			'9': 1.5, // Jiu (Longevity / Eternity)
			'6': 1.0, // Liu (Smoothness / Success)
		},
		PenalizedDigits: map[rune]float64{
			'4': 2.5, // Si (Death penalty in Chinese culture)
		},
		DescriptionEn: "Heavy premium on digits 8, 9, 6 representing wealth and longevity; strong avoidance of digit 4.",
		DescriptionFa: "تقاضای بالا برای ارقام ۸ (ثروت)، ۹ (طول عمر) و ۶ (روانی امور) با جریمه سنگین برای رقم ۴.",
	},
	{
		MarketName: "Middle East & Gulf (GCC / IR)",
		RegionKey:  "middle_east",
		FavoredDigits: map[rune]float64{
			'7': 2.0, // Barakah / Sacred number
			'9': 1.5, // Completeness
			'1': 1.0, // Unity
		},
		PenalizedDigits: map[rune]float64{},
		DescriptionEn: "Preference for auspicious prime 7 (Barakah/Perfection), unity (1), and complete 9s.",
		DescriptionFa: "محبوبیت ارقام ۷ (برکت و کمال)، ۹ (تکامل) و ۱ (یکتایی) در میان خریداران خاورمیانه.",
	},
	{
		MarketName: "Global / Western Market",
		RegionKey:  "global",
		FavoredDigits: map[rune]float64{
			'7': 1.5, // Lucky 7
			'0': 1.2, // Clean round endings (00, 000)
			'8': 1.2, // Universal luxury symbol
		},
		PenalizedDigits: map[rune]float64{
			'3': 0.2, // Weak penalty if cluttered
		},
		DescriptionEn: "Prefers clean zero endings, lucky 7s, repeating block sequences and pure palindromes.",
		DescriptionFa: "تمرکز بر صفرهای پایانی رند، ارقام شانس جهانی (۷۷۷) و تقارن‌های ریاضی زیبا.",
	},
}
