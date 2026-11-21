package nvengine

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"hash/crc32"
	"math"
	"math/big"
	"math/bits"
	"strings"

	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/numbers/registry"
)

// NumberDigitForensicCell holds per-digit ASCII, 4-bit 8421 BCD, and ITU-T Q.23 DTMF telemetry
type NumberDigitForensicCell struct {
	Position      int    `json:"position"`
	Digit         string `json:"digit"`
	ASCIICode     int    `json:"ascii_code"`
	ASCIIHex      string `json:"ascii_hex"`
	ASCIIBinary   string `json:"ascii_binary"`
	BCDNibble     string `json:"bcd_nibble"`
	HammingWeight int    `json:"hamming_weight"`
	DTMFRowHz     int    `json:"dtmf_row_hz"`
	DTMFColHz     int    `json:"dtmf_col_hz"`
	KeypadRow     int    `json:"keypad_row"`
	KeypadCol     int    `json:"keypad_col"`
}

// NumberBinaryForensicsDto exposes deep bit-level, BCD, ITU-T Q.23 DTMF, Fitts's Law, and TVM BOC telemetry
type NumberBinaryForensicsDto struct {
	CleanDigits              string                    `json:"clean_digits"`
	SuffixDigits             string                    `json:"suffix_digits"`
	UTF8Hex                  string                    `json:"utf8_hex"`
	BitLength                int                       `json:"bit_length"`
	BCDStream                string                    `json:"bcd_stream"`
	BCDHammingWeight         int                       `json:"bcd_hamming_weight"`
	IsPureMSB80Wave          bool                      `json:"is_pure_msb_80_wave"`
	TEP62IndexSHA256Hex      string                    `json:"tep62_index_sha256_hex"`
	TEP62IndexUint256Dec     string                    `json:"tep62_index_uint256_dec"`
	CollectionAddress        string                    `json:"collection_address"`
	NFTItemAddress           string                    `json:"nft_item_address"`
	TokenNameBOCHex          string                    `json:"token_name_boc_hex"`
	TelemintTokenCellBOCHex  string                    `json:"telemint_token_cell_boc_hex"`
	BOCMagicPrefix           string                    `json:"boc_magic_prefix"`
	CellDescriptorD1Hex      string                    `json:"cell_descriptor_d1_hex"`
	CellDescriptorD2Hex      string                    `json:"cell_descriptor_d2_hex"`
	CRC32CChecksumHex        string                    `json:"crc32c_checksum_hex"`
	FragmentNumberWebURI     string                    `json:"fragment_number_web_uri"`
	FragmentNFTMetadataURI   string                    `json:"fragment_nft_metadata_uri"`
	FragmentNFTImageURI      string                    `json:"fragment_nft_image_uri"`
	ShannonEntropyBits       float64                   `json:"shannon_entropy_bits"`
	MaxEntropyBits           float64                   `json:"max_entropy_bits"`
	KolmogorovCompressionPct int                       `json:"kolmogorov_compression_pct"`
	TotalHammingWeight       int                       `json:"total_hamming_weight"`
	HammingDensity           float64                   `json:"hamming_density"`
	KeypadManhattanDistance  int                       `json:"keypad_manhattan_distance"`
	FittsIndexBits           float64                   `json:"fitts_index_bits"`
	KeypadErgonomicScore     int                       `json:"keypad_ergonomic_score"`
	DTMFConsonanceScore      float64                   `json:"dtmf_consonance_score"`
	KeypadGeometryClassEn    string                    `json:"keypad_geometry_class_en"`
	KeypadGeometryClassFa    string                    `json:"keypad_geometry_class_fa"`
	DTMFAcousticSignature    string                    `json:"dtmf_acoustic_signature"`
	DigitsMatrix             []NumberDigitForensicCell `json:"digits_matrix"`
}

