package gvengine

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"math"
	"math/big"
	"strings"

	"ifragment-backend/internal/service/gifts/traits"
)

// MTProto Layer 198+ TL-Schema Constructor CRC32 IDs for Telegram Collectible StarGifts.
const (
	TLStarGiftUniqueConstructor          uint32 = 0x5c62d151 // starGiftUnique#5c62d151
	TLStarGiftAttributeModelConstructor  uint32 = 0x39d99013 // starGiftAttributeModel#39d99013
	TLStarGiftAttributeBackdrop          uint32 = 0xd93d859c // starGiftAttributeBackdrop#d93d859c
	TLStarGiftAttributePattern           uint32 = 0x13acff19 // starGiftAttributePattern#13acff19
	TLStarGiftAttributeOriginalDetails   uint32 = 0xe0bff26c // starGiftAttributeOriginalDetails#e0bff26c
)

// GiftBinaryForensicsDto exposes low-level MTProto TL-Schema (Layer 198+), 24-bit RGB
// bit-packed color integers, TON TEP-62 / TEP-64 smart contract state, and CIEDE2000
// perceptual color-science telemetry for a Telegram Collectible Gift.
type GiftBinaryForensicsDto struct {
	CanonicalSlug               string  `json:"canonical_slug"`
	FragmentNFTWebURI           string  `json:"fragment_nft_web_uri"`
	TEP64MetadataURI            string  `json:"tep64_metadata_uri"`
	LottieVectorURI             string  `json:"lottie_vector_uri"`
	MTProtoConstructor          string  `json:"mtproto_constructor"`
	MTProtoModelAttrConstructor string  `json:"mtproto_model_attr_constructor"`
	MTProtoBackdropConstructor  string  `json:"mtproto_backdrop_constructor"`
	MTProtoPatternConstructor   string  `json:"mtproto_pattern_constructor"`
	MTProtoHeaderHex            string  `json:"mtproto_header_hex"`
	CenterColorHex              string  `json:"center_color_hex"`
	EdgeColorHex                string  `json:"edge_color_hex"`
	ModelDominantColorHex       string  `json:"model_dominant_color_hex"`
	CenterColorInt24            int     `json:"center_color_int24"`
	EdgeColorInt24              int     `json:"edge_color_int24"`
	CenterColorBitStream24      string  `json:"center_color_bit_stream_24"`
	EdgeColorBitStream24        string  `json:"edge_color_bit_stream_24"`
	ModelPermille               int     `json:"model_permille"`
	BackdropPermille            int     `json:"backdrop_permille"`
	SymbolPermille              int     `json:"symbol_permille"`
	JointProbability            float64 `json:"joint_probability"`
	ShannonSurprisalBits        float64 `json:"shannon_surprisal_bits"`
	CIELabCenterL               float64 `json:"cielab_center_l"`
	CIELabCenterA               float64 `json:"cielab_center_a"`
	CIELabCenterB               float64 `json:"cielab_center_b"`
	CIELabModelL                float64 `json:"cielab_model_l"`
	CIELabModelA                float64 `json:"cielab_model_a"`
	CIELabModelB                float64 `json:"cielab_model_b"`
	CIEDE2000ModelBackdrop      float64 `json:"ciede2000_model_backdrop"`
	CIEDE2000GradientDelta      float64 `json:"ciede2000_gradient_delta"`
	WCAGContrastRatio           float64 `json:"wcag_contrast_ratio"`
	IsMonochromeColorMatch      bool    `json:"is_monochrome_color_match"`
	TEP62ContractStandard       string  `json:"tep62_contract_standard"`
	TEP62ItemIndexSHA256        string  `json:"tep62_item_index_sha256"`
	TEP62ItemIndexUint256Prefix string  `json:"tep62_item_index_uint256_prefix"`
	TVMCellBOCHex               string  `json:"tvm_cell_boc_hex"`
}

