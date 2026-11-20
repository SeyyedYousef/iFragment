package avm

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"hash/crc32"
	"math"
	"math/bits"
	"strings"
)

const TelegramUsernamesCollectionAddress = "EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi"

// BinaryForensicsDto exposes deep bit-level, TVM BOC cell, Fitts's Law biomechanical,
// optical glyph kerning, and Viterbi segmentation telemetry for any Telegram username.
type BinaryForensicsDto struct {
	AsciiHexPayload           string            `json:"ascii_hex_payload"`
	AsciiHexSpaced            string            `json:"ascii_hex_spaced"`
	RawHexPayload             string            `json:"raw_hex_payload"`
	ByteLength                int               `json:"byte_length"`
	TotalBits                 int               `json:"total_bits"`
	SetBitsPopcount           int               `json:"set_bits_popcount"`
	ZeroBitsCount             int               `json:"zero_bits_count"`
	HammingWeightDensity      float64           `json:"hamming_weight_density"`
	HammingWeightPct          float64           `json:"hamming_weight_pct"`
	ShannonEntropyBits        float64           `json:"shannon_entropy_bits"`
	MaxTheoreticalEntropyBits float64           `json:"max_theoretical_entropy_bits"`
	NormalizedEntropy         float64           `json:"normalized_entropy"`
	UniqueCharsCount          int               `json:"unique_chars_count"`
	BitstreamMatrix           []string          `json:"bitstream_matrix"`
	Tep62IndexSha256          string            `json:"tep62_index_sha256"`
	TvmBocCellHex             string            `json:"tvm_boc_cell_hex"`
	TelemintTokenCellBoc      string            `json:"telemint_token_cell_boc"`
	BocMagicPrefix            string            `json:"boc_magic_prefix"`
	CellDescriptorD1Hex       string            `json:"cell_descriptor_d1_hex"`
	CellDescriptorD2Hex       string            `json:"cell_descriptor_d2_hex"`
	Crc32cChecksumHex         string            `json:"crc32c_checksum_hex"`
	Tep81DnsInternalHex       string            `json:"tep81_dns_internal_hex"`
	TonDnsResolveMethodId     string            `json:"ton_dns_resolve_method_id"`
	TonDnsCategoryKeys        map[string]string `json:"ton_dns_category_keys"`
	CollectionAddress         string            `json:"collection_address"`
	HandAlternationPct        int               `json:"hand_alternation_pct"`
	LeftHandKeys              int               `json:"left_hand_keys"`
	RightHandKeys             int               `json:"right_hand_keys"`
	FittsIndexBits            float64           `json:"fitts_index_bits"`
	FittsErgonomicScore       float64           `json:"fitts_ergonomic_score"`
	OpticalKerningSymmetry    float64           `json:"optical_kerning_symmetry"`
	ViterbiTokens             []string          `json:"viterbi_tokens,omitempty"`
	ViterbiCoverage           float64           `json:"viterbi_coverage"`
}

// FragmentCapabilitiesDto describes Telegram protocol & TON DNS capabilities unlocked by the handle.
type FragmentCapabilitiesDto struct {
	CollectibleLinksCount     int      `json:"collectible_links_count"`
	ZeroSignupRequired        bool     `json:"zero_signup_required"`
	BotUpgradeEligible        bool     `json:"bot_upgrade_eligible"`
	TonDnsDomain              string   `json:"ton_dns_domain"`
	AdRevenueSharePct         int      `json:"ad_revenue_share_pct"`
	TmeUrl                    string   `json:"tme_url"`
	WebSubdomainUrl           string   `json:"web_subdomain_url"`
	TgResolveUri              string   `json:"tg_resolve_uri"`
	FragmentUrl               string   `json:"fragment_url"`
	NftJsonUrl                string   `json:"nft_json_url"`
	NftWebpUrl                string   `json:"nft_webp_url"`
	TonDnsHexTarget           string   `json:"ton_dns_hex_target"`
	AssignableTo              []string `json:"assignable_to"`
	MaxCollectiblesPerChat    int      `json:"max_collectibles_per_chat"`
	GlobalSearchPriorityBoost bool     `json:"GlobalSearchPriorityBoost"`
	ZeroSimCardLoginReady     bool     `json:"zero_sim_card_login_ready"`
	BotUpgradeFeeTon          int      `json:"bot_upgrade_fee_ton"`
	GiveawayPrepaidSupported  bool     `json:"giveaway_prepaid_supported"`
	MinOfferFeeTon            int      `json:"min_offer_fee_ton"`
	OfferFeeCommissionPct     int      `json:"offer_fee_commission_pct"`
	ProtocolRoyaltyPct        int      `json:"protocol_royalty_pct"`
}

