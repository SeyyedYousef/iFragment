# گزارش جامع ممیزی Vertical شماره‌های کلکسیونی/Anonymous تلگرام (+888)

**مخزن ممیزی‌شده:** `src/iFragment-main`  
**دامنه:** backend / frontend / API / DB & migrations / indexer / TON & Fragment integrations / single-item report / collection & charts / watchlist / portfolio / Mask Builder / NV Engine / tests / docs.  
**روش:** خواندن کد و اسکیما با شماره‌خط، تطبیق مسیرهای route با API client و OpenAPI، بررسی مسیرهای fallback و provenance، و اجرای تست‌های مرتبط در حد ابزار موجود. **هیچ تغییر کدی انجام نشد.**

## خلاصه اجرایی

این vertical از نظر surface محصول کامل است، اما در وضعیت فعلی برای نمایش داده به‌عنوان «تأییدشده/آنچین/مالی» آماده انتشار نیست. بحرانی‌ترین ریسک‌ها:

1. `VerifyNumber` برای بیشتر ورودی‌های ۸رقمی صرفاً بر اساس format، `is_minted=true` و در برخی حالت‌ها `collection_verified=true` می‌دهد؛ item NFT، collection، `get_nft_data`/index، initialized status و block snapshot در مسیر Verify بررسی نمی‌شوند.
2. در outage، backend و frontend در چند مسیر خروجی‌های ساختگی یا برآوردی را بدون برچسب قابل‌اعتماد در سطح field نمایش می‌دهند؛ chart صراحتاً OHLCV مصنوعی ۱۸۱روزه تولید می‌کند و collection dashboard اعداد fallback مالی hardcoded دارد.
3. ingest فروش در indexer برای traceهای نامشخص بیشینه هر `in_msg.value` را می‌گیرد و در صورت market interface آن را `exact` می‌کند؛ این sale نهایی‌شده را اثبات نمی‌کند.
4. schema اولیه با queryهای runtime سازگار نیست: `number_features` ستون `id` و `is_restricted` ندارد، ولی کد هر دو را می‌خواند.
5. NV Engine نام‌هایی مانند `QuantumBayes`، confidence، global rank، rental yield، liquidity و collateral را عمدتاً از ضرایب دستی/ثابت می‌سازد؛ backtest زمان‌محور واقعی و calibration قابل‌اثبات در مسیر اجرا وجود ندارد.
6. گزارش خریداری‌شده از نظر تراکنش credit/report اکنون اتمیک‌تر از نسخه قدیمی است، اما خود valuation audit به‌صورت async best-effort نوشته می‌شود و `RunID` پاسخ با id persisted یکی نیست؛ همچنین entitlement با snapshot برآوردهای فاقد provenance قفل می‌شود.
7. قرارداد frontend/backend/OpenAPI کامل نیست: `/numbers/collection-overview` در frontend وجود دارد ولی route backend ندارد؛ schemaهای TypeScript چند نام فیلد متفاوت دارند؛ OpenAPI پارامتر `nft_colors` را مستند می‌کند ولی handler `nft_color` می‌خواند.

---

## یافته‌ها

### N-01 — احراز اصالت کالکشن با format اشتباه گرفته شده است

- **Severity:** Critical
- **Evidence:**
  - `backend/internal/service/numbers/features/features.go:24-69` هر suffix هشت‌رقمی را نرمال می‌کند؛ membership کالکشن را بررسی نمی‌کند.
  - `backend/internal/service/numbers/numbers_service.go:1264-1272` در حالت DB بدون رکورد، برای standard هشت‌رقمی `collectionVerified=true` و `verificationState="format_verified"` می‌گذارد و سپس بدون شرط `isMinted=true`, `exists=true` برمی‌گرداند.
  - `backend/internal/service/numbers/numbers_service.go:1234-1239` همه ۴رقمی‌های پذیرفته‌شده را بدون query آنچین، `verified_telemint_genesis` می‌نامد.
  - `backend/internal/service/numbers/numbers_service.go:1291-1297` provenance را با آدرس collection پر می‌کند، اما `item_address` معمولاً خالی و `DataStatus=live` است.
- **Action:** **Change**. `format_valid`, `collection_verified`, `is_minted`, `exists`, `restriction_status` و `provenance` را جدا نگه‌دار. برای Verify: resolve item address، خواندن `get_nft_data`/TonAPI، استخراج index و collection، فراخوانی/مقایسه deterministic item address، کنترل `initialized` و ذخیره block/time/endpoint snapshot. در نبود داده، `unknown/unavailable` بده، نه true.
- **Expected behavior:** شماره‌ای مانند `+888 0000 0000` فقط به دلیل طول valid، minted/verified نشود. پاسخ باید `format_valid=true`, `collection_verified=unknown/false`, `is_minted=unknown/false` و provenance دقیق داشته باشد.
- **Acceptance criteria:** هیچ پاسخ Verify بدون `item_address`, actual collection, index, initialized status, observed block/time به‌عنوان `verified` برچسب نخورد؛ برای random 8-digit که در DB/chain نیست `is_minted=false` یا `unknown` باشد.
- **Edge cases:** ۸رقمی معتبر ولی خارج inventory؛ Genesis خارج بازه 8000..8999؛ NFT با collection counterfeit؛ item uninitialized؛ escrow owner؛ API timeout؛ فارسی/عربی.
- **Tests:** table-driven API tests برای 100 شماره واقعی/غیرواقعی؛ mocked TonAPI verification; assert no `format_verified` as minted; chain reorg/stale snapshot test.

### N-02 — ستون‌های DB مورد استفاده runtime در migration وجود ندارند

- **Severity:** Critical / Release blocker
- **Evidence:**
  - `backend/migrations/000070_anonymous_numbers_vertical.up.sql:4-12` جدول `number_features` فقط `number,color,owner_address,nft_address,features,created_at,updated_at` دارد؛ `id` و `is_restricted` ندارد.
  - `backend/internal/service/numbers/numbers_service.go:1243-1246` `COALESCE(is_restricted,false)` می‌خواند.
  - `backend/internal/service/numbers/numbers_service.go:1776-1780` `ORDER BY id ASC` می‌خواند.
  - `backend/internal/repository/numbers_repo.go:434-442` به `market_registry` وابسته است که فقط از migration 000076 می‌آید؛ این dependency باید در migration ordering/deploy تست شود.
