باشه حتماً 👇 کل گزارش رو همینجا کامل و بدون خلاصهسازی میذارم تا راحت بخونی:

---

# 📑 گزارش فوق جامع بخش «نام کاربری / Username» در پروژه iFragment

> منبع بررسی: ریپازیتوری <https://github.com/SeyyedYousef/iFragment>
> تاریخ بررسی: ژانویه ۲۰۲۶
> دامنهی بررسی: فرانتاند، بکاند، تکنولوژیها، مسیر کاربری، UI/UX، منابع داده

---

## 0) خلاصهی اجرایی (TL;DR)

| سرفصل | وضعیت فعلی |
|---|---|
| **فرانتاند Username** | فقط یک فرم ورودی + اعتبارسنجی regex + شبیهسازی Loading. هیچ نتیجهای نمایش داده نمیشود. |
| **بکاند Username** | **عملاً صفر.** فقط یک Health-check در `cmd/api/main.go` وجود دارد. هیچ روت، هیچ سرویس، هیچ مدل دیتابیس، هیچ اتصال به Postgres/Dragonfly. |
| **اتصال به منابع داده (Fragment / TON / Market)** | هیچ. حتی یک کلاینت HTTP هم ساخته نشده. |
| **مسیر کاربری (Flow)** | کاربر یوزرنیم میزند → دکمه ۱۰۰ ستاره میزند → ۲ ثانیه لودر → پیام «موفقیتآمیز» (Mock). انتها. |
| **«اطلاعات رایگان مجموعه»** که در UI ادعا شده | لینک هست ولی **صفحهی مقصد و دیتای آن وجود ندارد.** |
| **ذخیرهسازی، پرداخت، گزارش پولی** | پیادهسازی نشده. |

### نمرهی نهایی: **۸ از ۱۰۰**

> این ۸ نمره فقط بابت دو چیز است: ۱) معماری پوشهبندی FSD درست انتخاب شده، ۲) UI کلاینت یوزرنیم از نظر طراحی، انیمیشن و i18n واقعاً تمیز و حرفهای ساخته شده. بقیهی ۹۲ نمره بهخاطر نبود کامل لایهی داده، بکاند، کش، اعتبارسنجی واقعی، و یکپارچهسازی است.

---

## 1) نقشهی فایلهای مرتبط با Username

### 1.1 فرانتاند (SolidJS + TS + Tailwind)
```
frontend/src/
├── entities/username/model/index.ts          ← فقط Schema + Hook ساده
├── widgets/hero-tabs/HeroTabs.tsx            ← تب «یوزرنیمها / شمارهها / هدایا»
├── widgets/action-area/ActionArea.tsx        ← فرم ورود + دکمهی Analyze
├── pages/IndexPage/IndexPage.tsx             ← صفحهی هاست
└── shared/i18n/{fa,en,ru,zh}.ts              ← متنهای UI (action.username.*)
```

> **چیزی که وجود ندارد:**
> - `entities/username/api/*` — هیچ کلاینت HTTP/GraphQL/TanStack Query
> - `entities/username/ui/UsernameCard.tsx` — کامپوننت نمایش نتیجه
> - `pages/UsernameDetailsPage` — صفحهی نتیجهی تحلیل
> - `pages/CollectionStatsPage` — صفحهی «اطلاعات عمومی رایگان» که در UI به آن لینک میدهیم
> - استفاده از `@tanstack/solid-query` که در `package.json` نصب است ولی **در عمل برای Username اصلاً استفاده نشده**.

### 1.2 بکاند (Go + Chi)
```
backend/
├── cmd/api/main.go                           ← فقط /health
├── go.mod / go.sum                           ← تنها وابستگی واقعی: chi
└── sqlc.yaml                                 ← اشاره به internal/repository/* که موجود نیست
```

> **چیزی که وجود ندارد:**
> - `internal/handler/username_handler.go`
> - `internal/service/username_service.go`
> - `internal/repository/{schema.sql,query.sql}` (در sqlc.yaml اشاره شده ولی فایلها نیستند → `sqlc generate` همین الان شکست میخورد)
> - اتصال PostgreSQL (`pgx`)
> - اتصال DragonflyDB
> - میدلویر اعتبارسنجی `Telegram InitData`
> - هیچ روت `/api/v1/usernames/...`