// ViterbiSegmentation holds the globally optimal dynamic-programming segmentation of a username.
type ViterbiSegmentation struct {
	Tokens           []string `json:"tokens"`
	KnownTokens      []string `json:"known_tokens"`
	KnownCharCount   int      `json:"known_char_count"`
	CoverageRatio    float64  `json:"coverage_ratio"`
	UnexplainedRatio float64  `json:"unexplained_ratio"`
	CompositeRank    int      `json:"composite_rank"`
	IsCleanCompound  bool     `json:"is_clean_compound"`
	LogProbability   float64  `json:"log_probability"`
}

type keyCoord struct {
	x    float64
	y    float64
	hand byte // 'L' or 'R'
}

var mobileQwertyCoords = map[byte]keyCoord{
	// Row 0: QWERTYUIOP
	'q': {0.0, 0.0, 'L'}, 'w': {1.0, 0.0, 'L'}, 'e': {2.0, 0.0, 'L'}, 'r': {3.0, 0.0, 'L'}, 't': {4.0, 0.0, 'L'},
	'y': {5.0, 0.0, 'R'}, 'u': {6.0, 0.0, 'R'}, 'i': {7.0, 0.0, 'R'}, 'o': {8.0, 0.0, 'R'}, 'p': {9.0, 0.0, 'R'},
	// Row 1: ASDFGHJKL (staggered by +0.5)
	'a': {0.5, 1.0, 'L'}, 's': {1.5, 1.0, 'L'}, 'd': {2.5, 1.0, 'L'}, 'f': {3.5, 1.0, 'L'}, 'g': {4.5, 1.0, 'L'},
	'h': {5.5, 1.0, 'R'}, 'j': {6.5, 1.0, 'R'}, 'k': {7.5, 1.0, 'R'}, 'l': {8.5, 1.0, 'R'},
	// Row 2: ZXCVBNM (staggered by +1.5)
	'z': {1.5, 2.0, 'L'}, 'x': {2.5, 2.0, 'L'}, 'c': {3.5, 2.0, 'L'}, 'v': {4.5, 2.0, 'L'},
	'b': {5.5, 2.0, 'R'}, 'n': {6.5, 2.0, 'R'}, 'm': {7.5, 2.0, 'R'},
	// Digits row (y = -1.0)
	'1': {0.0, -1.0, 'L'}, '2': {1.0, -1.0, 'L'}, '3': {2.0, -1.0, 'L'}, '4': {3.0, -1.0, 'L'}, '5': {4.0, -1.0, 'L'},
	'6': {5.0, -1.0, 'R'}, '7': {6.0, -1.0, 'R'}, '8': {7.0, -1.0, 'R'}, '9': {8.0, -1.0, 'R'}, '0': {9.0, -1.0, 'R'},
	// Underscore requires symbol shift + reach on mobile keyboards
	'_': {8.5, 2.8, 'R'},
}

// Proportional optical glyph widths in SF Pro / Roboto (normalized to standard 'n' = 0.75)
var sfProGlyphWidths = map[byte]float64{
	'i': 0.42, 'l': 0.42, 'j': 0.45, 't': 0.48, 'f': 0.48, 'r': 0.52, '1': 0.48,
	'a': 0.74, 'b': 0.76, 'c': 0.70, 'd': 0.76, 'e': 0.74, 'g': 0.76, 'h': 0.75,
	'k': 0.72, 'n': 0.75, 'o': 0.76, 'p': 0.76, 'q': 0.76, 's': 0.68, 'u': 0.75,
	'v': 0.72, 'x': 0.72, 'y': 0.72, 'z': 0.68,
	'm': 1.14, 'w': 1.10, '_': 0.95,
	'0': 0.76, '2': 0.74, '3': 0.74, '4': 0.74, '5': 0.74, '6': 0.74, '7': 0.72, '8': 0.76, '9': 0.76,
}