- **Action:** **Change migration/query**. یا ستون‌ها را با migration forward-compatible اضافه کن (`id`/restriction + index)، یا query را با PK `number` و فیلد واقعی اصلاح کن؛ migration integration test از صفر تا آخر اجرا کن.
- **Expected behavior:** `/numbers/verify` و `/numbers/list` در DB production با schema جاری 500/empty ندهند.
- **Acceptance criteria:** clean database migration سپس smoke queryهای Verify/List/Mask بدون `column does not exist`; down migration هم قابل‌بررسی باشد.
- **Edge cases:** DB از migration 70 تا 78؛ existing table created قبلاً؛ rollback ناقص؛ `is_restricted=NULL`.
- **Tests:** PostgreSQL migration test + repository integration tests برای all queries.

### N-03 — Canonical catalogue و Mask fallback دادهٔ جعلی را حقیقت نشان می‌دهند

- **Severity:** Critical
- **Evidence:**
  - `backend/internal/service/numbers/numbers_service.go:1605-1612` در outage/DB سرد `generateCanonicalCatalogue` را می‌دهد.
  - `backend/internal/service/numbers/numbers_service.go:1811-1910` شماره‌ها را با فرمول مصنوعی تولید می‌کند، `floorPrice` ثابت 42000/2450، `LastSaleDate="Telemint Mint"`, owner=`"Telemint NFT Smart Contract"`, `IsEstimated=false` و `DataStatus="canonical_catalogue"` می‌گذارد.
  - `backend/internal/service/numbers/numbers_service.go:1847-1881` اگر mask match نشود، شماره دیگری با `idx*17` تولید می‌کند؛ بنابراین نتیجه لزوماً mask را match نمی‌کند.
  - inventory standard از `88880000 + idx` ساخته می‌شود (`:1867-1870`) و به‌جای mapping verified inventory، یک توالی مصنوعی است.
- **Action:** **Remove/Change** synthetic assets/prices/owners. در outage فقط snapshot معتبر stale با `observed_at` و source statuses؛ اگر snapshot نداریم `items=[]`, `data_status=unavailable`, HTTP/field message روشن. Mask باید فقط matchهای واقعی را برگرداند.
- **Expected behavior:** هیچ آیتم، قیمت، مالک یا sale ساختگی در table/portfolio/valuation/club ظاهر نشود.
- **Acceptance criteria:** `IsEstimated=true` برای estimates، `provenance=synthetic` فقط در محیط demo و هرگز production؛ mask result برای هر item واقعاً predicate را match کند.
- **Edge cases:** upstream 200 با HTML تغییرکرده؛ timeout؛ DB خالی؛ page خارج بازه؛ mask هیچ نتیجه‌ای ندارد؛ leading zero.
- **Tests:** outage test assert no items unless stale snapshot؛ property test `matches(mask,item.number)`؛ test page 2732 boundary.

### N-04 — fallbackهای ساختگی frontend هنوز کاربر را به اعداد مالی هدایت می‌کنند

- **Severity:** Critical
- **Evidence:**
  - `frontend/src/pages/numbers/collection/ui/NumbersCollectionPage.tsx:29-84` CLUBS و color counts/multipliers hardcoded هستند.
  - `:146-168` در نبود API به‌ترتیب floor=2450، volume24h=14850، totalVolume=48920000 و ATH=666666 نشان می‌دهد.
  - `frontend/src/pages/numbers/intel/ui/components/NumbersChartView.tsx:93-107` floor را در نبود داده 2450 می‌کند؛ `:76-90` rate را در نبود داده 5.5 می‌کند.
  - `frontend/src/entities/numbers/api/numbersApi.ts:275-291` در fallback chart rate=5.5 و floor از intel می‌گیرد، بدون source status.
- **Action:** **Remove/Change** hardcoded financial fallback؛ UI باید stateهای `live/stale/unavailable` و timestamp/source را نمایش دهد.
- **Expected behavior:** outage = unavailable/stale، نه floor/volume/ATH ظاهراً live.
- **Acceptance criteria:** هیچ مقدار TON/USD بدون `source`, `observed_at`, `data_status` render نشود؛ zero/unknown با «در دسترس نیست» نمایش داده شود.
- **Edge cases:** TON rate صفر/قدیمی؛ API 200 با payload خالی؛ cache stale؛ collection count zero.
- **Tests:** component tests برای API failure/empty/partial and assert no 2450/666666 placeholders.

### N-05 — chart هنگام outage OHLCV مصنوعی می‌سازد و provenance ندارد

- **Severity:** Critical
- **Evidence:** `backend/internal/service/numbers/numbers_service.go:1406-1435` در نبود upstream و DB، ۱۸۱ روز progression سینوسی با `startFloor=1850`, `endFloor=floorTon`, volume فرمولی 18000..42000 و OHLC تولید می‌کند؛ `ChartDataResponse` در `:1310-1320` هیچ `data_status/source_status/observed_at` ندارد.
- **Action:** **Remove** synthetic chart. فقط on-chain verified aggregate یا stale cached snapshot. اگر unavailable است، payload صریحاً unavailable و data خالی.
- **Expected behavior:** chart هر نقطه را به source/event window لینک کند و auction/listing را با sale قاطی نکند.
- **Acceptance criteria:** synthetic point در production صفر؛ هر point `provenance`, `sale_count`, `verified_count`, `as_of` دارد؛ USD فقط با rate timestamp همان snapshot.
- **Edge cases:** یک روز بدون sale؛ rate missing؛ duplicate tx؛ sale vs listing؛ clock skew.
- **Tests:** upstream outage with cold DB => no generated 181 rows; aggregate fixture => exact OHLCV and verified count.

### N-06 — Fragment/TON sale indexer معامله را از transfer و `in_msg.value` حدس می‌زند

- **Severity:** Critical
- **Evidence:**
  - `backend/internal/service/numbers/indexer/sales_indexer.go:203-239` با دیدن هر `NftItemTransfer` اولین base transaction را trace می‌کند و هر `priceTON>0` را sale ذخیره می‌کند.
  - `:255-318` اگر op bid/purchase/buy/sale باشد value را price می‌گیرد؛ اگر market interface دیده شود confidence را exact می‌کند (`:314-318`)، و حتی اگر market match نباشد بیشینه `in_msg.Value` را می‌گیرد (`:291-295`). این transfer/action classification، finalized event، sale contract allowlist، buyer/seller settlement یا amount net را اثبات نمی‌کند.
  - `backend/migrations/000070_anonymous_numbers_vertical.up.sql:25-38` جدول sale را «verified» می‌نامد ولی `block_seqno`, `event_index`, `verification_status`, `provenance_level`, `nft_address` و allowlisted market evidence ندارد.
