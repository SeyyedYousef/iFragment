package handler

import _ "embed"

// premiumWhalesProofPNG embeds the @FragmentInvestors heavy-hitting whales & collectors roster screenshot
// so /premium always delivers a 2-photo album (generated analytical card + community social proof).
//
//go:embed assets/fragment_investors_whales.png
var premiumWhalesProofPNG []byte
