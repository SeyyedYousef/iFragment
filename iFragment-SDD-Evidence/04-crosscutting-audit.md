# ممیزی Cross-cutting مشترک سه Vertical: Username / Numbers / Gifts

تاریخ ممیزی: 2026-03-02  
دامنه: کد مشترک و مسیرهای مربوط به `username`، `numbers` و `gifts` از منظر امنیت، صحت مالی، freshness/provenance، idempotency/reorg، دیتابیس، API contract، observability، accessibility/i18n/RTL/mobile، performance و test gaps.  
وضعیت تغییرات: **هیچ کدی تغییر نکرده است.**

## محدودیت‌های اجرایی

- `go test ./...` و `go vet ./...` اجرا نشدند: ابزار `go` در محیط موجود نبود.
- `pnpm test:run`، `pnpm build`، `pnpm lint` و `pnpm check:i18n` اجرا نشدند: ابزار `pnpm` در محیط موجود نبود.
- بنابراین یافته‌های زیر از بازبینی ایستا، جست‌وجوی source و بررسی migration/route/schema استخراج شده‌اند؛ اجرای runtime، integration test، load test، OpenAPI validator و accessibility runner تأیید نشده است.
- هیچ ادعایی درباره وضعیت production یا داده واقعی runtime مطرح نمی‌شود.

## خلاصه اولویت‌ها

| اولویت | تعداد | موضوعات اصلی |
|---|---:|---|
| P0 | 4 | داده مالی مصنوعی در Gifts، داده تاریخی مصنوعی در Numbers، certificate قابل جعل، false-live/provenance در Username |
| P1 | 10 | webhook replay loss، parser مالی Numbers، نرخ‌های ناسازگار، confidence calibration، reorg/finality، encryption key separation، SSRF، schema constraints، OpenAPI drift، observability |
| P2 | 8 | cache timestamp، Gifts aggregate performance، attribution، duplicate routes/dead code، accessibility/i18n، response limits، metrics exposure، test gaps |

## تعریف اقدام‌ها

- **add**: قابلیت/کنترل/تست جدید لازم است.
- **change**: رفتار یا contract موجود باید اصلاح شود.
- **remove**: قابلیت، label، fallback یا route گمراه‌کننده/dead باید حذف شود.

---

# P0 — مسدودکننده انتشار

## P0-01 — Gifts داده‌های synthetic را به‌عنوان market data تولید و ذخیره می‌کند

**نوع اقدام:** `remove + change + add`  
**حوزه:** correctness مالی، provenance/confidence، fake live labels

### شواهد

- `backend/internal/service/gifts/ingestor/ingestor.go:214-229` برای نبود داده واقعی، `totalSupply=10000`، `upgradedCount=18%` و `holdersCount=72%` را محاسبه می‌کند.
- `backend/internal/service/gifts/ingestor/ingestor.go:251-291` مقادیر ATH/ATL، حجم 24h/7d/30d، turnover، تغییر قیمت و market cap را با ضرایب ثابت تولید می‌کند.
- `backend/internal/service/gifts/ingestor/ingestor.go:374-420` قیمت venueها را با ضرایب ثابت ساخته و فرصت arbitrage را در DB ذخیره می‌کند.
- `backend/internal/service/gifts/ingestor/ingestor.go:427-455` شش wallet ثابت را با نام، آدرس، تعداد دارایی، ارزش و زمان فعالیت seed می‌کند.
- `backend/internal/handler/webhook_gifts.go:146` متن «داده‌های ۱۰۰٪ نیتیو تلگرام، فرگمنت و گت‌جمز بدون وابستگی به اسکرپر» ارسال می‌کند.
- `backend/internal/service/gifts/gifts_service.go:497-500` با وجود هر sale در جدول، وضعیت کلی را `live` می‌کند.

### ریسک

کاربر ممکن است market cap، حجم، whale profile، floor و arbitrage را داده واقعی و قابل معامله تلقی کند. این مورد مستقیماً روی تصمیم مالی اثر دارد و باید پیش از انتشار مسدود شود.

### اقدام اصلاحی

- **remove:** تمام seed/محاسبه‌های synthetic از market tables و responseهای live حذف شوند.
- **change:** اگر fallback محصولاً لازم است، در مدل جداگانه با `data_status=estimated`، `confidence=0` یا confidence صریح، `provenance.kind=synthetic` و timestamp نگهداری شود؛ هرگز در فیلد live یا verified قرار نگیرد.
- **change:** status کلی Gifts فقط از sourceهای موفق همان response مشتق شود؛ یک sale یا یک snapshot نباید کل response را `live` کند.
- **remove/change:** متن‌های `100% native`، `without scraper`، `real market` و مشابه حذف یا به claim مشروط به evidence تبدیل شوند.
- **add:** per-field provenance شامل source، observed_at، age_seconds، confidence، status و method محاسبه.