### 1.3 i18n
کلیدهای `action.username.*` تعریف شده، ولی هیچ کلیدی برای **نمایش نتیجهی تحلیل** (مثل floor price، رنک کمیابی، تاریخچهی مالکین، چارت قیمت، صاحب فعلی، آخرین فروش، ...) تعریف نشده.

---

## 2) تحلیل تکنولوژیها

### 2.1 انتخابهای فرانتاند — ✅ مدرن و درست
| مورد | وضعیت | نظر |
|---|---|---|
| SolidJS | ✅ | برای Mini‑App تلگرام عالی است. |
| Vite + TS strict | ✅ | استاندارد. |
| Tailwind + Ark UI + Motion | ✅ | ترکیب خوب، ولی Ark UI هنوز در Username استفاده نشده. |
| TanStack Query v5 | ⚠️ | نصب شده ولی **در Username صفر استفاده** شده. |
| Valibot | ✅ | مصرف میشود ولی حداقلی (فقط minLen/maxLen/regex). |
| TMA SDK (`@tma.js/sdk-solid`) | ✅ | hapticFeedback درست استفاده شده. |
| TON Connect | ⚠️ | پکیج نصب است ولی هیچجای Username از کیف پول استفاده نمیشود. |
| FSD (Feature‑Sliced Design) | ⚠️ | لایهی `entities/username/api` و `features/analyze-username` ساخته نشده — یعنی FSD ناقص است. |

### 2.2 انتخابهای بکاند — ⚠️ روی کاغذ خوب، در عمل پوچ
- Go + chi + sqlc + Postgres + Dragonfly → روی کاغذ stack درجه یک.
- ولی **یک خط کد واقعی برای Username نوشته نشده**. Risk: انتخاب stackهای زیاد بدون بستهبندی اولیه (Boilerplate) باعث میشود فاز ۲ خیلی کند شروع شود.

### 2.3 اعتبارسنجی Username
قانون فعلی:
```
4 ≤ len ≤ 32 ، فقط [a-zA-Z0-9_]
```
**ایرادها:**
1. تلگرام **شروع با عدد را نمیپذیرد** ولی regex فعلی میپذیرد.
2. تلگرام **نباید با `_` شروع یا تمام شود** و **نباید `__` پشتسرهم** داشته باشد — هیچکدام چک نشده.
3. حداقل واقعی تلگرام برای یوزرنیم عمومی **۵ کاراکتر** است (۴ کاراکتر فقط یوزرنیم پرمیوم/قدیمی). با ۴ شروع کردن ممکن است کاربر را گمراه کند.
4. حروف بزرگ بهصورت سرور-ساید نرمالسایز (lowercase) نمیشود.
5. کاراکترهای `@`, space, emoji نباید پاکسازی هم بشوند — الان پاکسازی نمیشوند، فقط ارور میدهد.

---

## 3) تحلیل مسیر کاربری (User Flow)

### 3.1 Flow فعلی (Mock)
```
Home → کلیک تب «یوزرنیمها» → Animation → 
  Input @username → اعتبارسنجی client-side →
    کلیک «تحلیل پیشرفته یوزرنیم (۱۰۰ ستاره)» →
      ۲ ثانیه setTimeout →  ✅ "موفقیتآمیز"  →  بازگشت به idle
```
**هیچ نتیجهای نشان داده نمیشود.** کاربر بعد از پرداخت ادعایی هیچ ارزشی نمیگیرد.

