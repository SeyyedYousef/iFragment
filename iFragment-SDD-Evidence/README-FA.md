# بسته ممیزی و SDD پروژه iFragment

این بسته فقط سه vertical زیر را پوشش می‌دهد: Telegram collectible usernames، Fragment anonymous numbers و Telegram collectible gifts. در هر vertical، سطح Collection و Single Item جداگانه بررسی شده است.

## ترتیب استفاده

1. فایل `iFragment-SDD-FA.md` قرارداد اصلی پیاده‌سازی است.
2. فایل‌های 01 تا 04 شواهد ممیزی سورس با ارجاع file:line هستند.
3. فایل 05 مبانی رسمی Telegram، Fragment و TON و محدودیت APIهاست.
4. فایل 06 benchmark پروژه‌های GitHub و محصولات مشابه است.

## نتیجه release

تا بسته‌شدن همه الزام‌های `RB-P0-*`، محصول نباید داده synthetic را با برچسب live/verified بفروشد یا به‌عنوان market intelligence عمومی منتشر کند. fixture نمایشی باید از جداول و endpointهای production کاملاً جدا باشد.

## محدودیت بررسی

تمام ۱۰۸۱ فایل پروژه استخراج و مسیرهای مرتبط بررسی شدند. اجرای Go tests و frontend test/build در محیط بررسی ممکن نبود، چون toolchain و dependencyهای پروژه در محیط موجود نبودند؛ بنابراین موفقیت build یا test ادعا نشده است. تاریخ تحقیق منابع وب: 2026-09-16.