### Acceptance criteria

1. در DBهای `gift_collections`، `gift_sales`، `venue_snapshots`، `gift_arbitrage_opportunities` و `gift_whale_wallets` هیچ مقدار مصنوعی بدون flag صریح ثبت نشود.
2. پاسخ `/gifts/intel`، `/gifts/collection-intel`، `/gifts/arbitrage` و `/gifts/whales` برای مقدار تخمینی `data_status=estimated` و source مجزا بدهد.
3. `data_status=live` فقط وقتی مجاز باشد که تمام metricهای نمایشی آن response منبع معتبر و freshness مجاز داشته باشند.
4. هیچ whale/wallet/venue مصنوعی با برچسب verified/live به client ارسال نشود.
5. UI و bot هر دو status و provenance را نمایش دهند و claim unsupported نداشته باشند.

---

## P0-02 — Numbers fallback تاریخی و chart مصنوعی به‌عنوان market intelligence عرضه می‌شود

**نوع اقدام:** `remove + change + add`  
**حوزه:** correctness مالی، provenance، fake live labels

### شواهد

- `backend/internal/service/numbers/numbers_service.go:284-305` floor baseline ثابت و status `syncing` ایجاد می‌کند.
- `backend/internal/service/numbers/numbers_service.go:415-440` در نبود scrape/DB، پنج Hall of Fame با قیمت‌های ثابت 490,000 تا 666,666 TON تولید می‌کند.
- `backend/internal/service/numbers/numbers_service.go:443-457` percentile chart را با ضرایب ثابت 1.00، 1.45 و 2.80 می‌سازد.
- `frontend/src/entities/numbers/api/numbersApi.ts:109-123` fallback کلاینتی جداگانه با `insufficient_data` دارد و با رفتار backend هم‌contract نیست.

### اقدام اصلاحی

- **remove:** Hall of Fame و chart ثابت از مسیر production حذف شوند.
- **change:** نبود upstream/DB فقط `insufficient_data` یا `unavailable` بدهد.
- **change:** هر sale تاریخی باید transaction hash، source URL، observed_at، verification state و confidence داشته باشد.
- **add:** contract test که ثابت کند شکست upstream هرگز به اعداد تاریخی hardcoded تبدیل نمی‌شود.

### Acceptance criteria

1. در نبود source معتبر، آرایه‌های Hall of Fame/chart خالی یا صریحاً `estimated` باشند.
2. رکوردهای تاریخی فاقد hash/منبع با label verified نمایش داده نشوند.
3. backend و frontend روی enumهای status و semantics یکسان باشند.
4. قیمت‌های ثابت در production response با static scan و test regression قابل شناسایی نباشند.

---

## P0-03 — Valuation certificate قابل جعل است اما Cryptographically Verified نامیده می‌شود

**نوع اقدام:** `change + add`  
**حوزه:** security، provenance

### شواهد

- `backend/internal/service/username/avm/valuation.go:203-207` verify فقط SHA-256 عمومی payload را محاسبه می‌کند.
- `backend/internal/service/username/avm/valuation.go:1815-1818` signature نیز SHA-256 بدون secret/private key است.
- `backend/internal/service/username/avm/valuation.go:1865-1872` badge `Cryptographically Verified` برمی‌گرداند.

### اقدام اصلاحی

- **change:** HMAC با secret اختصاصی یا امضای asymmetric با private key خارج از source استفاده شود.
- **add:** key version، rotation، revocation و public-key discovery/verification.
- **change:** verify باید timestamp، version، run ID، payload hash و expiration را بررسی کند.
- **remove:** label `Cryptographically Verified` از مسیر legacy تا زمان verify واقعی حذف شود.

### Acceptance criteria

1. مهاجم بدون secret/private key نتواند certificate معتبر تولید کند.
2. تغییر هر فیلد مهم (`username`, `model`, `expected`, `confidence`, `timestamp`) verify را fail کند.
3. certificate منقضی/revoked رد شود.
4. تست forged signature، tampering، replay و key rotation وجود داشته باشد.

---