// Protected Web3/Tech alphanumeric tokens that must NOT be corrupted by blind leetspeak decoding
var protectedTechTokens = []string{
	"web3", "l2", "l1", "b2b", "p2p", "b2c", "c2c", "mp3", "mp4", "v1", "v2", "v3", "v4",
	"24x7", "360", "404", "2fa", "100x", "10x", "erc20", "trc20", "tep62", "tep74", "gpt4",
}

// DecodeLeetSmart decodes leetspeak digits into letters while preserving genuine tech tokens like "web3" or "p2p".
func DecodeLeetSmart(username string) string {
	lower := strings.ToLower(strings.TrimSpace(username))
	for _, tok := range protectedTechTokens {
		if lower == tok || strings.HasPrefix(lower, tok) || strings.HasSuffix(lower, tok) {
			return lower
		}
	}
	return DecodeLeet(lower)
}

var viterbiSpecialLexicon = map[string]int{
	"ton": 120, "web3": 180, "defi": 220, "nft": 190, "dex": 260, "dao": 280,
	"hodl": 450, "pepe": 320, "doge": 310, "shib": 420, "usdt": 240, "btc": 150,
	"eth": 160, "sol": 190, "crypto": 140, "wallet": 180, "swap": 250, "token": 230,
	"durov": 280, "fragment": 300, "telegram": 110, "notcoin": 340, "catizen": 480,
	"hamster": 450, "toncoin": 260, "getgems": 490, "miniapp": 520, "bot": 180,
	"ai": 100, "gpt": 210, "app": 160, "vip": 140, "pro": 170, "pay": 150,
	"tech": 200, "dev": 260, "ceo": 240, "founder": 310, "whale": 290, "alpha": 250,
	"apex": 270, "prime": 230, "vault": 280, "rare": 190, "gold": 150, "king": 160,
}

func wordRankForViterbi(w string) int {
	if len(w) < 2 {
		return 0
	}
	if r, ok := viterbiSpecialLexicon[w]; ok {
		return r
	}
	if r := RankWord(w); r > 0 {
		// Short 2-letter stopwords ("in", "on", "to", "at", "by", "of") are allowed
		// only if they are genuinely common (rank <= 600); avoid random 2-char abbreviations.
		if len(w) == 2 && r > 600 {
			return 0
		}
		return r
	}
	if _, ok := tier_0_corporate_gods[w]; ok {
		return 150
	}
	if _, ok := tier_0_web3_gods[w]; ok {
		return 160
	}
	if _, ok := tier_ai_tech_gods[w]; ok {
		return 170
	}
	if KnownBrandEntity[w] != "" {
		return 200
	}
	return 0
}