### 3.2 Flow ایدهآل (که باید پیاده شود)
```
1) تب Username
2) Input + لایو-چک «این یوزرنیم در تلگرام Available/Taken/On Auction»
   ↳ این داده رایگان است (از Fragment + t.me/<u> + TON DNS)
3) دکمهی «اطلاعات رایگان مجموعه» → صفحهی Stats کلی کالکشن (بدون پرداخت)
4) دکمهی «۱۰۰ ⭐ گزارش پرمیوم»:
   a) باز شدن Telegram Stars Invoice (روش رسمی پرداخت Mini‑Apps)
   b) تایید پرداخت سرور-ساید
   c) فراخوانی موازی منابع داده (Fragment + TonAPI + GetGems + MarketApp)
   d) ساخت گزارش JSON ← کش ۲۴ساعته در Dragonfly
   e) نمایش UsernameDetailsPage با چارت + جدول + Share
5) Share/Export PDF + ذخیره در «گزارشهای من»
```

---

## 4) UI/UX — نقاط قوت و ضعف

### ✅ نقاط قوت
- طراحی تیره با Glow و Glass درجه یک، منطبق با راهنمای ضدّ AI-slop.
- انیمیشنهای Motion One نرم و موبایل-فرست.
- Haptic Feedback در نقاط درست.
- پشتیبانی RTL برای فارسی + ۴ زبان.
- وضعیتهای `idle / loading / success` بهخوبی متمایزند.

### ❌ نقاط ضعف
1. **«۱۰۰ ⭐ Premium Report»** نمایش داده میشود ولی هیچ روند پرداختی پشتش نیست — اعتماد کاربر را خراب میکند.
2. **هیچ پیشنمایش رایگانی** قبل از پرداخت دیده نمیشود (مثلاً «این یوزرنیم در فرگمنت موجود است؟ کف قیمت کالکشن چقدر است؟»). این یعنی کاربر کور-کورانه باید پرداخت کند.
3. لینک «اطلاعات عمومی مجموعه را رایگان همین حالا ببینید» **به هیچجا نمیرود** (no `onClick`).
4. در حالت Error فقط متن قرمز کوچک زیر input نمایش داده میشود؛ هیچ راهنمایی برای فرمت درست (مثل: "@durov" نمونه) داده نمیشود.
5. وقتی یوزرنیم خالی است دکمه disabled است — درست — ولی متن «۱۰۰ ⭐» همانجا روشن میماند که مبهم است.
6. آیکون Material Symbols در داخل Tailwind کلاس مستقیم استفاده شده؛ ولی فونت آن در پروژه load نشده (در App.tsx لینک نیست) — در پابلیش ممکن است آیکونها نشان داده نشوند.
7. هیچ اشارهای به اینکه گزارش چه چیزی شامل میشود (Bullet list از فیچرها) دیده نمیشود → نرخ تبدیل پایین.
8. روی iOS Safari وقتی صفحه expand میشود، input ۴۰px font ممکن است باعث Zoom بشود (Telegram Mini App راهحل: `font-size: 16px+` روی input یا `viewport-fit=cover`).

---

## 5) بخش رایگان vs پولی — استراتژی داده

### 5.1 دادهی رایگان (Collection-Level — برای همهی کاربران)
| داده | منبع | هزینه | توضیح |
|---|---|---|---|
| تعداد کل آیتمهای کالکشن (Total Supply) | TonAPI / GetGems / MarketApp | رایگان | ~۳۳۷K |
| تعداد هولدرهای یکتا | TonAPI `/v2/nfts/collections/{addr}/items` | رایگان | ~۹۰K |
| Floor price | MarketApp / Fragment / GetGems | رایگان | لحظهای |
| حجم ۲۴h / ۷d / ۳۰d | GetGems GraphQL + Fragment | رایگان | trade volume |
| میانگین قیمت فروش | aggregation داخلی | رایگان | ساده |
| چارت قیمت تاریخی | جمعآوری از TonAPI events | رایگان | نیاز به Job ساعتی |
| تعداد آکشنهای فعال در فرگمنت | فرگمنت (HTML scrape یا internal API) | رایگان | parsing |

