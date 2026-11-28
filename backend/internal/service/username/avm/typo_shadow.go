package avm

import (
	"strings"
	"sync"
)

// TypoShadowResult describes whether a username is a typo or phonetic confusable ("Radio-Test failure")
// of a much higher-authority canonical dictionary word or flagship brand (e.g. @mainer vs @miner, @walet vs @wallet).
type TypoShadowResult struct {
	IsShadow           bool   `json:"is_shadow"`
	CanonicalWord      string `json:"canonical_word,omitempty"`
	ShadowType         string `json:"shadow_type,omitempty"`
	CanonicalAuthority int    `json:"canonical_authority,omitempty"`
}

type canonicalCandidate struct {
	word      string
	authority int
}

var (
	typoShadowOnce sync.Once
	canonicalAuth  map[string]int
	skeletonIndex  map[string]canonicalCandidate
	delete1Index   map[string][]canonicalCandidate
)

func initTypoShadowIndex() {
	canonicalAuth = make(map[string]int, 4500)
	skeletonIndex = make(map[string]canonicalCandidate, 4500)
	delete1Index = make(map[string][]canonicalCandidate, 16000)

	register := func(w string, auth int) {
		w = strings.ToLower(strings.TrimSpace(w))
		if len(w) < 4 || len(w) > 14 {
			return
		}
		for i := 0; i < len(w); i++ {
			if w[i] < 'a' || w[i] > 'z' {
				return
			}
		}
		if prev, ok := canonicalAuth[w]; ok && prev >= auth {
			return
		}
		canonicalAuth[w] = auth
	}

	// 1. Top English frequency headwords
	for w, rank := range wordFrequencyRank {
		if rank <= 800 {
			register(w, 88)
		} else if rank <= 2000 {
			register(w, 82)
		} else if rank <= 3500 {
			register(w, 76)
		}
	}

	// 2. Curated Tier 0-2 lexicons & global brands
	for w := range tier_0_corporate_gods {
		register(w, 94)
	}
	for w := range tier_0_web3_gods {
		register(w, 94)
	}
	for w := range tier_ai_tech_gods {
		register(w, 92)
	}
	for w := range tier_1_atlas {
		register(w, 86)
	}
	for w := range tier_2_wealth {
		register(w, 86)
	}
	for w := range KnownBrandEntity {
		register(w, 94)
	}

	// 3. Verified high-value sales & benchmark anchors
	for w, p := range HistoricalSales {
		if p >= 100000 {
			register(w, 96)
		} else if p >= 25000 {
			register(w, 90)
		} else if p >= 10000 {
			register(w, 84)
		}
	}
	for w, p := range ValuationAnchors {
		if p >= 40000 {
			register(w, 95)
		} else if p >= 10000 {
			register(w, 88)
		}
	}

	// 4. Essential Web3 & commercial headwords frequently targeted by phonetic/vowel-swap squatters
	coreCommercial := []string{
		"miner", "mining", "wallet", "crypto", "bitcoin", "tether", "telegram", "fragment",
		"toncoin", "market", "trader", "trading", "casino", "payment", "broker", "sniper",
		"hacker", "holder", "winner", "master", "legend", "empire", "palace", "global",
		"capital", "finance", "network", "agency", "studio", "durov", "solana", "binance",
		"coinbase", "kraken", "bybit", "notcoin", "banking", "banker", "founder", "builder",
	}
	for _, w := range coreCommercial {
		register(w, 95)
	}

	// Build O(1) phonetic skeleton index & O(L) SymSpell 1-delete index
	for w, auth := range canonicalAuth {
		skel := phoneticRadioSkeleton(w)
		if skel != "" {
			cur, exists := skeletonIndex[skel]
			if !exists || auth > cur.authority || (auth == cur.authority && len(w) < len(cur.word)) || (auth == cur.authority && len(w) == len(cur.word) && w < cur.word) {
				skeletonIndex[skel] = canonicalCandidate{word: w, authority: auth}
			}
		}
		if auth >= 80 && len(w) >= 5 {
			for i := 0; i < len(w); i++ {
				del := w[:i] + w[i+1:]
				delete1Index[del] = append(delete1Index[del], canonicalCandidate{word: w, authority: auth})
			}
		}
	}
}