- **Action:** **Change** pipeline: verified trace transaction + action index/event id + item address + collection + block/lt + known market contract + exact settlement transfer؛ heuristic/raw observations را جدول جدا و weight=0/low نگه‌دار.
- **Expected behavior:** listing/bid/transfer/refund/royalty به sale قطعی تبدیل نشود.
- **Acceptance criteria:** `price_confidence=exact` فقط پس از canonical event classification؛ transaction hash واقعی و unique؛ suspected sale از comps/NV حذف یا وزن‌گذاری مستند شود.
- **Edge cases:** bid outbid/refund؛ auction escrow؛ royalty-only value؛ self transfer؛ failed/scam event؛ multiple actions in trace؛ unknown marketplace.
- **Tests:** fixture traces for purchase, bid, transfer, refund, scam; assert only final sale inserts; property unique `(tx_hash,event_index)`.

### N-07 — checkpoint و bootstrap برای idempotency و failure semantics کافی نیست

- **Severity:** High
- **Evidence:**
  - `backend/internal/service/numbers/indexer/sales_indexer.go:34-35,139-181` `lastOffset` فقط memory است؛ migration `000076...:4-10` جدول persistent `indexer_checkpoints` ساخته، اما این indexer از آن استفاده نمی‌کند و با restart از offset صفر می‌رود.
  - `backend/internal/service/numbers/bootstrap/bootstrap.go:66-89` `processNFTItem` خطاها را نادیده می‌گیرد (`:76` و `:144`) و checkpoint را بعد از batch بدون تعداد موفق ذخیره می‌کند.
  - `:146-159` histogram increment برای rerun/partial batch idempotent نیست و ممکن است counts را چندبار زیاد کند.
  - `:162-173` checkpoint table با append و `MAX(last_offset)` کار می‌کند، نه scope/lease/atomic state.
- **Action:** **Change** persistent cursor با scope و cursor/last seen event؛ batch transaction یا success/failure accounting؛ histogram rebuild/UPSERT by inventory snapshot نه increment کور.
- **Expected behavior:** restart، crash و partial API page باعث loss/duplication و percentile drift نشود.
- **Acceptance criteria:** resume test بعد از kill در هر مرحله؛ total unique NFTs و histograms دقیقاً برابر verified inventory؛ lag/failed partitions قابل مشاهده.
- **Edge cases:** empty page موقت؛ API cursor reorder؛ duplicate item; context cancellation؛ concurrent workers.
- **Tests:** crash injection before/after upsert/checkpoint; replay same pages; compare DB unique counts.

### N-08 — query comparables هر sale موجود را verified فرض می‌کند و fallback ناهم‌کلاس می‌دهد

- **Severity:** High
- **Evidence:** `backend/internal/repository/numbers_repo.go:288-301` فقط tail/max-run را match می‌کند و `price_confidence`/market allowlist/verification status را filter نمی‌کند.
  - `:322-349` در نبود comp هم آخرین saleهای کل بازار را به‌عنوان comp می‌دهد.
  - `backend/internal/service/numbers/nvengine/nvengine.go:447-475` همین‌ها را winsorize، weighted median و Bayesian shrink می‌کند.
- **Action:** **Change** strict provenance/cohort filters: same length, restriction, color/venue/time/liquidity/owner history and verified status; broad prior فقط با label و weight مشخص؛ no-data => no comp, not arbitrary recent sales.
- **Expected behavior:** قیمت یک ۴رقمی Genesis با standard/random sales anchor نشود.
- **Acceptance criteria:** هر comp reason/similarity/effective weight/provenance دارد؛ suspected/unverified excluded by default.
- **Edge cases:** one comp; all comps stale; sale price zero; same item repeated sale; color unknown.
- **Tests:** cohort fixture ensuring unrelated sale never enters; wash/suspected weighting test.

### N-09 — sale anchor عملاً افت قیمت را ممنوع می‌کند

- **Severity:** High
- **Evidence:** `backend/internal/service/numbers/nvengine/nvengine.go:538-557` آخرین sale را decay می‌کند، اما فقط اگر `rawEstimateTON < anchoredPrice` مقدار را بالا می‌برد (`:551-553`).
  - `:576-581` low bound را در صورت sale به خود `latestExactSaleTON` clamp می‌کند.
  - نتیجه: آخرین sale، حتی پس از افت بازار/واش‌ترید/restriction/liquidity shock، floor ابدی می‌شود؛ مستند خودش در `docs/telegram_anonymous_numbers_encyclopedia.md:118-131` می‌گوید نباید floor ابدی باشد.
- **Action:** **Change** sale را feature زمان‌دار/uncertainty-weighted نگه دار؛ floor از active verified listings/sales cohort و regime استخراج شود؛ low band هرگز به last sale hard clamp نشود.
- **Expected behavior:** estimate می‌تواند از previous sale پایین‌تر بیاید و دلیل/وزن نمایش داده شود.
- **Acceptance criteria:** synthetic down-market test with prior high sale lowers expected/low; no invariant `low >= last_sale` unless explicit contract-backed floor.
- **Edge cases:** previous wash trade؛ sale 1 day old؛ restriction after sale؛ TON/USD change؛ zero liquidity.
- **Tests:** time-decay and regime scenarios; monotonic uncertainty bounds only (`low<=expected<=high`).

### N-10 — NV Engine مدل آموزش‌دیده/Quantum-Bayes نیست و confidence/rank calibration ندارد

- **Severity:** High
- **Evidence:**
  - `backend/internal/service/numbers/nvengine/nvengine.go:26-30` version را `NV-Engine-v5.0-QuantumBayes` می‌نامد اما ضرایب دستی از `:236-359` و minor coefficients از `:362-415` hardcoded هستند.
  - confidence از base=72 و bonusهای heuristic در `:595-616` ساخته می‌شود؛ `GetCalibratedConfidenceScore` فقط post-processing است و نتیجه به coverage واقعی وصل نیست.
  - global rank در `:1062-1152` فقط bucket/rarity formula است و کل inventory را با همان snapshot/version score نمی‌کند.
  - model card `:757-769` dataset hash ثابت hardcoded دارد و `DataAsOf=time.Now`; signature hash امضای cryptographic trusted نیست، صرفاً SHA256 string است.