## P0-04 — Username پاسخ‌هایی با badgeهای false-live و audit ID مصنوعی تولید می‌کند

**نوع اقدام:** `remove + change + add`  
**حوزه:** provenance، confidence، cache/freshness، correctness مالی

### شواهد

- `backend/internal/handler/username_public.go:621-627` در خطای rate مقدار ثابت `7.25` را استفاده می‌کند.
- `backend/internal/service/username/analysis.go:1597-1603` fallback را stale علامت می‌زند، اما مسیر handler خطای مستقیم provenance کامل را حفظ نمی‌کند.
- `backend/internal/service/username/avm/valuation.go:1865-1870` بدون توجه به evidence، badgeهای `Live - Fragment`، `On-chain - TON` و `Realtime` را می‌سازد.
- `backend/internal/service/username/avm/valuation.go:1581-1587` در شکست audit DB، `synthetic runID` تولید می‌کند.

### اقدام اصلاحی

- **remove:** badgeهای ثابت live/on-chain/realtime.
- **change:** badge از evidence واقعی source، age، status و confidence مشتق شود.
- **change:** در نبود persistence، `run_id` معتبر ساخته نشود؛ مقدار null یا status `audit_unavailable` برگردد.
- **add:** `source_timestamp`, `fetched_at`, `age_seconds`, `confidence_basis`, `audit_persisted` در DTO.

### Acceptance criteria

1. هیچ response فاقد live listing/confirmed sale با badge live/on-chain/realtime برنگردد.
2. fallback rate همیشه source=fallback، stale=true و age نامعلوم/واقعی داشته باشد.
3. synthetic run ID در API یا badge audit نمایش داده نشود.
4. test matrix شامل DB down، upstream down، stale cache و no-evidence باشد.

---

# P1 — اصلاح لازم پیش از release عمومی بعدی

## P1-01 — Webhook پس از panic update را برای ۷ روز گم می‌کند

**نوع اقدام:** `change + add`  
**حوزه:** idempotency، reliability، observability

### شواهد

- `backend/internal/handler/webhook.go:282-293` پیش از پردازش `SETNX(updateKey, 7d)` انجام می‌شود.
- `backend/internal/handler/webhook_worker.go:37-45` panic فقط log می‌شود.
- `backend/internal/handler/webhook.go:301-315` کلید فقط در queue-full حذف می‌شود، نه در worker panic/failed processing.

### Acceptance criteria

1. stateهای `received`, `processing`, `processed`, `failed` تعریف شوند.
2. فقط پس از commit موفق state `processed` شود.
3. panic/timeout به durable DLQ منتقل شود و retry policy داشته باشد.
4. duplicate همزمان، crash وسط پردازش، retry و restart worker تست شوند.

---

## P1-02 — TonAPI webhook فقط log می‌کند و هیچ ingest/index انجام نمی‌دهد

**نوع اقدام:** `add` یا `remove`  
**حوزه:** API contract، idempotency، reorg

### شواهد

- `backend/internal/handler/webhook.go:670-719` signature را verify و payload را decode می‌کند، سپس فقط log و `200 OK` می‌دهد.
- route فعال در `backend/internal/router/router.go:47` است.

### تصمیم لازم

- اگر integration لازم است: ingest کامل، persistence، idempotency، finality/reorg، retry و alert اضافه شود.
- اگر هنوز feature نیست: route، secret config و claimهای integration حذف شوند.

### Acceptance criteria

1. هر event معتبر یک اثر durable قابل audit داشته باشد.
2. duplicate و replay دوباره effect ایجاد نکند.
3. event نامعتبر/unsupported status مناسب بگیرد، نه `200` گمراه‌کننده.
4. reorg و finality policy تست شوند.

---

## P1-03 — نرخ TON/USD بین endpointهای Gifts ناسازگار است

**نوع اقدام:** `change + add`  
**حوزه:** correctness مالی، precision، provenance

### شواهد

- `backend/internal/service/gifts/gifts_service.go:130-135` و `173-177`: fallback `5.20`.
- `backend/internal/service/gifts/gifts_service.go:321-325`: fallback `1.42`.
- `backend/internal/service/gifts/venues/venues.go:167-174`: fallback `1.42`.
- `backend/internal/service/gifts/ingestor/ingestor.go:268`: market cap با `5.20` ساخته می‌شود.
- `backend/internal/service/gifts/venues/adapters.go:200-208`: Stars conversion fallback `1.42` دارد.

### Acceptance criteria