### 5.2 دادهی پولی (Username-Level — ۱۰۰ ⭐ یا تعرفهی شما)
| داده | منبع | پیچیدگی |
|---|---|---|
| وضعیت فعلی (Available / On‑Sale / Auction / Owned) | Fragment + t.me/<u> + TON DNS | Medium |
| صاحب فعلی (Wallet + Telegram ID اگر public) | TonAPI `/v2/nfts/{nft}` | Easy |
| تاریخچهی کامل مالکین | TonAPI `/v2/nfts/{nft}/history` | Easy |
| تاریخچهی پیشنهادها/قیمتها | Fragment + GetGems + MarketApp | Hard |
| رنک کمیابی (Rarity) | محاسبهی داخلی روی صفات (length, has_digit, dictionary, ...) | Medium |
| ارزش تخمینی AI | مدل خودتان روی دیتای فروشهای مشابه | Hard |
| یوزرنیمهای مشابه (Similar) | الگوریتم Levenshtein + n‑gram | Medium |
| نمودار قیمت بر اساس categoryها (3-letter, dictionary, ...) | aggregation | Medium |
| بررسی Counterfeit / homoglyph (مثلاً `paypaI` با I بزرگ) | تابع داخلی | Easy ولی ارزشمند |
| نمایش Telegram Bio/Photo اگر public است | `getChat` در Bot API یا MTProto `resolveUsername` | Easy |
| فروشندهی فعلی (Listing) و قیمت پیشنهادی | MarketApp / GetGems / Fragment | Easy |

---

## 6) منابع داده — جزئیات فنی کامل

### 6.1 Fragment.com — منبع اصلی (نیمهرسمی)
**سایت:** `fragment.com`
**روشهای استخراج:**

#### روش الف) HTML scraping ساده
- `GET https://fragment.com/username/<handle>` → HTML شامل صفحهی auction.
- دادههای قابل پارس: status, current bid, time left, owner, history.

#### روش ب) Internal AJAX API (آن چیزی که `auction.js` استفاده میکند)
بررسی `auction.js` نشان میدهد فریمورک داخلی به نام `Aj` همهی فراخوانیها را به یک endpoint مرکزی میفرستد:
```
POST https://fragment.com/api?hash=<csrf_hash>
Content-Type: application/x-www-form-urlencoded
Body: method=<methodName>&...params
```
متدهای رایج که در سورس کد و network tab مرورگر دیده میشوند:
| Method | کاربرد |
|---|---|
| `searchAuctions` | لیست/فیلتر آکشنهای فعال |
| `getAuctionInfo` | اطلاعات یک یوزرنیم خاص |
| `getAuctionStats` | آمار کلی کالکشن |
| `getBuyerWallet` | اطلاعات کیف پول خریدار |
| `searchPremarket` / `searchAuctions` | جستجوی فیلترشده |

> **هشدار حقوقی/پایداری:** این API نیمهرسمی است. ToS را چک کنید، rate-limit بزنید، User-Agent درست بگذارید، CSRF hash را از HTML اصلی صفحه استخراج کنید و در Cookie جلسه نگهدارید.

#### روش ج) رسمی-تر: دادهی on-chain از TON
هر یوزرنیم Fragment که لیست شده عملاً یک NFT روی کالکشن:
```
Telegram Usernames Collection:
EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi
```
که از طریق TonAPI/TonCenter قابل خواندن است (پایین).

### 6.2 TonAPI.io — برای دادههای on-chain
**Base URL:** `https://tonapi.io/v2`
**کلید:** بخش رایگان دارد (محدود)، Pro: tonconsole.com → API Key

| Endpoint | کاربرد | دسته |
|---|---|---|
| `GET /nfts/collections/{addr}` | متادیتای کالکشن، supply | رایگان |
| `GET /nfts/collections/{addr}/items?limit=1000` | لیست آیتمها (paginate) | رایگان |
| `GET /nfts/{nft_addr}` | اطلاعات یک یوزرنیم خاص | رایگان |
| `GET /nfts/{nft_addr}/history` | تاریخچهی انتقالها | رایگان |
| `GET /accounts/{addr}/nfts?collection={addr}` | NFT های یک کیف پول | رایگان |
| `GET /dns/{name}.t.me/resolve` | resolve یوزرنیم به آدرس | رایگان |
| `GET /rates?tokens=ton&currencies=usd` | نرخ TON برای محاسبه ارزش | رایگان |

> **بهترین انتخاب برای MVP:** TonAPI بهخاطر مستندات تمیز، WebSocket، و SSE.