- **Action:** **Change naming/claims** تا backtest واقعی: time split, OOS metrics, calibration/coverage, model/data version, inventory snapshot id. تا آن زمان `estimated heuristic rank` و `expert prior` نمایش بده، نه confidence آماری/رتبه جهانی قطعی.
- **Expected behavior:** user بتواند فرق feature score، model confidence و empirical coverage را بفهمد.
- **Acceptance criteria:** model card شامل train/eval ranges, n, MAPE/log-MAE, interval coverage 80/95%, cohort errors; rank only `estimated` unless full scored snapshot.
- **Edge cases:** no comps; one comp; market regime missing; new color; data stale.
- **Tests:** walk-forward backtest fixture; calibration curve; rank reproducibility from pinned snapshot.

### N-11 — projection، rental، liquidity و DeFi collateral خروجی مالی فرضی هستند

- **Severity:** High
- **Evidence:**
  - Projection ثابت `+35%/+12%/-10%` در `backend/internal/service/numbers/nvengine/nvengine.go:648-656` است.
  - Rental cap rateهای 4.5/5.5/6.5/7.5% و 10% fee در `backend/internal/service/numbers/nvengine/financial.go:42-94` بدون rental observations محاسبه می‌شوند.
  - DeFi LTV 50/55/60/65% و threshold در `:96-125` هیچ protocol acceptance/oracle/liquidation data ندارد.
  - survival probabilities ثابت بر اساس rarity/price در `:127-185` هستند، نه Weibull fit با event data.
  - frontend برای missing fields fallback می‌کند: `NumberReportPage.tsx:1068-1092` APY 54% و monthly 4.5%، `:1124-1151` club floor/sell speed/hodl، `:1163-1186` probabilities 38/72/94.
- **Action:** **Remove from investment-grade report or label loudly** as scenario simulation; no “verified/guaranteed” badges. Require real rental/loan/liquidity datasets before empirical language.
- **Expected behavior:** scenario calculator inputs/ranges and disclaimer beside every value.
- **Acceptance criteria:** no default numeric value when field absent; report returns `status=experimental` and source/method; recommendation cannot imply financial advice certainty.
- **Edge cases:** ton rate unavailable; expected=0; Genesis; restricted; no marketplace support.
- **Tests:** absent financial fields render N/A/experimental, not constants; scenario sensitivity tests.

### N-12 — On-chain audit card fabricated as live/verified بدون provenance

- **Severity:** Critical
- **Evidence:** `backend/internal/service/numbers/nvengine/nvengine.go:1389-1441`:
  - `mintDate` همیشه December 2022;
  - transaction count در نبود history از 0 به 1 تغییر می‌کند (`:1391-1394`);
  - `CollectionVerified=true`, `IsRestricted=false`, `DataStatus="live"` (`:1426-1440`)؛ حتی owner/item/block/initialized query انجام نشده.
  - `:1413-1418` tx URL فقط اگر history transaction hash باشد، ولی status همچنان live است.
  - `computeValuation` در `:816-824` TelemintProvenance را همیشه collection verified/live می‌کند.
- **Action:** **Change/Remove** false defaults. Audit باید `unavailable/stale/verified` state per field، observed timestamp, item/collection/owner/tx/block داشته باشد.
- **Expected behavior:** missing history = `transfer_count=unknown/0 with status unavailable`, not 1; no “VERIFIED” UI unless chain verifier succeeded.
- **Acceptance criteria:** synthetic/no-DB valuation clearly says `data_status=unavailable` and never claims restriction clean or live on-chain.
- **Edge cases:** no owner; escrow owner; stale TonAPI; chain reorg; item not initialized.
- **Tests:** valuation with nil DB/TonAPI; assert false/unknown provenance, zero fabricated transfer; verified fixture checks exact addresses.

### N-13 — Portfolio مالک فعلی را با buyer تاریخی اشتباه می‌گیرد و public address scan کنترل provenance ندارد

- **Severity:** High
- **Evidence:** `backend/internal/handler/numbers_handler.go:275-289` هر address را public scan می‌کند (صرفاً rate limit)، و `numbers_service.go:921-935` empty/format check فقط می‌کند.
  - `:1018-1037` buyer هر sale تاریخی را به owned asset اضافه می‌کند، بدون انتقال بعدی/current owner verification.
  - `:973-991` background upsert با owner address درخواست‌کننده اجرا می‌شود، بدون check returned item's actual owner/collection beyond upstream filter.
  - `:1057-1109` در نبود valuation engine/DB، baseline value/rarity را silently می‌سازد.
- **Action:** **Change** portfolio inventory را فقط از current on-chain owner snapshot بگیر؛ historical sale برای history جدا؛ source completeness/partial status و per-item ownership proof بده؛ no baseline valuation silently.
- **Expected behavior:** کیف پولی که قبلاً خریده ولی فروخته، آن NFT را owned نشان ندهد.
- **Acceptance criteria:** `current_owner == requested wallet` and collection exact match; pagination complete/partial explicit; historical buyers excluded.
- **Edge cases:** escrow/current sale; friendly/raw address forms; API partial page; duplicate NFT; metadata missing; rate=0.
- **Tests:** buyer→seller fixture; current ownership reconciliation; partial API response status; arbitrary invalid address 400/422.

### N-14 — Mask Builder / List filtering contract ناقص و statusهای فیلترشده اجرا نمی‌شوند

- **Severity:** High
- **Evidence:**
  - handler فقط `sale_type,number_type,owners_history,nft_color,mask` را عبور می‌دهد (`backend/internal/handler/numbers_handler.go:314-355`)، ولی backend `GetNumbersList` در `:1531-1553` URL upstream را می‌سازد؛ fallback DB در `:1760-1808` اصلاً این filters را اعمال نمی‌کند.
  - `SearchNumbersByMask` به `market_registry` join می‌شود (`numbers_repo.go:434-442`) و schema dependency دارد؛ status `taken/for_sale/on_auction` از listing field خام استخراج می‌شود (`:469-487`)، نه verified active listing.
  - frontend جدول «Live On-Chain Feed» می‌گوید (`NumbersTableView.tsx:461-477`) ولی stale/canonical response را همانند live render می‌کند.