// ComputeNumberBinaryForensics computes deterministic bit-level, 8421 BCD, ITU-T Q.23 DTMF, Fitts's Law, and TVM BOC forensics
func ComputeNumberBinaryForensics(normNumber string, fv features.FeatureVector, nftItemAddress string) *NumberBinaryForensicsDto {
	cleanDigits := strings.TrimPrefix(normNumber, "+")
	suffix := fv.Suffix
	if suffix == "" && strings.HasPrefix(cleanDigits, "888") {
		suffix = cleanDigits[3:]
	}

	digitsMatrix := make([]NumberDigitForensicCell, 0, len(suffix))
	bcdNibbles := make([]string, 0, len(suffix))
	totalASCIIHamming := 0
	totalBCDHamming := 0
	isPure80 := len(suffix) > 0

	for idx, r := range suffix {
		code := byte(r)
		hw := bits.OnesCount8(code)
		totalASCIIHamming += hw

		coord, ok := features.DialPadCoords[r]
		if !ok {
			coord = features.DialPadCoords['0']
		}
		bcdNibbles = append(bcdNibbles, coord.BCD)
		for _, bitRune := range coord.BCD {
			if bitRune == '1' {
				totalBCDHamming++
			}
		}
		if r != '8' && r != '0' {
			isPure80 = false
		}

		digitsMatrix = append(digitsMatrix, NumberDigitForensicCell{
			Position:      idx + 1,
			Digit:         string(r),
			ASCIICode:     int(code),
			ASCIIHex:      fmt.Sprintf("0x%02X", code),
			ASCIIBinary:   fmt.Sprintf("%08b", code),
			BCDNibble:     coord.BCD,
			HammingWeight: hw,
			DTMFRowHz:     coord.RowHz,
			DTMFColHz:     coord.ColHz,
			KeypadRow:     coord.Row,
			KeypadCol:     coord.Col,
		})
	}

	bitLen := len(suffix) * 8
	hammingDensity := 0.0
	if bitLen > 0 {
		hammingDensity = math.Round((float64(totalASCIIHamming)/float64(bitLen))*10000.0) / 10000.0
	}

	// Exact TEP-62 SHA-256 NFT Index for TeleMint number token (sha256 of raw digits e.g. "88888888888")
	hash := sha256.Sum256([]byte(cleanDigits))
	shaHex := "0x" + hex.EncodeToString(hash[:])
	uint256Int := new(big.Int).SetBytes(hash[:])

	// Deterministic TVM Bag-of-Cells (BOC) representation of the TeleMint token name slice
	bocHex, d1Hex, d2Hex, crc32cHex := buildTeleMintNumberBOCDetails([]byte(cleanDigits))

	// TeleMint Token Info TL-B cell: telemint_text$_ len:(## 8) text:(bits (len * 8))
	telemintPayload := append([]byte{byte(len(cleanDigits))}, []byte(cleanDigits)...)
	telemintTokenBoc, _, _, _ := buildTeleMintNumberBOCDetails(telemintPayload)

	maxEnt := 0.0
	if len(suffix) > 0 {
		maxEnt = math.Round(math.Log2(float64(len(suffix)))*1000.0) / 1000.0
	}
	kolmogorovPct := int(math.Round(fv.CompressionRatio * 100.0))

	geoEn, geoFa := describeKeypadGeometry(fv.DialPad)

	itemAddr := nftItemAddress
	if itemAddr == "" {
		itemAddr = "Deterministic TEP-62 Index: " + shaHex[:18] + "..."
	}

	return &NumberBinaryForensicsDto{
		CleanDigits:              cleanDigits,
		SuffixDigits:             suffix,
		UTF8Hex:                  strings.ToUpper(hex.EncodeToString([]byte(cleanDigits))),
		BitLength:                bitLen,
		BCDStream:                strings.Join(bcdNibbles, " "),
		BCDHammingWeight:         totalBCDHamming,
		IsPureMSB80Wave:          isPure80,
		TEP62IndexSHA256Hex:      shaHex,
		TEP62IndexUint256Dec:     uint256Int.String(),
		CollectionAddress:        registry.AnonymousNumbersCollectionAddr,
		NFTItemAddress:           itemAddr,
		TokenNameBOCHex:          bocHex,
		TelemintTokenCellBOCHex:  telemintTokenBoc,
		BOCMagicPrefix:           "0xb5ee9c72",
		CellDescriptorD1Hex:      d1Hex,
		CellDescriptorD2Hex:      d2Hex,
		CRC32CChecksumHex:        crc32cHex,
		FragmentNumberWebURI:     "https://fragment.com/number/" + cleanDigits,
		FragmentNFTMetadataURI:   "https://nft.fragment.com/number/" + cleanDigits + ".json",
		FragmentNFTImageURI:      "https://nft.fragment.com/number/" + cleanDigits + ".webp",
		ShannonEntropyBits:       fv.HarmonicEntropy,
		MaxEntropyBits:           maxEnt,
		KolmogorovCompressionPct: kolmogorovPct,
		TotalHammingWeight:       totalASCIIHamming,
		HammingDensity:           hammingDensity,
		KeypadManhattanDistance:  fv.DialPad.ManhattanDistance,
		FittsIndexBits:           fv.DialPad.FittsIndexBits,
		KeypadErgonomicScore:     int(math.Round(fv.DialPad.FittsErgonomicScore)),
		DTMFConsonanceScore:      fv.DialPad.DTMFConsonanceScore,
		KeypadGeometryClassEn:    geoEn,
		KeypadGeometryClassFa:    geoFa,
		DTMFAcousticSignature:    fv.DialPad.DTMFAcousticSignature,
		DigitsMatrix:             digitsMatrix,
	}
}

