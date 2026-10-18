# Privacy Policy & Data Processing Agreement (DPA)

**Last Updated: October 2026**

Welcome to **iFragment**. We are committed to protecting your privacy and ensuring compliance with the General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA), and global data protection standards across our Telegram Mini App (TMA), Telegram Bot (Private Chat & Inline Mode), and community integrations.

---

## 1. General Principles & Scope of Services
As a GDPR-compliant processor and controller, we process minimal user data strictly to deliver institutional analytics across all three Telegram collectible verticals on the TON Blockchain:
1. **Telegram Usernames (`AVM Engine v7.0`)**: Valuation reports, TeleMint provenance verification, auction playbooks, and username watchlist alerts.
2. **Collectible Anonymous Numbers (`+888` — `NV Engine v5.2`)**: Pattern club analytics, live listing arbitrage detection, portfolio scanning, and bid/sale watchlist notifications.
3. **Telegram Gifts (`GV Engine v6.0`)**: Multi-marketplace floor aggregation (`Fragment`, `Getgems`, `MarketApp`, `Portals`, `MRKT`, `Tonnel`), trait rarity ranking, crafting EV simulations, and gift watchlist alerts.
4. **Intel Credits (`⚡`), Telegram Stars (`XTR`) & `@FragmentInvestors` Community**: Processing native Telegram Stars (`XTR`) payments (`telegram_payment_charge_id`), FIFO credit batches, and rewarding Paid-Star group messages and `chat_boost` events in `@FragmentInvestors`.

---

## 2. Your Rights Under GDPR
Under the General Data Protection Regulation, you have the following rights:
1. **Right of Access (Article 15)**: Request details of the personal data we hold about you.
2. **Right to Rectification (Article 16)**: Request updates or corrections to your profile preferences (such as language code).
3. **Right to Erasure / "Right to be Forgotten" (Article 17)**: Request physical deletion of all your data from our active databases and caches.
4. **Right to Restriction of Processing (Article 18)** & **Right to Data Portability (Article 20)**.

---

## 3. Physical Data Deletion (GDPR "Right to be Forgotten")
To guarantee absolute compliance with **GDPR Article 17**, we provide an automated physical data deletion mechanism:

* **Endpoint**: `DELETE /api/v1/profile/gdpr`
* **Action**: Triggers an immediate **physical deletion** cascade (`ON DELETE CASCADE`) at the PostgreSQL database level and evicts all associated DragonflyDB cache keys.
* **Scope of Deletion**:
  * Your primary user record in `users` is permanently destroyed.
  * All valuation unlock history, watchlist subscriptions (Usernames, `+888` Numbers, Gifts), Intel Credit batches/ledgers, Stars order records, and `@FragmentInvestors` leaderboard stats are physically erased.
  * All active caches inside DragonflyDB/Redis are immediately evicted.

---

## 4. Security Standards & Data Protection
- **Cryptographic Authentication**: Every Mini App request is verified via HMAC-SHA256 using Telegram `initData`, and every bot webhook is validated via constant-time `X-Telegram-Bot-Api-Secret-Token` comparison.
- **PII Log Masking**: Automated structured log masking (`internal/logger/mask.go`) prevents Telegram User IDs, phone numbers, tokens, and IP addresses from leaking into stdout or tracing telemetry.
- **Zero Third-Party Data Selling**: We never sell, rent, or trade user data with third parties.

---

## 5. Contact & Support
For any questions regarding this Privacy Policy or your data protection rights, contact our Data Protection Officer (DPO) at `dpo@ifragment.app`.