- **Action:** **Change** filter semantics and status provenance; return applied filters, total exact/unknown, source status. On fallback query all filters or return unavailable.
- **Expected behavior:** `banned`, sale type, owners history و color نتایج دقیق و consistent بین upstream/local باشند.
- **Acceptance criteria:** property test every row satisfies all requested filters; stale/canonical visually distinct; no `Live` badge for stale.
- **Edge cases:** colors comma/repeated params; `mask` short/long; wildcard escape; no DB; upstream HTML layout change.
- **Tests:** parity fixtures upstream vs DB fallback; SQL query tests; mask wildcard/property tests.

### N-15 — frontend report اعداد پیش‌فرض و برچسب‌های verified را جایگزین داده missing می‌کند

- **Severity:** High
- **Evidence:**
  - `frontend/src/pages/numbers/report/ui/NumberReportPage.tsx:922-955` ask و liquidation را با 1.15 و 0.75 fallback می‌کند.
  - `:1001-1054` exact supply=10, 0.007%, symmetry=100, memorability=99 و numerology متن ثابت جایگزین missing می‌شوند.
  - `:1068-1092`, `:1124-1186` rental/depth/probability defaults above.
  - `:808-815` badge `VERIFIED` صرفاً با render report نشان داده می‌شود، نه based on provenance.
  - `:348-351` monitoring فقط local signal است و به API/watchlist/notification وصل نیست.
- **Action:** **Remove numeric fallbacks**; map null/unknown to N/A; verified badge فقط `provenance.collection_verified && data_status=verified`; monitoring either implement server endpoint or remove.
- **Expected behavior:** یک report ناقص/experimental ناقص بماند، نه report کامل با اعداد حدسی.
- **Acceptance criteria:** contract tests with every optional field omitted; no fabricated numeric card; monitoring reload-preserves state only if persisted.
- **Edge cases:** zero is valid vs missing; locale RTL; stale report; changed number after input.
- **Tests:** component snapshot/DOM assertions for null fields and 403 paywall; monitoring persistence test.

### N-16 — watchlist `alert_on_bid` ذخیره می‌شود ولی هیچ‌وقت trigger نمی‌شود

- **Severity:** Medium/High
- **Evidence:** `backend/internal/repository/numbers_repo.go:158-169` هر دو `alert_on_sale` و `alert_on_bid` را true می‌کند.
  - `backend/internal/service/numbers/watchlist/watchlist_notifier.go:42-81` فقط `NotifySale` دارد و فقط userهای `alert_on_sale=true` را می‌گیرد (`:48`).
  - indexer فقط بعد از insert sale notifier را صدا می‌زند (`sales_indexer.go:243-246`).
- **Action:** **Remove unused bid toggle or implement bid event ingestion + NotifyBid** با dedupe/rate limit.
- **Expected behavior:** UI/API ادعای bid alert فقط وقتی backend واقعاً آن را پشتیبانی می‌کند.
- **Acceptance criteria:** bid event fixture sends one alert to `alert_on_bid`; sale does not send bid-only; notification dedupe.
- **Edge cases:** outbid sequence, duplicate sweep, disabled user/bot token absent, Telegram 429.
- **Tests:** notifier unit/integration tests with mock Telegram and both alert flags.

### N-17 — API client، route و OpenAPI mismatch

- **Severity:** High
- **Evidence:**
  - `frontend/src/entities/numbers/api/numbersApi.ts:136-145` `/numbers/collection-overview` را call می‌کند؛ `backend/internal/router/router.go:77-94` چنین routeی ندارد. route مشابه موجود `/collection/stats` در `:119-121` است و handler دیگری دارد.
  - frontend `:294-325` query parameter را `nft_color` می‌فرستد؛ `openapi.yaml:1314-1316` `nft_colors` مستند کرده است؛ backend handler `nft_color` می‌خواند (`numbers_handler.go:328-339`).
  - `openapi.yaml:1414-1425` برای `/numbers/valuate` security/403 response ندارد، در حالی‌که route `router.go:89` OptionalAuth و handler `numbers_handler.go:85-99` entitlement 403 اعمال می‌کند.
  - `frontend/src/entities/numbers/model/types.ts:1-47` trending/hall fields با backend `NumbersIntelResponse` (`numbers_service.go:89-109,130-152`) متفاوت‌اند؛ backend `pattern,name_en,name_fa,floor_price...` می‌دهد اما TS `tail_class,label,volume_growth_pct,avg_price...` انتظار دارد.
  - `types.ts:49-59` gate `live_ask_ton` را optional price field می‌داند، در حالی backend همیشه `DataSourcesCount=2` (`nvengine.go:128-136`)؛ UI missing را 4 API نشان می‌دهد (`NumberReportPage.tsx:601-607`).
- **Action:** **Change** single source of truth: generate OpenAPI/types from tested schemas or add contract tests; remove dead client method or add route.
- **Expected behavior:** every frontend request maps to route and field names exactly; 401/403 documented.
- **Acceptance criteria:** CI contract diff; no 404 collection-overview; all enum/status/data_status values aligned.
- **Edge cases:** API versioning; omitted optional fields; Decimal JSON string vs number.
- **Tests:** MSW/httptest contract tests for all numbers API functions; OpenAPI validation.

### N-18 — Decimal/JSON contract و report cache قابل‌اعتماد مستند نشده است

- **Severity:** Medium
- **Evidence:** backend `NumberValuation` از `decimal.Decimal` برای TON استفاده می‌کند (`backend/internal/service/numbers/nvengine/model.go:17-22`)، frontend آن‌ها را `string` تعریف کرده (`frontend/src/entities/numbers/model/types.ts:234-245`) اما بسیاری از فیلدهای nested را number فرض می‌کند. این باید explicit contract باشد.
  - `numbers_service.go:493-500` snapshot cache را با unmarshal silently قبول/رد می‌کند؛ در malformed snapshot دوباره compute می‌شود.
  - `nvengine.go:833-842` valuation audit async است؛ response/report قبل از persistence audit برمی‌گردد.
  - `nvengine.go:847-865` persisted id را در copy goroutine می‌گذارد، در نتیجه `RunID` response/snapshot معمولاً UnixNano است نه `number_valuations.id`.
- **Action:** **Change** schema/serialization docs and run identity: persist valuation synchronously or return `audit_pending`; use one run UUID/id passed into report snapshot; reject stale model/data hash.
- **Expected behavior:** report قابل audit و replay با همان run id/config snapshot باشد.
- **Acceptance criteria:** response run id == DB audit id (or explicit separate fields); malformed/stale snapshot never silently treated as paid current report.
- **Tests:** JSON contract test Decimal values; audit DB failure test; concurrent unlock/retry idempotency test.

