# SDD پروژه iFragment — سه vertical دارایی‌های تلگرامی/TON

**وضعیت:** پیش‌نویس اجرایی، evidence-first؛ این سند جایگزین قرارداد API/OpenAPI تولیدشده نیست تا زمانی که CI آن را تولید و validate کند.  
**دامنه محصول:** فقط `collectible username`، `collectible anonymous number` و `Telegram collectible gift`. برای هر vertical، سطح **Collection** و **Single Item** مستقل است.  
**واحد پایه:** قیمت زنجیره‌ای در `nanoTON` (نمایش TON)؛ Stars و USD فقط با واحد، نرخ و زمان مشاهده مستقل. `GRAM` در API جدید مجاز نیست.  
**منابع ممیزی:** `username_audit.md`، `numbers_audit.md`، `gifts_audit.md`، `crosscutting_audit.md`، `official_research.md`، `competitor_research.md` در `/home/user/work/ifragment_audit/`.

> **اصل حاکم:** هر ادعای مشاهده‌شده باید source، زمان مشاهده، وضعیت تازگی، روش، شناسه رکورد منبع و سطح اطمینان داشته باشد. نبود مدرک باید `unknown/unavailable` بماند، نه عدد ساختگی، `verified` یا `live`.

---

## 1) Verdict و release blockers

### 1.1 Verdict

**VER-P0-001 — انتشار عمومی monetized/market-intelligence فعلاً مجاز نیست (P0).** در هر سه vertical مسیرهایی وجود دارد که داده seed/static/synthetic را به‌صورت live/on-chain/verified یا exact نمایش می‌دهد؛ همچنین پرداخت/entitlement، certificate و اصالت برخی identityها release-safe نیستند. این verdict از شواهد `crosscutting_audit.md:32-152` و یافته‌های Gifts (`gifts_audit.md:67-147`)، Numbers (`numbers_audit.md:23-98`) و Username (`username_audit.md:109-216`) نتیجه می‌شود.

### 1.2 Blockerهای مطلق پیش از production

| شناسه | اولویت | blocker قابل اندازه‌گیری | شواهد |
|---|---|---|---|
| `RB-P0-001` | P0 | صفر رکورد synthetic/fabricated در live/verified market response و DB production؛ seed فقط metadata مجاز است. | Gifts: `gifts_audit.md:67-81`; مشترک: `crosscutting_audit.md:32-67` |
| `RB-P0-002` | P0 | collection chart فقط نقاط timestamped واقعی/verified یا empty/unavailable؛ هیچ `sin/cos`/OHLC fabricated در production. | Numbers: `numbers_audit.md:79-85`; Username: `username_audit.md:147-158` |
| `RB-P0-003` | P0 | هر Single Item فقط پس از identity verification یا status صریح unknown؛ format به‌تنهایی minted/verified نیست. | Numbers: `numbers_audit.md:23-35`; Gifts: `gifts_audit.md:83-97` |
| `RB-P0-004` | P0 | فروش فقط با decoder قرارداد/trace/payment leg/finality؛ transfer، bid، refund یا بیشینه `in_msg.value` sale نیست. | `official_research.md:10-14,140-152`; Numbers: `numbers_audit.md:89-100` |
| `RB-P0-005` | P0 | debit، order/entitlement و report persistence در یک transaction/reservation اتمیک؛ تست concurrent و rollback سبز. | Username: `username_audit.md:109-126`; Gifts: `gifts_audit.md:131-153` |
| `RB-P0-006` | P0 | order status فقط owner یا token یک‌بارمصرفِ owner-bound؛ raw payload و user id افشا نشود. | `username_audit.md:292-307` |
| `RB-P0-007` | P0 | certificate تا HMAC/asymmetric واقعی آماده نشده فقط `hash/checksum`؛ SHA عمومی به‌عنوان cryptographic verification ممنوع. | `username_audit.md:210-224`; `crosscutting_audit.md:96-121` |
| `RB-P0-008` | P0 | هیچ hardcoded numeric fallback برای floor/volume/ATH/rate/rarity/trait/certificate در live UI/API. | Numbers: `numbers_audit.md:65-87,210-223`; Gifts: `gifts_audit.md:107-121`; Username: `username_audit.md:372-386` |
| `RB-P0-009` | P0 | کلاینت report-cache به Telegram principal/session bind و در switch/logout پاک می‌شود؛ server authorization مستقل باقی می‌ماند. | `username_audit.md:227-242` |
| `RB-P0-010` | P0 | migration از صفر و smoke queryهای سه vertical بدون `column does not exist`، route/client/OpenAPI contract بدون mismatch. | Numbers: `numbers_audit.md:39-49`; `crosscutting_audit.md:415-444` |

**تصمیم release:** تا بسته‌شدن همه `RB-P0-*`، فقط demo با fixture جدا و banner غیرقابل‌اشتباه مجاز است؛ demo data نباید query تولید را تغذیه کند.

---

## 2) اهداف و غیراهداف

### 2.1 اهداف