func describeKeypadGeometry(dp features.DialPadFeatures) (string, string) {
	switch dp.GeometryClass {
	case "MONODIAL":
		return "Zero-Vector Stationary Point (Single Key Tap)", "نقطه ایستا با بردار صفر (ضربه تک‌کلید مطلق)"
	case "VERTICAL_COL":
		return "Vertical Column Spine (Collinear Keypad Glide)", "ستون عمودی شماره‌گیر (لغزش خطی هم‌راستا)"
	case "LINEAR_ROW":
		return "Horizontal Row Sweep (Linear Keypad Cadence)", "پیمایش افقی ردیف شماره‌گیر (ضرب‌آهنگ خطی)"
	case "DIAGONAL":
		return "Symmetric Diagonal Axis (1-5-9 / 3-5-7 Vector)", "محور قطری متقارن روی کی‌پد (بردار 1-5-9 / 3-5-7)"
	case "CORNER_VIP":
		return "Perimeter Corner Frame (1-3-7-9-0 Geometry)", "چهارچوب گوشه‌های کی‌پد (هندسه 1-3-7-9-0)"
	case "CROSS_VIP":
		return "Central Cross Axis (2-4-5-6-8-0 Harmony)", "محور صلیبی مرکز شماره‌گیر (هارمونی 2-4-5-6-8-0)"
	case "COMPACT_TOUCH":
		return "Ultra-Tight Adjacent Cluster (Low Fitts ID)", "خوشه فوق‌فشرده همسایه (شاخص دشواری فیتس پایین)"
	default:
		if dp.ManhattanDistance <= 4 {
			return "Symmetric Geometric Cadence", "ضرب‌آهنگ هندسی متقارن روی شماره‌گیر"
		}
		return "Multi-Vector Keypad Path", "مسیر چندبرداری روی کی‌پد"
	}
}

// buildTeleMintNumberBOCHex constructs a canonical TVM Bag-of-Cells (BOC, magic 0xb5ee9c72)
// single-root cell with CRC32-C containing the ASCII bytes of the TeleMint number token.
func buildTeleMintNumberBOCHex(cleanDigits string) string {
	bocHex, _, _, _ := buildTeleMintNumberBOCDetails([]byte(cleanDigits))
	return bocHex
}

func buildTeleMintNumberBOCDetails(payload []byte) (bocHex string, d1Hex string, d2Hex string, crc32cHex string) {
	d1 := byte(0x00) // 0 refs, ordinary data cell
	d2 := byte(len(payload) * 2)
	cellSize := 2 + len(payload)

	raw := make([]byte, 0, 16+len(payload))
	// Standard BOC magic: b5ee9c72
	raw = append(raw, 0xb5, 0xee, 0x9c, 0x72)
	// Flags byte: has_idx=0, has_crc32c=1 (0x40), size_bytes=1 (0x01) -> 0x41
	raw = append(raw, 0x41)
	// off_bytes = 1
	raw = append(raw, 0x01)
	// cells = 1, roots = 1, absent = 0
	raw = append(raw, 0x01, 0x01, 0x00)
	// tot_cells_size = cellSize
	raw = append(raw, byte(cellSize))
	// root_idx = 0
	raw = append(raw, 0x00)
	// cell descriptors + payload
	raw = append(raw, d1, d2)
	raw = append(raw, payload...)

	// Append Castagnoli CRC32-C (little-endian, per TON BOC specification)
	crcTable := crc32.MakeTable(crc32.Castagnoli)
	checksum := crc32.Checksum(raw, crcTable)
	var crcBytes [4]byte
	binary.LittleEndian.PutUint32(crcBytes[:], checksum)
	raw = append(raw, crcBytes[:]...)

	return "0x" + hex.EncodeToString(raw), fmt.Sprintf("0x%02x", d1), fmt.Sprintf("0x%02x", d2), "0x" + hex.EncodeToString(crcBytes[:])
}

