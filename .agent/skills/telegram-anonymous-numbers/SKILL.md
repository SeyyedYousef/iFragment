---
name: telegram-anonymous-numbers
description: 19-chapter comprehensive encyclopedia, architecture reference, and domain knowledge base for Telegram Anonymous Numbers (+888), Telemint smart contracts, mathematical valuation engine (NV Engine), realized sale price anchoring, and full-stack integration for iFragment.
---

# 📚 Telegram Anonymous Numbers (+888) — Hermes & Antigravity Domain Skill

> **Trigger:** Activate this skill whenever the user mentions "+888", "anonymous numbers", "شماره ناشناس", "شماره کلکسیونی", "NV Engine", "genesis numbers", or asks about Telegram number valuations, auctions, or sales.

---

## 1. Quick Reference & Core Architecture

- **Total Closed Supply:** Exactly **136,566** numbers minted in December 2022. No new numbers can ever be minted.
- **Telemint Collection Address:** `EQAOQdwdw8kGftJCSFgOErM1mXYYXPphTXjqIw35JGhJjpSf`
- **Genesis 4-Digit Club:** Only 1,000 numbers minted (`+888 8000` to `+888 8999`). Top rarity class in the world.
  - Floor: ~42,000 TON
  - All-Time High: +888 8888 (~800K+ TON), +888 8666 (666,666 TON), +888 8777 (651,358 TON).
- **Standard 8-Digit Numbers:** 135,566 numbers (`+888 XXXXXXXX`).
  - Secondary Floor: ~2,450 TON (2026 live market).
- **Marketplace Deep-Link Protocol:**
  - Standard Fragment number URL is: `https://fragment.com/number/<all_digits_including_888>`
  - E.g.: `https://fragment.com/number/8888777` or `https://fragment.com/number/88807778777`.
  - NEVER strip `888` when creating Fragment URLs!

---

## 2. Invariants & Realized Sale Anchoring Protocol

1. **Floor Clamp:** No number in a closed collection trades below its market floor.
2. **Realized Sale Price Anchor:**
   - If an asset has a verified on-chain sale with price $P_{\text{last}}$, the algorithm MUST NOT value it below $P_{\text{last}}$:
     $$\text{ExpectedTON} \ge P_{\text{last}} \times (1 + 0.15)^{\Delta t}$$
     $$\text{LowTON} \ge P_{\text{last}}$$
     $$\text{PriceBasis} = \text{"exact\_asset\_realized\_sale\_anchor"}$$
3. **Strict Gate / Zero Price Leakage:**
   - Free users get Curiosity Gate only (analyzed signals count, risk counts). Never leak expected price or bounds before paywall unlock.

---

## 3. Reference Encyclopedia

For the complete 19-chapter encyclopedia covering:
- Mathematical feature vectors & Shannon entropy
- DialPad spatial ergonomics
- 19 Official NFT colors and hedonic multipliers
- Regional cultural weights (Fa, Jiu, Liu, Si, Barakah)
- Rental yield cash flow & DeFi collateral (LTV) models
- Weibull survival liquidation timelines
- Database schema and indexer architecture

👉 Read: [telegram_anonymous_numbers_encyclopedia.md](file:///c:/Users/DEll/Desktop/iFragment/docs/telegram_anonymous_numbers_encyclopedia.md)

---

## 4. AI Maintenance & Update Rule

Whenever modifying any code in:
- `backend/internal/service/numbers/...`
- `backend/internal/repository/numbers_repo.go`
- `frontend/src/pages/numbers/...`
- `frontend/src/entities/numbers/...`

You MUST update [telegram_anonymous_numbers_encyclopedia.md](file:///c:/Users/DEll/Desktop/iFragment/docs/telegram_anonymous_numbers_encyclopedia.md) to keep this technical truth source perfectly synchronized.