1. یک `RateSnapshot` مرکزی با source، observed_at، TTL و stale policy استفاده شود.
2. همه USD conversionهای یک request از همان snapshot استفاده کنند.
3. fallback در همه endpointها یک semantics واحد داشته باشد.
4. cross-endpoint rate consistency test اضافه شود.

---

## P1-04 — Confidence Username با sample اشتباه calibrate می‌شود

**نوع اقدام:** `change + add`  
**حوزه:** confidence/provenance

### شواهد

- `backend/internal/service/username/avm/valuation.go:1444-1450` تعداد comparables را به‌عنوان calibration sample پاس می‌دهد.
- `backend/internal/service/valuation/core/calibration.go:20-44` هر sample مثبت را به mapping ثابت 88/78/68/... تبدیل می‌کند.
- `backend/internal/service/username/avm/calibration.go:63-75` calibration واقعی بدون backtest را uncalibrated می‌داند، ولی مسیر valuation از comparable count استفاده می‌کند.

### Acceptance criteria

1. calibration sample فقط از holdout backtest واقعی همان model/version بیاید.
2. sample comparables و calibration sample جدا باشند.
3. در نبود backtest کافی، confidence uncalibrated/low برگردد.
4. تست sample=0، sample=1، زیر حداقل و حداقل معتبر وجود داشته باشد.

---

## P1-05 — Number sale parser هر value/opcode را sale فرض می‌کند

**نوع اقدام:** `change + add`  
**حوزه:** correctness مالی، provenance

### شواهد

- `backend/internal/service/numbers/indexer/sales_indexer.go:266-315` اگر market match نشود، بیشترین `InMsg.Value` را انتخاب می‌کند؛ سپس market match باعث promotion به `exact` می‌شود.
- `backend/internal/service/numbers/indexer/sales_indexer.go:216-235` فقط اولین base transaction و اولین transfer بررسی می‌شود.

### Acceptance criteria

1. market contract از `market_registry` و address/opcode معتبر تأیید شود.
2. payment leg، recipient، currency، event index و finality بررسی شود.
3. transfer/funding transaction sale نشود.
4. traceهای مثبت و منفی با confidence دقیق/heuristic تست شوند.

---

## P1-06 — Reorg/finality در Number/Gift indexer مدل نشده است

**نوع اقدام:** `add + change`  
**حوزه:** idempotency، reorg handling، financial correctness

### شواهد

- `backend/migrations/000070_anonymous_numbers_vertical.up.sql:35-38` فقط `transaction_hash` دارد.
- `backend/migrations/000078_fix_number_sales_idempotency.up.sql:11-14` فقط uniqueness روی hash اضافه می‌کند.
- `backend/migrations/000083_gift_sales_idempotency_and_venues.up.sql:4-20` uniqueness روی `(venue, tx_hash, event_index)` اضافه می‌کند، اما block/lt/finality/reorg ندارد.
- `backend/migrations/000084_gifts_market_engine_and_freshness.up.sql:5-22` history فقط timestamp دارد.

### Acceptance criteria

1. chain identity، block hash، lt/seqno، event index، confirmation depth و `reorged/removed` state ذخیره شود.
2. sale پیش از finality لازم وارد aggregate عمومی نشود.
3. reorg rollback/replay و duplicate event تست شوند.
4. aggregateها reorged record را exclude کنند.

---

## P1-07 — Checkpoint durable ساخته شده ولی Numbers indexer از آن استفاده نمی‌کند

**نوع اقدام:** `change + add`  
**حوزه:** restart safety، idempotency، performance

### شواهد

- `backend/migrations/000076_proliferation_fix_and_indexer_v2.up.sql:3-11` جدول `indexer_checkpoints` را می‌سازد.
- `backend/internal/service/numbers/indexer/sales_indexer.go:33-35,63-64,138-181` از `lastOffset` حافظه‌ای استفاده می‌کند.

### Acceptance criteria

1. cursor/offset بعد از batch موفق در DB ذخیره شود.
2. resume بعد از restart و crash وسط batch درست باشد.
3. overlap window برای missed events و idempotency دوطرفه تست شود.
4. جدول checkpoint source of truth باشد، نه state حافظه‌ای.

---

## P1-08 — Encryption key separation شکسته است

**نوع اقدام:** `change + add`  
**حوزه:** secrets/auth

### شواهد

- `backend/internal/crypto/crypto.go:20-43` در نبود `BOT_TOKEN_KEY` از `JWT_SECRET` یا `WEBHOOK_SECRET_TOKEN` کلید AES می‌سازد.
- `backend/cmd/api/main.go:77-98` production وجود `BOT_TOKEN_KEY` را enforce نمی‌کند.

