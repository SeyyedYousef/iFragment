# Telegram Gifts/NFT vertical audit

**Scope.** Read-only audit of the Gifts/NFT vertical: catalog/collection list and intelligence, single-gift gate/valuation/enriched report, GV engine, traits/rarity, serials, crafting EV, venues, portfolio, charts, API/router/OpenAPI, persistence and migrations, ingestion/seeding, webhook/bot, frontend, tests, and Gifts documentation. Evidence is from the checked-out source; no production database or external API response was available. No code was changed.

## Executive result

The vertical has a good separation between a curiosity gate and a purchased report, and it contains explicit `data_status`/freshness fields in several response types. However, the current implementation can persist and present fabricated market rows as verified/live, accepts unknown or impossible gifts, ranks unavailable venues as actionable exits, and displays hard-coded UI values as exact/verified. These are release-blocking for a valuation product.

Severity: **P0** blocks release / can materially mislead or corrupt financial output; **P1** high correctness or contract risk; **P2** material UX/documentation/test gap.

## Page-specific review and priority matrix

### Collection page / collection intelligence surface

**Primary files and API path:** `frontend/src/pages/gifts/collection/ui/GiftCollectionPage.tsx:53-61,737-738,1711`; `GiftFloorChart.tsx`; `CollectionRarityHeatmap.tsx`; `frontend/src/entities/gifts/api/giftsApi.ts:98-107`; `backend/internal/handler/gifts_handler.go:282-312`; `backend/internal/service/gifts/collection_intel.go:400-1333`.

| Priority | Finding IDs | Collection-page impact |
|---|---|---|
| **P0** | GFT-001, GFT-002, GFT-004, GFT-006, GFT-008 | Catalog/market cards can display seeded or static prices as live; stale/unavailable venues can become floors or ranked exits; USD/rate units are inconsistent. |
| **P1** | GFT-005, GFT-011, GFT-016, GFT-017, GFT-018, GFT-020 | Model floors and heatmap cells inherit collection floor; rarity is marked verified without trait-instance evidence; schema/API/source contracts are incomplete; dynamic trait misses receive synthetic values. |
| **P2** | No additional P2-only defect identified | Existing collection tests cover empty-DB truthfulness but do not cover populated synthetic seed rows, stale status boundaries, frontend status rendering, or catalog-source conflicts. |

**Collection-page acceptance tests:**

1. **Catalog 120 contract:** enumerate all 120 IDs from backend canonical metadata, frontend catalog, `catalog120_full.json`, `catalog120_generated.json`, and `primary_models.json`; fail on missing/duplicate IDs, name/model mismatch, or supply mismatch. No static `floorTon` may reach a displayed floor.
2. **Empty/source-outage page:** with no snapshots/listings/history and all adapters unavailable, `/gifts/collections` and `/gifts/collection-intel?c=plush_pepe` return `data_status=unavailable`, null floors, empty `top_floor_items`, empty `floor_history`, no search items, no real-volume badge, and no synthetic upgrade ladder.
3. **Freshness boundaries:** fixtures at `<5m`, exactly `5m`, `<30m`, exactly `30m`, `<6h`, exactly `6h`, and future timestamps must render `live`, `delayed`, `stale`, or `unavailable` consistently; unavailable/stale data cannot be selected as best floor/arbitrage.
4. **Model/heatmap evidence:** a collection with one model listing must not assign that price to other models or every model×backdrop cell. Catalog-derived rarity must be `estimated`/`catalog`, never `verified`, unless instance-level evidence exists.
5. **Chart integrity:** `GiftFloorChart` receives only timestamped verified history; no synthetic point is generated when `floor_history` is absent. USD toggle is disabled/null when its rate is missing or stale.
6. **Venue status:** unavailable venues are not ranked as collection opportunities; static registry fee/slippage values cannot create an actionable floor or “real volume” badge.

### Single-item page / gate, valuation, and enriched report surface

**Primary files and API path:** `frontend/src/pages/gifts/report/ui/GiftReportPage.tsx:71-121,431-596,853-1504`; `GiftValuationPillarsCard.tsx`; `frontend/src/entities/gifts/api/giftsApi.ts:20-45,110-116`; `backend/internal/handler/gifts_handler.go:49-163`; `backend/internal/service/gifts/gvengine/gvengine.go:87-828`; `backend/internal/service/gifts/gifts_service.go:583-998`.

| Priority | Finding IDs | Single-item-page impact |
|---|---|---|
| **P0** | GFT-003, GFT-006, GFT-008, GFT-009, GFT-010, GFT-012 | Unknown/impossible items can be valued; valuation uses silent rate fallbacks; unavailable venues appear actionable; coin/credit unlocks are not atomic; report UI displays placeholder certificate and hard-coded rarity/trait values. |
| **P1** | GFT-007, GFT-011, GFT-013, GFT-015, GFT-018, GFT-019 | Confidence/exactness can exceed evidence; crafting EV is empirical but presented as a recommendation; provenance/custody/authenticity are inferred or mislabeled; auth/OpenAPI/docs diverge. |
| **P2** | No additional P2-only defect identified | Existing single-item tests cover gate leakage and some deterministic invariants, but not malformed provenance, partial resolver responses, missing API fields, UI placeholders, or concurrent unlock failure paths. |

**Single-item acceptance tests:**