### N-19 — collection/intel metricها بدون authority و freshness قاطی می‌شوند

- **Severity:** High
- **Evidence:** `backend/internal/service/numbers/numbers_service.go:284-305` baseline supply/floor را پیش‌فرض قرار می‌دهد و `data_status="syncing"`; `:308-325` هر scraped listing/ATH را live می‌نامد.
  - `:328-365` DB total sales/volume و `COUNT(DISTINCT owner_address)` را از rows می‌گیرد، حتی اگر rows heuristic/suspected باشند.
  - `:415-440` Hall of Fame و Trending fallbackها hardcoded و `Verified=false` هستند، ولی response contract هیچ per-item source/status الزام نمی‌کند.
  - `:443-455` percentile chart فرمولی است و DB/upstream distribution نیست.
- **Action:** **Change** metrics into independently sourced cells: verified-sales only; active listing snapshot; historical ATH verified; no synthetic percentiles. Include `source_status`, `observed_at`, `confidence/provenance` per group.
- **Expected behavior:** total supply static authority separate from market stats; missing market stats remain unknown.
- **Acceptance criteria:** no `data_status=live` unless source HTTP + parser confidence + timestamp; no fallback numbers without estimated label.
- **Tests:** mixed source fixture; empty upstream; DB only; parser confidence threshold.

### N-20 — fragmentation of genesis taxonomy/supply claims creates false scarcity

- **Severity:** High
- **Evidence:**
  - `backend/internal/service/numbers/nvengine/nvengine.go:1189-1206` Genesis `exactSupply=1` and text “1 of 1” for every Genesis, although registry/doc says 1,000 Genesis.
  - `:1207-1247` standard pattern supply counts 10/90/1000 etc. are hand-entered, not enumerated inventory or histogram proof.
  - `backend/internal/service/numbers/numbers_service.go:818-886` curated club counts/floors/top sales are hardcoded; counts overlap and sum far beyond/under collection without disjoint definition.
  - `docs/telegram_anonymous_numbers_encyclopedia.md:65-70` says standard count 135,566 in row (correct total standard only if label clear), while frontend `NumbersCollectionPage.tsx:67-74` calls standard floor count 135566 and clubs overlap it.
- **Action:** **Change** exact supply to mathematically defined predicate over verified 136,566 inventory; label estimated counts until full enumeration. Do not call overlapping classes “exact supply.”
- **Expected behavior:** report states class definition, denominator and whether overlap allowed.
- **Acceptance criteria:** for each club `count = COUNT(predicate)` from pinned inventory; Genesis baseline count=1000; exact one-asset class only for explicit singleton.
- **Tests:** enumerate all 1000 Genesis; compare class counts; overlap matrix and sum/union report.

### N-21 — documentation contains unverified claims and internal contradictions

- **Severity:** High (trust/documentation)
- **Evidence:**
  - `docs/telegram_anonymous_numbers_encyclopedia.md:43-46,80-95,283-290` states supply, historical prices, dates and sale records without transaction hashes/block references/source snapshots.
  - TOC `:25` says 19 colors, section `:188-213` says registry has 20.
  - `:146-166` says 27 signals but lists 18 grouped signals; code reasoning log says 38 (`nvengine.go:686-712`), gate returns 27 (`:116-135`).
  - `:103-110` says restricted and clean are separately modeled, but current valuation `buildOnChainAudit` always clean/unrestricted and no restricted feature enters model.
  - `:262-265` says Weibull survival, while code uses fixed branches (`financial.go:127-185`) and no fit parameters.
  - README `README.md:3-6` labels project “Completed & Verified” despite critical runtime/schema/provenance gaps.
- **Action:** **Change/remove** unsupported claims; add source URI, tx hash, block/time, collection snapshot and “unverified/placeholder/experimental” labels. Correct counts and terminology.
- **Expected behavior:** docs are normative only where code/tests/data prove the claim.
- **Acceptance criteria:** every historical sale row has verifiable source; contradictory counts resolved; CI docs/code checklist on coefficient/schema changes.
- **Tests:** docs linter for placeholders/unsupported claims; verify all sample links and tx hashes against fixtures/live verification where allowed.

### N-22 — tests validate heuristic outputs, not trust boundaries

- **Severity:** High
- **Evidence:**
  - Existing tests are mainly feature/NV invariants (`backend/internal/service/numbers/features/features_test.go:9-185`, `backend/internal/service/numbers/nvengine/nvengine_test.go:13-318`) and explicitly assert synthetic price bands such as Genesis >=600k (`:283-296`) rather than data provenance.
  - `backend/internal/service/numbers/numbers_service_test.go:160-183` allows `canonical_catalogue` in outage, which institutionalizes synthetic catalogue behavior.
  - `backend/internal/handler/numbers_handler_test.go:12-60` validates paywall/gate, but no authenticated entitlement, malformed snapshot, credit rollback, or standard-number chain verification integration.
  - `backend/internal/service/ton/ton_nft_verifier_test.go:1-36` is too small for collection/index/initialized/escrow/reorg cases.
- **Action:** **Add** integration/property/contract tests before release; revise tests that bless fake production data. Keep deterministic feature tests, but separate heuristic tests from evidence tests.
- **Expected behavior:** test suite fails on synthetic data, schema mismatch, API drift, parser false positives, stale/unavailable labeling and payment race.
- **Acceptance criteria:** coverage includes all assigned routes and error states; PostgreSQL migration test; mocked TonAPI/Fragment trace fixtures; frontend contract tests.
- **Tests to add:** see test matrix below.

### N-23 — frontend normalization/validation بین utility، report و backend یکسان نیست