// ViterbiSegmentUsername performs O(L^2) dynamic programming word segmentation using Zipf unigram log-probabilities.
func ViterbiSegmentUsername(username string) ViterbiSegmentation {
	clean := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(username)), "@")
	cleanNoUnderscore := strings.ReplaceAll(clean, "_", "")
	n := len(cleanNoUnderscore)
	if n == 0 {
		return ViterbiSegmentation{}
	}

	// Fast path: if the entire string is a single known dictionary/special word
	if fullRank := wordRankForViterbi(cleanNoUnderscore); fullRank > 0 && !strings.Contains(clean, "_") {
		logP := -math.Log(float64(fullRank) + 10.0)
		return ViterbiSegmentation{
			Tokens:           []string{cleanNoUnderscore},
			KnownTokens:      []string{cleanNoUnderscore},
			KnownCharCount:   n,
			CoverageRatio:    1.0,
			UnexplainedRatio: 0.0,
			CompositeRank:    fullRank,
			IsCleanCompound:  false,
			LogProbability:   math.Round(logP*1000) / 1000,
		}
	}

	// DP tables: bestScore[i] is max log-probability for prefix cleanNoUnderscore[:i]
	bestScore := make([]float64, n+1)
	prevIdx := make([]int, n+1)
	tokenKnown := make([]bool, n+1)
	tokenRank := make([]int, n+1)

	for i := 1; i <= n; i++ {
		bestScore[i] = -1e9
	}

	for i := 0; i < n; i++ {
		if bestScore[i] <= -1e8 {
			continue
		}
		// Option A: single unexplained character transition
		unkScore := bestScore[i] - 9.5
		if unkScore > bestScore[i+1] {
			bestScore[i+1] = unkScore
			prevIdx[i+1] = i
			tokenKnown[i+1] = false
			tokenRank[i+1] = 0
		}

		// Option B: known dictionary/brand/tech word transition of length >= 2
		maxWordLen := n - i
		if maxWordLen > 16 {
			maxWordLen = 16
		}
		for l := 2; l <= maxWordLen; l++ {
			j := i + l
			sub := cleanNoUnderscore[i:j]
			r := wordRankForViterbi(sub)
			if r > 0 {
				// Zipf log-probability with length reward to favor longer coherent words over tiny fragments
				wordLogProb := -math.Log(float64(r)+10.0) + float64(l)*0.45 - 1.25
				if l == 2 && r > 200 {
					wordLogProb -= 2.2 // Penalize weak 2-letter splits unless top token like "ai", "on", "to"
				}
				cand := bestScore[i] + wordLogProb
				if cand > bestScore[j] {
					bestScore[j] = cand
					prevIdx[j] = i
					tokenKnown[j] = true
					tokenRank[j] = r
				}
			}
		}
	}

	// Backtrack optimal path and coalesce adjacent unknown characters
	type rawSeg struct {
		text  string
		known bool
		rank  int
	}
	var revSegs []rawSeg
	for cur := n; cur > 0; {
		p := prevIdx[cur]
		revSegs = append(revSegs, rawSeg{
			text:  cleanNoUnderscore[p:cur],
			known: tokenKnown[cur],
			rank:  tokenRank[cur],
		})
		cur = p
	}

	var tokens []string
	var knownTokens []string
	knownChars := 0
	rankSum := 0
	knownCount := 0

	var unkBuf strings.Builder
	flushUnk := func() {
		if unkBuf.Len() > 0 {
			tokens = append(tokens, unkBuf.String())
			unkBuf.Reset()
		}
	}

	for i := len(revSegs) - 1; i >= 0; i-- {
		seg := revSegs[i]
		if seg.known {
			flushUnk()
			tokens = append(tokens, seg.text)
			knownTokens = append(knownTokens, seg.text)
			knownChars += len(seg.text)
			rankSum += seg.rank
			knownCount++
		} else {
			unkBuf.WriteString(seg.text)
		}
	}
	flushUnk()

	cov := float64(knownChars) / float64(n)
	compRank := 0
	if knownCount > 0 {
		compRank = rankSum / knownCount
	}
	isCompound := knownCount >= 2 && knownChars == n && len(tokens) == knownCount

	return ViterbiSegmentation{
		Tokens:           tokens,
		KnownTokens:      knownTokens,
		KnownCharCount:   knownChars,
		CoverageRatio:    math.Round(cov*1000) / 1000,
		UnexplainedRatio: math.Round((1.0-cov)*1000) / 1000,
		CompositeRank:    compRank,
		IsCleanCompound:  isCompound,
		LogProbability:   math.Round(bestScore[n]*1000) / 1000,
	}
}