1. **Identity gate:** `non_existent_fake_model-1`, serial 0/negative, and serial greater than authoritative supply return 404/422 and never produce expected value, rarity, certificate, portfolio value, or marketplace links. A resolver timeout yields `instance_traits=unknown`, not exact defaults.
2. **Paywall truthfulness:** guest/unpurchased requests receive only the curiosity gate; no expected/low/high price, comps, exit planner, certificate, or provenance leaks. Purchased reports return the saved snapshot only within the entitlement window.
3. **Valuation evidence:** every expected value has model version, rate source/timestamp, floor/comparable IDs, sample/effective sample size, confidence calibration version, and explicit basis. No `$1.42`/`$5.20` fallback is emitted as live evidence.
4. **Traits/rarity:** missing model/backdrop/symbol/permille is `unknown`/`estimated`; no “exact data” badge, invented 10% permille, default `Obsidian Matrix`/`Aero Crest`, or hard-coded UI rarity (`85.4`, `80`, `1.42e-4`, `11.84 bits`) is rendered.
5. **Serial:** serial identity is verified independently from the collection supply; serial classification may be shown as a heuristic only and must not override observed market evidence or claim “out of total supply” for impossible IDs.
6. **Venue/provenance:** a venue option is actionable only with fresh listing/floor/volume, valid deep link, and source timestamp; sale rows say `verified_tx` only after transaction/event lookup, not merely because a URL can be formed. Owner/custody badges stay unknown until chain/indexer evidence is validated.
7. **Unlock atomicity:** coin and credit debit plus report persistence occur in one transaction/reservation; concurrent requests yield one entitlement; forced valuation/insert/commit failures leave no debit and no report.
8. **Frontend no-placeholder snapshot:** locked, partial, unavailable, and malformed reports contain no `CERT-GF-8839`, 5,000/45 fallback, hard-coded rarity numbers, or “verified” badge. Missing projections/venue options render unavailable and never as zero-valued recommendations.

### Cross-page data ownership rules

- **Collection page owns:** collection-level catalog metadata, collection supply, aggregate floor/volume/listings, model/trait catalogs, collection history, and collection-level venue freshness. It must not invent an individual NFT serial, trait combination, sale, or model floor.
- **Single-item page owns:** one gift’s verified identity, serial, on-chain/in-app state, exact instance traits, comparable sales, valuation, exit plan, crafting/upgrade advice, and provenance. It must not inherit a collection static floor or static trait values as if they were item evidence.
- **Shared contract:** both surfaces must use the same canonical 120 metadata source, same TON/GRAM unit, same rate source/timestamp, same freshness vocabulary (`live`, `delayed`, `stale`, `unavailable`), and same provenance model. Collection-level estimates cannot be promoted to item-level exactness, and item-level evidence cannot silently rewrite collection aggregates.

### Priority release order

1. **P0 release blockers:** quarantine/remove synthetic seed and UI fallbacks; reject unknown/impossible items; make venue ranking evidence-gated; fix currency/rate consistency; make coin/credit unlock atomic; remove placeholder/false exactness from single-item UI.
2. **P1 correctness gate:** reconcile catalog/supply sources; correct model/heatmap rarity status; add provenance/schema constraints; fix adapter/source-health behavior; align OpenAPI/docs; label risk/authenticity/crafting outputs according to evidence.
3. **P2 hardening:** expand frontend snapshots, contract tests, stale/failure UX, and documentation/build checks after P0/P1 behavior is corrected.

## Findings

### GFT-001 — Synthetic seed/ingestor market data is persisted as verified and then consumed as live (P0)

- **Evidence:** `backend/internal/service/gifts/gifts_service.go:63-68` starts `EnsureCanonicalDataSeeded` asynchronously at service construction. `backend/internal/service/gifts/seeder/seeder.go:186-203` contains hard-coded venue floors, listing counts, and 24h volumes for 16 collections; `:218-235` persists them with `UpdatedAt=now` and `HasRealVolumeBadge: true`; `:239-256` creates a sale with fabricated addresses (`EQB...`, `EQC...`) and a fabricated-looking `TxHash`, marks it `PriceConfidence: "exact"`, and gives it a sale date two hours ago; `:258-275` creates an active listing with invented model/trait/color data and a live-looking URL. `backend/internal/service/gifts/ingestor/ingestor.go:226-290` derives `upgradedCount`, holders, ATH/ATL dates, volume, turnover, price changes, and market cap from fixed ratios/constants when the live detail is absent. `backend/internal/service/gifts/gifts_service.go:411-423` then reads snapshots as market data, and `:425-430` treats recent sales as the real-volume badge basis. `backend/internal/handler/webhook_gifts.go:146` and `:351` claim data is “100% native” / “without fabricated data”.
- **Required change (add/remove/change):** **Remove** the hard-coded sale/listing/snapshot/whale rows and derived ATH/ATL/volume/change/holder estimates from the production seed path. **Add** source identifier, source URL, fetched/captured timestamp, verification status, and explicit `synthetic=false`/`estimated` provenance to every market observation. Seed only canonical metadata/traits, or isolate demo fixtures behind an explicit non-production flag/table that cannot feed valuation.
- **Desired behavior:** A missing source yields `unavailable`/null metrics, never a row marked exact, verified, live, or `has_real_volume_badge=true`. Placeholder addresses/tx hashes must be rejected at ingestion and never rendered as provenance.
- **Acceptance criteria:** A fresh production database contains zero `gift_sales`, `market_listings`, `venue_snapshots`, arbitrage, or whale records until a source adapter inserts them; every displayed sale is traceable to a real source/event and passes tx/address validation; no “without fabricated data” copy appears while any input is synthetic; synthetic fixtures are impossible to select in production queries.
- **Edge/test cases:** empty DB; source timeout; source returns partial collection detail; placeholder `EQB...`/short tx hash; duplicate sync; restart during async seed; one venue live and five unavailable; clock skew and future timestamps.