- **Severity:** Medium
- **Evidence:** `frontend/src/entities/numbers/lib/formatNumber.ts:12-57` صرفاً formatting می‌کند و 4رقمی خارج بازه 8000..8999 را invalid نمی‌کند؛ `:62-79` `formatLiveNumberInput` هر 4-digit را می‌پذیرد. در مقابل `NumberReportPage.tsx:89-120` range را reject می‌کند و backend `features.NormalizeNumber:54-59` نیز reject می‌کند.
- **Action:** **Change** یک canonical shared normalization/validation contract؛ formatter نباید semantic valid را القا کند و UI باید response backend را source of truth بداند.
- **Expected behavior:** `+888 1234` در همه مسیرها یک status واحد (`invalid genesis`) داشته باشد.
- **Acceptance criteria:** utility tests شامل خارج‌بازه Genesis، 5/6/7/9 digit، double prefix و leading zero؛ no route sends invalid number to gate/valuate.
- **Edge cases:** pasted full prefix; Persian/Arabic; partial typing; `+888` only.
- **Tests:** parity table comparing frontend helper and backend NormalizeNumber fixtures.

### N-24 — Mask Builder paste می‌تواند prefix را اشتباه حذف کند

- **Severity:** Medium
- **Evidence:** `frontend/src/pages/numbers/mask/ui/MaskBuilderPage.tsx:131-150` همیشه `replace(/^888/,'')` می‌کند. برای suffix استانداردی که خودش با 888 شروع می‌شود (مثلاً `88880000`) این کار بخشی از suffix را حذف می‌کند؛ سپس باقی slotهای قبلی حفظ می‌شوند و query با mask موردنظر یکی نیست.
- **Action:** **Change** فقط prefix را وقتی input full `+888`/11-digit تشخیص داده شد حذف کن؛ suffix هشت‌رقمی خام را دست‌نخورده نگه‌دار و slotهای باقی‌مانده را صریحاً `*` کن.
- **Expected behavior:** paste `+888 8888 0000` و paste `88880000` هر دو به slots `8888 0000` تبدیل شوند.
- **Acceptance criteria:** query string دقیقاً با displayed mask برابر باشد؛ property tests برای all 8-digit strings starting `888`.
- **Edge cases:** 4-digit Genesis `8888`; full `+888`; 11-digit with leading zero; Arabic/Persian digits.
- **Tests:** component paste tests and request spy asserting exact `/numbers/mask` pattern.

---

## تست‌ها و اجرای انجام‌شده

### اجراشده

- Inventory و line-by-line review با `find`, `rg`, `nl -ba` روی تمام فایل‌های مستقیم vertical و dependencyهای route/schema/docs انجام شد.
- مسیرهای backend numbers service/handler/repository/NV/features/indexer/bootstrap/TON verifier، frontend API/types/pages/components، migrations/OpenAPI/docs خوانده شدند.

### مسدودشده توسط محیط

1. `cd backend && go test ./internal/service/numbers/... ./internal/handler ./internal/service/ton/... ./internal/client/fragment/...` اجرا نشد: executable `go` در محیط موجود نیست (`go: command not found`).
2. `frontend/node_modules/.bin/vitest run src/entities/numbers` اجرا نشد: `node_modules/.bin/vitest` موجود نیست؛ `pnpm` نیز در PATH موجود نیست و نصب dependency/network مجاز نبود.
3. تست integration با PostgreSQL/TonAPI/Fragment اجرا نشد؛ repository برای نتیجه معتبر به سرویس/fixtures نیاز دارد.

**نتیجه:** هیچ ادعای «تست سبز» برای backend/frontend یا migration داده نمی‌شود. محدودیت بالا blocking است و باید در CI/dev environment با Go، pnpm dependencies و Postgres تکرار شود.

---

## ماتریس تست پذیرش پیشنهادی

| حوزه | تست حداقلی | انتظار |
|---|---|---|
| Normalize | suffixهای 4/8، 4رقمی خارج 8000..8999، leading zero، فارسی/عربی، double prefix | فقط format درست؛ membership جدا |
| Verify | random 8-digit، Genesis واقعی، counterfeit item، uninitialized، API timeout | verified فقط با chain proof؛ unknown در outage |
| Fragment parser | listing، auction، sold، changed HTML، 200 empty، 429 | status unknown برای parse ناشناخته؛ no sale insertion |
| TON trace | bid/refund/transfer/purchase/final sale/failed/scam | فقط final verified sale با tx+event index |
| DB | migrations 70→latest و rollback smoke | no missing `id/is_restricted`; all queries compile/run |
| Bootstrap | crash/replay/partial page/concurrent workers | exact-once logical inventory/histogram |
| NV Engine | no comps، stale comps، down-market prior sale، restricted، rate missing | no permanent last-sale floor; confidence/rank labeled estimated |
| Paywall | guest 403، paid credit، insufficient credit، DB failure، concurrent double unlock | no price leak; atomic/idempotent entitlement/refund |
| Report | every optional field null/unknown; verified vs unavailable | no numeric fallback; no false VERIFIED |
| Collection/intel/chart | cold outage, stale cache, mixed verified/unverified sales | no generated OHLCV/ATH/volume; per-source freshness |
| List/mask | all filters, no-match, wildcard injection, DB fallback | each row matches mask/filters; status provenance |
| Portfolio | buyer then seller, escrow, partial TonAPI, invalid address, duplicate NFT | current owner only; partial status explicit |
| Watchlist | sale, bid, duplicate event, disabled flags, Telegram 429 | configured alerts only, deduped/retried |
| API contract | frontend calls vs router/OpenAPI, Decimal JSON | zero dead routes/field mismatches |
| Docs | sale references, color count, signal count, placeholders | source-backed, consistent, experimental labels |

---

## پوشش فایل‌ها

### Backend مستقیم vertical

- `backend/internal/handler/numbers_handler.go` — 471 خط، کامل خوانده شد.
- `backend/internal/router/router.go` — routeهای numbers و collection خوانده شد.
- `backend/internal/service/numbers/numbers_service.go` — 1925 خط، کامل خوانده شد.
- `backend/internal/service/numbers/features/features.go` — 657 خط، کامل خوانده شد.
- `backend/internal/service/numbers/features/features_test.go` — 188 خط، کامل خوانده شد.
- `backend/internal/service/numbers/features/dialpad.go` — 173 خط، inventory و implementation بررسی شد.
- `backend/internal/service/numbers/features/genesis.go` — 157 خط، کامل خوانده شد.
- `backend/internal/service/numbers/features/lexicon.go` — 152 خط، inventory شد.
- `backend/internal/service/numbers/features/taxonomy.go` — 229 خط، inventory شد.
- `backend/internal/service/numbers/registry/registry.go` — 104 خط، کامل خوانده شد.
- `backend/internal/service/numbers/nvengine/nvengine.go` — 1444 خط، valuation/provenance/persistence/helperها خوانده شد.
- `backend/internal/service/numbers/nvengine/model.go` — 386 خط، کامل خوانده شد.
- `backend/internal/service/numbers/nvengine/financial.go` — 186 خط، کامل خوانده شد.
- `backend/internal/service/numbers/nvengine/nvengine_test.go` — 319 خط، کامل خوانده شد.
- `backend/internal/service/numbers/nvengine/benchmark_test.go` — 114 خط، کامل خوانده شد.
- `backend/internal/service/numbers/numbers_service_test.go` — 184 خط، کامل خوانده شد.
- `backend/internal/service/numbers/indexer/sales_indexer.go` — 319 خط، کامل خوانده شد.
- `backend/internal/service/numbers/bootstrap/bootstrap.go` — 174 خط، کامل خوانده شد.
- `backend/internal/service/numbers/watchlist/watchlist_notifier.go` — 82 خط، کامل خوانده شد.
- `backend/internal/service/ton/ton_nft_verifier.go` — 137 خط، کامل خوانده شد.
- `backend/internal/service/ton/ton_nft_verifier_test.go` — 36 خط، کامل خوانده شد.