**جایگزینها:**
- `https://toncenter.com/api/v2/` — رسمیتر، rate limit بازتر، ولی دادهی NFT-friendly کمتر.
- `https://tonapi.tonconsole.com` — Pro نسخه.
- Self-hosted `ton-http-api` + `ton-index-go`.

### 6.3 GetGems.io — مارکتپلیس بزرگ TON
**Endpoint:** `https://api.getgems.io/graphql`
**Auth:** Public read (برخی mutationها نیاز به sign-in TON Connect دارند)
**نمونه Query:**
```graphql
query NftCollectionStats($address: String!) {
  alphaNftCollectionStats(address: $address) {
    floorPrice  totalVolume  ownersCount  itemsCount
  }
  alphaNftItemsByCollection(address: $address, first: 50) {
    items {
      address  name  ownerAddress  sale { ... on NftSaleFixPrice { fullPrice } }
    }
  }
}
```
**استفادهی ما:** Floor price، Listing های فعال، تاریخچهی Sale بهصورت دقیقتر از TonAPI.

### 6.4 MarketApp.ws — مارکت کوچکتر تخصصی
**Base URL:** `https://api.marketapp.ws`
**Swagger UI:** همان آدرس بالا
**Auth:** Header `Authorization: <token>` (بدون `Bearer`)
**ویژگیها:**
- اندپوینت برای Telegram Usernames Collection بهطور خاص.
- اطلاعات Rent (اجاره) که هیچ مارکت دیگر ندارد.
- معمولاً Floor از Fragment پایینتر است (arbitrage opportunity).

> **نکته:** Token از `https://marketapp.ws` بعد از sign-in با TON Wallet گرفته میشود. میتوانید برای backend خودتان یک wallet اختصاصی بسازید.

### 6.5 Telegram Bot API — رایگان و رسمی
- `getChat?chat_id=@<username>` → اگر کانال/گروه عمومی باشد، اطلاعات publicاش را میدهد (title, photo, members count).
- اگر یوزر شخصی باشد و قبلاً با ربات شما تعامل نداشته باشد، **نمیتوانید اطلاعاتش را بگیرید** (محدودیت رسمی Telegram).