### Acceptance criteria

1. production بدون `BOT_TOKEN_KEY` مستقل startup نکند.
2. کلید encryption token، JWT signing و webhook HMAC مستقل باشند.
3. rotation/versioning برای کلیدها وجود داشته باشد.
4. fallback فقط در dev/test build فعال باشد و test production آن را رد کند.

---

## P1-09 — Avatar proxy امکان SSRF/redirect abuse دارد

**نوع اقدام:** `change + add`  
**حوزه:** SSRF، DoS

### شواهد

- `backend/internal/service/profile_service.go:192-241` هر URL ذخیره‌شده با scheme HTTP/HTTPS را fetch می‌کند؛ allowlist host، private-IP block، redirect policy و response size limit ندارد.

### Acceptance criteria

1. فقط hostهای مجاز Telegram/CDN پذیرفته شوند.
2. loopback، RFC1918، link-local، IPv6 private و DNS rebinding مسدود شود.
3. redirect به host غیرمجاز follow نشود.
4. body با `LimitReader` محدود و content-type واقعی validate شود.
5. تست SSRF مستقیم، redirect و oversized response اضافه شود.

---

## P1-10 — Database constraints مالی/domain ناکافی است

**نوع اقدام:** `add + change`  
**حوزه:** database integrity، correctness مالی

### شواهد

- `backend/migrations/000070_anonymous_numbers_vertical.up.sql:26-43`
- `backend/migrations/000072_telegram_gifts_vertical.up.sql:43-66`

برای قیمت، currency، venue، confidence، sale type، serial و model محدودیت domain کافی وجود ندارد.

### Acceptance criteria

1. CHECK برای قیمت مثبت، serial غیرمنفی و timestamp معتبر.
2. enum/check برای venue، currency، confidence و sale type.
3. FK/registry معتبر برای model/collection.
4. migration cleanup پیش از constraint rollout.
5. repository و DB constraint tests با داده invalid.

---

# P2 — اصلاح لازم در hardening و cleanup

## P2-01 — Cache نرخ timestamp واقعی را مخفی می‌کند

**نوع اقدام:** `change + add`  
**حوزه:** cache/freshness/provenance

### شواهد

- `backend/internal/service/username/analysis.go:1567-1577` هنگام cache hit، `ObservedAt=now` و `IsStale=false` می‌شود.
- `backend/internal/handler/username_public.go:595-603` response valuation cache hit را مستقیم می‌دهد.
- `backend/internal/handler/username_public.go:887-889` response نهایی با TTL ده‌دقیقه‌ای cache می‌شود.

### Acceptance criteria

1. cache value شامل `observed_at`, `fetched_at`, `source`, `expires_at`, `model_version` باشد.
2. cache hit age/provenance را در response/header حفظ کند.
3. cache stale با timestamp زمان read fresh تلقی نشود.

---

## P2-02 — Gifts Intel aggregate کامل را در هر درخواست اجرا می‌کند

**نوع اقدام:** `add + change`  
**حوزه:** performance، SLO

### شواهد

- `backend/internal/service/gifts/gifts_service.go:319-500` در هر درخواست sales، snapshots و arbitrage را aggregate می‌کند.
- `backend/internal/service/gifts/gifts_service.go:493-495` `COUNT(*)` و `SUM(...)` روی کل `gift_sales` دارد.

### Acceptance criteria

1. read model/materialized aggregate یا cache کوتاه‌مدت با invalidation ingestion اضافه شود.
2. latency، rows scanned، cache hit/miss و DB timeout metric شوند.
3. load test با dataset حجیم SLO p95/p99 مشخص داشته باشد.

---

## P2-03 — Attribution Gifts sourceهای استفاده‌نشده را گزارش می‌کند

**نوع اقدام:** `change`  
**حوزه:** provenance

### شواهد

- `backend/internal/service/gifts/collection_intel.go:1260-1273` در نبود price source، رشته `Fragment / Getgems / MarketApp / Telegram / TON Indexer` را گزارش می‌کند.
- چند adapter عملاً `ErrNoFloorData` می‌دهند: `backend/internal/service/gifts/venues/adapters.go:68-72,99-103,227-230,257-260`.

### Acceptance criteria

1. attribution فقط source موفق همان response را ذکر کند.
2. source health و per-field provenance در contract حضور داشته باشد.
3. source unavailable با `unavailable`/`estimated` اشتباه نشود.

