# Fragment / Telegram Gifts / TON NFT — competitor research

**Scope.** Public GitHub and web sources were checked for active, technically useful projects around Fragment usernames and anonymous numbers, Telegram collectible gifts, and TON NFTs. “Active” here means a live product, a repository with recent commits/releases/issues, or a maintained data/API surface. Projects that are famous but archived/stale were excluded from the main benchmark. Capabilities below are source claims; proposed product implications are explicitly marked as recommendations.

## Executive takeaways

1. **The strongest open-source primitives are indexing + typed parsing, not marketplace UI.** `toncenter/ton-indexer` provides the full ingest/parse/store/API pattern; `tonindexer/anton` adds schema-driven contract interfaces, parsed operations, account state and historical aggregates; `@ton/core`/`@ton/ton` are the maintained low-level TypeScript stack.
2. **Gifts are the most mature analytics opportunity.** GMC, Gift Asset and GiftAsset MCP expose multi-market floors, market-cap/supply, collection/model traits, history, profile valuation and marketplace comparisons. Those are strong references, but their freshness, methodology and licensing must be treated as data dependencies—not copied as facts without provenance.
3. **Fragment remains the benchmark for usernames/numbers and authoritative listing state.** Its live pages expose marketplace sorting (price high/low, recently listed, ending soon), auction countdowns, current/minimum bid and direct asset pages. Public clients/scrapers show that username, number and gift detail/history can be normalized, but they depend on an unofficial/private web surface and should be isolated behind a connector.
4. **UX gap worth exploiting:** combine an evidence-first single-item page (on-chain identity, current listing, sale/bid/owner history, source freshness and cross-market comparison) with collection analytics (floors, depth, realized sales, rarity methodology, supply/holders). Avoid presenting a single “fair value” as fact; show source and confidence.

## Shortlist: active or live competitors and reusable patterns

### 1) Explorers / indexers / data backends

