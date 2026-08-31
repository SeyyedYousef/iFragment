---
name: telegram-gifts
description: Complete 35-chapter technical encyclopedia and knowledge base on Telegram Gifts, TEP-62/TEP-64 NFTs, Star economics, pricing models, on-chain contracts, APIs, crafting mechanics, and marketplace aggregation for iFragment.
---

# 📚 دایره‌المعارف کامل اکوسیستم Telegram Gifts
> تاریخ تدوین: ۲۰۲۶/۰۸/۳۱ | منبع: تحقیق عمیق از ده‌ها سورس زنده و APIهای رسمی

---

## ۱. آمار کلان لحظه‌ای (از `api.changes.tg/health` و `/total`)

| متریک | مقدار | منبع |
|:---|:---|:---|
| **کل گیفت‌ها** | **۱۴۹** | api.changes.tg/total |
| **گیفت‌های قابل ارتقا به NFT** | **۱۲۰** | api.changes.tg/total |
| **گیفت‌های محدود (Limited)** | **۱۳۸** | api.changes.tg/total |
| **گیفت‌های نامحدود** | **۱۱** | api.changes.tg/total |
| **کل مدل‌های یکتا** | **۷,۵۷۶** | api.changes.tg/total |
| **کل بک‌دراپ‌ها (پس‌زمینه)** | **۸۰** | api.changes.tg/total |
| **کل سیمبل/پترن‌ها** | **۲۵,۳۷۳** | api.changes.tg/total |
| **ارزش بازار (Market Cap)** | **~$۱۲۸M** (اواخر ۲۰۲۵) | dropstab, binance |
| **حجم تجمیعی معاملات** | **$۳۰۰M+** | durovscode, binance |
| **کیف‌پول‌های فعال** | **۵۰۰,۰۰۰+** | dropstab |
| **کل کاربران هولدر** | **~۲ میلیون** | dropstab |
| **کل گیفت‌های در گردش** | **~۹ میلیون** | dropstab |

---

## ۲. فهرست کامل ۱۲۰ گیفت قابل ارتقا (از `api.changes.tg/gifts`)

```
Santa Hat, Signet Ring, Precious Peach, Plush Pepe, Spiced Wine,
Jelly Bunny, Durov's Cap, Perfume Bottle, Eternal Rose, Berry Box,
Vintage Cigar, Magic Potion, Kissed Frog, Hex Pot, Evil Eye,
Sharp Tongue, Trapped Heart, Skull Flower, Scared Cat, Spy Agaric,
Homemade Cake, Genie Lamp, Lunar Snake, Party Sparkler, Jester Hat,
Witch Hat, Hanging Star, Love Candle, Cookie Heart, Desk Calendar,
Jingle Bells, Snow Mittens, Voodoo Doll, Mad Pumpkin, Hypno Lollipop,
B-Day Candle, Bunny Muffin, Astral Shard, Flying Broom, Crystal Ball,
Eternal Candle, Swiss Watch, Ginger Cookie, Mini Oscar, Lol Pop,
Ion Gem, Star Notepad, Loot Bag, Love Potion, Toy Bear,
Diamond Ring, Sakura Flower, Sleigh Bell, Top Hat, Record Player,
Winter Wreath, Snow Globe, Electric Skull, Tama Gadget, Candy Cane,
Neko Helmet, Jack-in-the-Box, Easter Egg, Bonded Ring, Pet Snake,
Snake Box, Xmas Stocking, Big Year, Holiday Drink, Gem Signet,
Light Sword, Restless Jar, Nail Bracelet, Heroic Helmet, Bow Tie,
Heart Locket, Lush Bouquet, Whip Cupcake, Joyful Bundle, Cupid Charm,
Valentine Box, Snoop Dogg, Swag Bag, Snoop Cigar, Low Rider,
Westside Sign, Stellar Rocket, Jolly Chimp, Moon Pendant, Ionic Dryer,
Input Key, Mighty Arm, Artisan Brick, Clover Pin, Sky Stilettos,
Fresh Socks, Happy Brownie, Ice Cream, Spring Basket, Instant Ramen,
Faith Amulet, Mousse Cake, Bling Binky, Money Pot, Pretty Posy,
Khabib's Papakha, UFC Strike, Victory Medal, Rare Bird, Mood Pack,
Pool Float, Timeless Book, Chill Flame, Vice Cream, Surge Board,
Liberty Figure, Durov's Glasses, Fine Pen, Intelligence Cup, Algorithm Cup
```