// ComputeFittsBiomechanics calculates two-thumb mobile QWERTY typing kinematics using Fitts's Law:
// ID = log2(1 + D / W), with parallel thumb preparation discount on hand alternation.
func ComputeFittsBiomechanics(username string) (fittsIndexBits float64, ergonomicScore float64, handAlternationPct int) {
	clean := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(username)), "@")
	n := len(clean)
	if n <= 1 {
		return 0.50, 0.95, 100
	}

	const keyTargetWidth = 1.0 // Normalized key cap width W = 1.0
	totalID := 0.0
	alternations := 0
	transitions := 0

	prevCoord, prevOk := mobileQwertyCoords[clean[0]]
	for i := 1; i < n; i++ {
		curCoord, curOk := mobileQwertyCoords[clean[i]]
		if !prevOk || !curOk {
			totalID += 2.0
			transitions++
			prevCoord, prevOk = curCoord, curOk
			continue
		}

		dx := curCoord.x - prevCoord.x
		dy := curCoord.y - prevCoord.y
		dist := math.Sqrt(dx*dx + dy*dy)

		var stepID float64
		if dist < 0.01 {
			// Exact same key double-tap: fast motor repeat, unless triple+ repeat
			if i >= 2 && clean[i] == clean[i-2] {
				stepID = 0.85 // Counting identical characters >=3 requires cognitive rhythm tracking
			} else {
				stepID = 0.20
			}
		} else if curCoord.hand != prevCoord.hand {
			// Two-thumb alternation: opposite thumb pre-positions in parallel (~45% lower motor difficulty)
			alternations++
			stepID = 0.55 * math.Log2(1.0+dist/keyTargetWidth)
		} else {
			// Same-thumb ballistic jump
			stepID = math.Log2(1.0 + dist/keyTargetWidth)
		}

		// Underscore requires symbol layer toggle on mobile keyboards
		if clean[i] == '_' || clean[i-1] == '_' {
			stepID += 1.35
		}

		totalID += stepID
		transitions++
		prevCoord, prevOk = curCoord, curOk
	}

	if transitions == 0 {
		return 0.50, 0.90, 50
	}

	meanID := totalID / float64(transitions)
	// Length memory load penalty for handles > 6 chars
	lengthLoad := 0.0
	if n > 6 {
		lengthLoad = float64(n-6) * 0.08
	}
	fittsIndexBits = math.Round((meanID+lengthLoad)*100) / 100

	// Normalize into [0.05, 0.99] ergonomic score where lower Fitts ID = higher ergonomic ease
	ergo := 1.0 / (1.0 + 0.42*(meanID+lengthLoad))
	ergonomicScore = math.Round(math.Max(0.05, math.Min(0.99, ergo))*1000) / 1000
	handAlternationPct = int(math.Round((float64(alternations) / float64(transitions)) * 100.0))
	return fittsIndexBits, ergonomicScore, handAlternationPct
}

// ComputeOpticalKerningSymmetry evaluates proportional glyph width harmony and mirror balance in SF Pro / Roboto.
func ComputeOpticalKerningSymmetry(username string) float64 {
	clean := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(username)), "@")
	n := len(clean)
	if n == 0 {
		return 0.50
	}

	widths := make([]float64, n)
	sum := 0.0
	for i := 0; i < n; i++ {
		w, ok := sfProGlyphWidths[clean[i]]
		if !ok {
			w = 0.75
		}
		widths[i] = w
		sum += w
	}
	mean := sum / float64(n)

	// 1. Uniformity of glyph widths (low variance = clean typographic rhythm)
	variance := 0.0
	for _, w := range widths {
		d := w - mean
		variance += d * d
	}
	variance /= float64(n)
	uniformity := math.Max(0.0, 1.0-variance*6.5)

	// 2. Mirror width symmetry around the visual center
	mirrorDiff := 0.0
	pairs := n / 2
	if pairs > 0 {
		for i := 0; i < pairs; i++ {
			mirrorDiff += math.Abs(widths[i] - widths[n-1-i])
		}
		mirrorDiff /= float64(pairs)
	}
	mirrorHarmony := math.Max(0.0, 1.0-mirrorDiff*1.4)

	score := 0.55*uniformity + 0.45*mirrorHarmony
	return math.Round(math.Max(0.10, math.Min(0.99, score))*1000) / 1000
}

// buildCanonicalSingleRootBOC constructs a bit-exact TON TVM Bag-of-Cells (magic 0xb5ee9c72)
// single-root ordinary data cell with flags=0x41 (has_crc32c=1, size_bytes=1) and
// little-endian Castagnoli CRC32-C checksum at the end.
func buildCanonicalSingleRootBOC(payload []byte) (bocHexNoPrefix string, d1Hex string, d2Hex string, crc32cHex string) {
	d1 := byte(0x00) // 0 refs, ordinary data cell, level mask 0
	d2 := byte(len(payload) * 2)
	cellSize := 2 + len(payload)

	raw := make([]byte, 0, 16+len(payload))
	// Standard BOC magic: 0xb5ee9c72
	raw = append(raw, 0xb5, 0xee, 0x9c, 0x72)
	// Flags byte: has_idx=0, has_crc32c=1 (0x40), has_cache_bits=0, flags=0, size_bytes=1 (0x01) -> 0x41
	raw = append(raw, 0x41)
	// off_bytes = 1
	raw = append(raw, 0x01)
	// cells = 1, roots = 1, absent = 0
	raw = append(raw, 0x01, 0x01, 0x00)
	// tot_cells_size = cellSize
	raw = append(raw, byte(cellSize))
	// root_idx = 0
	raw = append(raw, 0x00)
	// cell descriptors d1, d2 + data payload
	raw = append(raw, d1, d2)
	raw = append(raw, payload...)

	// Append Castagnoli CRC32-C (little-endian per TON BOC specification)
	crcTable := crc32.MakeTable(crc32.Castagnoli)
	checksum := crc32.Checksum(raw, crcTable)
	var crcBytes [4]byte
	binary.LittleEndian.PutUint32(crcBytes[:], checksum)
	raw = append(raw, crcBytes[:]...)

	return hex.EncodeToString(raw), fmt.Sprintf("0x%02x", d1), fmt.Sprintf("0x%02x", d2), "0x" + hex.EncodeToString(crcBytes[:])
}