- `OBJ-P0-001` (P0): هویت canonical هر item، مالک زنجیره‌ای، binding/hosting تلگرام، listing و event timeline را جدا و قابل audit ذخیره/نمایش دهیم. Telegram صراحتاً wallet owner را از username association و gift `host_id` جدا می‌کند؛ [Telegram Fragment API](https://core.telegram.org/api/fragment)، [Telegram Gifts](https://core.telegram.org/api/gifts)، `official_research.md:7-13,40-48,84-98`.
- `OBJ-P0-002` (P0): Collection analytics فقط از داده source-tagged و fresh استفاده کند؛ missing با `unknown/unavailable` بیان شود.
- `OBJ-P0-003` (P0): Single Item report فقط برای item موجود/قابل‌احراز صادر شود و valuation با uncertainty، sample، cohort و method version همراه باشد.
- `OBJ-P0-004` (P0): پرداخت و entitlement قابل تکرار، اتمیک، owner-scoped و idempotent باشد.
- `OBJ-P1-001` (P1): ingestion زنجیره‌ای replayable، durable checkpoint، finality و reorg-aware باشد.
- `OBJ-P1-002` (P1): contract واحد بین router، OpenAPI، TypeScript و response fixtures برقرار شود.
- `OBJ-P1-003` (P1): SLO و observability برای latency، freshness، provider health، indexer lag، payment و provenance تعریف شود.
- `OBJ-P2-001` (P2): i18n/RTL/a11y/mobile و source-explanation قابل اتکا در هر دو سطح تکمیل شود.

### 2.2 غیراهداف

- `NO-P0-001` (P0): خرید، bid، transfer، withdrawal، login-code retrieval یا مدیریت wallet انجام نمی‌شود؛ UI فقط deep-link به venue مجاز دارد. Telegram Mini App نیز منبع مالکیت زنجیره‌ای نیست؛ [Telegram Mini Apps](https://core.telegram.org/bots/webapps)، `official_research.md:128-136`.
- `NO-P0-002` (P0): ادعای `fair value` قطعی، سود تضمینی، market cap معتبر در نبود supply/floor تازه، یا financial advice تولید نمی‌شود.
- `NO-P0-003` (P0): Fragment reverse-engineered/private endpoint منبع canonical تلقی نمی‌شود؛ منابع رسمی بررسی‌شده bulk public marketplace API را مستند نکرده‌اند، `official_research.md:13`.
- `NO-P1-001` (P1): identity تلگرام/نام حقیقی از wallet یا phone infer نمی‌شود؛ شماره و login state فقط به‌صورت authorized/session-observed ذخیره می‌شود، `official_research.md:70-82`.
- `NO-P1-002` (P1): یک مدل rarity عمومی برای username/number اعمال نمی‌شود؛ desirability با زبان/الگوی ثبت‌شده و روش explainable است، نه trait rarity عمومی.
- `NO-P1-003` (P1): Stars resale، TON NFT sale و custodial venue در یک حجم/واحد/portfolio جمع نمی‌شوند؛ [Telegram Gift Marketplace](https://telegram.org/blog/gift-marketplace-and-more)، `official_research.md:9-12,100-110`.
- `NO-P2-001` (P2): portfolio/PnL بدون coverage کامل و timestamps fresh ادعای complete نمی‌کند.

---

## 3) واژگان و domain model

### 3.1 واژگان status و provenance

`DOM-P0-001` (P0): statusهای مشترک دقیقاً این‌ها باشند: `verified` (مدرک کافی و policy pass)، `confirmed` (chain observation با finality policy ناقص/در انتظار)، `observed` (از provider/indexer بدون verification کامل)، `estimated` (مدل/محاسبه با ورودی معتبر)، `stale` (آخرین داده معتبر اما خارج TTL)، `partial` (بخشی از بخش‌ها)، `unknown` (identity/field resolve نشده)، `unavailable` (provider/data ندارد)، `synthetic` (فقط demo؛ هرگز production live). Unknown با false یکی نیست.

`DOM-P0-002` (P0): `Evidence` مشترک:

```json
{
  "source_type": "ton_raw_trace|ton_indexer|telegram_mtproto|fragment_page|marketplace_api|model|editorial",
  "source_name": "tonapi|toncenter|fragment|telegram|...",
  "source_record_id": "opaque-provider-id",
  "source_url": "https://...",
  "captured_at": "RFC3339",
  "observed_at": "RFC3339",
  "expires_at": "RFC3339|null",
  "status": "verified|confirmed|observed|estimated|stale|unknown|unavailable|synthetic",
  "method": "raw_trace_decoder/v3_api/mtproto/model_v1",
  "parser_version": "string|null",
  "model_version": "string|null",
  "confidence": {"level":"high|medium|low|none", "basis":"string", "sample_size":0},
  "raw_payload_hash": "sha256|null"
}
```

`DOM-P0-003` (P0): هر value مالی یک `Money` است: `{amount_minor: integer, currency: TON|STARS|USD, decimals, rate_snapshot_id|null, observed_at, evidence}`. هیچ `float` و هیچ TON/GRAM alias در boundary.

`DOM-P0-004` (P0): ownership و utility مستقل: `chain_owner_address`, `telegram_binding_type/id/active/observed_at`, `gift_host_id`, `listing_state`. Wallet owner با Telegram host/assignment جایگزین نمی‌شود؛ [StarGift](https://core.telegram.org/type/StarGift)، [UniqueStarGiftValueInfo](https://core.telegram.org/type/payments.UniqueStarGiftValueInfo)، `official_research.md:15-38,84-98`.

`DOM-P0-005` (P0): event taxonomy: `mint`, `transfer`, `fixed_price_sale`, `primary_auction_settlement`, `secondary_auction_settlement`, `offer_settlement`, `gift_resale`, `bid`, `refund`, `royalty`, `listing`, `unclassified_transfer`. `sale` فقط event decoder تأییدشده؛ TEP-62 transfer آزاد و TEP-66 royalty را اجباری نمی‌کند، [TEP-62](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md)، [TEP-66](https://github.com/ton-blockchain/TEPs/blob/master/text/0066-nft-royalty-standard.md)، `official_research.md:10-14,140-152`.

### 3.2 هویت canonical سه vertical

| vertical | Collection key | Single Item key | utility/off-chain |
|---|---|---|---|
| Username | `chain_id + collection_address` یا registry key؛ `username` برای display | `username_normalized + chain_id + nft_address|null` | account/bot/channel/supergroup association، active/order در `usernames` vector |
| Anonymous number | `chain_id + collection_address + class` (`genesis`/`standard` فقط با registry) | exact normalized `+888…` + `nft_address|null` | login binding/code availability جدا از wallet ownership |
| Telegram gift | `gift_id + base_gift_id` و catalog version | `(gift_id, serial_num, gift_address|null)` | host/profile، Stars resale/offer، exported TON state |

`DOM-P0-006` (P0): Input normalization فقط syntax است؛ resolver باید existence/canonical identity را جدا verify کند. برای gift، `gift_id`, `slug`, `num`, attributes، `owner_address`, `gift_address`, `host_id` حفظ می‌شود؛ [StarGift](https://core.telegram.org/type/StarGift)، `official_research.md:15-29`.

---

## 4) source-of-truth و provenance

### 4.1 سلسله‌مراتب منبع

`PROV-P0-001` (P0): برای settlement/owner/NFT state، raw TON transaction/trace/contract state منبع قوی‌تر از action summary است. TonAPI می‌گوید Events برای display هستند و ساختارشان ممکن است تغییر کند؛ accounting باید raw trace/message/decoder را استفاده کند: [TonAPI Events](https://docs.tonapi.io/tonapi/rest-api/events)، `official_research.md:164-170`.

`PROV-P0-002` (P0): برای Telegram utility، MTProto/API session state source است، نه TON. `fragment.getCollectibleInfo` visibility-limited است و bulk public history نیست: [fragment.getCollectibleInfo](https://core.telegram.org/method/fragment.getCollectibleInfo)، `official_research.md:62-65,80-82`.

`PROV-P0-003` (P0): برای market listing، marketplace observation با URL/record id و captured timestamp مجاز است؛ listing فروش نهایی نیست. برای historical sale باید transaction/event proof یا صریحاً `archive_observation`/`model_anchor` باشد.

`PROV-P0-004` (P0): هر response بخش‌های `data_status`, `source_status[]`, `observed_at`, `fetched_at`, `stale`, `is_estimate`, `evidence[]` دارد؛ per-field precedence از response status مهم‌تر است.

### 4.2 قواعد vertical/سطح

`PROV-USER-C-001` (P0, Username Collection): floor/listings/auctions/volume فقط از مشاهده timestamped Fragment/TON/indexer؛ static Hall of Fame فقط `editorial_reference` با منبع، نه verified. chart بدون history `unavailable`. شواهد `username_audit.md:130-174`.

`PROV-USER-S-001` (P0, Username Single): status auction/buy/listing/owner/Telegram association مستقل؛ HistoricalSales/anchor وارد `history.transactions` نمی‌شود؛ `onchain_sale` فقط tx proof. شواهد `username_audit.md:177-208`.

`PROV-NUM-C-001` (P0, Numbers Collection): تعداد supply/floor/volume/ATH فقط با snapshot pinned و provenance؛ synthetic canonical catalogue، hardcoded Hall of Fame و OHLC حذف؛ `mask` فقط آیتم واقعی مطابق predicate. شواهد `numbers_audit.md:51-85` و `crosscutting_audit.md:68-95`.

`PROV-NUM-S-001` (P0, Number Single): `format_valid`, `collection_verified`, `exists`, `is_minted`, `initialized`, `item_address`, `restriction_status` مستقل؛ format به‌تنهایی minted/verified نیست. `item_address`, collection, index, observed block/time باید برای verified موجود باشد؛ `numbers_audit.md:23-35`.

`PROV-GIFT-C-001` (P0, Gifts Collection): catalog/traits metadata می‌تواند static versioned باشد اما floor/volume/listing/sales/real-volume فقط live/stale source-bearing. collection floor به model/cell سرریز نمی‌کند؛ `gifts_audit.md:67-121`.

`PROV-GIFT-S-001` (P0, Gift Single): canonical collection + serial + live resolver/chain identity لازم؛ `host_id` با `owner_address` جدا؛ sale/owner/traits/venues evidence-level خودشان را دارند. [Telegram Gifts](https://core.telegram.org/api/gifts)، `official_research.md:84-108`.

`PROV-P1-001` (P1): attribution فقط sourceهایی را فهرست کند که در همان پاسخ موفق بوده‌اند؛ رشته‌های “Fragment / Getgems / MarketApp / Telegram / TON Indexer” بدون observation ممنوع، `crosscutting_audit.md:397-413`.

---

## 5) حذف‌ها، اضافه‌ها و تغییرات محصولی

### 5.1 حذف قطعی

- `DEL-P0-001`: Gifts synthetic seed sale/listing/volume/whale/arbitrage و fixed ratio ingestor از production؛ فقط canonical metadata seed. `gifts_audit.md:67-81`.
- `DEL-P0-002`: Numbers synthetic catalogue/owner/price، 181-day OHLC، static Hall of Fame chart؛ Username trigonometric chart و static verified leaderboard. `numbers_audit.md:51-85`; `username_audit.md:147-174`.
- `DEL-P0-003`: همه UI fallbackهای numeric (`2450`, `666666`, `10 TON`, `5.2M`, `CERT-GF-8839`, `85.4`, `1.42e-4`, `11.84 bits`, `5,000/45`) از live/partial report. `gifts_audit.md:155-169`; `numbers_audit.md:210-223`.
- `DEL-P0-004`: public SHA-only certificate badge؛ تا implementation جدید فقط checksum. `username_audit.md:210-224`.
- `DEL-P1-001`: unavailable venue در best-exit/arbitrage و model floor inferred از collection floor؛ `gifts_audit.md:99-113`.
- `DEL-P1-002`: `onchain_sale` برای static HistoricalSales و `verified` برای catalog-only rarity؛ `username_audit.md:177-208`; `gifts_audit.md:99-113`.
- `DEL-P1-003`: one of duplicate `/numbers/mask` vs `/numbers/search-mask`, dead `/numbers/collection-overview` client، OpenAPI موازی؛ تا route واقعی/contract واحد تعیین شود. `crosscutting_audit.md:415-444`.

### 5.2 اضافه‌های ضروری

- `ADD-P0-001`: Evidence/RateSnapshot/Run/Entitlement schema طبق بخش 7.
- `ADD-P0-002`: typed resolver برای identity و `unknown/unavailable` path، قبل از valuation/payment side effect.
- `ADD-P0-003`: immutable raw observation + derived event tables؛ provenance row برای هر metric.
- `ADD-P0-004`: signed certificate با key id/expiry/model/run/payload hash؛ HMAC یا asymmetric private key جدا.
- `ADD-P1-001`: finality/reorg fields و durable checkpoints؛ `reorged` row هرگز aggregate نمی‌شود.
- `ADD-P1-002`: venue/source health، circuit breaker، DLQ/retry/lease، webhook state machine.
- `ADD-P1-003`: OpenAPI generated client/schema contract، migration tests و static regression scan برای forbidden defaults.
- `ADD-P2-001`: read model/materialized aggregates برای Gifts Intel، cache age preservation و metrics cardinality-safe.

---

## 6) API و data schema

### 6.1 API surface

`API-P0-001` (P0): همه collection endpointها envelope مشترک داشته باشند:

```json
{
  "schema_version":"2026-01-01",
  "data_status":"live|stale|partial|unavailable|estimated",
  "as_of":"RFC3339|null",
  "source_status":[{"source":"...","status":"...","fetched_at":"...","error_code":null}],
  "items":[],
  "pagination":{"cursor":"...","has_more":false},
  "coverage":{"complete":true,"seen":0,"failed":0},
  "warnings":[]
}
```

Collection endpoints:
- `GET /api/v1/usernames/collection/stats` (canonical path؛ route/OpenAPI یکسان)
- `GET /api/v1/numbers/collection` و `/mask` (یکی، نه duplicate)
- `GET /api/v1/gifts/collections` و `/collection-intel?c=...`

`API-P0-002` (P0): هر Collection response شامل فقط collection-level fields: `collection_id`, `supply` با evidence، `floor`، `median`، `realized_volume`، `listing_depth`، `history[]` timestamped، `traits_catalog[]`؛ هیچ individual serial/trait/sale synthetic.

`API-P0-003` (P0): هر Single Item response شامل `identity`, `existence`, `ownership`, `utility`, `listing`, `events[]`, `valuation|null`, `uncertainty`, `evidence[]`, `run_id|null`; locked response فقط curiosity fields و هیچ expected/low/high/comps/certificate/exit-plan.

`API-P0-004` (P0): HTTP semantics: syntax invalid `422`، unknown item `404` یا `200` با `existence=unknown` طبق resource policy؛ guest locked `401/402` فقط در endpoint مستند؛ provider unavailable `200` با `data_status=unavailable` برای read path؛ rate limit `429`; internal `500`. OpenAPI و router باید دقیقاً همین باشد (`crosscutting_audit.md:415-444`).

`API-P1-001` (P1): status enum واحد در backend/frontend/OpenAPI: username `available|purchase_available|on_auction|on_sale|owned|reserved|collectible_not_listed|source_unavailable|unknown`; gift/number مشابه با status source-aware. Unknown renderer نباید available/taken فرض کند؛ `username_audit.md:260-273`.

`API-P1-002` (P1): payment API تفاوت `credit_pack` و `report_entitlement` را صریح کند؛ client discount/price نادیده یا reject؛ server قیمت/discount را حساب کند. `username_audit.md:275-289`.

`API-P1-003` (P1): `/orders/*/status` auth/ownership enforced؛ payload raw برنگردد. `username_audit.md:292-307`.

### 6.2 جداول منطقی

`SCHEMA-P0-001` (P0) — `assets`:

```text
id UUID PK, vertical enum, collection_id, canonical_key, display_key,
chain_id, collection_address, item_address, gift_id, serial_num,
username_normalized, number_normalized, canonical_status,
created_at, updated_at, evidence_id
UNIQUE(vertical, canonical_key)
```

`SCHEMA-P0-002` (P0) — `observations`:

```text
id UUID PK, asset_id/collection_id, field_path, value_json,
source_type, source_name, source_record_id, source_url,
observed_at, fetched_at, expires_at, status, method,
parser_version, raw_payload_hash, ingestion_run_id, is_estimate, is_synthetic
CHECK(is_synthetic = false OR status='synthetic')
```

`SCHEMA-P0-003` (P0) — `chain_events`:

```text
chain, network, tx_hash, block_hash, seqno, lt, event_index,
contract_address, item_address, event_type, raw_trace_hash,
decoder_version, confirmation_depth, finality_status,
reorged, captured_at, source_observation_id
UNIQUE(chain, network, tx_hash, event_index, decoder_version)
```

`SCHEMA-P0-004` (P0) — `market_events`:

```text
venue, listing_id/source_record_id, asset_id, event_type,
price_minor, currency, seller/buyer public addresses nullable,
settlement_tx_hash nullable, event_index nullable,
verification_status, price_confidence, observed_at, expires_at,
source_observation_id
CHECK(price_minor > 0); sale requires verified evidence or status != sale
```

`SCHEMA-P0-005` (P0) — `rate_snapshots`:

```text
id UUID, base_currency, quote_currency, rate_minor/decimal,
provider, observed_at, fetched_at, expires_at, status, fallback_reason
CHECK(rate > 0)
```

`SCHEMA-P0-006` (P0) — `valuation_runs` و `report_entitlements`:

```text
valuation_runs(id UUID PK, asset_id, model_version, config_hash,
input_snapshot_hash, output_json, uncertainty_json, status,
started_at, completed_at, persisted_at, audit_persisted)
report_entitlements(id UUID PK, principal_id, asset_id, idempotency_key,
product_type, debit_ledger_id, granted_at, expires_at, snapshot_run_id,
UNIQUE(principal_id, asset_id, idempotency_key))
```

`SCHEMA-P1-001` (P1): migration `number_features` باید runtime columns (`id`/restriction یا query اصلاح‌شده) و `market_registry` dependency را حل کند؛ migration 000070 فعلی با queryهای runtime ناسازگار است، `numbers_audit.md:39-49`.

`SCHEMA-P1-002` (P1): migration constraints برای price مثبت، serial، currency، sale type، venue، confidence، collection/model و source record؛ `crosscutting_audit.md:336-358`.

`SCHEMA-P1-003` (P1): `has_real_volume_badge` default=false؛ placeholder tx/address regex reject؛ بدون tx/event، row حداکثر `observed/unverified`.

---

## 7) ingestion، indexing و finality

### 7.1 Pipeline مشترک

`ING-P0-001` (P0): adapter فقط raw payload/response را با request id و hash persist کند؛ parser نسخه‌دار immutable observation بسازد؛ classifier derived event بسازد؛ read model فقط verified/allowed observations را query کند. TonAPI actions convenience هستند، نه protocol-critical accounting، [TonAPI Events](https://docs.tonapi.io/tonapi/rest-api/events).

`ING-P0-002` (P0): هر worker دارای `run_id`, lease, retry/backoff, DLQ, source health و bounded body/timeout باشد. `io.ReadAll` بدون limit ممنوع، `crosscutting_audit.md:505-524`.

`ING-P0-003` (P0): cursor با `(source, network, collection, partition, last_lt/seqno, last_tx_hash)` در DB و transactionally بعد از batch موفق ذخیره شود؛ replay overlap و unique key duplication-safe.

`ING-P0-004` (P0): `finality_status=unconfirmed|confirmed|finalized|reorged`; metric/aggregate عمومی فقط finalized یا policy مستند confirmed. stream invalidation باید row را re-evaluate کند؛ [TON streaming](https://docs.ton.org/api/streaming/overview)، `official_research.md:164-170`.

`ING-P0-005` (P0): sale decoder ثبت کند: contract address/code hash/version، opcode، query/event id، inbound/outbound amount و recipient، NFT transfer نهایی، block/lt/event index. اگر هر جزء نیست: `transfer_or_unknown`, نه sale. TEP-66 و Getgems source فقط reference implementation هستند، نه proof Fragment fee/contract؛ `official_research.md:148-156`.

`ING-P1-001` (P1, Username): Fragment/TON connector listing/auction/status را جدا ingest کند؛ Telegram association را MTProto/session با visibility و timestamp ذخیره کند؛ auction close را از chain inclusion بگیرد، نه UI submit. [Fragment About](https://fragment.com/about)، `official_research.md:50-55`.

`ING-P1-002` (P1, Numbers): deterministic item address + actual collection + `get_nft_data`/TonAPI + initialized/block snapshot؛ `Verify` بدون این evidence فقط unknown. `numbers_audit.md:23-35`.

`ING-P1-003` (P1, Gifts): Telegram `starGiftUnique`/`UniqueStarGiftValueInfo`، Stars listing/offers و TON export/ownership رویدادهای جدا؛ `host_id` هرگز current wallet owner نیست؛ [Telegram Gifts](https://core.telegram.org/api/gifts)، `official_research.md:84-118`.

`ING-P1-004` (P1): Numbers/Gifts historical ingestion از LT/time watermark + overlap dedupe استفاده کند؛ TON Center offset changing dataset را قطعی نمی‌کند، `official_research.md:174-180`.

`ING-P1-005` (P1): webhook state machine `received→processing→processed|failed→retry/DLQ`; SETNX قبل از commit نباید event را 7 روز گم کند؛ `crosscutting_audit.md:153-194`.

`ING-P1-006` (P1): اگر TonAPI webhook ingest کامل ندارد، route/config/claims حذف شود؛ `200 OK` برای فقط log کردن ممنوع. `crosscutting_audit.md:173-194`.

### 7.2 freshness policy

`ING-P0-006` (P0): TTLهای اولیه و قابل‌تنظیم:
- listing/auction/status: live `<5m`; delayed `5–30m`; stale `>30m`; unavailable بدون observation.
- collection floor/volume: live `<30m`; stale `30m–6h`; unavailable `>6h`، مگر source policy صریح.
- chain owner/event: finalized snapshot معتبر تا observation جدید؛ timestamp read با observed_at عوض نشود.
- rate: TTL provider-specific؛ stale/fallback هیچ‌وقت silently fresh نیست.

مرز دقیق `<`, `=`, `>` باید در tests ثبت شود؛ Gifts audit همین boundaryهای 5m/30m/6h را الزام کرده، `gifts_audit.md:227-239`.

---

## 8) valuation methodology و عدم‌قطعیت

### 8.1 قواعد مشترک

`VAL-P0-001` (P0): valuation input snapshot immutable: identity evidence، verified comps، market regime، rate snapshot، model/config version. Output شامل `point_estimate|null`, `interval_low/high|null`, `currency`, `basis`, `sample_size`, `effective_sample_size`, `coverage`, `uncertainty`, `model_version`, `data_cutoff`.

`VAL-P0-002` (P0): no-data نتیجه `unavailable`/`insufficient_evidence` است؛ not arbitrary recent sale، static floor، یا zero. Confidence model از comparable count به calibration sample تبدیل نشود؛ `username_audit.md:421-438` و `crosscutting_audit.md:219-237`.

`VAL-P0-003` (P0): comps filter strict: same vertical/collection/class، matching traits/pattern/length، verified event، non-reorg، freshness window، venue/currency normalization؛ each comp reason/similarity/weight/provenance. Broad prior فقط labeled و down-weighted.

`VAL-P0-004` (P0): last sale anchor hard floor نیست؛ down-market test باید low/expected را زیر previous high sale اجازه دهد. Numbers finding `N-09` این clamp را release-risk دانسته (`numbers_audit.md:128-136`).

`VAL-P1-001` (P1): model card: train/eval window، n، log-MAE/MAPE، 80/95% interval coverage، cohort error، calibration version، data cutoff. تا backtest زمان‌محور نداریم label `heuristic estimate`/`uncalibrated`، نه statistical confidence؛ `numbers_audit.md:140-150`.

`VAL-P1-002` (P1): projections/rental/liquidity/collateral/DeFi و crafting EV فقط `scenario|experimental` با assumptions؛ default numeric output و توصیه قطعی ممنوع؛ `numbers_audit.md:154-166`; `gifts_audit.md:155-169`.

### 8.2 Username

`VAL-USER-C-001` (P1, Collection): floor = cheapest fresh actionable listing (تعریف صریح)، median/realized volume فقط sales verified و window مشخص؛ listing value با realized sale قاطی نشود. language/brand/rarity panel `estimated` است مگر evidence sample.

`VAL-USER-S-001` (P0, Single): valuation فقط بعد از canonical username + item/collection existence یا evidence policy؛ `on_auction`, `on_sale`, `purchase_available` status مستقل. Historical anchor/comparable با type صحیح؛ estimated date exact transaction نیست. `username_audit.md:177-208`.

`VAL-USER-S-002` (P1): AVM model version در config/API/cache/certificate/audit یکی باشد؛ v7/v8 drift ممنوع، `username_audit.md:421-438`.

`VAL-NUM-C-001` (P1, Collection): cohort جدا برای Genesis/standard، number pattern، restriction/color، venue/time؛ `global rank` فقط pinned full scoring snapshot. supply class تعریف predicate و denominator داشته باشد؛ overlapping clubs “exact supply” نیست. `numbers_audit.md:276-299`.

`VAL-NUM-S-001` (P0, Single): identity unverified => no price/certificate/portfolio/link. 4-digit Genesis و 8-digit standard ناهم‌کلاس comp نمی‌گیرند. `rent/liquidity/collateral` حذف یا scenario.

`VAL-GIFT-C-001` (P1, Collection): separate issued/upgraded/on-chain/off-chain supply، Stars و TON venues، model/trait matrix. model/cell floor فقط exact evidence یا null؛ catalog rarity `estimated/catalog` نه verified. `gifts_audit.md:99-113`.

`VAL-GIFT-S-001` (P0, Single): identity resolver + `serial 1..authoritative_supply`; exact traits فقط live instance evidence. `gift_id`/serial/slug و crafted/export state preserve. `UniqueStarGiftValueInfo` estimate است، executable quote نیست، `official_research.md:100-110`.

`VAL-GIFT-S-002` (P0): best venue null مگر floor/listing/volume تازه، executable deep link، currency/custody known؛ unavailable venue rank نمی‌گیرد. `gifts_audit.md:115-145`.

`VAL-GIFT-S-003` (P1): crafting input server-resolved، same base type، 1–4 owned/live items طبق Telegram؛ outcome odds source/version/observation، نه client chance/10-GRAM. [Telegram Gifts](https://core.telegram.org/api/gifts)، `official_research.md:118-126`.

---

## 9) UX states و تفکیک Collection/Single Item

`UX-P0-001` (P0): badge vocabulary در همه صفحات یکسان: **Observed**, **Verified**, **Estimated**, **Stale**, **Unavailable**, **Unknown**, **Experimental**؛ کنار badge source و “as of” و توضیح method. واژه `live` فقط provider+freshness policy pass.

### 9.1 Username

- `UX-USER-C-001` (P1, Collection): list/search با filter `available/purchase_available/on_auction/on_sale/sold/source_unavailable`، sort price/high-low/recent/ending؛ floor/volume/graph unavailable state؛ deep-link Fragment. این الگو با مشاهده بازار Fragment سازگار است، اما به‌جای کپی claim، evidence می‌نماید، `competitor_research.md` بخش UX Fragment.
- `UX-USER-S-001` (P1, Single): canonical username، Fragment URL، TON collection/item اگر موجود، status، auction clock با `observed_at`; timeline transfer/sale/bid جدا؛ wallet عمومی فقط address، نه هویت حقیقی؛ Telegram binding/active جدا.
- `UX-USER-S-002` (P0): locked report هرگز price/comps/history owner/certificate را leak نکند؛ report cache account-bound.

### 9.2 Anonymous number

- `UX-NUM-C-001` (P1, Collection): filter pattern/length/color/status/restriction، source timestamp، pagination/coverage؛ `mask` هر ردیف را با predicate verify کند.
- `UX-NUM-S-001` (P0, Single): `format valid` از `collection verified`, `minted`, `initialized`, `current owner`, `login binding`, `code availability` جدا؛ format-valid random number صفحه قیمت ندارد.
- `UX-NUM-S-002` (P1): phone-to-wallet/Telegram identity join در UI نمایش داده نشود مگر authorized; login code/session controls خارج scope.

### 9.3 Telegram gifts

- `UX-GIFT-C-001` (P1, Collection): catalog metadata جدا از market cards؛ venue table با custody/currency/freshness؛ trait matrix با formula/version/sample؛ chart فقط realized sale points، listing series جدا؛ cross-market spread actionable فقط source fresh.
- `UX-GIFT-S-001` (P0, Single): media، collection/model/backdrop/symbol، serial، owner/host، export state، comparable sales، venue links و evidence drawer. host ≠ owner باید متن «hosted, not owned» داشته باشد؛ `official_research.md:94-98`.
- `UX-GIFT-S-002` (P0): missing traits/venue/rate/projection `N/A` + reason؛ no `CERT-GF-8839`, hardcoded rarity or exact badge; `gifts_audit.md:155-169`.

`UX-P1-001` (P1): loading/error/stale/partial UI جدا از legitimate zero. No-source collection: null/empty + retry, نه fabricated numeric. `username_audit.md:372-386`.
`UX-P2-001` (P2): همه visible strings i18n؛ fa RTL، numeric tokens `dir=ltr`؛ axe/keyboard/320/360/390px pass، `crosscutting_audit.md:483-503`.

---

## 10) security و privacy

`SEC-P0-001` (P0): order/payment/entitlement principal-bound؛ status endpoint owner check؛ request idempotency key؛ no raw payment payload/internal user id. `username_audit.md:292-307`.

`SEC-P0-002` (P0): debit ledger authoritative and single mutation. Username FRG double deduction (`username_audit.md:109-126`) و Gifts transaction/Pool mismatch (`gifts_audit.md:131-153`) باید با DB transaction/row lock/unique entitlement حل شود.

`SEC-P0-003` (P0): report cache key `principal_id + session_generation + canonical_asset`; logout/account switch purge payload/index. Server authorization هر read. `username_audit.md:227-242`.

`SEC-P0-004` (P0): certificate key HMAC/asymmetric مستقل از JWT/webhook/encryption؛ private key خارج source، key id/rotation/revocation/expiry. `BOT_TOKEN_KEY` نباید از JWT/webhook fallback شود، `crosscutting_audit.md:298-315`.

`SEC-P1-001` (P1): Mini App init data server-side validate و actions به Telegram user bind؛ client price/gift/buyer/completion trusted نیست. [Telegram Mini Apps](https://core.telegram.org/bots/webapps)، `official_research.md:128-136`.

`SEC-P1-002` (P1): avatar/share proxy allowlist host، block loopback/RFC1918/link-local/IPv6 private/DNS rebinding، no untrusted redirects، body/image size limit، TTL cleanup. `crosscutting_audit.md:317-334`; `username_audit.md:388-403`.

`SEC-P1-003` (P1): share upload auth یا strict anonymous rate-limit، magic bytes/dimensions validate، random path 0600/short TTL. `username_audit.md:388-403`.

`SEC-P1-004` (P1): authenticated rate limiting by principal+asset; X-Forwarded-For only trusted proxy; client spoof bypass ممنوع، `gifts_audit.md:171-185`.

`SEC-P2-001` (P2): `/metrics` production بدون token startup fail یا internal/mTLS؛ high-cardinality IDs labels نشوند، `crosscutting_audit.md:466-481`.

---

## 11) performance و SLO

اعداد زیر **هدف طراحی قابل‌اندازه‌گیری** هستند، نه claim وضعیت فعلی؛ هیچ runtime/load test در audit اجرا نشده (`crosscutting_audit.md:7-18`).

`SLO-P1-001` (P1): Collection read با cache گرم p95 ≤ 500ms، p99 ≤ 1.5s؛ cache سرد/یک provider p95 ≤ 2s، p99 ≤ 5s؛ timeout کل request 8s و response partial/unavailable، نه hang.

`SLO-P1-002` (P1): Single Item curiosity p95 ≤ 800ms؛ paid report با resolverهای parallel p95 ≤ 5s، p99 ≤ 10s؛ async audit persistence نباید run_id جعلی بسازد؛ اگر persistence pending است `audit_persisted=false`.

`SLO-P1-003` (P1): fresh listing/auction ingest lag p95 ≤ 5m، collection snapshot p95 ≤ 30m، chain finalized ingest lag p95 ≤ 10m؛ breach در UI stale.

`SLO-P1-004` (P1): payment success response فقط پس از durable entitlement؛ p95 ≤ 3s؛ duplicate success rate صفر؛ failed transaction debit leakage صفر.

`SLO-P2-001` (P2): Gifts Intel read model؛ query full-table per request ممنوع. p95 target ≤ 750ms dataset benchmark حداقل 1M market_events؛ rows scanned و cache hit metric.

`SLO-P2-002` (P2): upstream TonAPI/TonCenter rate budget config، timeout/backoff/circuit breaker؛ محدودیت مستند TonAPI/TON Center را runtime config بداند و 429 را backoff کند، `official_research.md:164-180`.

`SLO-P2-003` (P2): memory body limit برای upstream و uploads؛ max response/request size در contract.

---

## 12) observability

`OBS-P1-001` (P1): metrics بدون asset/user labels پرکاردینالیتی:

- `ifragment_http_requests_total{vertical,surface,status_class}` و latency histogram
- `ifragment_source_requests_total{vertical,source,outcome}`، timeout/429
- `ifragment_observation_age_seconds{vertical,field,status}` و stale ratio
- `ifragment_indexer_lag_seconds{vertical,source,network}`، checkpoint age، replay/reorg count
- `ifragment_valuation_runs_total{vertical,outcome,model_version}` و `uncalibrated_ratio`
- `ifragment_payment_total{product,outcome}`، `entitlement_duplicate_total`، `debit_rollback_total`
- `ifragment_webhook_queue_depth`، DLQ depth، retry count
- `ifragment_cache_hits_total{surface,status}`

`OBS-P1-002` (P1): alert thresholds: synthetic/placeholder insert >0؛ verified output without evidence >0؛ reorged aggregate >0؛ payment debit without entitlement >0؛ checkpoint age >2× cadence؛ DLQ nonzero >15m؛ stale ratio >policy threshold; p99 SLO breach 10m.

`OBS-P1-003` (P1): structured audit log برای `run_id`, `source_record_id`, `principal_hash`, `asset_key_hash`, outcome/error code؛ wallet addresses در log mask/hashed؛ secrets/payload خام log نشود.

`OBS-P2-001` (P2): dashboard جدا برای collection/single و هر vertical؛ source-health و partial section visible. Metrics فعلی پوشش کافی ندارند، `crosscutting_audit.md:446-464`.

`OBS-P2-002` (P2): trace spans adapter→raw observation→parser→read model→valuation→report persistence؛ correlation id در API و worker.

---

## 13) migration و backfill

`MIG-P0-001` (P0): ابتدا schema additive: evidence/source/status/freshness/chain finality columns و observation tables؛ هیچ destructive drop تا backfill/audit complete.

`MIG-P0-002` (P0): همه رکوردهای موجود با origin نامعلوم به `legacy_unknown`/`unverified` منتقل شوند؛ نه verified/live. Synthetic seed rows quarantine/delete شوند؛ IDs و deletion report حفظ شود.

`MIG-P0-003` (P0): backfill raw tx/trace فقط از source قابل‌دسترسی؛ اگر proof نیست event=`unclassified_transfer` و sale analytics exclude. No fabricated tx/address/date.

`MIG-P0-004` (P0): username HistoricalSales/anchors split: `sale_observation` فقط proof-bearing؛ `model_anchor`/`editorial_reference` جدا، estimated date flag. `username_audit.md:177-208`.

`MIG-P0-005` (P0): Numbers `number_features` migration/query reconcile؛ migration 000070→latest clean DB و existing DB هر دو smoke؛ `numbers_audit.md:39-49`.

`MIG-P1-001` (P1): Gifts catalog واحد 120 ID/name/supply/model با version/hash؛ conflict fail-closed، نه merge silent. `gifts_audit.md:75-81`.

`MIG-P1-002` (P1): historical sale unique `(chain,network,tx_hash,event_index,decoder_version)`؛ gift venue source record idempotency با tx null هم؛ stale rows retain but read query filters.

`MIG-P1-003` (P1): durable checkpoint migration با lease/scope/overlap؛ Numbers memory `lastOffset` حذف. `numbers_audit.md:102-114`; `crosscutting_audit.md:279-296`.

`MIG-P1-004` (P1): entitlement migration idempotency key و ledger reference؛ existing debits audit/reconcile؛ balance invariant before enable writes.

`MIG-P2-001` (P2): materialized aggregates/rebuild command از immutable observations؛ reorg correction rebuildable؛ daily snapshot hash و parser/model versions.

---

## 14) Acceptance criteria — Given / When / Then

### 14.1 هویت و provenance

- `AC-P0-001`: **Given** random valid-looking 8-digit number **When** `/numbers/verify` با DB/chain no record فراخوانی شود **Then** `format_valid=true` ولی `collection_verified`, `is_minted`, `item_address`, `initialized` همگی `unknown/false` و هیچ price/certificate برنگردد. (شاهد: `numbers_audit.md:23-35`.)
- `AC-P0-002`: **Given** gift unknown collection یا serial `0`, negative یا `> authoritative_supply` **When** Single Item resolve شود **Then** 404/422، بدون valuation/rarity/certificate/link. (شاهد: `gifts_audit.md:83-97`.)
- `AC-P0-003`: **Given** username association مشاهده نشده **When** wallet owner known باشد **Then** utility `unknown/none`، نه `active`; binding با wallet owner merge نشود. [Telegram Fragment API](https://core.telegram.org/api/fragment).
- `AC-P0-004`: **Given** any sale row missing tx/event proof **When** API builds history/comps **Then** type `observed/unverified/archive_anchor` و excluded from verified sales/realized volume.

### 14.2 collection no-data و synthetic quarantine

- `AC-P0-005`: **Given** empty DB و همه adapters unavailable **When** هر Collection endpoint فراخوانی شود **Then** `data_status=unavailable`, numeric market fields null، items/history empty، source errors visible؛ هیچ default static عددی.
- `AC-P0-006`: **Given** stale snapshot **When** collection read شود **Then** original `observed_at` حفظ، `status=stale`، best floor/arbitrage/verified badge انتخاب نشود.
- `AC-P0-007`: **Given** source returns one valid listing **When** collection/intel builds aggregates **Then** only that source contributes; model/cell دیگر collection floor را inherit نکند.
- `AC-P0-008`: **Given** missing history **When** chart renders **Then** “history unavailable” و zero generated points؛ no synthetic OHLC/sinusoid.

### 14.3 sales/finality/reorg

- `AC-P0-009`: **Given** NFT transfer with no allowlisted market contract/payment settlement **When** indexer parses trace **Then** `unclassified_transfer`, no sale/comparable.
- `AC-P0-010`: **Given** bid then refund/outbid **When** indexer runs **Then** bid/refund events remain distinct and no sale.
- `AC-P0-011`: **Given** finalized sale then chain invalidation/reorg **When** reconciliation receives event **Then** row `reorged`, excluded from aggregates, corrected read model and audit event emitted.
- `AC-P1-001`: **Given** worker crash after side effect before checkpoint **When** restart/replay occurs **Then** exactly one derived event and histogram/count unchanged.

### 14.4 valuation و uncertainty

- `AC-P0-012`: **Given** no verified same-cohort comps/rate **When** valuation called **Then** `point_estimate=null` یا `insufficient_evidence`; no 1.42/5.20/7.25 fallback as live USD.
- `AC-P1-002`: **Given** previous sale high but current verified cohort down-market **When** valuation runs **Then** low/expected may decrease below previous sale; no hard clamp.
- `AC-P1-003`: **Given** confidence sample is only comparable count and no backtest calibration **When** report built **Then** `uncalibrated`/low evidence; not statistical confidence.
- `AC-P1-004`: **Given** projection/rental/liquidity/craft model lacks empirical inputs **When** report shown **Then** `experimental` scenario with assumptions/interval; recommendation not financial certainty.

### 14.5 payment/security

- `AC-P0-013`: **Given** one sufficient balance and two concurrent identical unlocks **When** both execute **Then** one debit + one entitlement/report; second idempotently returns same result or explicit conflict; no double debit.
- `AC-P0-014`: **Given** valuation or report insert fails **When** debit transaction completes **Then** debit rolls back/no entitlement; no swallowed persistence error.
- `AC-P0-015`: **Given** User B order id/payload of User A **When** status requested **Then** indistinguishable 403/404; no raw payload/user id.
- `AC-P0-016`: **Given** browser cache from User A **When** User B/account switch reads same asset **Then** no report payload; logout clears payload/index.
- `AC-P0-017`: **Given** attacker creates public SHA digest **When** certificate verify called **Then** rejected; valid key-signed payload only passes; tamper/expiry/replay fail.

### 14.6 API/UI

- `AC-P1-005`: **Given** backend returns every runtime username status **When** generated frontend client decodes **Then** all enum values map; unknown safe fallback not available/taken.
- `AC-P1-006`: **Given** route inventory and OpenAPI generated **When** CI compares **Then** no missing/extra route without explicit deprecation.
- `AC-P1-007`: **Given** report field null/unknown **When** UI renders **Then** N/A + status/reason; no hardcoded certificate/rarity/floor/rate.
- `AC-P1-008`: **Given** unavailable venue with fee metadata **When** exit planner ranks **Then** venue not actionable/rank 1; `best_venue=null` if no fresh route.
- `AC-P2-001`: **Given** Persian viewport 320/360/390px **When** collection and single pages open **Then** no clipping/overlap, keyboard/focus/axe critical violations zero.

### 14.7 contract/schema

- `AC-P1-009`: **Given** clean DB migration from zero through latest **When** Verify/List/Mask/Gifts/Username smoke run **Then** no missing-column/table errors; down/up test documented.
- `AC-P1-010`: **Given** invalid negative price, serial 0, unsupported currency, placeholder tx **When** DB insert attempted **Then** CHECK/validation rejects.
- `AC-P2-002`: **Given** provider response > configured body limit or slow > timeout **When** adapter called **Then** bounded memory, timeout error/status, no OOM or hung request.

---

## 15) test matrix

| ID | priority | scope | test | pass criterion |
|---|---|---|---|---|
| `T-P0-001` | P0 | all | empty DB + all providers down | no synthetic records/numbers; null/empty/unavailable |
| `T-P0-002` | P0 | identity | random number / unknown gift / invalid username | no verified/minted/valuation/side effect |
| `T-P0-003` | P0 | provenance | missing tx, placeholder address, static anchor | not sale/on-chain/verified; evidence status preserved |
| `T-P0-004` | P0 | chart | empty, 2 real points, stale points | exact real points or unavailable; zero generated points |
| `T-P0-005` | P0 | money | concurrent username FRG/Gifts coin/credit unlock | one debit + one entitlement; rollback on error |
| `T-P0-006` | P0 | auth/privacy | cross-user order/cache access | denied; no payload/report leak |
| `T-P0-007` | P0 | certificate | forged/tampered/expired/rotated key | verify fail except active valid signature |
| `T-P0-008` | P0 | rate | provider timeout/0/negative/stale | USD null or explicit fallback, source/age visible |
| `T-P1-001` | P1 | sale parser | purchase, bid, refund, transfer, royalty, unknown market | only decoder-qualified final sale |
| `T-P1-002` | P1 | finality | confirm then reorg/invalidation | reorged excluded; replay idempotent |
| `T-P1-003` | P1 | checkpoint | crash before/after upsert/checkpoint | no gaps/dupes; checkpoint authoritative |
| `T-P1-004` | P1 | contracts | router/OpenAPI/client generated diff | zero unexplained mismatch |
| `T-P1-005` | P1 | schema | clean migration + invalid inserts | migration pass; constraints reject |
| `T-P1-006` | P1 | valuation | cohort, down-market, no comps, calibrated/un calibrated | no hard clamp; intervals/basis explicit |
| `T-P1-007` | P1 | portfolio | 0/50/51/duplicate/partial source | coverage/cursor; no complete PnL claim on partial |
| `T-P1-008` | P1 | security | SSRF/private IP/redirect/oversized image/XFF | blocked/rate-limited/TTL cleanup |
| `T-P2-001` | P2 | performance | Gifts 1M events aggregate/read model | p95/p99 SLO, bounded rows scanned |
| `T-P2-002` | P2 | observability | metrics auth/cardinality/alerts | protected endpoint; alerts fire on injected fault |
| `T-P2-003` | P2 | frontend | RTL/mobile/axe/keyboard/i18n | no critical/serious a11y; key parity |
| `T-P2-004` | P2 | cache | cache hit retains observed_at/age | stale not relabeled fresh |
| `T-P2-005` | P2 | resilience | 429/timeout/body > limit/circuit breaker | bounded retry, partial/unavailable, no OOM |

**وضعیت baseline:** اجرای Go/Pnpm/build/load/validator در audit ممکن نبود چون ابزارهای `go`, `pnpm`, `npm` در محیط موجود نبودند؛ این یک limitation ثبت‌شده است و pass محسوب نمی‌شود، `crosscutting_audit.md:7-18`، `gifts_audit.md:240-254`.

---

## 16) rollout phases

`REL-P0-001` — **Phase 0: freeze claims (هم‌اکنون، release gate).** Monetized live/verified claims خاموش؛ feature flag `evidence_first=true`; synthetic/demo table از production query جدا؛ همه P0 tests نوشته و در CI اضافه.

`REL-P0-002` — **Phase 1: schema/provenance.** additive migrations، observation/evidence/RateSnapshot/chain event، catalog canonicalization، quarantine legacy؛ backfill audit report؛ deploy shadow-read فقط.

`REL-P0-003` — **Phase 2: ingestion/finality.** raw TON/Telegram/venue adapters، decoder/version registry، durable checkpoints، reorg reconciliation، source health، DLQ؛ compare old/new read models، صفر synthetic.

`REL-P0-004` — **Phase 3: identity + API contract.** strict resolver/serial bounds، route/OpenAPI generated contract، status/auth semantics، no-data UX؛ Numbers migration smoke.

`REL-P0-005` — **Phase 4: valuation/payments.** model card/uncertainty، strict comps، signed certificate، atomic entitlements, owner-bound payment status; first internal users only.

`REL-P1-001` — **Phase 5: canary read-only.** 1% read traffic، no public buy/financial CTA؛ monitor stale ratio, evidence failures, SLO, error/partial status for ≥24h.

`REL-P1-002` — **Phase 6: limited monetized canary.** max 1% eligible principals، daily reconciliation debit/entitlement، instant rollback on `synthetic>0`, debit leakage >0، cross-user auth leak, or contract mismatch.

`REL-P2-001` — **Phase 7: general availability/hardening.** only after 7 days no P0 alerts, SLO target met, migration/backfill reconciled، a11y/i18n/perf tests green. P2 experimental modules (craft/projection/portfolio) default off unless criteria pass.

---

## 17) Definition of Done

`DOD-P0-001` (P0): تمام `RB-P0-*` و `AC-P0-*` سبز؛ هیچ synthetic/placeholder live/verified در DB/API/UI؛ static scan forbidden constants pass.

`DOD-P0-002` (P0): identity، provenance، ownership/host، sale taxonomy، finality/reorg و timestamp semantics در schema/API/UI مستند و integration-tested.

`DOD-P0-003` (P0): concurrent payment/credit tests نشان دهند debit leak=0، duplicate entitlement=0، owner isolation=100%؛ audit persistence status صادقانه.

`DOD-P1-001` (P1): route inventory با OpenAPI و generated frontend types exact؛ clean migration/up-down، DB constraints، checkpoint/replay/DLQ و source-health pass.

`DOD-P1-002` (P1): model card و valuation response uncertainty/sample/basis/version دارند؛ no-data و stale behavior تست شده؛ best venue/portfolio فقط evidence-gated.

`DOD-P1-003` (P1): SLO dashboards/alerts، structured audit logs، metrics auth و cardinality review فعال؛ runbook برای provider outage/reorg/payment reconciliation وجود دارد.

`DOD-P2-001` (P2): load/performance، a11y/RTL/mobile/i18n، cache provenance و read-model tests در CI؛ claims/docs/source table با implementation sync.

`DOD-P2-002` (P2): release sign-off شامل owner محصول، backend/data، security و finance/integrity باشد؛ هر exception دارای شناسه، expiry و risk acceptance کتبی. بدون exception، هیچ P0 باز قابل release نیست.

---

## منابع رسمی و شواهد کلیدی

- Telegram Fragment API: https://core.telegram.org/api/fragment
- `fragment.getCollectibleInfo`: https://core.telegram.org/method/fragment.getCollectibleInfo
- Fragment About/Terms: https://fragment.com/about ، https://fragment.com/terms
- Telegram Gifts API / StarGift / UniqueStarGiftValueInfo: https://core.telegram.org/api/gifts ، https://core.telegram.org/type/StarGift ، https://core.telegram.org/type/payments.UniqueStarGiftValueInfo
- Telegram Gift Marketplace: https://telegram.org/blog/gift-marketplace-and-more
- Telegram Move Gifts to Blockchain: https://telegram.org/blog/wear-gifts-blockchain-and-more
- Telegram Mini Apps/Bot features: https://core.telegram.org/bots/webapps ، https://core.telegram.org/bots/features
- TEP-62 NFT: https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md
- TEP-64 metadata: https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md
- TEP-66 royalty: https://github.com/ton-blockchain/TEPs/blob/master/text/0066-nft-royalty-standard.md
- TON address API: https://docs.ton.org/api/v2/accounts/get-address-information
- TON streaming/finality: https://docs.ton.org/api/streaming/overview
- TonAPI Events: https://docs.tonapi.io/tonapi/rest-api/events
- TON Center NFT APIs: https://docs.ton.org/api/v3/nfts/get-nft-items ، https://docs.ton.org/api/v3/nfts/get-nft-sales-and-auctions ، https://docs.ton.org/api/v3/nfts/get-nft-transfers
- مبنای رقیب/الگوی UX فقط benchmark است، نه source of truth: Fragment https://fragment.com/username، Getgems https://getgems.io، GMC https://gmc.mystars.tg/، TON Indexer https://github.com/toncenter/ton-indexer، Anton https://github.com/tonindexer/anton؛ جزئیات در `competitor_research.md`.