---

## ۳. جزئیات فنی ۱۶ کالکشن برتر (از API زنده)

| کالکشن | ID | مدل‌ها | بک‌دراپ‌ها | سیمبل‌ها | قابل ارتقا | حراج |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **Diamond Ring** | 5868503709637411929 | **100** | 60 | 296 | ✅ | ❌ |
| **Desk Calendar** | 5782988952268964995 | **157** | 60 | 255 | ✅ | ❌ |
| **Jingle Bells** | 6001473264306619020 | **151** | 60 | 138 | ✅ | ❌ |
| **Santa Hat** | 5983471780763796287 | **70** | 60 | 138 | ✅ | ❌ |
| **Liberty Figure** | 5999298447486747746 | **60** | 80 | 250 | ✅ | ❌ |
| **Durov's Cap** | 5915521180483191380 | **55** | 60 | 198 | ✅ | ❌ |
| **Fine Pen** | 5882129648002794519 | **55** | 80 | 225 | ✅ | ❌ |
| **Chill Flame** | 5999277561060787166 | **52** | 80 | 300 | ✅ | ❌ |
| **Timeless Book** | 5886387158889005864 | **52** | 80 | 220 | ✅ | ❌ |
| **Plush Pepe** | 5936013938331222567 | **50** | 60 | 280 | ✅ | ❌ |
| **Vice Cream** | 5898012527257715797 | **50** | 80 | 300 | ✅ | ❌ |
| **Eternal Rose** | 5882125812596999035 | **50** | 60 | 191 | ✅ | ❌ |
| **Surge Board** | 5832497899283415733 | **50** | 80 | 250 | ✅ | ❌ |
| **Durov's Glasses** | 5834651202612102354 | **50** | 80 | 150 | ✅ | ❌ |
| **Scared Cat** | 5837059369300132790 | **50** | 60 | 138 | ✅ | ❌ |
| **Signet Ring** | 5936085638515261992 | **50** | 60 | 198 | ✅ | ❌ |

---

## ۴. آناتومی ۴ محور ژنتیک (DNA) یک گیفت کلکسیونی

### ۴.۱. مدل‌ها (Models)
- هر کالکشن **۳ تا ۱۵۷ مدل** دارد
- درصد نایابی بر اساس **Permille (پرمیل = هزارم)** تعیین می‌شود
- مثال Plush Pepe: نایاب‌ترین‌ها (`rarityPermille: 10` = ۱٪):
  - Ninja Mike, Louis Vuittoad, Steel Frog, Gucci Leap, Raphael, Toading..., Leonardo, Donatello, Puppy Pug, Midas Pepe
- رایج‌ترین‌ها (`rarityPermille: 30` = ۳٪):
  - Gummy Frog, Spectrum, Cold Heart, Poison Dart, Hue Jester

### ۴.۲. بک‌دراپ‌ها (Backdrops) — ۸۰ عدد سراسری
هر بک‌دراپ دارای **۴ رنگ HEX** است:

| بک‌دراپ | Center | Edge | Pattern | Text | Permille |
|:---|:---|:---|:---|:---|:---:|
| Black | #363738 | #0E0F0F | #6C6868 | #8C8F91 | — |
| Electric Purple | #CA70C6 | #9662D4 | #620FB4 | #EBCEFF | — |
| Lavender | #B789E4 | #8A5ABC | #5B10AB | #E8D1FF | — |
| Cyberpunk | #858FF3 | #865FD3 | #4318A6 | #E0D9FF | — |
| Electric Indigo | #A980F3 | #5B62D8 | #3722AB | #D8D8FF | — |

**نکته مهم:** بک‌دراپ‌ها فایل ندارند — صرفاً تعریف رنگ/متریال هستند.

### ۴.۳. سیمبل‌ها/پترن‌ها (Symbols/Patterns)
- هر کالکشن **۱۳۸ تا ۳۰۰ پترن** دارد
- نایاب‌ترین‌ها مثل Plush Pepe: `rarityPermille: 2` (یعنی ۰.۲٪)
  - Gear, Tie, Cicada, Gem, Piggy Bank
- قابل دانلود به فرمت‌های: `.tgs` (استیکر), `.json` (Lottie), `.png` (تصویر)