### GFT-002 — Frontend catalog contains unproven static floors and diverges from backend/generated catalog (P0)

- **Evidence:** `frontend/src/entities/gifts/model/catalog120.ts:1-10,13-1232` calls itself the official catalog but stores a `floorTon` for all 120 items (120 static prices; 72 are exactly `110.0`, with only 32 unique values) and no source timestamp, source URL, confidence, or freshness. The values are used as report fallbacks at `frontend/src/pages/gifts/report/ui/GiftReportPage.tsx:1091-1096` (fallback supply 5,000, fallback floor 45) and contribute to the trait-floor card at `:1120-1125`. `backend/internal/service/gifts/traits/catalog.go:55-73` has `plush_pepe=2450`, `durov_cap=2500`; the frontend has 2,450 and 2,500 in `catalog120.ts:45-83`, while `catalog120_full.json` records 10,000 for the same examples. The backend also has many different supplies from the frontend (for example `spiced_wine`, `jelly_bunny`, `magic_potion`, and most of the 120 entries). `catalog120_full.json` is itself uniformly supplied with 10,000 in the checked-out data and has no provenance.
- **Required change:** **Remove** static floors from the canonical UI catalog and all valuation fallbacks. **Add** one generated, versioned metadata contract sourced from the backend/live API, including `observed_at`, `data_status`, `source`, and confidence; fail closed when supply conflicts. Reconcile the canonical supply/name/model source and reject duplicate/unknown IDs in CI.
- **Desired behavior:** The UI shows a floor only when returned by a fresh source; otherwise it says unavailable. A report must never silently switch to a static catalog price or 5,000/45 defaults.
- **Acceptance criteria:** backend/frontend/generated catalog agree on all 120 IDs, names, supplies, and model IDs; no `floorTon` is consumed in report or portfolio valuation; catalog tests fail on source divergence and stale/missing provenance.
- **Edge/test cases:** `plush-pepe-1` with no price source; backend/frontend supply mismatch; catalog entry removed upstream; 0/negative floor; 120th entry; apostrophes and hyphens in slugs.

### GFT-003 — Unknown collections and serials outside supply are accepted and valued (P0)

- **Evidence:** `backend/internal/service/gifts/gvengine/gvengine.go:129-170` resolves a known collection when possible but otherwise normalizes arbitrary input into a `modelID` and returns a valid `ParsedGiftRef`; there is no canonical-catalog or live-asset existence requirement. `:307-337` proceeds with valuation regardless of `isKnownCol` (assigned to `_`), and `:831-883` computes a serial score for any positive serial, including serials greater than supply. `:1011-1049` labels model/serial certainty exact and describes `#serial out of total supply` even when no live NFT exists and the serial is impossible. The existing tests only check collection-only rejection and a fake risk checklist (`gifts_audit_fixes_test.go:12-52,54-86`); they do not assert valuation rejection.
- **Required change:** **Add** strict canonical/live identity validation before valuation, with `serial >= 1 && serial <= authoritative_total_supply`; **change** unknown/ambiguous inputs to a typed 404/422; **remove** exact certainty from inferred attributes and impossible serials.
- **Desired behavior:** A non-existent collection, unknown NFT, serial 0, negative serial, or serial above authoritative supply cannot receive a price, rarity, certificate, portfolio value, or marketplace link.
- **Acceptance criteria:** `NormalizeGiftIdentifier` remains syntax-only or is renamed; the valuation boundary rejects unknown model IDs and out-of-range serials; a live resolver response can update supply only after collection identity matches; no `DisplayTitle` is emitted with an empty collection name.
- **Edge/test cases:** `non_existent_fake_model-1`, `plush_pepe-0`, `plush_pepe--1`, `plush_pepe-2451`, serial above live supply after a supply reduction, unknown `foo-bar-1`, and a valid slug with a hyphenated name.

### GFT-004 — Freshness policy is incomplete and synthetic fallback items are presented as market listings (P0)

- **Evidence:** `backend/internal/service/gifts/collection_intel.go:630-665` classifies snapshots by age, but `:954-965` creates a `TopFloorItems` record with serial `1`, model `collectionName`, symbol `Top Tier`, backdrop `Canonical`, and current `ObservedAt` whenever there is a floor but no real listing. `:973-1001` creates a four-step upgrade ladder with hard-coded Stars and `starToGram=0.016` irrespective of live upgrade data. `:1260-1273` adds a broad fallback string listing Fragment/Getgems/MarketApp/Telegram/TON Indexer as sources even when no venue snapshot exists. `backend/migrations/000072_telegram_gifts_vertical.up.sql:121-135` defaults `has_real_volume_badge` to true, and seeded rows set it true. `:126-135` of `000085...up.sql` has no source/fetched-at/quality fields for the live snapshot itself.
- **Required change:** **Remove** synthetic top-floor and hard-coded ladder rows from live responses. **Add** per-field/per-row provenance and source timestamps; derive upgrade prices from the authoritative Telegram response or return unavailable. Change badge defaults to false and require verified evidence to set true.
- **Desired behavior:** A stale snapshot is visibly stale; no `TopFloorItems`, “real volume”, “current ladder”, or buy URL is emitted without a corresponding source record and valid age.
- **Acceptance criteria:** each price/listing/volume has source + observed timestamp + age; stale/unavailable inputs render null/empty state; synthetic rows cannot enter search items or chart series; ladder shows “unavailable” without live upgrade data.
- **Edge/test cases:** exactly 5m/30m/6h snapshot ages; future `updated_at`; only one stale venue; no listing but a floor; source outage; `has_real_volume_badge` omitted/default false.