---

## P2-04 — OpenAPI و routeها drift دارند و routeهای duplicate/dead وجود دارد

**نوع اقدام:** `remove + change + add`  
**حوزه:** API contracts، dead code

### شواهد

- `frontend/src/entities/numbers/api/numbersApi.ts:136-146` به `/numbers/collection-overview` درخواست می‌زند، اما route در `backend/internal/router/router.go` نیست.
- `backend/internal/router/router.go:83-84` هر دو `/numbers/mask` و `/numbers/search-mask` را به یک handler وصل می‌کند؛ دومی در OpenAPI ثبت نشده.
- `backend/internal/router/router.go:110-113` مسیرهای gifts arbitrage/whales/serials/sync در OpenAPI نیستند.
- routeهای username share/send-to-chat/payment/monitor در OpenAPI نیستند.
- `openapi.yaml` و `backend/openapi.yaml` دو نسخه موازی‌اند.
- `backend/openapi.yaml:22` مسیر `/health` دارد، درحالی‌که health واقعی `/healthz/live` و `/healthz/ready` است.

### اقدام اصلاحی

- **remove:** یکی از `/numbers/mask` و `/numbers/search-mask`.
- **remove:** `getCollectionOverview` اگر feature واقعی نیست؛ در غیر این صورت endpoint و schema اضافه شود.
- **remove/change:** یکی از دو OpenAPI حذف و دیگری canonical/generated شود.
- **add:** route-vs-OpenAPI contract test و CI validator.
- **change:** health paths، auth requirements، status codes و response schemas با runtime همگام شوند.

### Acceptance criteria

1. هر route public دقیقاً یک operation در OpenAPI داشته باشد.
2. هیچ frontend client path به route nonexistent اشاره نکند.
3. OpenAPI validator در CI pass شود.
4. duplicate/dead routeها یا حذف شده یا rationale و deprecation دارند.

---

## P2-05 — Metrics پوشش سه vertical و SLO signal کافی ندارند

**نوع اقدام:** `add + change`  
**حوزه:** observability/SLO

### شواهد

- `backend/internal/telemetry/metrics.go:8-55` metricها عمدتاً pricing، TonAPI و channel/webhook هستند.
- metric مشخص برای username/numbers/gifts latency/error/cache/source freshness/indexer lag/payment/queue/DLQ وجود ندارد.
- `backend/internal/telemetry/metrics.go:72-75` پارامتر `botID` در metric استفاده نمی‌شود.

### Acceptance criteria

1. برای هر vertical request latency/error/timeout، cache hit/miss، source age/status و valuation fallback metric وجود داشته باشد.
2. indexer lag، checkpoint age، queue depth، DLQ و payment completion قابل alert باشد.
3. SLO برای API p95/p99، freshness و successful ingestion تعریف شود.
4. labelهای پر cardinality مانند username/gift ID/bot ID مستقیماً metric label نشوند.

---

## P2-06 — `/metrics` در نبود token عمومی می‌شود

**نوع اقدام:** `change + add`  
**حوزه:** observability security

### شواهد

- `backend/cmd/api/main.go:266-281` اگر `METRICS_TOKEN` خالی باشد، `/metrics` بدون auth سرو می‌شود.

### Acceptance criteria

1. production در نبود `METRICS_TOKEN` startup نکند یا endpoint فقط از شبکه داخلی/mTLS قابل دسترسی باشد.
2. secret در log/response افشا نشود.
3. unauthenticated access test برای production config اضافه شود.

---

## P2-07 — hardcoded i18n و accessibility/RTL/mobile test gap

**نوع اقدام:** `change + add`  
**حوزه:** accessibility، i18n، RTL، mobile

### شواهد

- `frontend/src/pages/gifts/report/ui/GiftReportPage.tsx:883-889` متن فارسی hardcoded دارد.
- `frontend/src/pages/gifts/crafting/ui/CraftingCalculatorPage.tsx:160` متن `Input Gifts` hardcoded است.
- `frontend/src/shared/i18n/index.ts:20` فقط `fa` را RTL می‌کند؛ تست automated برای layout RTL، keyboard navigation، focus order، screen reader و viewportهای mobile مشاهده نشد.
- icon-only/weak-label candidates در `frontend/src/pages/gifts/crafting/ui/CraftingCalculatorPage.tsx:162-169`، `frontend/src/pages/gifts/portfolio/ui/PortfolioScannerPage.tsx:175-182` و `frontend/src/pages/gifts/report/ui/GiftReportPage.tsx:893-900` نیازمند axe/manual review هستند.