| Project | URL | Activity / maintenance signal | Tech / useful pattern | License | What to adapt |
|---|---|---|---|---|---|
| TON Indexer | [github.com/toncenter/ton-indexer](https://github.com/toncenter/ton-indexer) | Public repository; README describes a multi-service production architecture (index worker, PostgreSQL, REST API, event classifier, metadata fetcher); search result has current project docs and no archived flag. | Reads TON node RocksDB, transforms raw blocks/transactions/messages, classifies traces into actions, stores accounts/NFTs/jettons/actions in PostgreSQL; optional metadata/imgproxy services. | **Not surfaced in the checked result; verify `LICENSE` before copying code.** | Separate ingestion, normalization, action classification and read API. Keep raw message/trace evidence beside derived sale/transfer events; isolate metadata fetchers for SSRF/privacy controls. |
| Anton TON indexer | [github.com/tonindexer/anton](https://github.com/tonindexer/anton) | Repository presents a maintained open-source indexer; API docs include contract interfaces and aggregate history; no archived signal in the result. | JSON contract-interface schemas select contracts by get-methods/code hash/address, parse message opcodes and state, rescan after schema changes; REST filters and time-series aggregates. | **Not surfaced in checked result; verify repository LICENSE.** | Use versioned parser schemas, contract/code-hash provenance, rescans, and aggregate endpoints for collection floors/holders/activity. This is the clearest pattern for supporting new gift/market contracts without hard-coding every UI field. |
| TON Studio ETL | [github.com/ton-studio/ton-etl](https://github.com/ton-studio/ton-etl) | Repository documents a real ETL pipeline and parser deployment model; live source result. | Ton-index-worker → Postgres → Debezium/Kafka → parsers → S3/data lake; includes NFT transfers, Getgems sales/auctions and `nft_history`. | **Not surfaced in checked result; verify LICENSE.** | Adopt append-only event/history tables and replayable parsers. Useful if product needs time-series valuation or backfills rather than only latest state. |
| TON HTTP API v4 | [github.com/ton-community/ton-api-v4](https://github.com/ton-community/ton-api-v4) | 109 stars / 29 forks / 8 open issues; MIT; active-looking `main` API project (created 2022). | CDN-friendly HTTP API for blocks, account state, get-method execution and WebSocket block watch; public mainnet/sandbox endpoints documented. | [MIT](https://github.com/ton-community/ton-api-v4/blob/main/LICENSE) | Keep a provider abstraction for block/account reads and websocket head updates; use it as a fallback or testnet source, not as the sole marketplace-history source. |
| Tonscan | [github.com/catchain/tonscan](https://github.com/catchain/tonscan), [live site](https://tonscan.org) | 212 stars / 67 forks / 25 open issues; homepage is live; org metadata shows tonscan last updated 2025-03-25 and address-book updates in 2026; README warns repository is a mirror and may lag production. | Vue explorer; TON Center + DYOR + Typesense search; address book; live site has stats, tokens, apps, whales and links to source/API. | **Other / not an OSI license in GitHub metadata** | Benchmark obvious search/SEO entry points, token/whale/app discovery and address labels. Do not assume mirror code equals production behavior; verify current API contracts. |

### 2) Marketplaces and Fragment connectors

| Project / product | URL | Activity / maintenance signal | Tech / useful pattern | License | What to adapt |
|---|---|---|---|---|---|
| Fragment | [fragment.com/username](https://fragment.com/username) | Live marketplace page returns current auction rows/countdowns and prices during research. | Native username marketplace: auction/sale states, minimum bid, USD conversion, sort by high/low/recent/ending; Telegram asset identity and `t.me` links are first-class. | **Proprietary service; no reuse license.** | Match fast list-to-detail flow and visible state/countdown. Add provenance and analytics Fragment itself does not need to expose. Do not scrape credentials or replicate transaction/auth flows without permission. |
| Fragment API Python client | [github.com/S1qwy/fragment-api-py](https://github.com/S1qwy/fragment-api-py/blob/main/DOC.md) | Public docs enumerate a fairly complete client surface; activity date/license were not reliably surfaced in checked result. Treat as connector reference, not dependency health proof. | Search usernames/numbers/gifts; detail objects with auction, bids, owner history; pagination offsets; asset transfer/history methods. | **Not surfaced; verify repository LICENSE.** | Define a canonical `Asset`, `Listing`, `Bid`, `OwnershipEvent` model that supports all three Fragment verticals. Build a rate-limited connector with cache and schema drift tests. |
| Fragment API Go client | [github.com/Locon213/gofragment](https://github.com/Locon213/gofragment) | Public repository README exposes raw Fragment calls plus three TON providers; activity/license not surfaced in checked result. | Search marketplace for usernames, numbers and gifts; raw API escape hatch; TonAPI/Toncenter/liteclient provider choice. | **Not surfaced; verify repository LICENSE.** | The provider interface (direct lite client vs indexed API) is useful for resilient wallet/address verification. Never place seed/cookie handling in the analytics web tier. |
| Fragment scraper/API actor | [Apify Fragment scraper](https://apify.com/apipi/ton-fragment-scraper/api/openapi) | Live public API documentation; not a GitHub project and not necessarily open-source. | Bulk username/number filters and sort; collection and item gift endpoints; detailed bids, ownership history, traits, floors and auction state. | **Commercial/hosted actor; license not established.** | Treat bulk endpoint shape as an ingestion contract and maintain `source_updated_at`, scrape timestamp, page URL and raw payload hash. Do not assume scraped fields are canonical. |
| Getgems | [getgems.io](https://getgems.io), [Fragment collection example](https://getgems.io/collection/EQAY84Yz9cqWle5bQpZ9R7pf2n1BJATPrg6zto616F1T1ouC) | Live marketplace homepage during research; active collection pages. | Fixed-price and auctions; collection/item discovery; homepage exposes lucky-buy/deal-like cards, top collections by period, top auctions, bundles and TON/Stars promotion. Getgems’ own rarity documentation explains its score is subjective and lower score means rarer. | **Proprietary service; no reuse license.** | Adapt period tabs, collection ranking, deal cards and explicit rarity methodology/disclaimer. Keep marketplace execution links external unless formally integrated. |

### 3) Price history, portfolio and cross-market analytics

| Project / product | URL | Activity / maintenance signal | Tech / useful pattern | License | What to adapt |
|---|---|---|---|---|---|
| GiftMarketCap (GMC) | [gmc.mystars.tg](https://gmc.mystars.tg/), [portfolio](https://gmc.mystars.tg/portfolio), [marketplaces](https://gmc.mystars.tg/marketplaces), [trending](https://gmc.mystars.tg/trending) | Live tracker pages show hourly-refresh claims, collection rankings and portfolio pages during research. | Aggregates 7 venues; collection floor, market cap, volume, supply, 24h change, rarity/deals; portfolio uses manually added holdings and floor-based unrealized P&L; marketplace page explains on-chain vs custodial venue/currency differences. Trending explains gainers/losers and “most active” methodology. | **Proprietary web product; no public reuse license found.** | Copy the *disclosure pattern*: define floor as cheapest active listing, market cap formula, refresh interval, venue/custody/currency and trend qualification. Add source-by-source rows and confidence instead of hiding aggregation. |
| Gift Asset API | [github.com/GIFT-ASSET/gift_asset_api](https://github.com/GIFT-ASSET/gift_asset_api), [docs](https://giftasset.gifts/docs), [site](https://giftasset.dev/) | 3 stars / 0 forks; created 2025-10-11; 51 contributions by primary contributor shown; README says core API, multi-market aggregation and live sales stream are live. | Unified Telegram gift API: metadata/rarity/supply, real-time multi-market prices, user inventories, live sales, media assets and widgets. | **No license surfaced in checked GitHub result; treat as all-rights-reserved until verified.** | Use endpoint/domain concepts (collection, model, traits, provider floor, sales stream, profile valuation) as requirements. Do not copy code/data or imply API SLA without terms. |
| GiftAsset MCP | [github.com/GIFT-ASSET/giftasset_mcp](https://github.com/GIFT-ASSET/giftasset_mcp) | Repository published 2026-02-22 in search result; public tool catalog. | MCP tools for market actions, aggregated filters, unique/last sales, 24h/7d history, user inventory/profile valuation, collection emission/market cap/health/greed and provider volumes. | **License not surfaced; verify before reuse.** | Design internal analytics service around small composable queries, but show each metric’s definition and sample window. The health/greed indices must be labeled vendor-derived, not universal truth. |
| Morgan gift plugins | [github.com/kloveren/morgan-gift-plugins](https://github.com/kloveren/morgan-gift-plugins) | 0 stars / 5 open issues; v1.1.0 in March 2026; README says multi-source analytics and daily SQLite snapshots. Small project, but recent release signal. | Teleton plugins combine GetGems, MarketApp, Giftstat, Fragment and other venues; price compare; floor history; model/backdrop/symbol traits; whale accumulation/PNL; z-score anomaly and wash-trade heuristics; SQLite delta snapshots. | [MIT](https://github.com/kloveren/morgan-gift-plugins/blob/main/LICENSE) | Adapt daily snapshots/deltas, provider comparison and “heuristic” labels. Avoid presenting z-score/wash-trade heuristics as adjudicated facts. |
| TelegramGifts Python SDK | [github.com/ssamy2/TelegramGifts](https://github.com/ssamy2/TelegramGifts), [license](https://github.com/ssamy2/TelegramGifts/blob/main/LICENSE) | 2 stars / 0 issues; repository created 2026-06-19 and commit `c9c9850` same day in search result; very new/small, so active signal is recent but maturity is unproven. | Cached GitHub-hosted dataset; unified lookup for regular/upgraded gifts, model attributes/custom emoji/backdrops, Fragment/GetGems/TGMrkt prices, WebP/TGS asset download; no bot token claim. | [MIT](https://github.com/ssamy2/TelegramGifts/blob/main/LICENSE) | Adapt normalized gift/model/backdrop/symbol schema, ETag caching and offline media fallback. Add a source-health badge because a synchronized dataset can lag markets. |
| Dune TON Gifts dashboards | [pascal04/ton-gifts-the-economy](https://dune.com/pascal04/ton-gifts-the-economy), [Howard Peng dashboard](https://dune.com/howard_peng/telegram-gifts) | Public dashboards with query-backed widgets; data coverage/methodology visible in dashboard text, but query freshness/status must be checked before production use. | On-chain volume/users/marketplace mix, wallet age/retention, largest sales, FDV, supply and 7-day floor trends. | Dune dashboard/content terms; not a code license. | Benchmark analyst views and cohort/retention panels. Label on-chain-only versus off-chain/custodial data and never merge them silently. |

### 4) Rarity / trait analytics

| Project / product | URL | Activity / maintenance signal | Tech / useful pattern | License | What to adapt |
|---|---|---|---|---|---|
| Getgems rarity | [Getgems rarity explanation](https://getgems.helpscoutdocs.com/article/31-what-does-rarity-score-mean) | Official help article was updated 2025-09-22 (as shown by source). | Product explains rarity as a collection-relative score: attribute frequencies multiplied, normalized so 1 is rarest, with mint-order tie-break; explicitly warns it is subjective and missing traits matter. | Proprietary methodology/content. | Show raw trait frequency, formula/version, missing-trait treatment and tie-break—not only one opaque rank. |
| GMC rarity/deals | [GMC](https://gmc.mystars.tg/) | Live pages claim a rarity score for every gift and automatic undervaluation/deal detection; hourly marketplace refresh claim. | Cross-market floor + trait/rarity + deal workflow. | Proprietary. | Separate rarity from market mispricing; define “deal” against model/collection floor and recent sale baseline with confidence and minimum sample size. |
| Gift Asset / GiftAsset MCP | [API repo](https://github.com/GIFT-ASSET/gift_asset_api), [MCP repo](https://github.com/GIFT-ASSET/giftasset_mcp) | Live docs/tool catalog and recent repo publication; exact production freshness not independently verified. | Rarity score, model/symbol/backdrop filters, attribute sales volume, collection health/greed. | Unknown / verify. | Add trait-level count, floor, sales count and spread to collection pages; put methodology/version next to every score. |
| Fragment scraper gift schema | [Apify docs](https://apify.com/apipi/ton-fragment-scraper/api/openapi) | Live API docs. | Collection details expose model/symbol/backdrop lists, counts, floor and rarity distribution; item details expose attributes/pricing/ownership history. | Hosted actor terms; not established. | Use a trait matrix and item-to-collection navigation, but keep fields source-tagged. |

### 5) Smart-contract parsing and TON SDKs

| Project | URL | Activity / maintenance signal | Tech / useful pattern | License | What to adapt |
|---|---|---|---|---|---|
| `@ton/core` | [github.com/ton-org/ton-core](https://github.com/ton-org/ton-core), [npm](https://www.npmjs.com/package/@ton/core) | npm result: v0.63.1, 206K weekly downloads, 294 dependents; releases through 2026-02-11 shown; MIT. | Cell/BOC, slices/builders, dictionaries, addresses, Merkle and transaction/state primitives. | [MIT](https://github.com/ton-org/ton-core/blob/main/LICENSE) | Use for deterministic address/BOC/opcode parsing and common TON types. Pin versions and add golden BOC fixtures. |
| `@ton/ton` | [github.com/ton-org/ton](https://github.com/ton-org/ton) | 238 stars / 76 forks / 56 issues; maintained main branch; npm result shows releases through 2026-06-01; MIT. | Cross-platform TON client, wallets, providers, get methods and transfers; pairs with `@ton/core`/`@ton/crypto`. | [MIT](https://github.com/ton-org/ton/blob/master/LICENSE) | Keep chain access and contract calls behind an adapter; use read-only clients in analytics workers and a separately reviewed signing service if ever needed. |
| TON TL-B parser | [github.com/ton-community/tlb-parser](https://github.com/ton-community/tlb-parser) | 27 stars / 10 forks / 4 issues; MIT; dependabot and several contributors. | Parse TL-B definitions into TypeScript AST/objects. | [MIT](https://github.com/ton-community/tlb-parser/blob/master/LICENSE) | Generate/validate parser code from schemas rather than scattering bit offsets across application code. |
| TON TL-B runtime | [github.com/ton-community/tlb-runtime](https://github.com/ton-community/tlb-runtime) | 13 stars / 1 fork / 3 issues; created 2025-08-25; MIT; main branch. | Runtime parse/serialize against TL-B schemas and BOC/Cell; documented Jetton example. | [MIT](https://github.com/ton-community/tlb-runtime/blob/main/LICENSE) | Useful for plugin-style message parsers and replayable schema evolution. |
| TON ABI catalog | [github.com/ton-blockchain/abis](https://github.com/ton-blockchain/abis) | 8 stars / 1 fork; repository result created 2026-05-23; catalog claims 283 contracts, 332 code hashes, 331 addresses; MIT. | Curated ABI/interface catalog, code hashes/addresses, opcodes/get-method names, fixtures and wrappers. | [MIT](https://github.com/ton-blockchain/abis/blob/master/LICENSE) | Seed known NFT/market interfaces and detect new contracts by code hash/opcode. Verify catalog freshness before production. |
| TON Cell ABI Viewer | [github.com/TrueCarry/ton-cell-abi-viewer](https://github.com/TrueCarry/ton-cell-abi-viewer), [demo](https://ton-cell-abi-viewer.vercel.app) | 15–16 stars / 10–11 forks / 0 issues; created 2025-03-26; current README documents build/test/typecheck. | Browser BOC inspector: tree/YAML/JSON, disassembly, custom TLB, opcode heuristics, strict/partial parse with provenance/warnings, explorer-link input. | [MIT](https://github.com/TrueCarry/ton-cell-abi-viewer/blob/main/LICENSE) | Adapt an “explain this event” drawer with raw cell, parser version, decoded fields and warnings. This is especially useful for disputed sale/transfer records. |
| `pytonapi` | [github.com/nessshon/tonapi](https://github.com/nessshon/tonapi) | 185 stars / 40 forks / 0 issues; MIT; Python REST/streaming/webhook SDK; docs and package install shown. | Accounts, NFTs, jettons, DNS, REST, SSE/WebSocket streaming and webhooks. | [MIT](https://github.com/nessshon/tonapi/blob/main/LICENSE) | Use streaming/webhooks for incremental item/owner updates and reindex queues, while preserving source response and ingestion time. |
| TON Center Python SDK | [github.com/nessshon/toncenter](https://github.com/nessshon/toncenter) | Public current SDK docs; REST v2/v3 and SSE/WebSocket examples for NFT, actions, traces and DNS. | Direct node REST plus indexed/enriched v3 endpoints and streaming. | **License not surfaced in checked result; verify LICENSE.** | Multi-provider fallback for chain reads, action/traces and NFT history. |

## Projects intentionally excluded from the active shortlist

- [ton-js/ton-index-sdk](https://github.com/ton-js/ton-index-sdk) is explicitly **ARCHIVED**, despite being a useful historical client for TON Index API; use `ton-org/ton` / current indexer APIs instead.
- [tonradar/tonrich](https://github.com/tonradar/tonrich) is a clever wallet-intelligence/browser-overlay reference (balance, NFT worth, spend/deposit rates, six-month activity) but its GitHub result shows last push **2023-12-03**; retain as UX inspiration, not active dependency.
- `tonwhales/ton-api-v4` is a fork; prefer upstream [ton-community/ton-api-v4](https://github.com/ton-community/ton-api-v4).
- Generic TON explorers/SDKs without a demonstrated tie to these verticals were not counted as direct competitors; they remain infrastructure references.

## UX / feature benchmark (what is actually visible)

### Fragment — usernames and anonymous numbers

- Live username page has a compact auction list with **price sorting (high/low), recently listed, ending soon**, minimum bid and live auction countdown/end timestamp ([Fragment](https://fragment.com/username)).
- The product’s strongest pattern is intent clarity: search/list → auction/sale state → bid/buy action. For anonymous numbers, use the same taxonomy but clearly expose number formatting, ownership/eligibility and privacy/security caveats.
- **Do not claim** Fragment has portfolio P&L, cross-market floor, trait rarity or open API merely because unofficial clients expose similar fields. Those belong in our analytics layer and must carry source labels.

### Getgems — TON NFT and gift marketplace

- Homepage visibly combines **Lucky Buys/deal-like cards, period tabs (1d/7d/30d/all time), top collections with floor and change, top auctions, bundles**, and gift/username categories ([Getgems](https://getgems.io)).
- Official rarity article is unusually transparent: it states the formula is subjective and discusses missing attributes and mint-order tie-breaks ([rarity article](https://getgems.helpscoutdocs.com/article/31-what-does-rarity-score-mean)).
- Product implication: collection pages need a fast market summary plus a methodology drawer; item pages need an attribute comparison and source-linked history, not only a rarity badge.

### Tonviewer — explorer / wallet / NFT collection discovery

- Live home exposes TON price/market cap/TPS, wallet/DeFi discovery, username auctions, and transfer/account/transaction-type stats ([Tonviewer](https://tonviewer.com/)).
- NFT index visibly lists Telegram gifts, anonymous numbers and usernames with total volume, item count, floor and collection address ([Tonviewer NFT index](https://tonviewer.com/nfts)).
- Wallet pages expose balances, tokens, collectibles, contract type/activity and suspicious/scam labels in observed pages; the public SDK pattern adds wallet transactions/actions, bulk NFT fetch, collection grouping and floor-based value summary ([Tonviewer SDK](https://github.com/DevZ44d/Tonviewer)).
- Product implication: use explorer-grade evidence and scam/unknown labels; do not turn floor × count into a definitive portfolio valuation—call it an estimate with liquidity assumptions.

### Tonscan — broad explorer/search

- Live home has stats, tokens/market, apps, richest addresses and a public GitHub/API link ([Tonscan](https://tonscan.org)).
- Repository README documents Typesense search, TON Center/DYOR inputs and an address-book workflow ([Tonscan repo](https://github.com/catchain/tonscan)); its own README says the repo is a mirror and may not match production.
- Product implication: borrow the universal address/collection/transaction search and human-readable labels; avoid copying stale UI/backend assumptions.

### Gift analytics / marketplaces

- GMC’s live pages emphasize **market-cap ranking, cross-market floors, hourly refresh, portfolio cost/P&L, marketplace/custody/currency comparison and trend methodology** ([GMC home](https://gmc.mystars.tg/), [portfolio](https://gmc.mystars.tg/portfolio), [marketplaces](https://gmc.mystars.tg/marketplaces), [trending](https://gmc.mystars.tg/trending)).
- Gift Asset’s public API positioning is unified metadata + prices + sales stream + user inventory ([repo](https://github.com/GIFT-ASSET/gift_asset_api)); MCP catalog adds history, profile valuation, collection health/greed and provider volume ([MCP](https://github.com/GIFT-ASSET/giftasset_mcp)).
- **Methodology warning:** these are useful benchmarks, not independent truth. Floors can be thin/manipulable; custodial venues and on-chain venues are not equivalent; “health,” “greed,” rarity and estimated portfolio value need formula, timestamp, sample size and source disclosure.

## Recommended collection and single-item pages (add/remove) — all three verticals

### A. Fragment usernames and anonymous numbers

**Collection/list page — add**
- Separate tabs: `Usernames` / `Anonymous numbers`; status filters `auction`, `fixed sale`, `available`, `sold` and an explicit “not found/redirected” state.
- Sort/filter by current price, minimum bid, ending soon, recently listed, character count/pattern, premium words, number pattern, and verified source.
- Show floor/median/volume only when a defined sample exists; include 24h/7d realized sales and listing depth rather than only cheapest listing.
- Show source timestamp, TON/USD conversion timestamp, pagination cursor and a “Fragment source” badge.
- Add saved search/price alert and compare up to 3 assets; deep link to Fragment for execution.

**Collection/list page — remove/avoid**
- Remove a generic NFT rarity score for usernames/numbers; linguistic or numeric desirability is not a universal trait-frequency rarity metric.
- Remove unqualified “market cap” and P&L derived from all listings; use “indicative listing value” or realized-sales range.
- Do not expose anonymous-number login/session controls, cookie/seed fields or buy/bid execution in an analytics UI.

**Single-item page — add**
- Canonical identity: normalized username/number, Telegram link, Fragment URL, TON contract/address where available, status and auction clock.
- Current ask/highest bid/minimum next bid; bid and ownership history with dates, wallet links and source; sale/transfer vs listing events distinguished.
- Comparable panel: same character length/pattern/word class or number pattern; recent realized sales; listing depth; USD and TON with timestamp.
- “Why this estimate?” drawer with source freshness and confidence; copy/share links; alert button.

**Single-item page — remove/avoid**
- Do not imply owner identity beyond public wallet/address; do not store or request Telegram/Fragment session cookies.
- Do not show stale countdowns or convert an auction bid into a completed sale; preserve event type and finality.

### B. Telegram collectible gifts

**Collection page — add**
- Collection overview: issued/upgraded/on-chain/off-chain supply (separate), unique owners, active listings, listing depth, floor/median/volume and 24h/7d/30d changes.
- Cross-market table with each venue, currency, custody model, floor, listings, last refresh and link; show spread and “cheapest actionable listing.”
- Trait matrix for model/backdrop/symbol: supply %, floor, recent sales count, last sale, model floor, and rarity formula/version.
- History chart with raw data points, venue filters, realized sales vs listings, and anomaly/wash-trade warning as heuristic.
- Portfolio/watchlist with acquisition cost, current floor estimate, realized/unrealized P&L and clearly stated floor-based method.

**Collection page — remove/avoid**
- Remove one opaque rarity rank as the primary valuation signal; retain a score only with formula, version, sample and missing-trait behavior.
- Remove merged totals that mix Stars, TON, custodial balances and on-chain NFT sales; separate currency and settlement/custody.
- Remove “market cap” when supply or floor is stale/unknown; display `not enough data` rather than extrapolating.

**Single gift item page — add**
- Full media preview (static/animated where legal), collection/model/backdrop/symbol, serial/mint number, issuance and upgrade state.
- Trait rarity with collection counts; current listings by marketplace; last sale and comparable same-model/trait sales.
- Ownership/sale/transfer timeline, on-chain contract/address where upgraded, and links to each venue’s listing; show provenance and data age.
- “Deal” explanation (floor spread, model premium, recent-sales baseline, fees/custody) and user-controlled alert.

**Single gift item page — remove/avoid**
- Remove “guaranteed undervalued” language; use “screened opportunity” plus evidence and confidence.
- Do not claim ownership transfer for custodial marketplaces; show deposit/withdraw/custody status separately from blockchain owner.
- Do not display unverified asset media or trait metadata without a source and fallback/error state.

### C. General TON NFTs (including non-gift collections)

**Collection page — add**
- Contract address, verified/unverified/scam status, standard/interface/code-hash evidence, creator/royalty fields, supply, owners, holders concentration and active listings.
- Floor, realized volume, sales count, median, liquidity/listing depth and time-series; collection-vs-item filters; links to Getgems and explorer.
- Metadata health: on-chain/off-chain, last indexed, broken media count, parser version and reindex status.
- Trait/rarity panel only when metadata coverage is sufficient; expose formula and coverage denominator.

**Collection page — remove/avoid**
- Remove claims of “official” or “verified” based solely on name/logo; require address/code-hash or trusted registry evidence.
- Remove floor-based market cap for collections with low depth, mixed currencies or stale data; show an estimate range or `insufficient liquidity`.

**Single NFT page — add**
- Address, collection address, token index/serial, owner, current listing, contract type/interface, code hash and explorer links.
- Visual/media + raw metadata/attributes, parser provenance, warnings and fallback raw Cell/BOC view for developers.
- Event timeline: mint, transfers, sale/auction/bid, current owner, fees/royalties; distinguish indexed action from raw transaction and show confirmation/finality.
- Trait rarity, collection rank, comparable sales and marketplace links; scam/suspicious badge with reason and appeal/source link.

**Single NFT page — remove/avoid**
- Remove unsupported “fair value,” ownership certainty or creator verification. A parser match is not an authenticity guarantee.
- Avoid auto-loading arbitrary metadata URLs; use an isolated proxy, timeouts, allowlists/SSRF protection and cached media.
- Avoid mixing cached explorer values with real-time marketplace values without separate timestamps.

## Suggested architecture / data contracts

1. **Canonical entities:** `collection`, `item`, `asset_alias` (username/number/gift), `contract`, `listing`, `bid`, `sale`, `transfer`, `trait`, `holder`, `provider_snapshot`.
2. **Every derived number:** store `value`, `currency`, `venue`, `observed_at`, `ingested_at`, `source_url`, `methodology_version`, `sample_size`, `confidence` and (where possible) raw payload hash.
3. **Event precedence:** raw TON transaction/message → decoded action/contract parser → marketplace listing/sale connector → cross-market metric. Never overwrite raw evidence with a derived interpretation.
4. **Provider isolation:** Fragment/Getgems/web sources behind rate-limited connectors; TON Indexer/Anton/TON API/TON Center behind chain adapters; gift marketplace aggregators treated as external data providers with health checks.
5. **Parser safety:** schemas/code hashes/opcodes are versioned; unknown contracts remain visible as “unknown,” not silently classified. Add golden BOC tests and a reparse queue when parser schemas change.
6. **Trust UX:** `On-chain`, `Marketplace-reported`, `Estimated`, `Heuristic` badges; explicit “last updated”; stale-source and thin-liquidity warnings; link every important claim to a source or raw event.

## Limitations and unresolved points

- GitHub search snippets did not reliably expose a license for TON Indexer, Anton, TON ETL, Fragment clients/scraper or Gift Asset projects; these are marked **verify** rather than inferred as permissive.
- Live marketplace pages are dynamic and can change between fetches. Counts/prices shown in source extracts are observations, not durable market facts.
- Several recent dates shown by GitHub/search (including 2026) reflect the connected index’s current metadata. “Active” means a source-visible maintenance/live signal, not an SLA or security audit.
- This is a supported shortlist and UX benchmark, not an exhaustive scan of every TON/Gift project. In particular, production APIs of Fragment/Getgems/Tonnel/Portals/MRKT may be undocumented or access-controlled; no claim is made that every field in third-party clients is stable or authorized.