### GFT-005 — Collection model floors and rarity heatmap reuse collection floor and overstate verification (P1)

- **Evidence:** `backend/internal/service/gifts/collection_intel.go:762-772` assigns the collection’s `bestFloorGRAM` to every model floor, regardless of model listings. `:825-870` computes a model×backdrop probability matrix but assigns that same collection floor to every cell and hard-codes `RarityStatus: "verified"`/`CalculationMethod: "canonical_matrix"`, including fallback traits from `:540-572` and fallback model rows from `:809-821`. The frontend renders the cell floor as “Estimated Floor” (`frontend/src/pages/gifts/collection/ui/CollectionRarityHeatmap.tsx:464-504`) but the API `verified` status remains available to the UI.
- **Required change:** **Change** model/cell floor to the nearest verified listing/comparable for that exact trait combination, or null; **change** verification status to `estimated` when derived from permille/catalog data; remove “verified” from mathematical rarity that has no observed supply/trait instance.
- **Desired behavior:** Rarity probability and market price are separate dimensions. A rare cell without a listing does not acquire the collection floor by implication.
- **Acceptance criteria:** no model or heatmap price is present without matching evidence; status and calculation method explain whether rarity is observed, catalog-derived, or estimated; frontend badge matches status.
- **Edge/test cases:** no listings; one model with floor and another without; trait permille 0; fallback catalog-only collection; rare combination with no sale.

### GFT-006 — Currency/rate fallbacks and unit naming are inconsistent (P0)

- **Evidence:** GV uses a hard-coded `$1.42` fallback at `backend/internal/service/gifts/gvengine/gvengine.go:339-345`; Gifts Intel uses `$1.42` at `gifts_service.go:321-325`; arbitrage/whales use `$5.20` at `:130-135,173-178`; ingestion computes market cap with `5.20` at `ingestor.go:268`; seeder stores USD using `1.42` at `seeder.go:246-249,264-265`. `backend/internal/service/gifts/starsrate/stars_rate.go:20-29` and `:32-44` silently fall back to 1.42. The code uses GRAM as an alias for TON (`stars_rate.go:13,20`, `venues.go:27`) while the UI labels values `TON / GRAM` (`GiftReportPage.tsx:860-865`) and code alternates `expectedTON`/`GRAM` (`gifts_service.go:865-900`).
- **Required change:** **Remove** silent rate fallbacks from market/valuation output; carry a nullable rate with `source`, `observed_at`, and stale status. **Change** the API/UI to one unambiguous unit (TON or nanoTON) and use the same rate across valuation, seed/ingestion, portfolio, USD conversion, and Stars parity.
- **Desired behavior:** If the rate is unavailable/stale, TON values may remain with USD null and a visible status; no calculation mixes rates from different times or labels GRAM/TON ambiguously.
- **Acceptance criteria:** one rate provider/contract; all USD fields are calculated from the recorded rate at observation/valuation time; tests assert no 1.42/5.20 output in live mode and unit round-trips.
- **Edge/test cases:** rate provider timeout; rate=0/negative; rate changes between sale and report; TON currency response in nanoton; GRAM input; USD absent.

### GFT-007 — GV engine’s “confidence” and exact traits are not calibrated to actual evidence (P1)

- **Evidence:** `backend/internal/service/gifts/gvengine/gvengine.go:389-467` uses default `Obsidian Matrix`/`Aero Crest` and average DB trait permilles when live NFT metadata is absent; it marks those axes estimated, but `:1009-1049` marks the model and serial axes exact without proving on-chain identity. `:609-625` starts every report at confidence 30, adds fixed points for canonical membership/traits/comps, then caps at 95; this is not tied to the calibration table. `backend/internal/service/gifts/traits/catalog.go:1169-1185` marks `permille<=0` as exact 10% fallback. `backend/internal/service/gifts/traits/rarity.go:20-61` uses invented model probability (`totalSupply/500000`) and clamps joint probability, then presents surprisal as a rarity signal.
- **Required change:** **Change** certainty/confidence to evidence-backed fields with a documented calibration version and sample size; **remove** exact labels for canonical/default/inferred traits and arbitrary fallback permille; distinguish mathematical catalog rarity from observed instance rarity.
- **Desired behavior:** A report with no live metadata says “instance traits unavailable; collection baseline only” and cannot claim exact on-chain scarcity.
- **Acceptance criteria:** confidence is reproducible from explicit evidence counts and calibration record; 0/missing permille yields unknown, not 10%; all rarity outputs include method, population, and source.
- **Edge/test cases:** resolver timeout; metadata has model but not symbol; permille 0; unknown catalog; tiny supply; no comps; stale calibration.

### GFT-008 — Exit planner ranks unavailable venues and fabricates execution economics (P0)