### 6.6 Telegram MTProto (TDLib / Telethon / Pyrogram) — قوی ولی پرریسک
از طریق یک **اکانت تلگرام واقعی** (Phone + API_ID + API_HASH از `my.telegram.org`):
- `contacts.resolveUsername` → کاملترین داده ممکن از یوزرنیم: ID, type (user/bot/chat/channel), photo, bio, premium flag, last_seen (در صورت اجازه).
- ریسک: Telegram به اکانتهایی که زیاد resolve میکنند **flood-wait** و در نهایت **ban** میدهد. باید pool از اکانتها داشته باشید (numbers خریداریشده) و rate limit دقیق.
- پیشنهاد: یک سرویس Go با کتابخانهی [`gotd/td`](https://github.com/gotd/td) یا یک سایدکار Python با [Pyrogram](https://github.com/pyrogram/pyrogram) که فقط به `resolveUsername` و `getFullUser` پاسخ میدهد و کش ۷ روزه دارد.

### 6.7 منابع بدیع و مفید دیگر
| منبع | داده | لینک |
|---|---|---|
| **t.me/<username>** (HTML) | تشخیص اینکه یوزرنیم به user / channel / group / bot وصل است + photo + description | بدون نیاز به API |
| **TON DNS Resolver** (`*.t.me`) | wallet مرتبط با یوزرنیم | TonAPI |
| **Tonnel.network** | مارکت کوچک ولی listing های متفاوت | `tonnel.network/api` |
| **Disintar.io** | مارکت قدیمی، تاریخچهی بهتر | `disintar.io/api` |
| **DeDust / STON.fi** | اگر قرار است در آینده توکن FRG داشته باشید | DEX |
| **CoinGecko** | نرخ TON/USD برای محاسبهی ارزشها | رایگان |
| **own MongoDB / Postgres** | کش گزارشهای قبلی + Trend سازی | داخلی |

---

## 7) معماری پیشنهادی پیادهسازی Username (هنگام شروع توسعه)

### 7.1 لایهی Aggregator در بکاند (Go)
```
internal/
├── handler/
│   ├── username_public.go     // GET /api/v1/usernames/collection/stats
│   └── username_premium.go    // POST /api/v1/usernames/{u}/report  (بعد از Stars)
├── service/
│   └── username/
│       ├── aggregator.go      // ادغام موازی همهی sourceها با errgroup
│       ├── rarity.go          // محاسبهی رنک کمیابی
│       └── pricing.go
├── client/
│   ├── fragment/              // HTTP client + cookie + CSRF
│   ├── tonapi/                // ساده با httptron
│   ├── getgems/               // GraphQL با machinebox/graphql
│   ├── marketapp/             // OpenAPI generated
│   └── mtproto/               // grpc به سایدکار Pyrogram
├── repository/
│   ├── username_report.sql.go // sqlc generated
│   └── schema.sql             // جدول reports + cache
└── middleware/
    ├── tg_initdata.go         // اعتبارسنجی Telegram InitData
    └── stars_invoice.go       // بررسی پرداخت
```

### 7.2 جداول دیتابیس (PostgreSQL)
```sql
CREATE TABLE username_cache (
  username        TEXT PRIMARY KEY,
  payload         JSONB NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE username_reports (    -- گزارشهای پولی کاربران
  id              UUID PRIMARY KEY,
  tg_user_id      BIGINT NOT NULL,
  username        TEXT NOT NULL,
  stars_paid      INT NOT NULL,
  invoice_id      TEXT NOT NULL UNIQUE,
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON username_reports (tg_user_id, created_at DESC);

CREATE TABLE collection_snapshots (   -- رایگان، snapshot ساعتی
  taken_at        TIMESTAMPTZ PRIMARY KEY,
  total_supply    INT,
  holders         INT,
  floor_ton       NUMERIC(20,9),
  volume_24h_ton  NUMERIC(20,9),
  source          TEXT
);
```

### 7.3 کشگذاری (DragonflyDB)
| نوع داده | TTL |
|---|---|
| Collection Stats | 60 ثانیه |
| Username Status (taken/available) | 5 دقیقه |
| Premium Report | ۲۴ ساعت (یوزر همان گزارش را تا ۲۴h رایگان دوباره میگیرد) |
| TON/USD rate | 60 ثانیه |
| Fragment auction data | 30 ثانیه |

### 7.4 پرداخت — Telegram Stars (روش رسمی Mini-App)
1. فرانت → `POST /api/v1/usernames/{u}/report/invoice`
2. سرور → `Bot.createInvoiceLink({currency:"XTR", prices:[{label:"Premium Report", amount:100}]})`
3. فرانت `tma.openInvoice(link)`
4. وبهوک ربات → `pre_checkout_query` → ok
5. `successful_payment` → سرور: گزارش را ساخته، در DB ذخیره میکند، به فرانت پوش میکند.

---

## 8) چکلیست تکمیل بخش Username

### Phase A — Free MVP (بدون پرداخت، فقط دادهی رایگان)
- [ ] `entities/username/api/index.ts` با TanStack Query
- [ ] `pages/CollectionStatsPage` (تب «اطلاعات رایگان»)
- [ ] بکاند: `GET /api/v1/usernames/collection/stats` با aggregation از TonAPI + GetGems
- [ ] Snapshot ساعتی collection_snapshots با cron در Go
- [ ] Live availability check روی Input (debounce 400ms) → سبز/قرمز/زرد
- [ ] اصلاح regex یوزرنیم (no leading digit, no leading/trailing _, no __ )
- [ ] فعال کردن لینک «اطلاعات رایگان مجموعه»

### Phase B — Premium Report
- [ ] Telegram Stars Invoice integration
- [ ] `pages/UsernameDetailsPage` با: Owner card, History timeline, Price chart, Rarity badge, Similar usernames
- [ ] Aggregator سرور با `errgroup` (Fragment + TonAPI + GetGems + MarketApp + MTProto)
- [ ] الگوریتم Rarity (طول، digit، dictionary, palindrome, pronounceable)
- [ ] صفحهی «گزارشهای من» با ذخیرهسازی DB
- [ ] Share PDF / Open Graph image dynamic

### Phase C — Pro
- [ ] Watchlist (نوتیف وقتی یوزرنیم خاصی Listing شد)
- [ ] Floor price alert
- [ ] هشدار Counterfeit (homoglyph detection)
- [ ] Bulk analyzer (۱۰ یوزرنیم همزمان با تخفیف Stars)
- [ ] AI valuation (مدل خودمان روی sales history)
- [ ] WebSocket push برای آپدیت لحظهای auction

### Phase D — Compliance & Robustness
- [ ] Rate-limiter داخلی برای هر source
- [ ] Circuit breaker برای Fragment (در صورت ban شدن IP)
- [ ] Pool از اکانتهای MTProto با rotation
- [ ] لاگینگ ساختاریافته (zerolog) + Sentry
- [ ] تست E2E با Playwright (مسیر کامل خرید Stars)
- [ ] Mock Service Worker برای dev بدون TON

---

## 9) نمرهدهی تفکیکی

| بُعد | امتیاز | از | توضیح |
|---|---|---|---|
| طراحی UI | ۱۲ | ۱۵ | تمیز، مدرن، RTL، انیمیشن |
| اعتبارسنجی Client | ۲ | ۵ | regex ضعیف |
| لایهی API فرانت | ۰ | ۱۰ | اصلاً وجود ندارد |
| بکاند Routes | ۰ | ۱۵ | فقط health |
| اتصال به Data Sources | ۰ | ۱۵ | هیچ |
| دیتابیس و کش | ۰ | ۱۰ | هیچ |
| پرداخت Stars / Premium | ۰ | ۱۰ | هیچ |
| نمایش نتیجه به کاربر | ۰ | ۱۰ | هیچ |
| امنیت (InitData, RateLimit) | ۰ | ۵ | هیچ |
| تست | ۰ | ۵ | هیچ |
| **جمع** | **۸** | **۱۰۰** | |

---

## 10) ریسکها و ملاحظات

1. **Fragment ToS** — استفادهی تجاری از scraping ممکن است بلاک شود. راه: کش طولانی، rate limit، حتی الامکان از TonAPI/GetGems استفاده کنید.
2. **Telegram MTProto Ban** — اگر pool درست نداشته باشید، اکانتها بن میشوند. پیشنهاد: ۵–۱۰ اکانت با شمارهی غیر-VOIP، rotation هر N درخواست، session ذخیره روی دیسک.
3. **TonAPI Rate Limit** — پلن Free محدود است. برای production حتماً پلن Pro یا self-hosted ton-http-api داشته باشید.
4. **هزینه** — هر تحلیل کامل ممکن است ۵–۱۵ درخواست شبکه داشته باشد. کش حیاتی است.
5. **دادهی متناقض بین منابع** — Fragment و GetGems گاهی floor متفاوت میدهند. پیشنهاد: نمایش هر دو با برچسب source، یا میانگین وزندار.
6. **Telegram Stars revenue share** — تلگرام ۳۰٪ کم میکند. در قیمتگذاری لحاظ شود.
7. **GDPR / Privacy** — اگر MTProto استفاده میکنید و bio/photo کاربر را ذخیره میکنید، باید سیاست حفظ حریم خصوصی شفاف داشته باشید.

---

## 11) جوابهای مستقیم به سؤالات شما

> **«از کجا اطلاعات نامهای کاربری تلگرام پیدا میکنیم؟»**

به ترتیب اولویت پیشنهادی:

1. **TonAPI.io** — بهترین نقطهی شروع، رایگان، رسمی، پایدار، JSON تمیز.
2. **GetGems GraphQL** — برای آمار کالکشن و listing های لحظهای.
3. **Fragment.com** — هم scraping HTML هم internal API (با احتیاط). دادهی auction فقط اینجا کامل است.
4. **MarketApp.ws** — مکمل خوب، Floor متفاوت، Rent functionality.
5. **t.me/<username>** scraping ساده — بفهمید یوزرنیم به چه نوع entity وصل است (user/channel/bot).
6. **Telegram Bot API `getChat`** — اطلاعات رسمی برای کانال/گروه/بات public.
7. **Telegram MTProto با اکانت** — قویترین، گرانترین، پرریسکترین. فقط برای دادههایی که بقیه نمیدهند (مثل Premium status کاربر، آخرین فعالیت، ID عددی).
8. **Tonnel / Disintar / Disintar.io** — مارکتهای ثانویه برای کامل کردن تصویر.

> **«اطلاعات دو دسته است: کالکشن (رایگان) و یوزرنیم خاص (پولی).»**

دقیقاً درست است؛ جدولهای بخش 5.1 و 5.2 این تفکیک را مفصل کردهاند. در سطح کالکشن از TonAPI/GetGems آمار را میگیریم؛ در سطح یک یوزرنیم خاص، Aggregator موازی روی Fragment + TonAPI + GetGems + MarketApp + MTProto اجرا میکنیم و نتیجه را بعد از پرداخت Stars به کاربر میدهیم.

> **«auction.js در stel.com چی هست؟»**

این فایل، **UI script** فرگمنت است (مشابه auction.js در سایر پنلهای تلگرام). همهی فراخوانیهایش از طریق `Aj.ajax(method, params)` به آدرس `POST https://fragment.com/api?hash=...` میرود. متدهای کلیدی: `searchAuctions`, `getAuctionInfo`, `searchPremarket`, `getAuctionStats`. برای استفاده باید: ۱) HTML اصلی صفحه را بگیرید تا hash و session را استخراج کنید، ۲) با همان cookieها POST بزنید، ۳) خروجی HTML/JSON را parse کنید. این رسماً API نیست ولی پایدار است.