### Acceptance criteria

1. تمام متن‌های visible از dictionary بیایند و `check:i18n` در CI اجرا شود.
2. تست RTL برای فارسی و حداقل viewportهای 320/360/390px.
3. axe/accessibility smoke test برای routeهای username/numbers/gifts.
4. icon-only controls، charts، tables، dialogs و horizontal scroll با keyboard/screen reader تست شوند.
5. number/TON/USD formatting در RTL با `dir=ltr` فقط برای tokenهای عددی و نه کل layout انجام شود.

---

## P2-08 — Upstream response بدون size limit و test coverage ناکافی

**نوع اقدام:** `change + add`  
**حوزه:** performance، resilience، test gaps

### شواهد

- `backend/internal/service/numbers/numbers_service.go:163-165,201-203,249-251` برای سه درخواست Fragment از `io.ReadAll(resp.Body)` بدون cap استفاده می‌کند.
- body limit عمومی router (`backend/cmd/api/main.go:254-258`) روی response upstream اعمال نمی‌شود.

### Acceptance criteria

1. همه upstream responseها با `io.LimitReader` محدود شوند.
2. status/content-type، timeout و cancellation validate شوند.
3. upstream response بزرگ/کند test شود.
4. load/chaos test برای rate limit، timeout و circuit breaker اضافه شود.

---

# موارد مشخص برای حذف، تغییر یا افزودن

## Remove

1. Synthetic Gifts collection metrics و fixed whale records در `ingestor.go:214-291,427-455` از live/verified pipeline.
2. Synthetic venue prices/arbitrage در `ingestor.go:374-420`.
3. Fixed Numbers Hall of Fame/chart در `numbers_service.go:415-457`.
4. متن‌های unsupported مانند `100% native`, `without scraper`, `Realtime`, `Cryptographically Verified` تا زمان وجود evidence.
5. `synthetic runID` در `valuation.go:1581-1587`.
6. یکی از routeهای duplicate `/numbers/mask` و `/numbers/search-mask`.
7. `getCollectionOverview` client اگر endpoint واقعی ساخته نمی‌شود.
8. TonAPI webhook route/config اگر integration ingest عمداً خارج از scope است.
9. یکی از دو فایل OpenAPI دستی و موازی؛ فقط canonical/generated file باقی بماند.

## Change

1. تمام financial outputها را به `decimal`/integer minor units و rate snapshot مشترک منتقل کنید؛ conversion و rounding در boundary واحد باشد.
2. source status/provenance/freshness را per-field و نه فقط per-response مدل کنید.
3. webhook idempotency را state-machine و commit-aware کنید.
4. sale parser را contract/registry/finality-aware کنید.
5. JWT، encryption و webhook keyها را مستقل و rotateable کنید.
6. URL proxyها را allowlist، private-IP-safe و size-limited کنید.
7. OpenAPI، frontend clients و router را از یک contract canonical تولید/validate کنید.
8. fallbackهای cache و rate timestamp واقعی را حفظ کنند.
9. همه textها به dictionary منتقل و RTL/a11y semantics اصلاح شود.

## Add

1. Provenance schema: source, source_record_id, observed_at, fetched_at, age_seconds, confidence, status, method, is_estimate.
2. Reorg/finality fields: chain, block_hash, lt/seqno, event_index, confirmation_depth, reorged.
3. Durable checkpoint/resume برای Numbers و Gifts ingestion.
4. DLQ/retry/lease state برای webhook/payment/indexer.
5. Metrics/SLO dashboard و alert.
6. Contract, migration, security, financial precision، SSRF/XSS، reorg و accessibility tests.

---

# Test matrix