- **Evidence:** `backend/internal/service/gifts/venues/venues.go:72-164` sets most venues to `DataStatus:"unavailable"` but supplies fee, slippage, and registry metadata. `:167-233` computes every venue’s gross price as the same target, assigns hard-coded days-to-sell, and does not consult live floor/listings/status; `:236-259` ranks by fee so the zero-fee unavailable MRKT commonly wins. `backend/internal/service/gifts/venues/adapters.go:68-80,99-110,186-196,227-238,257-267,286-296` explicitly return `ErrNoFloorData`/unavailable for most venues. The report still serializes all options and the frontend presents them as multi-market exit choices (`GiftReportPage.tsx:1239-1290`).
- **Required change:** **Remove** unavailable venues from actionable ranking; **add** a minimum freshness/liquidity/evidence gate and separate “fee simulation” from “available route”. Do not estimate sale duration without measured venue data.
- **Desired behavior:** `best_venue` is null when no fresh executable venue exists; unavailable venues are shown only as unavailable, never as ranked buy/sell choices or “max spread”.
- **Acceptance criteria:** ranking requires fresh floor/listing/volume and a valid deep link; no unavailable registry item can be rank 1; estimated fees/days carry estimated status and source.
- **Edge/test cases:** all venues unavailable; only Fragment fresh; MRKT unavailable with 0 fee; target price <=0; no volume; KYC-required venue; venue currency not TON.

### GFT-009 — Coin unlock is not atomic: report write uses a different DB connection/transaction (P0)

- **Evidence:** `backend/internal/service/gifts/gifts_service.go:622-648` begins `tx`, deducts coins through `DeductCreditsFIFO(ctx, tx, ...)`, but calls `s.repo.SaveGiftReport(...)`. `backend/internal/repository/gifts_repo.go:119-132` performs that insert via `r.db.Pool`, not the open transaction. A report can therefore commit while coin deduction rolls back/commit fails, or concurrent requests can observe entitlement inconsistently. `:615-616` checks purchase outside the transaction.
- **Required change:** **Change** repository methods to accept/use the same transaction; **add** row/advisory locking or an idempotency constraint for `(user_id,gift_id,entitlement_window)`; make deduction and report insert one atomic unit. **Remove** the false “strictly”/“idempotency” claim until this is true.
- **Desired behavior:** exactly one successful entitlement per payment window; failures leave both balance and report unchanged.
- **Acceptance criteria:** concurrent unlocks cannot double-spend or grant free reports; rollback tests show no report/no deduction; commit failure is surfaced; duplicate request returns existing report safely.
- **Edge/test cases:** two concurrent unlocks; SaveGiftReport failure; commit failure; timeout after deduction; duplicate request; expired 24h report; insufficient balance.

### GFT-010 — Credit unlock consumes credit before valuation and ignores report persistence errors (P0)

- **Evidence:** `backend/internal/service/gifts/gifts_service.go:663-673` consumes the Intel Credit before valuation; `:675-685` returns valuation errors after consumption and ignores `SaveGiftReport` errors (`_, _ = ...`). This can burn a credit without a report or return success without a persisted entitlement.
- **Required change:** **Change** to one transaction/reservation with compensating release on all failure paths; **handle** `SaveGiftReport` errors; **add** idempotency key persisted with the purchase.
- **Desired behavior:** a credit is consumed only when the report is durably saved, and retries are safe.
- **Acceptance criteria:** forced engine failure leaves credit balance unchanged; forced insert failure restores/rejects credit; success always has a retrievable report; same idempotency key returns the same report.
- **Edge/test cases:** engine timeout; DB insert timeout; duplicate credit request; credit consumed concurrently by two endpoints; user ID 0.

### GFT-011 — API/router/OpenAPI contracts disagree on auth, status codes, defaults, and endpoint coverage (P1)

- **Evidence:** `backend/internal/router/router.go:97-115` exposes 17 gift routes: `enriched-report` is behind `OptionalAuthMiddleware`, portfolio/crafting are public, and arbitrage/whales/serials/sync are present. `backend/openapi.yaml:456-645` documents only 13 of these, declares enriched report Bearer-auth and a 402, and documents `valuate` as executing valuation. Actual `gifts_handler.go:66-90` requires a user ID and returns 401/402 only through service error mapping; `:94-110` permits guests and returns a locked curiosity response; `:282-312` requires `c` although OpenAPI `:470-484` says it is optional/defaulted. The OpenAPI crafting schema omits `craft_chance_permille` even though handler/service consume it (`gifts_handler.go:168-181`; `ev_engine.go:14-23`).
- **Required change:** **Update** OpenAPI from router/handler behavior, including all endpoints, schemas, auth, 401/402/429/422/500 responses, nullable data fields, provenance, and unit semantics; or change implementation to match the contract. Add generated contract tests.
- **Desired behavior:** clients can predict whether a request is public, gated, or authenticated and can distinguish unavailable data from valuation errors.
- **Acceptance criteria:** OpenAPI route set equals router route set; response schemas validate real JSON; auth and status tests cover guest, purchased, unpaid, malformed, and unknown gift requests; no undocumented endpoint is production-exposed.
- **Edge/test cases:** guest `/valuate`; guest/purchased `/enriched-report`; missing collection `c`; unknown slug; crafting payload without chance; serial/arbitrage/whales/sync routes.

### GFT-012 — Frontend report renders hard-coded certificate/rarity math and overstates exactness (P0)