func isImmunePrimaryHeadword(u string) bool {
	if _, ok := ValuationAnchors[u]; ok {
		return true
	}
	if p, ok := HistoricalSales[u]; ok && p >= 5000 {
		return true
	}
	if CheckTier(u).Tier <= 4 {
		return true
	}
	if KnownBrandEntity[u] != "" || IsHyped(u) {
		return true
	}
	if r := RankWord(u); r > 0 && r <= 8500 {
		return true
	}
	// Protect genuine 2-word compounds where each word is >= 4 letters (e.g. "cryptoking", "goldmine"),
	// avoiding 3+3 syllable accidents like "bitcon" (bit+con) or "notcon" (not+con).
	v := ViterbiSegmentUsername(u)
	if v.IsCleanCompound && v.CoverageRatio >= 1.0 && len(v.Tokens) == 2 && len(v.Tokens[0]) >= 4 && len(v.Tokens[1]) >= 4 {
		if RankWord(v.Tokens[0]) > 0 && RankWord(v.Tokens[1]) > 0 {
			return true
		}
	}
	return false
}

// DetectTypoOrPhoneticShadow checks in O(L) time whether username is a typo or phonetic Radio-Test shadow
// of a higher-authority canonical word or brand.
func DetectTypoOrPhoneticShadow(username string) TypoShadowResult {
	u := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(username), "@"))
	if len(u) < 4 || len(u) > 14 {
		return TypoShadowResult{}
	}
	for i := 0; i < len(u); i++ {
		if u[i] < 'a' || u[i] > 'z' {
			return TypoShadowResult{}
		}
	}

	typoShadowOnce.Do(initTypoShadowIndex)

	if isImmunePrimaryHeadword(u) {
		return TypoShadowResult{}
	}

	// 1. Phonetic Radio-Test Skeleton Match (catches mainer->miner, krypto->crypto, kazino->casino, walet->wallet, kash->cash)
	skel := phoneticRadioSkeleton(u)
	if skel != "" {
		if cand, ok := skeletonIndex[skel]; ok && cand.word != u && cand.authority >= 84 {
			if absInt(len(u)-len(cand.word)) <= 2 {
				return TypoShadowResult{
					IsShadow:           true,
					CanonicalWord:      cand.word,
					ShadowType:         "phonetic_radio_test_shadow",
					CanonicalAuthority: cand.authority,
				}
			}
		}
	}

	// Short 4-letter handles retain 4-char protocol scarcity unless direct phonetic homophones above
	if len(u) < 5 {
		return TypoShadowResult{}
	}

	var best canonicalCandidate

	consider := func(cand canonicalCandidate, sType string) string {
		if cand.word == u || cand.authority < 82 {
			return ""
		}
		if cand.authority > best.authority || (cand.authority == best.authority && cand.word < best.word) {
			best = cand
			return sType
		}
		return ""
	}
	bestType := ""

	// 2A. Query has 1 extra character inserted (e.g. "mainer" -> delete 'a' -> "miner", "walllet" -> "wallet")
	for i := 0; i < len(u); i++ {
		// Do not penalize clean English pluralization (-s) or regular past tense (-ed)
		if i == len(u)-1 && ((u[i] == 's' && u[len(u)-2] != 's') || (u[i] == 'd' && u[len(u)-2] == 'e')) {
			continue
		}
		del := u[:i] + u[i+1:]
		if auth, ok := canonicalAuth[del]; ok && auth >= 82 {
			if t := consider(canonicalCandidate{word: del, authority: auth}, "extra_char_typo_shadow"); t != "" {
				bestType = t
			}
		}
	}

	// 2B. Query is missing 1 character (e.g. "bitcon" -> "bitcoin", "teleram" -> "telegram", "walet" -> "wallet")
	if cands, ok := delete1Index[u]; ok {
		for _, c := range cands {
			if t := consider(c, "missing_char_typo_shadow"); t != "" {
				bestType = t
			}
		}
	}

	// 2C. Adjacent transposition (e.g. "crpyto" -> "crypto", "wallte" -> "wallet")
	buf := []byte(u)
	for i := 0; i < len(buf)-1; i++ {
		if buf[i] == buf[i+1] {
			continue
		}
		buf[i], buf[i+1] = buf[i+1], buf[i]
		swapped := string(buf)
		if auth, ok := canonicalAuth[swapped]; ok && auth >= 82 {
			if t := consider(canonicalCandidate{word: swapped, authority: auth}, "transposition_typo_shadow"); t != "" {
				bestType = t
			}
		}
		buf[i], buf[i+1] = buf[i+1], buf[i]
	}

	// 2D. Same-length 1-character confusable substitution (e.g. "markit" -> "market", "durow" -> "durov", "tethir" -> "tether")
	for i := 0; i < len(u); i++ {
		del := u[:i] + u[i+1:]
		if cands, ok := delete1Index[del]; ok {
			for _, c := range cands {
				if len(c.word) == len(u) && c.word != u && c.authority >= 86 {
					if hasSingleConfusableSubstitution(u, c.word) {
						if t := consider(c, "confusable_substitution_shadow"); t != "" {
							bestType = t
						}
					}
				}
			}
		}
	}

	if best.word != "" {
		return TypoShadowResult{
			IsShadow:           true,
			CanonicalWord:      best.word,
			ShadowType:         bestType,
			CanonicalAuthority: best.authority,
		}
	}

	return TypoShadowResult{}
}