// ComputeBinaryAndBiomechanicalForensics computes bit-level ASCII matrix, Hamming weight density,
// Shannon entropy, TEP-62 SHA-256 index, TVM BOC cell hex with Castagnoli CRC32-C, TEP-81 DNS internal representation,
// Fitts's Law kinematics, and Viterbi tokens.
func ComputeBinaryAndBiomechanicalForensics(username string) (*BinaryForensicsDto, *FragmentCapabilitiesDto) {
	clean := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(username)), "@")
	rawBytes := []byte(clean)
	byteLen := len(rawBytes)
	totalBits := byteLen * 8

	setBitsPopcount := 0
	bitstreamMatrix := make([]string, byteLen)
	hexBytes := make([]string, byteLen)
	hexBytesUpper := make([]string, byteLen)
	charCounts := make(map[byte]int, byteLen)
	leftHandKeys := 0
	rightHandKeys := 0

	for i, b := range rawBytes {
		setBitsPopcount += bits.OnesCount8(b)
		bitstreamMatrix[i] = fmt.Sprintf("%08b", b)
		hexBytes[i] = fmt.Sprintf("%02x", b)
		hexBytesUpper[i] = fmt.Sprintf("%02X", b)
		charCounts[b]++
		if coord, ok := mobileQwertyCoords[b]; ok {
			if coord.hand == 'L' {
				leftHandKeys++
			} else {
				rightHandKeys++
			}
		}
	}

	zeroBitsCount := totalBits - setBitsPopcount
	rawHexPayload := strings.Join(hexBytes, "")
	asciiHexPayload := "0x" + rawHexPayload
	asciiHexSpaced := strings.Join(hexBytesUpper, " ")
	hammingDensity := 0.0
	if totalBits > 0 {
		hammingDensity = math.Round((float64(setBitsPopcount)/float64(totalBits))*10000) / 10000
	}
	hammingWeightPct := math.Round(hammingDensity*10000) / 100

	// Shannon Information Entropy H(X) = -Sum P(x) log2 P(x)
	shannonEntropy := 0.0
	if byteLen > 0 {
		for _, count := range charCounts {
			p := float64(count) / float64(byteLen)
			shannonEntropy -= p * math.Log2(p)
		}
	}
	shannonEntropy = math.Round(shannonEntropy*1000) / 1000

	maxPossibleEntropy := math.Round(math.Log2(math.Max(2.0, float64(byteLen)))*1000) / 1000
	normEntropy := math.Round(math.Min(1.0, shannonEntropy/maxPossibleEntropy)*1000) / 1000

	// TEP-62 SHA-256 NFT Index
	hash := sha256.Sum256(rawBytes)
	tep62Sha256 := "0x" + hex.EncodeToString(hash[:])

	// 1. Canonical TVM BOC Cell (0xb5ee9c72 standard magic header + payload + Castagnoli CRC32-C)
	tvmBocCellHex, d1Hex, d2Hex, crc32cHex := buildCanonicalSingleRootBOC(rawBytes)

	// 2. TeleMint Token Info TL-B Cell: telemint_text$_ len:(## 8) text:(bits (len * 8)) = TelemintText
	telemintPayload := make([]byte, 0, 1+byteLen)
	telemintPayload = append(telemintPayload, byte(byteLen))
	telemintPayload = append(telemintPayload, rawBytes...)
	telemintTokenBoc, _, _, _ := buildCanonicalSingleRootBOC(telemintPayload)

	// 3. TEP-81 TON DNS Internal Domain Slice ("me\x00t\x00<username>\x00") for dnsresolve (0x1e210)
	dnsInternalBytes := []byte("me\x00t\x00" + clean + "\x00")
	tep81DnsInternalHex := "0x" + hex.EncodeToString(dnsInternalBytes)

	// 4. TON DNS Category SHA-256 Hashes per TEP-81 specification
	dnsCategories := []string{"wallet", "telegram_username", "site", "dns_next_resolver"}
	tonDnsCategoryKeys := make(map[string]string, len(dnsCategories))
	for _, cat := range dnsCategories {
		catHash := sha256.Sum256([]byte(cat))
		tonDnsCategoryKeys[cat] = "0x" + hex.EncodeToString(catHash[:])
	}

	// Biomechanical Fitts's Law & Optical Kerning
	fittsBits, fittsErgo, handAltPct := ComputeFittsBiomechanics(clean)
	kerningSym := ComputeOpticalKerningSymmetry(clean)
	viterbi := ViterbiSegmentUsername(clean)

	forensics := &BinaryForensicsDto{
		AsciiHexPayload:           asciiHexPayload,
		AsciiHexSpaced:            asciiHexSpaced,
		RawHexPayload:             rawHexPayload,
		ByteLength:                byteLen,
		TotalBits:                 totalBits,
		SetBitsPopcount:           setBitsPopcount,
		ZeroBitsCount:             zeroBitsCount,
		HammingWeightDensity:      hammingDensity,
		HammingWeightPct:          hammingWeightPct,
		ShannonEntropyBits:        shannonEntropy,
		MaxTheoreticalEntropyBits: maxPossibleEntropy,
		NormalizedEntropy:         normEntropy,
		UniqueCharsCount:          len(charCounts),
		BitstreamMatrix:           bitstreamMatrix,
		Tep62IndexSha256:          tep62Sha256,
		TvmBocCellHex:             tvmBocCellHex,
		TelemintTokenCellBoc:      "0x" + telemintTokenBoc,
		BocMagicPrefix:            "0xb5ee9c72",
		CellDescriptorD1Hex:       d1Hex,
		CellDescriptorD2Hex:       d2Hex,
		Crc32cChecksumHex:         crc32cHex,
		Tep81DnsInternalHex:       tep81DnsInternalHex,
		TonDnsResolveMethodId:     "0x1e210 (123660)",
		TonDnsCategoryKeys:        tonDnsCategoryKeys,
		CollectionAddress:         TelegramUsernamesCollectionAddress,
		HandAlternationPct:        handAltPct,
		LeftHandKeys:              leftHandKeys,
		RightHandKeys:             rightHandKeys,
		FittsIndexBits:            fittsBits,
		FittsErgonomicScore:       fittsErgo,
		OpticalKerningSymmetry:    kerningSym,
		ViterbiTokens:             viterbi.Tokens,
		ViterbiCoverage:           viterbi.CoverageRatio,
	}

	capabilities := &FragmentCapabilitiesDto{
		CollectibleLinksCount:     5,
		ZeroSignupRequired:        true,
		BotUpgradeEligible:        strings.HasSuffix(clean, "bot"),
		TonDnsDomain:              clean + ".t.me",
		AdRevenueSharePct:         50,
		TmeUrl:                    "https://t.me/" + clean,
		WebSubdomainUrl:           "https://" + clean + ".t.me",
		TgResolveUri:              "tg://resolve?domain=" + clean,
		FragmentUrl:               "https://fragment.com/username/" + clean,
		NftJsonUrl:                "https://nft.fragment.com/username/" + clean + ".json",
		NftWebpUrl:                "https://nft.fragment.com/username/" + clean + ".webp",
		TonDnsHexTarget:           tep81DnsInternalHex,
		AssignableTo:              []string{"Personal Account", "Public Channel", "Supergroup", "Telegram Bot / Mini-App"},
		MaxCollectiblesPerChat:    15,
		GlobalSearchPriorityBoost: byteLen <= 6,
		ZeroSimCardLoginReady:     true,
		BotUpgradeFeeTon:          5000,
		GiveawayPrepaidSupported:  true,
		MinOfferFeeTon:            1,
		OfferFeeCommissionPct:     5,
		ProtocolRoyaltyPct:        5,
	}

	return forensics, capabilities
}