- **Evidence:** `frontend/src/pages/gifts/report/ui/GiftReportPage.tsx:853-856` displays `CERT-GF-8839` when the API certificate is absent. `:1083-1096` labels the trait section “exact data” and calculates a trait floor from a linear UI formula, with static supply/floor fallbacks; `:1200-1234` displays defaults `85.4`, `80`, `1.42e-4`, and `11.84 bits` rather than API values. `:1239-1290` renders all exit options without checking venue data status. `:1475-1504` presents fixed +40/+15/-12 month projections from the backend (`gvengine.go:664-672`) without forecast uncertainty/source.
- **Required change:** **Remove** all placeholder/default numbers and certificate strings. Render only fields present in the response; show “not available” with evidence status. **Change** “exact data”/verified badges to derive from `certainty_level` and provenance. Label projections as scenarios, not predictions, with model/version and uncertainty.
- **Desired behavior:** A missing field never becomes an invented-looking value. Users can tell observed, estimated, inferred, stale, and unavailable numbers apart.
- **Acceptance criteria:** snapshot tests assert no `CERT-GF-8839`, `85.4`, `1.42e-4`, `11.84 bits`, 5,000/45 fallbacks, or “exact” label under missing evidence; all prices have unit/rate/status; projections include assumptions and are not used as current value.
- **Edge/test cases:** locked report; partial enriched report; no joint rarity; no certificate; no USD rate; estimated traits; unavailable venue options.

### GFT-013 — Crafting EV is based on explicitly empirical odds, client input, and a silent 10-GRAM fallback (P1)

- **Evidence:** `backend/internal/service/gifts/crafting/ev_engine.go:76-82` checks same collection but permits blank/mismatched identity; `:84-116` defaults rate to 1.42 and uses fixed 25/45/65/85% odds explicitly described as community estimates; `:127-152` adds an invented `(cost*1.65)+30` output base and Monte Carlo variance. `backend/internal/service/gifts/gifts_service.go:1199-1224` revalues only parseable `GiftID`s, then sets any remaining known model’s value to `10.0` at `:1215-1219`. `gifts_handler.go:165-181` exposes the calculator publicly.
- **Required change:** **Add** odds/model source, version, observation window, and confidence; reject missing/unknown identity rather than assign 10 GRAM; validate every input against owned/live inventory where required; distinguish simulation from official Telegram outcome mechanics. **Remove** client-trusted model/serial/chance fields after server resolution.
- **Desired behavior:** EV is clearly scenario/estimated and cannot look like an official probability or valuation.
- **Acceptance criteria:** no valuation output for unresolved inputs; no 10-GRAM fallback; odds and output distribution are traceable to a versioned source; burn/lock semantics are tested; server recomputes all identity and value fields.
- **Edge/test cases:** 0 inputs, 5 inputs, blank model, cross-collection with one blank ID, negative value, chance 0/1000, locked gift, engine failure, fixed seed versus random seed.

### GFT-014 — Portfolio scan is partial but returned as a complete portfolio/PnL (P1)

- **Evidence:** `backend/internal/service/gifts/gifts_service.go:1048-1051` calls `GetUserGifts(..., 50)` once with no pagination. `:1068-1087` uses the lowest snapshot floor, then overwrites it with the last sale even if that sale is stale/unverified; if neither exists, `valGRAM` remains 0 and the item is still appended as an estimated value (`:1093-1110`). `:1115-1147` adds only 20 purchased reports to `AnalyzedGifts`; `:1175-1186` returns counts/PnL with no coverage or valuation status. The handler rate-limit key uses client-supplied `X-Forwarded-For` when unauthenticated (`gifts_handler.go:210-216`), which can be rotated to bypass the limit.
- **Required change:** **Add** Bot API pagination/coverage (`complete`, cursor, failed count, source timestamps) and per-item valuation status; do not compute PnL from missing/zero or stale prices. **Change** rate limiting to trusted proxy parsing or authenticated subject plus target, with abuse controls.
- **Desired behavior:** response clearly says “first page/partial/unavailable” and does not claim total portfolio value or PnL unless all assets are covered with fresh evidence.
- **Acceptance criteria:** >50 gifts are fully paginated; a source failure is reported; zero-value unknown is not a numeric estimated price; PnL denominator and valuation timestamps are returned; spoofed XFF cannot bypass limits.
- **Edge/test cases:** 0 gifts; exactly 50/51 gifts; burned gifts; duplicate gift IDs across pages; missing user; stale floor; no last sale; changing username; XFF chain.

### GFT-015 — Single-report provenance is inferred from URL shape and custody is mislabeled as verified (P1)

- **Evidence:** `backend/internal/service/gifts/gifts_service.go:813-830` labels every comp note “Verified sale” but only marks `verified_tx` when a Tonviewer URL is non-empty and not the bare domain; any DB sale with a tx string becomes a URL without verifying it. `:842-862` sets `on_chain_nft` merely when owner text looks like a wallet or a collection has a contract, not from a verified NFT state; `:971-987` emits owner-wallet/upgrade claims even with empty owner and hard-coded upgrade fee 25. Frontend `GiftReportPage.tsx:904-945` labels the owner section “verified” and presents Off-Chain/Telegram Custody as a verified status.
- **Required change:** **Add** evidence type and verification result from a chain/indexer lookup; **change** sale note to “indexed/observed/unverified” unless transaction/event is validated; only label on-chain ownership after the NFT contract/token owner is confirmed. Remove hard-coded upgrade/custody claims when source is absent.
- **Desired behavior:** absence of proof is displayed as unknown, not as Telegram custody or verified ownership.
- **Acceptance criteria:** provenance rows have source, event/tx, block/event index, fetched-at, and verification status; malformed tx/address is rejected; UI badge exactly reflects that status.
- **Edge/test cases:** sale without tx; tx that returns 404; escrow owner; contract only with no token; in-app gift; resolver partial metadata; conflicting owner sources.