| ID | سطح | حوزه | تست | انتظار قبولی | وضعیت فعلی |
|---|---|---|---|---|---|
| T01 | unit | financial | TON/USD conversion با rate snapshot واحد | همه endpointها مقدار یکسان و rounding مستند بدهند | اجرا نشده؛ `go` موجود نیست |
| T02 | unit | financial | قیمت منفی، zero، overflow، precision زیر 4 decimal | DB/service reject یا رفتار صریح داشته باشد | نیازمند اضافه شدن |
| T03 | unit | provenance | fallback/live/estimated/unavailable state transition | هیچ fallback با live badge برنگردد | نیازمند اضافه شدن |
| T04 | unit | confidence | calibration sample=0/1/کمتر از min/کافی | uncalibrated تا backtest معتبر | نیازمند اضافه شدن |
| T05 | unit | certificate | forged signature و payload tampering | verify fail شود | تست موجود فقط SHA عمومی را می‌سنجد؛ کافی نیست |
| T06 | integration | Gifts | ingestion بدون upstream | هیچ synthetic live/verified record تولید نشود | اجرا نشده |
| T07 | integration | Numbers | Fragment/DB unavailable | Hall of Fame/chart fabricated برنگردد | اجرا نشده |
| T08 | integration | cache | cache hit با observed_at قدیمی | age/stale واقعی حفظ شود | اجرا نشده |
| T09 | integration | webhook | duplicate update | فقط یک side effect | نیازمند اضافه شدن |
| T10 | integration | webhook | worker panic بعد از SETNX | DLQ/retry و عدم گم‌شدن update | نیازمند اضافه شدن |
| T11 | integration | payment | duplicate successful payment | یک grant/deduction/order completion | بخشی از کد atomic است؛ پوشش کامل لازم است |
| T12 | integration | reorg | confirmed sale سپس reorg | sale/aggregate rollback یا mark reorged | نیازمند اضافه شدن |
| T13 | integration | checkpoint | crash وسط batch و restart | resume بدون gap/duplicate | نیازمند اضافه شدن |
| T14 | migration | DB | replay migration و down/up order | migration idempotent و order-safe | اجرا نشده؛ `go`/DB runtime available نبود |
| T15 | migration | DB | invalid sale/currency/confidence | CHECK/FK reject | constraints فعلی ناکافی |
| T16 | contract | OpenAPI | route inventory vs OpenAPI paths | صفر route missing/extra بدون rationale | validator اجرا نشده |
| T17 | contract | frontend | `/numbers/collection-overview` | route واقعی یا client حذف شده | mismatch مشاهده شد |
| T18 | security | SSRF | avatar URL loopback/private/redirect/DNS rebinding | request blocked | نیازمند اضافه شدن |
| T19 | security | XSS | broadcast HTML: `script`, event handler, javascript URL, SVG | preview safe و Telegram markup allowlisted | نیازمند اضافه شدن |
| T20 | security | secrets | نبود BOT_TOKEN_KEY در production | startup fail | نیازمند اضافه شدن |
| T21 | performance | upstream | body بزرگ/کند Fragment | bounded memory و timeout | اجرا نشده |
| T22 | performance | Gifts | dataset حجیم sales aggregate | p95/p99 زیر SLO و query bounded | اجرا نشده |
| T23 | observability | metrics | metrics بدون token در production | unauthorized یا network restricted | اجرا نشده |
| T24 | accessibility | UI | axe روی 3 vertical | zero critical/serious violations | اجرا نشده؛ `pnpm` موجود نیست |
| T25 | accessibility | UI | keyboard/focus/dialog/chart/table | قابل استفاده بدون pointer | نیازمند اضافه شدن |
| T26 | i18n | UI | `en/fa/ru/zh` key parity | zero missing/extra keys و no hardcoded visible strings | `check:i18n` اجرا نشد |
| T27 | RTL/mobile | UI | 320/360/390px در fa | no clipping/overflow/overlap، numbers readable | اجرا نشده |
| T28 | build/static | repo | `go vet`, frontend lint/build, dead-code scan | CI green و خروجی بدون warning blocking | اجرا نشد؛ ابزار موجود نبود |

---

# ترتیب پیشنهادی remediation

1. **P0:** توقف انتشار market claims؛ حذف synthetic live data؛ اصلاح certificate؛ حذف false-live badge و synthetic audit IDs.
2. **P1:** اصلاح webhook state/idempotency، sale parser، rate consistency، key separation، SSRF و DB constraints.
3. **P1:** اضافه‌کردن reorg/finality و durable checkpoints.
4. **P2:** canonical OpenAPI، حذف route/client dead، metrics/SLO، cache provenance و performance read models.
5. **P2:** i18n/RTL/a11y/mobile و test matrix در CI.

## نتیجه نهایی

تا زمان بسته‌شدن P0ها، سه vertical از منظر ادعاهای market/live/verified و provenance مالی قابل انتشار عمومی نیستند. مهم‌ترین اقدام فوری حذف یا جداسازی تمام داده‌های synthetic و false-live labelهاست؛ سپس باید idempotency/reorg، rate consistency و cryptographic certificate اصلاح و با test matrix فوق gate شوند.