### ۴.۴. شماره سریال (Serial Number)
- از #1 تا سقف تیراژ
- ضریب ارزش (Gravity Multiplier):
  - تک‌رقمی (#1-#9): 5.0x+
  - دورقمی (#10-#99): 2.0x-3.5x
  - پترن‌های خاص (#100, #777, #1000, #2222): 2.5x+
  - پالیندروم‌ها (#1221, #5445): 1.5x-2.0x

---

## ۵. ساختار فنی API تلگرام (MTProto + Bot API)

### ۵.۱. سازنده‌های کلیدی (Constructors)
```
starGift {
  id: long                    // شناسه یکتای گیفت
  sticker: Document           // استیکر اصلی
  stars: long                 // قیمت خرید به Stars
  availability_remains: int   // تعداد باقی‌مانده
  availability_total: int     // سقف تیراژ
  availability_resale: long   // تعداد در بازار ثانویه
  convert_stars: long         // مبلغ تبدیل به Stars
  upgrade_stars: long         // هزینه ارتقا فعلی
  resell_min_stars: long      // حداقل قیمت فروش مجدد
  title: string               // نام رسمی
  upgrade_variants: int       // تعداد ترکیبات ارتقا
  auction: bool               // آیا حراج است
  auction_slug: string        // لینک حراج
}

starGiftUnique {
  slug: string                // شناسه یکتای URL
  owner_address: string       // آدرس والت TON مالک
  gift_address: string        // آدرس قرارداد NFT
  attributes: [StarGiftAttribute]  // آرایه ویژگی‌ها
}

starGiftAttributeModel {
  name: string, rarity_permille: int, document: Document
}
starGiftAttributeBackdrop {
  name: string, rarity_permille: int, center_color: int, edge_color: int, pattern_color: int, text_color: int
}
starGiftAttributeOriginalDetails {
  sender_id: Peer, recipient_id: Peer, date: int, message: TextWithEntities
}
```

### ۵.۲. متدهای کلیدی API
| متد | کاربرد |
|:---|:---|
| `payments.getStarGifts` | دریافت لیست کامل گیفت‌های قابل خرید |
| `payments.getResaleStarGifts` | دریافت گیفت‌های در بازار ثانویه (ریسیل) |
| `payments.getStarGiftUpgradeAttributes` | دریافت ویژگی‌های ارتقا (مدل، بک‌دراپ، پترن) |
| `payments.getStarGiftUpgradePreview` | پیش‌نمایش ارتقا |
| `payments.upgradeStarGift` | ارتقای گیفت به NFT |
| `payments.craftStarGift` | کرافت (ترکیب ۱-۴ گیفت) |
| `payments.getCraftStarGifts` | دریافت گیفت‌های قابل کرافت |
| `payments.getStarGiftWithdrawalUrl` | URL خروج به والت TON |
| `payments.transferStarGift` | انتقال گیفت به کاربر دیگر |
| `payments.saveStarGift` | ذخیره/حذف از پروفایل |

---

## ۶. مکانیزم‌های اقتصادی

### ۶.۱. حراج هلندی ارتقا (Dutch Auction Upgrade)
- قیمت ارتقا از **۱,۰۰۰,۰۰۰ Stars** شروع شده و ساعتی کاهش می‌یابد
- کف نهایی: **۲۵ Stars**
- نمونه اخیر: `Durov's Glasses` → ارتقا از 30,000⭐️ با کف 990,685⭐️

### ۶.۲. کرافتینگ و سوزاندن (Crafting & Burning)
- معرفی شده: فوریه ۲۰۲۶
- ورودی: **۱ تا ۴ گیفت کلکسیونی هم‌نوع**
- خروجی: یک گیفت با رده نایابی بالاتر (احتمالی)
- **تمام ورودی‌ها سوزانده می‌شوند** (Burn)
- نتیجه قطعی نیست → لاتری ریسکی
- تأثیر: درصد نایابی هر ۳۰ دقیقه مجدداً محاسبه می‌شود

### ۶.۳. بازار ریسیل داخلی تلگرام
- `payments.getResaleStarGifts` → بازار داخلی رسمی تلگرام
- قابل فیلتر بر اساس attribute (مدل، بک‌دراپ، پترن)
- مرتب‌سازی: قیمت، شماره سریال، زمان لیست
- تعیین حداقل و حداکثر قیمت توسط تلگرام

---

## ۷. نقشه مارکت‌پلیس‌ها و ابزارها

### ۷.۱. مارکت‌پلیس‌های معاملاتی (Venues)
| پلتفرم | نوع | کارمزد | ارز | ویژگی خاص |
|:---|:---|:---|:---|:---|
| **Fragment** | رسمی On-Chain | ~۵٪ | TON | مارکت‌پلیس رسمی تلگرام |
| **Getgems** | مارکت TON NFT | ~۵٪ | TON | بزرگ‌ترین مارکت NFT در TON |
| **Portals** | Mini App P2P | ~۲-۳٪ | Stars/TON | سریع‌ترین و محبوب‌ترین |
| **MRKT** | Mini App | ~۲٪ | Stars/TON | کمترین کارمزد |
| **Tonnel** | Mini App P2P | ~۳٪ | TON | استخرهای نقدینگی |
| **Telegram Stars** | داخلی رسمی | ~۰٪ | Stars | بازار داخلی رسمی |

### ۷.۲. ابزارهای تحلیلی و ربات‌ها
| ابزار | نوع | کاربرد اصلی |
|:---|:---|:---|
| **api.changes.tg** | API رایگان | داده مدل‌ها، بک‌دراپ‌ها، پترن‌ها، ایموجی |
| **cdn.changes.tg** | CDN استاتیک | تصاویر PNG/TGS/Lottie مدل‌ها |
| **GiftAsset (giftasset.dev)** | API تجمیعی | قیمت لحظه‌ای، تاریخچه معاملات، فیلتر |
| **Gift Charts (@gift_charts_bot)** | ربات تلگرام | چارت قیمت، تاریخچه |
| **Gift Satellite** | ربات اسنایپر | آلرت قیمت، خرید خودکار |
| **Gift Explore (@giftexplorebot)** | ربات تلگرام | جستجوی قیمت و ارزش‌گذاری |
| **GiftIDX (@GiftIDX_Bot)** | ربات تحلیلی | پورتفولیو و واچ‌لیست |
| **Telegifts (telegifts.app)** | وب‌اپ | اکسپلورر NFT با کف قیمت لحظه‌ای |
| **See.tg** | وب‌اپ | لیدربورد ارتقا، جستجوی مالکان |
| **Giftstat** | داشبورد | آمار بازار و شاخص‌ها |

---

## ۸. بلاکچین TON و گیفت‌ها

### ۸.۱. استاندارد NFT (TEP-62 + TEP-64)
- **TEP-62:** استاندارد قرارداد هوشمند NFT در TON
  - هر کالکشن یک قرارداد «Collection» دارد
  - هر آیتم یک قرارداد «Item» مستقل
- **TEP-64:** استاندارد متادیتای توکن
  - شامل تصاویر، توضیحات و ویژگی‌های (Traits) گیفت

### ۸.۲. چرخه حیات گیفت روی بلاکچین
```
1. خرید گیفت با Stars → آیتم Off-Chain در تلگرام
2. ارتقا (Upgrade) → NFT On-Chain در TON (TEP-62)
3. نمایش در پروفایل / لیست برای فروش
4. معامله در بازار داخلی یا خارجی
5. خروج (Withdraw) → انتقال به والت شخصی TON
6. کرافت (Craft) → سوزاندن ورودی‌ها + تولید آیتم جدید
```

### ۸.۳. ردیابی تاریخچه مالکیت (Provenance)
- **On-Chain:** تمام تراکنش‌های والت‌ها در TON Explorers قابل مشاهده:
  - [tonviewer.com](https://tonviewer.com)
  - [tonscan.org](https://tonscan.org)
- **Off-Chain:** اطلاعات فرستنده/گیرنده اولیه از `starGiftAttributeOriginalDetails`
- **نکته:** آدرس والت نمایش داده می‌شود نه یوزرنیم تلگرام

---

## ۹. منابع داده api.changes.tg (SKILL.md رسمی)

### اندپوینت‌های اصلی
| اندپوینت | توضیح |
|:---|:---|
| `GET /gifts` | لیست نام تمام گیفت‌های قابل ارتقا |
| `GET /gift/:gift` | جزئیات کامل یک گیفت (مدل‌ها، بک‌دراپ‌ها، سیمبل‌ها) |
| `GET /total` | آمار کل (گیفت‌ها، مدل‌ها، بک‌دراپ‌ها، پترن‌ها) |
| `GET /models/:gift?sorted` | مدل‌ها مرتب بر اساس نایابی |
| `GET /backdrops/:gift?sorted` | بک‌دراپ‌ها مرتب بر اساس نایابی |
| `GET /symbols/:gift?sorted` | سیمبل‌ها مرتب بر اساس نایابی |
| `GET /model/:gift/:model.png?size=512` | تصویر مدل (64/128/256/512/1024) |
| `GET /emoji/:gift` | ایموجی‌های سفارشی مدل‌ها |
| `GET /dates` | تاریخ انتشار و فعال‌سازی ارتقا |
| `GET /ids` | مپینگ شناسه ↔ نام |
| `GET /health` | وضعیت سرور و آخرین بروزرسانی |

### فرمت‌های نام ورودی
- `Scared Cat`, `scared cat`, `ScaredCat`, `scared-cat`, `scared_cat`, `5837059369300132790`

### قانون Attribution (اجباری)
> هر اپلیکیشنی که از `api.changes.tg` یا `cdn.changes.tg` استفاده کند **باید** یک خط تشکر `Thanks to @GiftChanges` در جای قابل مشاهده کاربر داشته باشد.

---

## ۱۰. کف قیمت تخمینی کالکشن‌های برتر

| کالکشن | کف تخمینی (TON) | رده بازار |
|:---|:---:|:---|
| **Plush Pepe** | ~5,000-5,800+ | بلوچیپ شماره ۱ |
| **Durov's Cap** | ~400-480+ | نماد جامعه تلگرام |
| **Diamond Ring** | ~150-220 | لوکس با نقدینگی بالا |
| **Durov's Glasses** | ~80-150 | جدید و پرحجم |
| **Magic Potion** | ~45-80 | کالکشن فصلی محبوب |
| **Eternal Rose** | ~25-35 | نقدشونده‌ترین |
| **Santa Hat** | ~15-30 | فصلی |

> ⚠️ قیمت‌ها نوسانی هستند و مقادیر بالا تخمینی‌اند.

---

## ۱۱. نکات طراحی و پیاده‌سازی برای iFragment

### نقاط ضعف رقبا (فرصت‌های iFragment)
1. **See.tg:** فاقد ارزش‌گذاری AVM و نقشه حرارتی
2. **Portals/MRKT:** صرفاً تابلوی خرید/فروش، بدون تحلیل
3. **Gift Charts:** فقط چارت قیمت در بات تلگرام، بدون وب‌اپ
4. **Gift Satellite:** واسط متنی، بدون UI مدرن
5. **GiftAsset:** صرفاً API خام برای برنامه‌نویسان

### مزیت‌های رقابتی iFragment
1. ✅ **نقشه حرارتی ماتریسی** (هیچ رقیبی ندارد)
2. ✅ **موتور ارزش‌گذاری AVM اختصاصی** (فرمول ریاضی)
3. ✅ **شجره‌نامه مالکیت** (Provenance Timeline)
4. ✅ **مقایسه خالص دریافتی ۶ مارکت** (Exit Planner)
5. ✅ **کارت سرتیفیکیت ۳D لوکس** برای استوری تلگرام
6. ✅ **برندینگ قوی @iFragmentBot**

---

## ۱۲. 🗺️ نقشه جامع منابع داده (از کجا چه چیزی بگیریم؟)

### ۱۲.۱. لایه ۱ — API رسمی تلگرام (MTProto / Bot API)

> این منابع **اصلی‌ترین** و **معتبرترین** داده‌ها هستند.

| چه داده‌ای | متد MTProto | متد Bot API | نوع داده |
|:---|:---|:---|:---|
| لیست تمام گیفت‌های قابل خرید | `payments.getStarGifts` | `getAvailableGifts` | کاتالوگ |
| بررسی امکان ارسال | `payments.checkCanSendGift` | — | اعتبارسنجی |
| لیست گیفت‌های بازار ثانویه | `payments.getResaleStarGifts` | — | مارکت |
| ویژگی‌های ارتقا (مدل/بک‌دراپ/پترن) | `payments.getStarGiftUpgradeAttributes` | — | متادیتا |
| پیش‌نمایش ارتقا | `payments.getStarGiftUpgradePreview` | — | UX |
| ارتقای واقعی | `payments.upgradeStarGift` | `upgradeGift` | عملیات |
| کرافت گیفت‌ها | `payments.craftStarGift` | — | عملیات |
| لیست قابل کرافت | `payments.getCraftStarGifts` | — | فیلتر |
| **ارزش‌گذاری رسمی** | `payments.getUniqueStarGiftValueInfo` | — | **ارزش‌گذاری** |
| جزئیات گیفت یکتا | `payments.getUniqueStarGift` | — | متادیتا |
| URL خروج به والت TON | `payments.getStarGiftWithdrawalUrl` | — | عملیات |
| انتقال به کاربر دیگر | `payments.transferStarGift` | `transferGift` | عملیات |
| ذخیره/حذف از پروفایل | `payments.saveStarGift` | — | عملیات |
| ارسال گیفت | inputInvoiceStarGift → `payments.getPaymentForm` | `sendGift` | عملیات |
| تبدیل به Stars | — | `convertGiftToStars` | عملیات |
| تنظیمات گیفت بیزنس | — | `setBusinessAccountGiftSettings` | تنظیمات |
| گیفت‌های اکانت بیزنس | — | `getBusinessAccountGifts` | کوئری |

#### 🔥 نکته طلایی: `payments.getUniqueStarGiftValueInfo`
```
ورودی: slug (شناسه یکتای گیفت)
خروجی: {
  floor_price,        // کف قیمت فعلی
  average_price,      // میانگین قیمت
  listed_count,       // تعداد لیست‌شده
  initial_sale_price, // قیمت فروش اولیه
  last_sale_price,    // آخرین قیمت فروش
  last_sale_date      // تاریخ آخرین فروش
}
```

---

## ۱۳. 💰 اقتصاد Telegram Stars (XTR)

### ۱۳.۱. نرخ تبدیل
- **Stars ← USD:** Stars به دلار آمریکا "peg" (ثابت‌شده) هستند
- **Stars ↔ TON:** نرخ **شناور** — بر اساس قیمت لحظه‌ای TON/USD
- **تخمین فعلی:** ~350-500 Stars ≈ 1 TON (بسته به قیمت TON)

### ۱۳.۲. قوانین تبدیل
| قانون | جزئیات |
|:---|:---|
| حداقل موجودی برای برداشت | ۱,۰۰۰ Stars |
| دوره نگهداری | ۲۱ روز پس از دریافت |
| پلتفرم برداشت | Fragment.com |
| کارمزد | ~۵٪ سرویس + gas fee |
| قابلیت برداشت Stars خریداری‌شده | ❌ فقط Stars دریافتی (earned) |

---

## ۱۴. ⚒️ مکانیزم کرافتینگ — جزئیات فنی

### ۱۴.۱. قوانین کرافت
| قانون | توضیح |
|:---|:---|
| ورودی | ۱ تا ۴ گیفت کلکسیونی |
| الزام هم‌نوع | همه باید `gift_id` یکسان داشته باشند |
| اولین گیفت | نباید روی بلاکچین باشد (off-chain) |
| محدودیت زمانی | `can_craft_at` — ممکن تایمر داشته باشد |
| خروجی موفق | یک گیفت جدید با رده نایابی بالاتر |
| خروجی ناموفق | `updateStarGiftCraftFail` — همه سوزانده می‌شوند |
| ID خروجی | ID اولین گیفت مجدداً استفاده می‌شود |

### ۱۴.۲. احتمالات (Permille Configuration)
```
stargifts_craft_attribute_permilles = [
  [permille_1_gift],    // احتمال carry-over با ۱ گیفت
  [permille_2_gifts],   // احتمال carry-over با ۲ گیفت
  [permille_3_gifts],   // احتمال carry-over با ۳ گیفت
  [permille_4_gifts],   // احتمال carry-over با ۴ گیفت
]
```

---

## ۱۵. 📊 مکانیزم حراج هلندی ارتقا — جزئیات کامل

### ۱۵.۱. نحوه کار
```
قیمت شروع: ~25,000 Stars (یا بالاتر)
          ↓ (هر ساعت کاهش)
          ↓ ...
          ↓ 
کف نهایی: ~25 Stars
```

### ۱۵.۲. فیلدهای API مرتبط
```
starGift.upgrade_stars     // هزینه ارتقای فعلی (لحظه‌ای)
starGift.convert_stars     // مبلغ تبدیل به Stars
starGift.resell_min_stars  // حداقل قیمت فروش مجدد
starGift.locked_until_date // تاریخ قفل (حراج/محدودیت)
```

---

## ۱۶. 🔍 ردیابی Provenance (شجره‌نامه مالکیت)

### ۱۶.۱. داده‌های Off-Chain (از تلگرام)
```
starGiftAttributeOriginalDetails {
  sender_id: Peer      // فرستنده اولیه
  recipient_id: Peer   // گیرنده اولیه
  date: int            // تاریخ ارسال (Unix timestamp)
  message: TextWithEntities  // پیام همراه
}
```

### ۱۶.۲. ساختن Timeline کامل
```
1. originalDetails → فرستنده/گیرنده اولیه (Off-chain)
2. upgrade → تاریخ ارتقا به NFT
3. TonAPI history → زنجیره انتقال‌های On-chain
4. marketplace sales → فروش‌ها از GiftAsset API
5. current owner → از starGiftUnique.owner_address
```

---

## ۱۷. 📈 تحلیل On-Chain با Dune Analytics

### ۱۷.۱. داشبوردهای کلیدی
| داشبورد | لینک | محتوا |
|:---|:---|:---|
| TON GIFTS - THE ECONOMY | `dune.com/queries/4808386` | حجم معاملات + آمار کاربران |
| Off-chain & On-chain stats | `dune.com/queries/4768393` | تخمین حجم Off-chain |
| Telegram Gifts | `dune.com/queries/4826135` | عملکرد مارکت‌پلیس‌ها |

---

## ۱۸. 🤖 متدهای Bot API تلگرام (HTTP Bot API)

```
Bot.getAvailableGifts()              → لیست گیفت‌های قابل ارسال
Bot.sendGift(user_id, gift_id, ...) → ارسال گیفت
Bot.upgradeGift(...)                 → ارتقای گیفت (نیاز به business rights)
Bot.convertGiftToStars(...)          → تبدیل به Stars
Bot.transferGift(...)                → انتقال گیفت
Bot.getBusinessAccountGifts(...)     → گیفت‌های اکانت بیزنس
```

---

## ۱۹. 🏗️ الگوهای پیاده‌سازی عملی برای iFragment

### ۱۹.۱. استراتژی Aggregation
```
┌─────────────────────────────────┐
│        iFragment Backend        │
│         (Go Service)            │
├─────────────────────────────────┤
│  Primary Sources (real-time):   │
│  ├─ api.changes.tg (free)      │  ← مدل‌ها، بک‌دراپ‌ها، پترن‌ها
│  ├─ Telegram MTProto           │  ← ارزش‌گذاری رسمی، بازار داخلی
│  └─ TonAPI                     │  ← ownership on-chain
│                                 │
│  Secondary Sources:             │
│  ├─ api.giftasset.dev          │  ← کف قیمت ۶ مارکت، شاخص‌ها
│  └─ Dune Analytics             │  ← حجم کلان (batch)
│                                 │
│  Cache Layer (DragonflyDB):     │
│  ├─ Floor prices: TTL 30s      │
│  ├─ Collection meta: TTL 30m   │
│  └─ Models/Backdrops: TTL 6h   │
└─────────────────────────────────┘
```

---

## ۲۰. 🗂️ نقشه اکوسیستم GitHub

| کتابخانه | مارکت | توسعه‌دهنده | نصب | احراز هویت |
|:---|:---|:---|:---|:---|
| **aportalsmp** | Portals | bleach-hub | `pip install aportalsmp` | `tma` token از Mini App |
| **tonnelmp** | Tonnel | bleach-hub | `pip install tonnelmp` | `web-initData` از DevTools |
| **amrkt** | MRKT | TheBrainAir | `pip install amrkt` | `api_id` + `api_hash` |
| **fragment-api-py** | Fragment | — | `pip install fragment-api-py` | Cookie/Wallet |

---

## ۲۱. 🔬 تحلیل عمیق: morgan-gift-plugins

10,200+ خط کد → 9 پلاگین → 50+ ابزار → ۶ مارکت‌پلیس (Whale Tracking, Bollinger Bands, Spread Scanner).

---

## ۲۲. 📐 فرمول محاسبه Rarity Score

$$RarityScore = \sum \frac{1}{\text{Frequency}}$$

---

## ۲۳. 🏢 GetGems Public API (REST)

- **Base URL:** `https://api.getgems.io/public-api/v1`
- **اندپوینت‌ها:** `/nfts/on-sale/{addr}`, `/nfts/floor-price/{addr}`, `/nfts/history/{addr}`

---

## ۲۴. 🆚 تحلیل رقابتی پلتفرم‌های ردیابی گیفت

| پلتفرم | نوع | ویژگی‌های متمایز | منبع داده |
|:---|:---|:---|:---|
| **Telegifts** | iOS/Android + TMA | AI Assistant "Gifti" | GiftAsset |
| **GiftStat** | Web Dashboard | Bollinger Bands | On-chain |
| **GiftAsset** | B2B API | 18+ endpoint | 6+ marketplace |
| **iFragment** | Telegram Mini App | **ماتریس کامل AVM + Provenance + ۷ مارکت** | **همه منابع** |

---

## ۲۵. 💡 ماتریس الهام‌بخش iFragment
- **Whale Tracking:** ردیابی برترین والت‌ها در صفحه گیفت تکی
- **Cross-Market Venues:** جدول مقایسه ۷ مارکت با خالص دریافتی
- **Interactive Heatmap:** ماتریس نایابی مدل × رنگ پس‌زمینه

---

## ۲۶. 🔌 نقشه API Giftstat
- Collections list, Collection floor, Floor Index with Bollinger Bands

---

## ۲۷. 📋 خلاصه اطلاعات MarketApp.ws
- Browse collections + floor + volume + listing stats

---

## ۲۸. 📱 ویژگی‌های Telegifts.app
- Market Analytics, Portfolio Tracking, Smart Discovery, Price Alerts

---

## ۲۹. 🔑 کشفیات کلیدی
- ۷ مارکت‌پلیس: GetGems, Fragment, MarketApp, Portals, Tonnel, MRKT, Internal Telegram.

---

## ۳۰. 🏛️ معماری فنی قراردادهای هوشمند TON TEP-62 و TEP-64

### ۳۰.۱. ساختار قراردادهای کالکشن و آیتم
- **NFT Collection Contract:** مدیریت کل کالکشن، اندیس‌ها و متادیتا.
- **NFT Item Contract:** قرارداد مستقل هر هدیه با `owner_address`.

### ۳۰.۲. توابع Get-Method
- `get_nft_data()`: استخراج شناسه، آدرس کالکشن، مالک و محتوا.
- `get_collection_data()`: داده‌های کالکشن و تعداد کل.
- `get_nft_address_by_index(index)`: محاسبه آدرس قرارداد هدیه با شماره سریال.

### ۳۰.۳. اپ‌کدهای تراکنش‌ها
```
0x5fcc3d14  // op::transfer
0x05138d91  // op::ownership_assigned
0x6f89f5e3  // op::burn
```

---

## ۳۱. 🧮 فرمولاسیون ریاضی و مدل‌های ارزش‌گذاری خودکار (AVM Engine)

$$V = F_{base} \times M_{trait} \times G_{serial} \times L_{liquidity} \times S_{sentiment}$$

$$Spread_{net} = \frac{(Price_{max} \times (1 - Fee_{max})) - (Price_{min} \times (1 + Fee_{min}))}{Price_{min} \times (1 + Fee_{min})} \times 100$$

---

## ۳۲. 🛡️ ممیزی امنیتی و مقابله با کلاهبرداری
- بررسی آدرس Master Collection جهت جلوگیری از توکن‌های جعلی
- اعتبارسنجی HMAC در `initData`
- شناسایی معاملات صوری (Wash Trading) و قفل ۲۱ روزه نقل‌وانتقال

---

## ۳۳. 🌟 سازوکار نمایش در پروفایل، استاتوس ایموجی و امکانات تلگرام
- پین کردن سه‌بعدی در تب بالای پروفایل
- استفاده از ایموجی‌های سفارشی (`custom_emoji_id`) در استاتوس پروفایل پرمیوم

---

## ۳۴. 🏆 لیست برترین مدل‌های Mythic و رکوردهای قیمتی
- مدل‌های ۱.۰٪ پرمیل در Plush Pepe, Durov's Cap, Diamond Ring, Desk Calendar
- رکورد فروش ۱۵,۰۰۰ TON برای Plush Pepe #1

---

## ۳۵. 📑 مرجع کدهای خطا در API استار گیفت تلگرام
| کد خطا | توضیح خطا | راهکار در بک‌اند |
|:---|:---|:---|
| `STARGIFT_USAGE_LIMITED` | تیراژ محدود تمام شده | Sold Out |
| `GIFT_ALREADY_UPGRADED` | قبلاً به NFT ارتقا یافته | ریدایرکت به آدرس On-Chain |
| `STAR_GIFT_NOT_FOUND` | شناسه نامعتبر | بررسی در کاتالوگ |
| `STARGIFT_CRAFT_LOCKED` | کرافت موقتاً قفل است | نمایش تایمر |
| `STARS_TRANSFER_FAILED` | موجودی Stars ناکافی | راهنمایی خرید Stars |
| `UPGRADE_AUCTION_ACTIVE` | حراج هلندی ارتقا فعال است | پله فعلی از `upgrade_stars` |