### GFT-016 — Migration/schema permits invalid market data and cannot enforce provenance (P1)

- **Evidence:** `backend/migrations/000072_telegram_gifts_vertical.up.sql:43-60` has no checks/FKs for sale model, venue, currency, positive prices, serial range, or tx/address format. `:121-135` makes `has_real_volume_badge` default true and snapshots have only `updated_at`. `000083...up.sql:8-20` deduplicates by `(venue, tx_hash, event_index)` only when tx is non-empty; rows without tx remain freely duplicable. `000084...up.sql:36-54` gives listings uniqueness only `(venue, listing_id)` and no freshness/quality/source fields. `000085...up.sql:33-50` allows arbitrage rows without source/target evidence.
- **Required change:** **Add** database constraints and provenance columns/tables: source, source record ID, observed/captured time, ingestion run, verification, quality, currency conversion/rate, and synthetic flag; set badge default false; constrain positive values and serials; require safe uniqueness for source records.
- **Desired behavior:** the database cannot represent an “exact verified live sale” with a placeholder or missing evidence.
- **Acceptance criteria:** migrations/up-down are reversible and tested against invalid inserts; source IDs are idempotent; stale records are queryable but never selected as live; all analytical tables retain evidence linkage.
- **Edge/test cases:** null/empty tx; duplicate event with no tx; negative/zero price; unsupported currency; serial 0; future capture; source correction; migration from seeded rows.

### GFT-017 — Ingestion/venue worker does not make the promised multi-venue data real (P1)

- **Evidence:** `backend/internal/service/gifts/venues/adapters.go:68-72,99-102,186-188,227-230,257-260,286-288` return no floor for six venue paths; only MarketApp has a live adapter at `:129-150`, but its `FetchFloor` ignores `giftSlug` and calls a generic collection endpoint. `venues/worker.go:123-151` writes whatever result exists, while `venues.go:83-164` registry metadata advertises Fragment live and Stars estimated despite adapter unavailability. The seeder then fills those gaps (GFT-001).
- **Required change:** **Change** registry status to runtime source health, pass/validate the collection slug to each adapter, and prevent seed data from satisfying live venue queries. Add circuit-breaker/error state and per-source freshness.
- **Desired behavior:** venue status accurately describes the adapter result for the requested collection, not static capability metadata.
- **Acceptance criteria:** a mocked adapter test proves each returned snapshot belongs to the requested slug; unavailable adapters cannot create floors/badges; source health drives collection status.
- **Edge/test cases:** generic endpoint returns a different collection; adapter returns 200 with zero floor; timeout/429; one venue stale; source recovers after circuit breaker.

### GFT-018 — Documentation advertises stronger guarantees than code/data supports (P1)

- **Evidence:** `docs/TELEGRAM_GIFTS_AI_SPEC.md:12-19,57-73,155-178,243-278` calls the platform institutional-grade, describes exact multi-axis scarcity, 10,000-trial EV, mandatory audit and “last-sale floor invariant”, and says every UI source page must attribute GiftChanges. Code contradicts this in the synthetic seeder/ingestor, inferred exact model/serial traits, hard-coded EV output, and unavailable venue planner. `docs/telegram_gifts_encyclopedia.md:30,164-172,261-277,324-342` presents official APIs/market sources and an “official valuation” path, but the local implementation is largely resolver/snapshot/fixture based and does not expose all documented Telegram operations.
- **Required change:** **Change** docs to distinguish implemented behavior, external specification, estimation, and unavailable integrations; document no-data behavior and units. **Add** a generated API/schema section and a provenance/freshness policy. Remove “institutional-grade”, “exact”, “verified”, and “without fabricated data” claims until acceptance criteria above pass.
- **Desired behavior:** docs are an accurate operational contract, not a product claim that bypasses data provenance.
- **Acceptance criteria:** docs route/schema/source tables match code; formulas link to versioned implementation and calibration evidence; all caveats are visible to users.
- **Edge/test cases:** docs build/link check; endpoint diff against router; migration schema diff; source outage runbook; stale-data UX.

### GFT-019 — Risk auditor calls catalog membership “verified authenticity” (P1)

- **Evidence:** `backend/internal/service/gifts/risk/auditor.go:54-65` treats `traits.ResolveCollection` and a non-empty catalog `ContractID` as live authenticity/“TEP-62 Smart Contract Verified”; it does not query chain state or verify the contract. `:67-123` also reports “Measured Dynamically per Active Venue” while no live venue input is passed to `AuditGiftRisk`.
- **Required change:** **Change** authenticity to `catalog-listed` until contract/collection/token state is independently verified; **add** chain/indexer evidence and source timestamp; **remove** dynamic-liquidity language when inputs are nil.
- **Desired behavior:** risk output distinguishes official catalog metadata, contract address configured, and contract/asset actually verified on-chain.
- **Acceptance criteria:** a fake/unreachable contract cannot pass smart-contract verification; liquidity/churn are `unknown` without evidence; UI uses these states directly.
- **Edge/test cases:** official catalog entry with no contract; configured but nonexistent contract; copycat collection; no venue snapshots; stale indexer.