---

## 12) جمعبندی و پیشنهاد قدم بعدی

نمرهی فعلی **۸/۱۰۰** صرفاً به این معنی نیست که کار بدی شده، بلکه به این معنی است که **فقط لایهی نمایشی و طراحی شروع شده** و کلِ منطق کسبوکار، اتصال داده، بکاند و monetization باقی است. بهخاطر اینکه UI شما واقعاً تمیز است، یک شالودهی عالی برای ساخت بقیهی لایهها وجود دارد.

### قدم بعدی پیشنهادی (ترتیب اجرا):

1. ✅ **همین گزارش** را با تیم/خودتان مرور کنید و فاز A/B/C/D را اولویتبندی کنید.
2. 🔑 سه کلید/توکن آماده کنید: **TonAPI key**, **GetGems** (اختیاری)، **MarketApp token**, **Telegram Bot Token + ادمین**, و در صورت نیاز **Telegram api_id/api_hash + شماره برای MTProto**.
3. 🛠 شروع از **Phase A (MVP رایگان)**: stats صفحه + availability check روی input — یک هفته کار است و بلافاصله ارزش به کاربر میدهد.
4. 💎 سپس **Phase B (Premium Report + Stars)** که نقطهی درآمدزایی است.
5. 🚀 بعد از validate شدن مدل، Phase C (Watchlist, Bulk, AI valuation).

> پیشنهاد بازرگانی هوشمند 💡: **«Free Availability Scan + Paid Deep Report»** الگویی است که در Namecheap/GoDaddy ثابت شده. کاربر را با چک رایگان جذب کنید، با گزارش پولی monetize کنید. اضافه کردن یک **«Watchlist با نوتیف Stars»** میتواند درآمد تکراری (subscription با Stars) ایجاد کند که برای Mini-App تلگرامی هنوز کمرقیب است.

---

*این گزارش تحلیلی است و هیچ کدی نوشته نشده. هر زمان آمادهی شروع پیادهسازی Phase A بودید، اعلام کنید تا مستقیم برویم سراغ کد.* 🚀

---

اگه بخش خاصی برات گنگه یا میخوای روی یه Phase خاص (مثلاً Phase A) عمیقتر بریم، بگو تا یا کد بزنیم یا Plan دقیقتر برات بنویسم. ✋