### Backend integration/client/repository/schema

- `backend/internal/client/fragment/client.go` — 300 خط؛ parser/status confidence implementation و test fixture reviewed.
- `backend/internal/client/fragment/client_test.go` — 95 خط، کامل خوانده شد.
- `backend/internal/client/tonapi/client.go` — 875 خط؛ address, NFT, collection, owner pagination and request behavior reviewed.
- `backend/internal/client/tonapi/indexer.go` — 141 خط، کامل خوانده شد.
- `backend/internal/repository/numbers_repo.go` — 503 خط، کامل خوانده شد.
- `backend/internal/repository/valuation_repo.go` — 657 خط، relevant valuation/provenance contract reviewed.
- `backend/migrations/000070_anonymous_numbers_vertical.up.sql` — 111 خط، کامل خوانده شد.
- `backend/migrations/000070_anonymous_numbers_vertical.down.sql` — 12 خط، کامل خوانده شد.
- `backend/migrations/000073_intel_credits_system.up/down.sql` — relevant number_sales index reviewed.
- `backend/migrations/000076_proliferation_fix_and_indexer_v2.up/down.sql` — checkpoint/market_registry reviewed.
- `backend/migrations/000078_fix_number_sales_idempotency.up/down.sql` — sale hash/index reviewed.
- `backend/openapi.yaml` — number paths reviewed.

### Frontend/API/types/pages

- `frontend/src/entities/numbers/api/numbersApi.ts` — 342 خط، کامل خوانده شد.
- `frontend/src/entities/numbers/api/numbersApi.test.ts` — inventory شد؛ اجرا به دلیل نبود node_modules ممکن نبود.
- `frontend/src/entities/numbers/model/types.ts` — 473 خط، کامل خوانده شد.
- `frontend/src/entities/numbers/index.ts` — 3 خط، کامل خوانده شد.
- `frontend/src/entities/numbers/lib/formatNumber.ts` — 87 خط، کامل خوانده شد.
- `frontend/src/entities/numbers/lib/formatNumber.test.ts` — 76 خط، کامل خوانده شد.
- `frontend/src/entities/numbers/api/numbersApi.test.ts` — 50 خط، کامل خوانده شد؛ اجرا به دلیل نبود node_modules ممکن نبود.
- `frontend/src/pages/numbers/collection/ui/NumbersCollectionPage.tsx` — 348 خط، کامل خوانده شد.
- `frontend/src/pages/numbers/report/ui/NumberReportPage.tsx` — کامل خوانده شد؛ paywall/report/fallback/provenance labels reviewed.
- `frontend/src/pages/numbers/intel/ui/NumbersIntelPage.tsx` — 240 خط، کامل خوانده شد.
- `frontend/src/pages/numbers/intel/ui/components/NumbersChartView.tsx` — 853 خط، chart/methodology reviewed.
- `frontend/src/pages/numbers/intel/ui/components/NumbersPortfolioView.tsx` — 290 خط، کامل خوانده شد.
- `frontend/src/pages/numbers/intel/ui/components/NumbersTableView.tsx` — 820 خط، filter/live/stale rendering reviewed.
- `frontend/src/pages/numbers/mask/ui/MaskBuilderPage.tsx` — 416 خط، کامل خوانده شد.
- `frontend/src/app/router/routes.tsx` — number routes reviewed.

### Docs/API specifications

- `docs/telegram_anonymous_numbers_encyclopedia.md` — 332 خط، کامل خوانده شد.
- `docs/AIRDROP_SYSTEM_AI_SPEC.md`, `docs/TELEGRAM_GIFTS_AI_SPEC.md` — cross-vertical payment/architecture context inventory شد؛ gift implementation خارج scope است.
- `README.md`, `PRODUCT.md`, `DESIGN.md`, `openapi.yaml`, `backend/openapi.yaml` — relevant claims/routes reviewed.

### خارج از پوشش محتوایی این ممیزی

فایل‌های unrelated به numbers (گifts/airdrop/username، owner/admin، unrelated migrations/tests) فقط برای dependency/route context بررسی شدند، نه خط‌به‌خط functional audit؛ ادعا نمی‌شود کل repository غیرمرتبط ممیزی شده است.

---

## Placeholder / ادعاهای غیرقابل‌اثبات / API mismatch — فهرست سریع

- **Placeholder/synthetic:** `generateCanonicalCatalogue` و owner/priceهای آن؛ OHLCV سینوسی 181روزه؛ `collection` static metrics؛ frontend floor/volume/ATH fallback؛ report numeric defaults؛ `DataSourcesCount` mismatch.
- **Unprovable claims:** historical sale table در docs بدون tx/block/source؛ QuantumBayes/model confidence؛ global rank دقیق؛ rental/DeFi/liquidity figures؛ “verified/live/clean” on-chain audit بدون item proof؛ exact pattern supplyها.
- **API mismatch:** missing `/numbers/collection-overview`; `nft_colors` vs `nft_color`; undocumented 403/paywall; `NumbersIntelData.trending_tail` names vs backend JSON; `data_status` union excludes `stale/canonical_catalogue`; Decimal string/number contract; `alert_on_bid` exposed but not implemented.

## وضعیت خروجی

این فایل تنها artifact ایجادشده است: `numbers_audit.md`. هیچ فایل source، migration، تست یا external content تغییر نکرد.