### GFT-020 — Dynamic catalog silently returns invented trait metadata on misses (P1)

- **Evidence:** `backend/internal/service/gifts/traits/dynamic_catalog.go:303-325` falls back to the static canonical catalog if live sync is empty. `:328-350` returns a fabricated-looking Midnight-style color palette and permille 50 for an unknown backdrop, and `:353-370` returns permille 50/tier “Rare” for an unknown symbol. These values can feed GV/trait UI as if resolved.
- **Required change:** **Remove** synthetic backdrop/symbol fallbacks; return `(unknown,false)` with status/source. Keep canonical fallback only for collection identity and mark it stale/static.
- **Desired behavior:** unknown trait metadata is unknown, not a 5% “Rare” trait with valid hex colors.
- **Acceptance criteria:** resolver tests assert `ok=false`, no rarity calculation or exact badge for misses, and no synthetic colors enter heatmap/report.
- **Edge/test cases:** empty dynamic cache; API 404; renamed trait; case mismatch; null/0 permille; stale cache older than 24h.

## Cross-cutting required acceptance suite

1. **Identity:** known/unknown collection and serial boundary tests; no valuation/certificate/link for invalid or out-of-range gifts.
2. **Provenance:** every sale/listing/floor/volume/trait/rate has source ID, source URL/type, captured time, age/status, confidence, and verification; malformed placeholders rejected.
3. **Truthfulness:** empty database and all-adapter-outage tests return null/empty/unavailable, never seeded/synthetic market data.
4. **Freshness:** boundary tests at 5m, 30m, 6h; stale rows cannot populate live floor, top listings, real-volume badges, arbitrage, exit ranking, or PnL.
5. **Currency:** one TON/GRAM unit convention; rate timestamp/source persisted; no silent 1.42/5.20 fallback in live output; USD null when rate unavailable.
6. **Paywall/atomicity:** concurrent coin/credit unlock, valuation failure, report insert failure, timeout, retry/idempotency, and 24h expiry tests.
7. **Frontend:** locked/partial/no-source snapshots contain no placeholder certificate or numeric defaults; observed/estimated/verified/unavailable badges are API-driven; unavailable venues are not actionable.
8. **Collection analytics:** model/cell floor evidence is model/trait-specific; fallback rarity is not “verified”; charts have real timestamped history only.
9. **Portfolio:** paginate all gifts, deduplicate, report coverage/failed items, and compute PnL only from fresh evidence; trusted rate-limit identity.
10. **Contract:** OpenAPI generated/validated against router and JSON fixtures, including all routes and actual auth/status/schema behavior.

## Tests executed / limitations

- Attempted focused Go tests: `go test ./internal/service/gifts/... ./internal/handler/...` from `backend`; blocked because the runtime image has no `go` executable (`go: command not found`).
- Attempted frontend Gift test command from `frontend` (`pnpm test -- --run ...`, fallback `npm test`); blocked because neither `pnpm` nor `npm` is installed.
- Static source/data checks were performed: catalog count (120 entries), static floor distribution (120 values, 32 unique; 72 equal 110), backend canonical map count (120), and direct source comparison showing supply mismatches (e.g. `plush-pepe` backend 2,450 vs generated JSON 10,000; `durov-cap` 2,500 vs 10,000). No production DB, external API, or live TON/Telegram response was available, so runtime source freshness and actual market truth could not be independently verified.

## Audited coverage

**Backend Gifts/NFT implementation and tests:** all files under `backend/internal/service/gifts/` (39 files, including collection intel, GV engine/model/social, traits/catalog/dynamic/harmony/rarity, crafting/Monte Carlo, serials, Stars rate/parity, upgrade, risk, venues/adapters/worker, ingestion/seeding, GiftChanges client, Telegram NFT resolver, and tests); `backend/internal/handler/gifts_handler.go`, `webhook_gifts.go`, `webhook_gifts_test.go`; `backend/internal/repository/gifts_repo.go`, `valuation_repo.go`, `schema.sql`; `backend/internal/router/router.go`; `backend/internal/client/marketapp/client.go`; and Gift-related code references in neighboring backend handlers/services.

**Frontend:** `frontend/src/entities/gifts/api/giftsApi.ts`, `model/types.ts`, `model/catalog120.ts`, `lib/cdn.ts`, `ui/GiftThumbnail.tsx`, all pages/components under `frontend/src/pages/gifts/` (collection, report, crafting, intel/charts, portfolio), related report cache/i18n usage, and Gift frontend tests/config where present.

**Schema/migrations/API/docs/data:** `backend/migrations/000072_telegram_gifts_vertical.{up,down}.sql`, `000083_gift_sales_idempotency_and_venues.{up,down}.sql`, `000084_gifts_market_engine_and_freshness.{up,down}.sql`, `000085_gifts_omni_analytics_and_arbitrage.{up,down}.sql`, related valuation migrations, `backend/openapi.yaml`, root `openapi.yaml`, `docs/TELEGRAM_GIFTS_AI_SPEC.md`, `docs/telegram_gifts_encyclopedia.md`, `catalog120_full.json`, `catalog120_generated.json`, and `primary_models.json`.

**Output path:** `/home/user/work/1005625608594470925/gifts_audit.md` (Markdown audit; 18 findings, acceptance/edge tests, execution limitations, and file-coverage ledger). The parent agent should publish/copy it to the requested project location.