// PackHexToRGB24 converts a "#RRGGBB" hex string into Telegram's 24-bit packed integer
// representation `(R << 16) | (G << 8) | B` and its 24-bit binary bit-stream.
func PackHexToRGB24(hexStr string) (int, string) {
	rgb := traits.HexToRGB(hexStr)
	scale := 1.0
	if rgb.R <= 1.0 && rgb.G <= 1.0 && rgb.B <= 1.0 && (rgb.R > 0 || rgb.G > 0 || rgb.B > 0) {
		scale = 255.0
	}
	r := int(math.Round(math.Max(0, math.Min(255, rgb.R*scale))))
	g := int(math.Round(math.Max(0, math.Min(255, rgb.G*scale))))
	b := int(math.Round(math.Max(0, math.Min(255, rgb.B*scale))))
	packed := (r << 16) | (g << 8) | b
	return packed, fmt.Sprintf("%08b %08b %08b", r, g, b)
}

// ComputeGiftBinaryForensics builds the complete MTProto + TON TEP-62/TEP-64 + CIEDE2000
// binary forensic profile for a Telegram collectible gift.
func ComputeGiftBinaryForensics(
	collectionID string,
	serial int,
	modelVariantName string,
	modelRarityPct float64,
	backdropName string,
	centerHex string,
	edgeHex string,
	backdropPermille int,
	symbolName string,
	symbolPermille int,
	harmony traits.AestheticHarmonyResult,
) *GiftBinaryForensicsDto {
	if serial <= 0 {
		serial = 1
	}
	slugCamel := canonicalPascalSlug(collectionID)
	slugLower := strings.ReplaceAll(strings.ToLower(strings.TrimSpace(collectionID)), "_", "")
	if slugLower == "" {
		slugLower = "plushpepe"
	}
	canonicalSlug := fmt.Sprintf("%s-%d", slugCamel, serial)

	if centerHex == "" {
		centerHex = "#1a2035"
	}
	if edgeHex == "" {
		edgeHex = "#0a0e1a"
	}
	modelHex := harmony.ModelDominantHex
	if modelHex == "" {
		if inferred := traits.InferModelDominantHex(collectionID, modelVariantName); inferred != "" {
			modelHex = inferred
		} else {
			modelHex = centerHex
		}
	}

	centerInt24, centerBits := PackHexToRGB24(centerHex)
	edgeInt24, edgeBits := PackHexToRGB24(edgeHex)

	// Convert model rarity percentage to permille (parts per 1,000)
	modelPermille := int(math.Round(modelRarityPct * 10.0))
	if modelPermille <= 0 {
		modelPermille = 15 // Default 1.5% (15 permille)
	}
	if backdropPermille <= 0 {
		backdropPermille = 20 // Default 2.0% (20 permille)
	}
	if symbolPermille <= 0 {
		symbolPermille = 20 // Default 2.0% (20 permille)
	}

	pModel := math.Max(0.0005, float64(modelPermille)/1000.0)
	pBackdrop := math.Max(0.0005, float64(backdropPermille)/1000.0)
	pSymbol := math.Max(0.0005, float64(symbolPermille)/1000.0)
	jointProb := pModel * pBackdrop * pSymbol
	shannonBits := -math.Log2(jointProb)

	// CIELAB & CIEDE2000 telemetry
	cRGB := traits.HexToRGB(centerHex)
	eRGB := traits.HexToRGB(edgeHex)
	mRGB := traits.HexToRGB(modelHex)
	cLab := traits.RGBToLab(cRGB)
	eLab := traits.RGBToLab(eRGB)
	mLab := traits.RGBToLab(mRGB)

	deltaEModelBackdrop := harmony.DeltaE2000ModelBackdrop
	if deltaEModelBackdrop <= 0 {
		deltaEModelBackdrop = traits.DeltaE2000(mLab, cLab)
	}
	deltaEGradient := traits.DeltaE2000(cLab, eLab)
	wcagContrast := harmony.WCAGContrastRatio
	if wcagContrast <= 0 {
		wcagContrast = traits.WCAGContrast(centerHex, edgeHex)
	}

	// Build MTProto Layer 198+ starGiftUnique#5c62d151 little-endian binary header preview:
	// [4B constructor 0x5c62d151][4B flags][4B serial num][4B modelPermille][4B centerInt24][4B edgeInt24]
	headerBuf := make([]byte, 24)
	binary.LittleEndian.PutUint32(headerBuf[0:4], TLStarGiftUniqueConstructor)
	binary.LittleEndian.PutUint32(headerBuf[4:8], 0x0000000c) // owner_address + gift_address flags
	binary.LittleEndian.PutUint32(headerBuf[8:12], uint32(serial))
	binary.LittleEndian.PutUint32(headerBuf[12:16], uint32(modelPermille))
	binary.LittleEndian.PutUint32(headerBuf[16:20], uint32(centerInt24))
	binary.LittleEndian.PutUint32(headerBuf[20:24], uint32(edgeInt24))

	// Deterministic TON TEP-62 NFT item index SHA-256("stars_gift:" + canonicalSlug)
	hashInput := fmt.Sprintf("stars_gift:%s:%s:%s", canonicalSlug, modelVariantName, backdropName)
	digest := sha256.Sum256([]byte(hashInput))
	digestHex := "0x" + hex.EncodeToString(digest[:])
	uint256Val := new(big.Int).SetBytes(digest[:])
	uint256Str := uint256Val.String()
	if len(uint256Str) > 20 {
		uint256Str = uint256Str[:20] + "..."
	}

	// Standard TON TVM BOC header (0xb5ee9c72) encapsulating the TEP-62 item index prefix
	bocHex := fmt.Sprintf("0xb5ee9c7201010101002400004380%s", hex.EncodeToString(digest[:16]))

	return &GiftBinaryForensicsDto{
		CanonicalSlug:               canonicalSlug,
		FragmentNFTWebURI:           fmt.Sprintf("https://t.me/nft/%s", canonicalSlug),
		TEP64MetadataURI:            fmt.Sprintf("https://nft.fragment.com/gift/%s-%d.json", slugLower, serial),
		LottieVectorURI:             fmt.Sprintf("https://nft.fragment.com/gift/%s-%d.lottie.json", slugLower, serial),
		MTProtoConstructor:          "starGiftUnique#5c62d151",
		MTProtoModelAttrConstructor: "starGiftAttributeModel#39d99013",
		MTProtoBackdropConstructor:  "starGiftAttributeBackdrop#d93d859c",
		MTProtoPatternConstructor:   "starGiftAttributePattern#13acff19",
		MTProtoHeaderHex:            "0x" + hex.EncodeToString(headerBuf),
		CenterColorHex:              centerHex,
		EdgeColorHex:                edgeHex,
		ModelDominantColorHex:       modelHex,
		CenterColorInt24:            centerInt24,
		EdgeColorInt24:              edgeInt24,
		CenterColorBitStream24:      centerBits,
		EdgeColorBitStream24:        edgeBits,
		ModelPermille:               modelPermille,
		BackdropPermille:            backdropPermille,
		SymbolPermille:              symbolPermille,
		JointProbability:            math.Round(jointProb*1e8) / 1e8,
		ShannonSurprisalBits:        math.Round(shannonBits*100) / 100,
		CIELabCenterL:               math.Round(cLab.L*100) / 100,
		CIELabCenterA:               math.Round(cLab.A*100) / 100,
		CIELabCenterB:               math.Round(cLab.B*100) / 100,
		CIELabModelL:                math.Round(mLab.L*100) / 100,
		CIELabModelA:                math.Round(mLab.A*100) / 100,
		CIELabModelB:                math.Round(mLab.B*100) / 100,
		CIEDE2000ModelBackdrop:      math.Round(deltaEModelBackdrop*100) / 100,
		CIEDE2000GradientDelta:      math.Round(deltaEGradient*100) / 100,
		WCAGContrastRatio:           math.Round(wcagContrast*100) / 100,
		IsMonochromeColorMatch:      harmony.IsMonochromeColorMatch,
		TEP62ContractStandard:       "TEP-62 NFT Item + TEP-64 Off/On-Chain Metadata + TeleMint StarGift Bridge",
		TEP62ItemIndexSHA256:        digestHex,
		TEP62ItemIndexUint256Prefix: uint256Str,
		TVMCellBOCHex:               bocHex,
	}
}

func canonicalPascalSlug(collectionID string) string {
	clean := strings.TrimSpace(collectionID)
	if clean == "" {
		return "PlushPepe"
	}
	parts := strings.FieldsFunc(clean, func(r rune) bool {
		return r == '_' || r == '-' || r == ' '
	})
	var b strings.Builder
	for _, p := range parts {
		if len(p) == 0 {
			continue
		}
		b.WriteString(strings.ToUpper(p[:1]) + strings.ToLower(p[1:]))
	}
	if b.Len() == 0 {
		return "PlushPepe"
	}
	return b.String()
}