func phoneticRadioSkeleton(s string) string {
	r := s
	replacer := strings.NewReplacer(
		"ai", "i",
		"ay", "a",
		"ey", "a",
		"ea", "e",
		"ee", "i",
		"ie", "i",
		"oo", "u",
		"ou", "o",
		"ph", "f",
		"ck", "c",
		"qu", "cw",
	)
	r = replacer.Replace(r)

	out := make([]byte, 0, len(r))
	for i := 0; i < len(r); i++ {
		ch := r[i]
		switch ch {
		case 'k':
			ch = 'c'
		case 'z':
			ch = 's'
		}
		if len(out) > 0 && out[len(out)-1] == ch {
			continue
		}
		out = append(out, ch)
	}
	return string(out)
}

func hasSingleConfusableSubstitution(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	diffCount := 0
	var c1, c2 byte
	for i := 0; i < len(a); i++ {
		if a[i] != b[i] {
			diffCount++
			if diffCount > 1 {
				return false
			}
			c1, c2 = a[i], b[i]
		}
	}
	if diffCount != 1 {
		return false
	}
	if c1 > c2 {
		c1, c2 = c2, c1
	}
	isV1 := c1 == 'a' || c1 == 'e' || c1 == 'i' || c1 == 'o' || c1 == 'u' || c1 == 'y'
	isV2 := c2 == 'a' || c2 == 'e' || c2 == 'i' || c2 == 'o' || c2 == 'u' || c2 == 'y'
	if isV1 && isV2 {
		return true
	}
	switch {
	case c1 == 'c' && c2 == 'k',
		c1 == 'c' && c2 == 's',
		c1 == 's' && c2 == 'z',
		c1 == 'f' && c2 == 'v',
		c1 == 'v' && c2 == 'w',
		c1 == 'b' && c2 == 'p',
		c1 == 'd' && c2 == 't',
		c1 == 'g' && c2 == 'j',
		c1 == 'm' && c2 == 'n':
		return true
	}
	return false
}

func absInt(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
