# Telegram / TON collectibles: research for analytics & valuation

**Scope.** Telegram collectible usernames, Fragment anonymous numbers, and collectible gifts; TON contracts/indexers; Fragment/Telegram integration; data and valuation implications.

**Research cut-off / access date:** 2026-09-16 UTC. Sources are official Telegram, Fragment, TON/TON Center/TonAPI, TON TEPs, and Getgems contract source/docs unless explicitly marked as an inference. A citation with this date means the page was checked on 2026-09-16; publication dates are included where the source supplies one.

## 1. Executive conclusions for the product

1. **There is no single “owner” field.** For a TON NFT, the canonical owner is the current TON wallet/owner address. Telegram adds a separate *assignment/hosting/utility* state: a collectible username may be assigned to an account, bot, supergroup or channel; a blockchain gift may be hosted on a profile while ownership stays in the TON wallet. A product must store both states and never substitute profile host/assignment for on-chain ownership. Telegram documents username association and active/inactive flags in the MTProto API, and documents `host_id` versus `owner_address` for gifts. ([Telegram Fragment API](https://core.telegram.org/api/fragment), accessed 2026-09-16; [Telegram Gifts](https://core.telegram.org/api/gifts), accessed 2026-09-16.)
2. **The three verticals are not one market.** Usernames and anonymous numbers are Fragment/TON assets whose utility is Telegram-native; gifts have at least two markets: in-app Stars resale/offers and TON-NFT transfer/marketplaces after withdrawal. Prices, settlement currency, fees, and identifiers differ. ([Fragment About](https://fragment.com/about), accessed 2026-09-16; [Telegram Gift Marketplace, 2025-05-08](https://telegram.org/blog/gift-marketplace-and-more), accessed 2026-09-16; [Telegram Gifts](https://core.telegram.org/api/gifts), accessed 2026-09-16.)
3. **Use the blockchain as the settlement/provenance source, but not as the only utility source.** TON transactions, ownership, code/data, metadata, and contract state are verifiable on-chain. Telegram assignment, active username state, in-app gift host/profile, Stars listing/offer state, and Fragment UI state are off-chain or API-session state. This implies a dual-ledger model and explicit confidence/freshness fields. ([TON address information API](https://docs.ton.org/api/v2/accounts/get-address-information), accessed 2026-09-16; [Telegram Fragment API](https://core.telegram.org/api/fragment), accessed 2026-09-16; [Telegram Gifts](https://core.telegram.org/api/gifts), accessed 2026-09-16.)
4. **A “sale” cannot be inferred from every NFT transfer.** TEP-62 intentionally permits free transfer and does not require royalties; TEP-66 says royalty payment is a marketplace convention and cannot be enforced for every sale. A valuation dataset must distinguish protocol transfer, marketplace sale, auction settlement, offer settlement, and inferred sale. ([TEP-62 NFT Standard](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md), accessed 2026-09-16; [TEP-66 NFTRoyalty](https://github.com/ton-blockchain/TEPs/blob/master/text/0066-nft-royalty-standard.md), accessed 2026-09-16.)
5. **Fragment has no public, documented bulk marketplace API in the official sources reviewed.** Telegram exposes session-authenticated MTProto methods for collectible info and gift markets, but Fragment’s public About/Terms pages are product documentation rather than a bulk API contract. A production analytics product should not depend on reverse-engineered Fragment endpoints without a written permission/contract; it should reconstruct finalized events from TON and use Telegram APIs for utility state. This is a documented limitation of the reviewed source set, not proof that no private/partner API exists. ([Telegram available methods](https://core.telegram.org/methods), accessed 2026-09-16; [fragment.getCollectibleInfo](https://core.telegram.org/method/fragment.getCollectibleInfo), accessed 2026-09-16; [Fragment Terms](https://fragment.com/terms), accessed 2026-09-16.)

## 2. Canonical domain model

### 2.1 Asset identity

| Vertical | Stable product key | External identifiers to retain | Utility identifier |
|---|---|---|---|
| Collectible username | `username_normalized` plus `chain_id`/`nft_address` when known | case-normalized handle without `@`; TON item/collection address; Fragment URL/slug; mint/transfer tx hash and LT | Telegram account/bot/channel/supergroup association; `active`; order in `usernames` vector |
| Anonymous number | normalized E.164-like `+888…` plus `chain_id`/`nft_address` | exact phone string; Fragment URL; TON item/collection address; tx hash/LT | whether currently usable through Telegram signup/login; login-code availability is a Telegram/Fragment function, not a chain field |
| Collectible gift | `(gift_id, num)` and, after export, TON `gift_address` | unique gift slug (`t.me/nft` link), `gift_id`, serial `num`, attributes, owner/host, `gift_address`, collection/item address, tx hash/LT | Telegram profile/channel host, wear/status, in-app resale/offer state, Stars value |

The username/phone input types are explicitly `inputCollectibleUsername{username}` and `inputCollectiblePhone{phone}`; `fragment.getCollectibleInfo` returns purchase date, fiat/currency amount, crypto currency/amount and URL, subject to visibility. ([Telegram Fragment API](https://core.telegram.org/api/fragment), accessed 2026-09-16; [fragment.getCollectibleInfo](https://core.telegram.org/method/fragment.getCollectibleInfo), accessed 2026-09-16.)

A unique gift has an explicit `gift_id`, `slug`, serial `num`, optional `owner_id`, `owner_address`, attributes, optional `gift_address`, resale amounts and optional hosted-profile `host_id`; value information contains last sale, floor, average, listed count and Fragment-listed count when available. ([StarGift](https://core.telegram.org/type/StarGift), accessed 2026-09-16; [UniqueStarGiftValueInfo](https://core.telegram.org/type/payments.UniqueStarGiftValueInfo), accessed 2026-09-16.)

### 2.2 Ownership/utility state

Store at least:

- `chain_owner_address`, raw and user-friendly forms, workchain, chain/network, account state, last observed LT/seqno, and source timestamp.
- `telegram_binding_type`: `none`, `account`, `bot`, `channel`, `supergroup`, `gift_host`; `telegram_binding_id` only where authorized/visible.
- `telegram_binding_active`, `telegram_binding_observed_at`, and `binding_source`.
- `listing_venue`: `fragment`, `telegram_stars_market`, `third_party_ton_market`, `unknown`; listing status and observed time.
- `sale_type`: `primary_auction`, `secondary_auction`, `fixed_price`, `offer`, `direct_transfer`, `gift_resale`, `unknown`; do not backfill `sale` merely because value moved.
- `source_confidence`: `chain_finalized`, `chain_confirmed`, `indexer_derived`, `telegram_session`, `marketplace_observed`, `heuristic`.

## 3. Vertical A — collectible usernames

### 3.1 Ownership and Telegram utility

Telegram states that collectible-username ownership is secured by TON and that usernames can be bought/sold through Fragment. A purchased username can be associated or dissociated with the buyer’s Telegram account, a bot, channel or supergroup. Collectible usernames behave like basic usernames in global search, mentions and `t.me` deep links. ([Telegram Fragment API](https://core.telegram.org/api/fragment), accessed 2026-09-16.)

When at least one collectible username is associated, Telegram does not place it in the basic `user.username`/`channel.username` field; it uses a `usernames` vector. `editable` distinguishes a basic username from collectible, `active` indicates visibility/use, and the first vector element is shown as the main username. Immediately after association the collectible is inactive and must be toggled active through `account.toggleUsername`, `bots.toggleUsername` or `channels.toggleUsername`. `account.reorderUsernames`/`bots.reorderUsernames`/`channels.reorderUsernames` control order; `channels.deactivateAllUsernames` bulk-deactivates collectible usernames. ([Telegram Fragment API](https://core.telegram.org/api/fragment), accessed 2026-09-16.)

**Spec consequence:** “NFT owner has utility” is false unless the product has separately observed Telegram assignment and active state. A wallet may own the item while it is unassigned, inactive, assigned to a different entity, or associated with a deleted/restricted Telegram account. Fragment’s Terms warn that account deletion/restriction may make a username or number impossible to link to Telegram even though the blockchain collectible is not revoked. ([Fragment Terms](https://fragment.com/terms), accessed 2026-09-16.)

### 3.2 Primary auction / conversion

Fragment’s official About page describes direct sales and open auctions. A basic username can be auctioned, which permanently converts it into a collectible; the original basic-username owner receives proceeds minus applicable fees. A seller can set a minimum bid and optional maximum price; if the maximum is paid, the auction ends immediately. Fragment says a 5% platform fee applies to collectible transactions, blockchain fees are additional, and the initial conversion auction has a one-time 5-Gram conversion fee deducted from proceeds. ([Fragment About](https://fragment.com/about), accessed 2026-09-16.)

Fragment says bids are considered according to inclusion on the blockchain; if outbid, funds are automatically returned, and a bid not recorded before auction close is not counted and is refunded. Transaction finality is therefore not the same as UI submission time. ([Fragment About](https://fragment.com/about), accessed 2026-09-16.)

**Do not assert a soft-close extension without a current official rule.** The reviewed official About page specifies an optional maximum price and blockchain-recording rule, but does not establish a last-minute extension algorithm. Model auction timestamps and close rules from observed Fragment/contract data, and retain an `auction_rules_version` field.

### 3.3 Secondary transfer/sale

After purchase, the owner can assign it on Telegram, sell it or start a new auction without a conversion fee; a TON wallet transfer can occur outside Telegram/Fragment. ([Fragment About](https://fragment.com/about), accessed 2026-09-16.) TEP-62 explains why TON’s base NFT standard does not prohibit free transfers: enforcing royalties would require restricting all transfers to auctions or charging all transfers, which was rejected for usability. ([TEP-62 NFT Standard](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md), accessed 2026-09-16.)

### 3.4 Data available through Telegram APIs

`fragment.getCollectibleInfo` accepts a username and returns `purchase_date`, `currency`, `amount`, `crypto_currency`, `crypto_amount`, and URL. Telegram says the collectible must be visible to the current user (for example, owned by the user, enabled on an account, or visible under phone privacy settings); it is not an unrestricted public historical API. Errors include `COLLECTIBLE_INVALID` and `COLLECTIBLE_NOT_FOUND`. ([fragment.getCollectibleInfo](https://core.telegram.org/method/fragment.getCollectibleInfo), accessed 2026-09-16; [fragment.CollectibleInfo](https://core.telegram.org/type/fragment.CollectibleInfo), accessed 2026-09-16.)

## 4. Vertical B — anonymous numbers

### 4.1 Utility and ownership

Telegram introduced blockchain-powered anonymous numbers so users can sign up without a SIM; the announcement says login codes are received through Fragment rather than SMS. ([Telegram, “No-SIM Signup,” 2022-12-06](https://telegram.org/blog/ultimate-privacy-topics-2-0), accessed 2026-09-16.) Telegram’s Fragment API says Fragment collectible phone numbers can only be used to create Telegram accounts through the usual sign-up/login flow. ([Telegram Fragment API](https://core.telegram.org/api/fragment), accessed 2026-09-16.) Telegram client configuration exposes `fragment_prefixes`, the list of prefixes used for anonymous Fragment phone numbers. ([Telegram client configuration](https://core.telegram.org/api/config), accessed 2026-09-16.)

Fragment’s About page describes a limited run of virtual phone numbers in late 2022, says the numbers can be added/removed from Telegram, and says the login code is retrieved from Fragment. The same page says the owner may list the number for auction or sale on Fragment. ([Fragment About](https://fragment.com/about), accessed 2026-09-16.) The two statements should be implemented as separate states: `wallet_owns_number`, `telegram_login_binding`, and `login_code_available`; do not infer one from the other.

### 4.2 Marketplace and privacy

Fragment describes purchases and auctions as non-custodial and anonymous; the wallet holding the collectible controls it, and Fragment says it cannot restore a lost wallet because it never holds private credentials. Fragment’s Terms state that purchased collectibles are linked to the new owner’s TON wallet, stored in the immutable TON ledger, and generally non-refundable; loss or deletion of a Telegram account may impair ecosystem utility without revoking the collectible. ([Fragment About](https://fragment.com/about), accessed 2026-09-16; [Fragment Terms](https://fragment.com/terms), accessed 2026-09-16.)

**Analytics caveat:** A number’s owner wallet is public on TON, but Telegram identity, login codes, and whether a number is currently attached to an account are privacy/session data. Store no inferred real-world identity. Do not expose phone-number-to-wallet joins without a lawful, user-authorized reason.

### 4.3 Data/API gap

Telegram’s MTProto API has `inputCollectiblePhone` and `fragment.getCollectibleInfo`, but the method is visibility-limited and only returns purchase information. The reviewed official sources do not specify a public, unauthenticated bulk endpoint for all numbers, order books, bids, or historical listings. ([Telegram Fragment API](https://core.telegram.org/api/fragment), accessed 2026-09-16; [fragment.getCollectibleInfo](https://core.telegram.org/method/fragment.getCollectibleInfo), accessed 2026-09-16.)

## 5. Vertical C — collectible gifts

### 5.1 In-app lifecycle

Telegram gifts start as Star Gifts. A received gift can be upgraded to a collectible when permitted; upgrading costs Stars and produces unique traits. Telegram’s January 2025 announcement describes custom models/art plus random secondary traits such as background color, icon and number. ([Telegram, “Collectible Gifts,” 2025-01-01](https://telegram.org/blog/collectible-gifts-and-more), accessed 2026-09-16.)

The MTProto schema is the authoritative field inventory for Telegram-native gifts: a base `starGift` includes `id`, `stars`, availability, `convert_stars`, dates, `upgrade_stars`, resale minimums and an optional auction; `starGiftUnique` includes `id`, `gift_id`, title, slug, serial `num`, owner, attributes, availability, optional `gift_address`, resale amounts, estimated value and optional `host_id`. ([StarGift](https://core.telegram.org/type/StarGift), accessed 2026-09-16.)

Gift attributes are structured, not one opaque rarity string: model, pattern, backdrop and original-details constructors have names/documents/colors/rarity or sender/recipient/date/message fields. ([StarGiftAttribute](https://core.telegram.org/type/StarGiftAttribute), accessed 2026-09-16.) Preserve raw constructors and parsed fields; never discard original details or crafted flags because they can affect value and future compatibility.

### 5.2 Hosting versus ownership

A blockchain-located gift may be linked to a Telegram user/channel profile without transferring TON ownership. `starGiftUnique.host_id` identifies the profile hosting it while `owner_address` remains the TON wallet owner. `payments.getSavedStarGifts` can exclude hosted gifts with `exclude_hosted`. ([Telegram Gifts](https://core.telegram.org/api/gifts), accessed 2026-09-16.)

**Acceptance rule:** if `host_id` is present and differs from the wallet owner, label the profile gift as “hosted, not owned”; never count it as a wallet transfer. This is a high-impact anti-double-counting requirement.

### 5.3 Telegram Stars resale, offers and value API

An owned collectible can be listed in Telegram’s gift marketplace by `payments.updateStarGiftPrice` with `resell_stars`; `0` unlists it. Telegram’s client configuration supplies minimum/maximum resale-price constraints and a resale commission parameter, documented as `stars_stargift_resale_amount_min`, `stars_stargift_resale_amount_max`, and `stars_stargift_resale_commission_permille` in the Gifts API. ([Telegram Gifts](https://core.telegram.org/api/gifts), accessed 2026-09-16.)

The resale inventory method is `payments.getResaleStarGifts`, with `gift_id`, optional attribute filters/hash, `sort_by_price` or `sort_by_num` (mutually exclusive), `offset`, and `limit`; it returns `payments.resaleStarGifts` with count, gifts, next offset, attributes/counters, chats and users. ([payments.ResaleStarGifts](https://core.telegram.org/type/payments.ResaleStarGifts), accessed 2026-09-16.)

Telegram supports purchase offers for unique gifts with Stars or TON. An offer reserves its specified amount for a duration selected from documented options (6h, 12h, 24h, 36h, 48h, 72h; 120 seconds in test mode); rejection/expiry refunds the full amount, and acceptance transfers the gift. ([Telegram Gifts](https://core.telegram.org/api/gifts), accessed 2026-09-16.)

`payments.getUniqueStarGiftValueInfo` returns value currency/amount, initial sale data, last sale, floor, average price, listed count and Fragment-listed count/URL where available. This is an estimate/market summary, not a guaranteed executable quote. ([UniqueStarGiftValueInfo](https://core.telegram.org/type/payments.UniqueStarGiftValueInfo), accessed 2026-09-16.)

Telegram’s May 8, 2025 announcement confirms that the in-app marketplace lets users buy/sell collectible gifts for Telegram Stars, with filters by model, backdrop and symbol. It does not establish that every in-app resale is a TON NFT sale. ([Telegram, “Gift Marketplace,” 2025-05-08](https://telegram.org/blog/gift-marketplace-and-more), accessed 2026-09-16.)

### 5.4 Export to TON and external markets

A collectible gift can be converted to a TON NFT through `payments.getStarGiftWithdrawalUrl`, which requires the current user’s 2FA password and returns a URL to import/export through Fragment. ([Telegram Gifts](https://core.telegram.org/api/gifts), accessed 2026-09-16; [payments.StarGiftWithdrawalUrl](https://core.telegram.org/type/payments.StarGiftWithdrawalUrl), accessed 2026-09-16.) Telegram’s January 24, 2025 announcement says blockchain transfer gives the owner permanent control even after losing/deleting the Telegram account and enables outside auction services; it also gives each collectible a `t.me/nft` link. ([Telegram, “Move Gifts to the Blockchain,” 2025-01-24](https://telegram.org/blog/wear-gifts-blockchain-and-more), accessed 2026-09-16.)

**Product rule:** keep the Telegram `slug`/`gift_id`/`num` identity linked to the TON NFT address after export, but treat export/import as state transitions with their own timestamps and transactions. A gift can be visible in Telegram, hosted by Telegram, owned by a wallet, or listed in Telegram Stars market at different times.

### 5.5 Gift auctions and crafting

Telegram’s November 19, 2025 announcement introduced auctions for new limited gifts using Stars over multiple rounds: rank in a round determines the unique serial number; winners receive gifts at round end, lower bids carry forward, and remaining bids are refunded after all gifts are allocated. ([Telegram, “Auctions for Gifts,” 2025-11-19](https://telegram.org/blog/live-stories-gift-auctions), accessed 2026-09-16.) The MTProto schema marks auction gifts with `auction`, `auction_slug`, start date, gifts per round and number of rounds/availability fields. ([StarGift](https://core.telegram.org/type/StarGift), accessed 2026-09-16.)

The MTProto API exposes `payments.getStarGiftAuctionState` (which subscribes the user to auction updates), `payments.getStarGiftAuctionAcquiredGifts`, and `payments.getStarGiftActiveAuctions`; active-auction lookup is intended to restore participation badges while detailed state comes from the subscribed auction updates. Persist auction state/update timestamps and do not treat a missing subscription as “no auction.” ([Telegram available methods](https://core.telegram.org/methods), accessed 2026-09-16.)

Telegram’s February 9, 2026 announcement says crafting combines up to four existing collectible gifts into Uncommon/Rare/Epic/Legendary outcomes, with multiple same-attribute inputs increasing attribute probability. ([Telegram, “Gift Crafting,” 2026-02-09](https://telegram.org/blog/crafting-android-design-and-more), accessed 2026-09-16.) The Gifts API says crafting combines 1–4 owned gifts of the same base type; the first must not be on TON and a `can_craft_at` lock may apply. ([Telegram Gifts](https://core.telegram.org/api/gifts), accessed 2026-09-16.)

**Valuation implication:** distinguish original mint number, upgrade traits, crafted flag, craft inputs (where visible), export state, and post-craft serial. Do not use collection floor alone for crafted items.

## 5.6 Bot API / Mini App integration boundary

Telegram’s Bot API is an HTTPS interface for bot developers; Mini Apps are JavaScript interfaces launched inside Telegram through a bot and can support authorization, notifications and payments. The Mini App launch surface includes main/profile, keyboard, inline, menu, direct-link and attachment-menu launches. ([Telegram Bot API](https://core.telegram.org/bots/api), accessed 2026-09-16; [Telegram Mini Apps](https://core.telegram.org/bots/webapps), accessed 2026-09-16.)

For digital goods/services sold by a bot or Mini App, Telegram’s Bot Platform documentation requires Telegram Stars (`XTR`) rather than arbitrary currencies in the in-app digital-goods flow. This is separate from TON settlement on Fragment and from the TON wallet used for exported NFTs. ([Telegram Bot Features](https://core.telegram.org/bots/features), accessed 2026-09-16; [Telegram Stars announcement](https://telegram.org/blog/telegram-stars), accessed 2026-09-16.)

Telegram provides a narrowly scoped custom Bot API method for external gift marketplaces: `sendCustomRequest` with `reportGiftPurchase`. It must be called only after a completed purchase and carries a marketplace transaction ID/date, amount in USD cents or nanotons, sale type (`listing`, `offer`, `auction`), gift name(s), buyer, and optional seller/recipient. This is a reporting/attribution hook, not a public marketplace order-book API and not proof that a TON transfer completed unless the marketplace verifies it. ([Telegram Gift Marketplaces](https://core.telegram.org/api/gift-marketplaces), accessed 2026-09-16.)

**Security acceptance:** Mini Apps must validate Telegram-provided init data server-side and bind actions to the authenticated Telegram user; never trust client-supplied price, gift ID, buyer ID or completion status. The reviewed Mini App docs describe the launch and client surface but do not turn a Mini App into a TON ownership oracle. ([Telegram Mini Apps](https://core.telegram.org/bots/webapps), accessed 2026-09-16.)

## 6. TON NFT standards, metadata, royalties and smart-contract sale mechanics

### 6.1 NFT and metadata standards

TEP-62 defines NFT item/collection interfaces, including collection enumeration/address derivation and NFT content retrieval. It says NFT item and collection metadata follow TEP-64 and may be on-chain or off-chain. Collection `get_collection_data()` returns next index, collection content and owner; `get_nft_content()` returns complete item content. ([TEP-62](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md), accessed 2026-09-16.)

TEP-64 defines off-chain content with a URI (first byte `0x01`), on-chain key/value content (`0x00`), and semi-chain merging where on-chain values override collisions. Standard NFT fields include `uri`, `name`, `description`, `image` and `image_data`; extensions are allowed. ([TEP-64](https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md), accessed 2026-09-16.)

**Metadata acceptance:** persist the raw content cell/BOC and hash, resolved URI, retrieval timestamp, HTTP status/content hash, parser version, and parsed fields. Off-chain JSON/image may change or disappear; an old cached version must remain tied to the observation block/LT. On-chain metadata is stronger provenance but still requires parser compatibility and scam/collection verification.

### 6.2 Royalties are optional, not enforced

TEP-66 standardizes a `royalty_params()` get-method returning `numerator`, `denominator`, and destination, plus an internal request/report flow. Marketplaces are expected to pay `price × numerator / denominator` but may deduct gas/message fees. TEP-66 explicitly says royalty cannot be enforced on every sale because free transfers cannot be distinguished from sales. ([TEP-66](https://github.com/ton-blockchain/TEPs/blob/master/text/0066-nft-royalty-standard.md), accessed 2026-09-16.)

Getgems’ open contract source demonstrates a concrete fixed-price sale implementation: it stores marketplace and royalty addresses/amounts, validates input value against price plus minimum gas, sends seller proceeds, royalty and marketplace fee, transfers the NFT, and marks sale complete. Its v4 source supports TON or Jetton price paths; Getgems’ repository README identifies a 5% marketplace royalty/fee configuration for its own marketplace. These are Getgems implementation facts, not proof that Fragment contracts use the same code or fee. ([Getgems NFT contracts](https://github.com/getgems-io/nft-contracts), accessed 2026-09-16; [Getgems fixed-price v4 source](https://github.com/getgems-io/nft-contracts/blob/main/packages/contracts/sources/nft-fixprice-sale-v4r1.fc), accessed 2026-09-16.)

**Sale classification acceptance:** record the sale/auction contract address, code hash, code version, static data, inbound message op/query ID, outgoing payment recipients and amounts, and final NFT transfer. Only label a transaction as a sale when the contract family and payment flow meet a versioned decoder; otherwise label `transfer_or_unknown`.

### 6.3 Getgems data/API

TON Center’s indexed v3 API exposes NFT collections, items, sales/auctions and transfers. NFT transfers accept owner/item/collection filters, LT/time bounds, limit and offset (maximum 1,000); NFT items include owner, collection, content, last transaction LT and on-sale fields. ([TON Center v3 NFT transfers](https://docs.ton.org/api/v3/nfts/get-nft-transfers), accessed 2026-09-16; [TON Center v3 NFT items](https://docs.ton.org/api/v3/nfts/get-nft-items), accessed 2026-09-16; [TON Center v3 NFT sales](https://docs.ton.org/api/v3/nfts/get-nft-sales-and-auctions), accessed 2026-09-16.)

Getgems publishes open NFT/sale/auction contract source and a minting API. Its minting API documentation says the API is mainnet/testnet, uses a funded special wallet for gas, and limits to no more than 400 requests per 5 minutes per IP. That rate limit is for the documented minting API, not evidence of a public historical marketplace API. ([Getgems minting API docs](https://github.com/getgems-io/nft-contracts/blob/main/docs/minting-api-en.md), accessed 2026-09-16; [Getgems public API](https://getgems.io/public-api), accessed 2026-09-16.)

## 7. TON APIs, events, freshness and rate limits

### 7.1 TonAPI

TonAPI’s official docs describe high-level Events as trace-derived actions such as NFT purchases and transfers, but explicitly warn that event structure may change and actions are for display, not protocol-critical logic. Use raw transactions/traces/messages and contract decoders for accounting; use TonAPI actions as a convenience layer. ([TonAPI Events](https://docs.tonapi.io/tonapi/rest-api/events), accessed 2026-09-16.)

Without authentication, TonAPI documentation states a throttle of approximately 1 request per 4 seconds (0.24 requests/s); an authorization token from TonConsole enables plan-based limits. The docs say token limits apply across issued tokens and independently to mainnet/testnet as described by the plan. ([Ton Console TonAPI About](https://docs.tonconsole.com/tonapi), accessed 2026-09-16.)

TonAPI’s streaming docs expose transactions/actions/traces, account-state changes, jetton changes and trace invalidation, with finality states; choose finalized for irreversible accounting and handle invalidation/reconciliation for trace-based data. ([TON streaming API overview](https://docs.ton.org/api/streaming/overview), accessed 2026-09-16.)

### 7.2 TON Center v2/v3

TON Center v3 accepts API keys via `X-API-Key` or query parameter; unauthenticated requests are limited to one request per second according to the authentication page. The separate rate-limit page documents a no-key default of 1 request/s and plan examples (Free 10, Plus 25, Advanced 100 requests/s), which is a documentation inconsistency. Treat endpoint/plan limits as runtime configuration: detect `429`, obey backoff, and maintain per-network budgets. ([TON Center v3 authentication](https://docs.ton.org/api/v3/authentication), accessed 2026-09-16; [TON Center rate limits](https://docs.ton.org/api/rate-limit), accessed 2026-09-16.)

TON Center v3 uses offset pagination, generally default 10 / maximum 1,000; transfer/item endpoints support LT/time ranges and sorting. Offset pagination can be unstable for datasets sorted by changing last transaction LT, so use LT/time watermarks plus overlap-and-deduplicate rather than assuming a static page boundary. ([TON Center pagination](https://docs.ton.org/api/v3/pagination), accessed 2026-09-16; [TON Center NFT transfers](https://docs.ton.org/api/v3/nfts/get-nft-transfers), accessed 2026-09-16; [TON Center NFT items](https://docs.ton.org/api/v3/nfts/get-nft-items), accessed 2026-09-16.)

### 7.3 Chain-state and address edge cases

TON account states include `nonexist`, `uninit`, `active`, and `frozen`. `uninit` may hold balance but no code/data; `frozen` preserves hashes after storage debt and cannot execute until recovered with valid state init/funds. ([TON account status](https://docs.ton.org/foundations/status), accessed 2026-09-16.)

TON raw addresses are canonical on-chain identifiers; user-friendly addresses add bounceable/non-bounceable and testnet flags plus checksum. Mainnet/testnet flags matter; a raw address alone does not carry a network marker. TON docs recommend verifying initialization and using bounceable addresses for contracts/non-bounceable for uninitialized wallets as appropriate. ([TON address formats](https://docs.ton.org/foundations/addresses/formats), accessed 2026-09-16; [TON address workflow](https://docs.ton.org/onboarding/wallet-apps/addresses-workflow), accessed 2026-09-16.)

**Required edge-case tests:** reject checksum-invalid addresses; reject testnet addresses on mainnet; canonicalize raw/friendly equivalents; preserve workchain; do not treat `nonexist`, `uninit`, `frozen` as equivalent; verify expected NFT state init/code hash before trusting a token; handle bounced messages and duplicate/reorg/invalidated traces; compare indexed state with a raw/get-method read for high-value assets.

## 8. Authenticity, scam/spam and verification policy

TON indexers expose scam/verification indicators but these are not the same as protocol ownership. TonAPI examples include `verified` collection linkage and a `trust`/blacklist signal; TON Center metadata includes `is_scam`, `valid`, and indexed metadata. Use these as risk signals, never as the sole authenticity rule. ([TonAPI NFT cookbook](https://tonconsole-docs-gray.vercel.app/tonapi/cookbook/working-with-nfts), accessed 2026-09-16; [TON Center NFT sales schema](https://docs.ton.org/api/v3/nfts/get-nft-sales-and-auctions), accessed 2026-09-16.)

**Authenticity score inputs (proposed inference):** (a) collection/item address allowlist for known Telegram/Fragment collections; (b) expected code hash and interface/get-method success; (c) immutable provenance from mint/withdrawal and finalized transfers; (d) metadata consistency and content hash; (e) Telegram `slug`/`gift_id`/`num` cross-check; (f) indexer `verified`/`is_scam`/trust; (g) marketplace/contract-recipient allowlist; (h) unresolved ownership/host mismatch. The score is an analytics inference, not an official Telegram authenticity attestation.

**Spam defenses:** never identify an item by name/image alone; require contract address + collection + serial/index; maintain poisoned-metadata and malicious-URI handling; sandbox HTTP metadata/image fetches; cap redirects and content sizes; pin content hashes and retain raw cells; display a prominent “unverified” state when collection or metadata cannot be verified.

## 9. Fees, currencies and valuation normalization

- Fragment’s About page says collectible transactions incur a 5% platform fee, blockchain fees are additional, and initial basic-username conversion has a one-time 5-Gram fee. Treat this as Fragment UI/terms economics and version by effective date; do not apply it to every TON transfer or every gift market. ([Fragment About](https://fragment.com/about), accessed 2026-09-16.)
- Telegram in-app gift resale is denominated in Stars (`resell_stars`); upgrade costs Stars; offers can use Stars or TON. ([Telegram Gifts](https://core.telegram.org/api/gifts), accessed 2026-09-16.)
- TEP-66 royalties are percentage parameters and expected marketplace payments, not mandatory protocol deductions. ([TEP-66](https://github.com/ton-blockchain/TEPs/blob/master/text/0066-nft-royalty-standard.md), accessed 2026-09-16.)
- Getgems’ published sale contracts encode fee/royalty addresses and amounts per sale contract; decode the actual contract rather than assuming the repository’s example 5% values. ([Getgems contracts](https://github.com/getgems-io/nft-contracts), accessed 2026-09-16.)
- TON uses integer nanotons on-chain. Store integer minor units and a `currency`/`decimals` column; convert to fiat only with a timestamped exchange-rate source. Never mix Fragment UI’s “Grams” label, TON/Gram protocol units and Stars without a versioned unit map. (TON Center APIs represent amounts as integer strings; [TON Center NFT sales](https://docs.ton.org/api/v3/nfts/get-nft-sales-and-auctions), accessed 2026-09-16.)

## 10. Recommended ingestion architecture

1. **Chain index:** TonAPI streaming or TON Center streaming/indexed endpoints for low-latency discovery; store raw transactions, traces, messages, blocks, LT, hash, finality and invalidation status.
2. **Backfill/reconciliation:** TON Center v3 transfers/items/sales plus raw contract/get-method reads. Use LT/time watermarks, overlap, dedupe, and finalized checkpointing.
3. **Contract decoder:** versioned code-hash registry for TON NFT item/collection, Fragment/Telegram gift export contracts when identified, Getgems sale/auction/offer versions, and unknown-contract fallback. Store decoder version and raw BOC.
4. **Telegram utility index:** session-authorized MTProto for visible collectible info, username assignment/active/order, gift records, hosted gifts, Stars resale/offers, unique gift value, and withdrawal URL status where available. Do not put user credentials in the analytics backend; collect only user-authorized data.
5. **Marketplace observations:** Fragment web pages or a documented partner API only after legal/ToS review; treat listing/auction snapshots as observations with retrieval time, not as canonical chain facts. Do not depend on private endpoints as a protocol API.
6. **Metadata service:** TEP-64 parser + raw-cell archival + content hash + URI fetch cache + malicious-content controls. Support JSON/HTTP(S)/IPFS/TON Storage only when actually encoded/returned; do not infer URI schemes.
7. **Valuation:** separate primary-auction price, secondary executed sale, listing ask, offer, Stars resale, TON sale, floor/median/VWAP, currency and timestamp. Apply outlier/wash-trade flags and liquidity/sample-size confidence; never treat an appraised value as executable price.

## 11. Acceptance criteria / testable product requirements

### Identity and ownership

- **AC-ID-1:** Given raw, friendly bounceable, friendly non-bounceable, URL-safe, or testnet-flagged TON addresses, parser canonicalizes to `(network, workchain, raw_address)` and rejects bad checksum/network.
- **AC-ID-2:** Every asset record has chain item address (when exported/minted), collection address (when known), Telegram-native key, source, observation block/LT and finality.
- **AC-ID-3:** A gift with `host_id != owner_address` is rendered as “hosted, not owned” and does not count toward wallet inventory.
- **AC-ID-4:** Username record can represent wallet owner, no Telegram binding, Telegram binding, inactive binding, active binding and binding to bot/channel/supergroup separately.
- **AC-ID-5:** Number record stores Telegram login utility as a separate state and never exposes inferred PII.

### Event and sale classification

- **AC-EVT-1:** Raw transfer is not a sale unless a versioned sale/auction/offer decoder identifies payment flow and final NFT transfer.
- **AC-EVT-2:** Decoder stores contract address, code hash/version, static data, op code/query ID, all payment recipients/amounts, buyer/seller/recipient, NFT transfer and finality.
- **AC-EVT-3:** Bounced, failed, superseded, trace-invalidated and pending events are marked, reconciled and excluded from finalized valuation.
- **AC-EVT-4:** Direct transfer, gift, offer, fixed-price, auction settlement and unknown are distinct event types.
- **AC-EVT-5:** Primary username conversion includes conversion-fee and original-basic-owner fields only when observed from an authoritative Fragment/chain record; no hardcoded fee across all dates.

### Metadata/authenticity

- **AC-META-1:** Preserve raw content cell/BOC, metadata URI, parsed JSON, content hash, retrieval timestamp, HTTP status, parser version and previous versions.
- **AC-META-2:** Collection/item identity cannot be created from display name/image alone; address/collection/serial is mandatory.
- **AC-META-3:** Scam/trust/verified signals are shown with source and timestamp and never silently converted to “official.”
- **AC-META-4:** Unknown code hash/interface is visible as `unverified_contract`, not silently grouped with a known Telegram/Fragment collection.

### API operations and freshness

- **AC-API-1:** All providers have per-provider/network rate budgets, retries with exponential backoff on 429, and cache TTLs; keys are server-side only.
- **AC-API-2:** TonAPI events are not the accounting source; finalized raw chain data is the accounting source, and stream invalidation triggers replay/reconciliation.
- **AC-API-3:** TON Center pagination uses LT/time watermarks with overlap/dedupe, not only offset pages.
- **AC-API-4:** Every displayed metric exposes `source`, `observed_at`, `block/LT`, `finality`, and freshness age.
- **AC-API-5:** Telegram session data is permission-scoped, expires/revokes cleanly, and is never used to claim public completeness; missing visibility returns `unknown`, not zero.

### Valuation

- **AC-VAL-1:** Prices retain integer amount, unit (`nanoton`, `TON`, `Star`), currency, timestamp, fee/royalty breakdown and source.
- **AC-VAL-2:** Floors and medians are computed separately for listings, executed sales, offers and Stars resale; sample size and liquidity window are mandatory.
- **AC-VAL-3:** “5% fee” is applied only to Fragment records that fall under the relevant current Fragment rule; it is not applied to all TON transfers.
- **AC-VAL-4:** Wash-trade/outlier flags, wallet clustering and self-transfer heuristics are labeled as heuristics and never presented as proven fraud.
- **AC-VAL-5:** Cross-vertical comparables are prohibited by default: a username, number, base gift, crafted gift and exported NFT have separate cohorts.

## 12. Explicit gaps / unresolved points

1. **No official Fragment bulk API contract was found in the reviewed official sources.** Telegram MTProto methods are useful but session/visibility-scoped; Fragment About/Terms document behavior, not a public historical order-book schema. A product requiring complete listings/bids must obtain a documented partner feed or build a lawful chain-first approximation and label coverage.
2. **Fragment auction contract address/code/version and all historical rule changes are not specified in the reviewed official docs.** Identify contracts empirically from finalized TON transactions and maintain a code-hash registry; do not assume Getgems sale contracts apply to Fragment.
3. **Fragment/Telegram fee schedules can change and use varying labels/units.** Store the original display/unit, effective date, source URL and fee-rule version; do not hardcode current 5%/5-Gram values beyond the cited Fragment page.
4. **Telegram does not promise a public, complete history of every username/number/gift listing, bid, offer, refund or Fragment UI snapshot.** Treat missing records as unknown, not no activity.
5. **Telegram’s client MTProto APIs require user/session authorization and visibility rules.** They are not a server-side public identity oracle; account/phone privacy can hide data.
6. **Metadata is frequently off-chain.** TEP-64 standardizes formats but not permanence/availability of HTTP/IPFS/TON Storage resources; preserve content hashes and retrieval history.
7. **High-level indexer actions are not protocol-stable.** TonAPI explicitly warns that actions may change; raw traces/messages and contract decoding remain necessary.
8. **Royalty observance is marketplace-dependent.** TEP-66 cannot enforce every transfer; analytics must not estimate creator royalties from metadata alone.
9. **Gift export/import identity reconciliation needs live fixtures.** The official docs specify withdrawal URL and gift fields, but a production implementation should test one gift end-to-end and record the exact export contract, code hash, metadata transformation and import-back behavior before claiming universal support.
10. **Current anti-sniping/auction timer details are not fully documented on the reviewed official Fragment page.** Keep `auction_rules_version` and source snapshots; do not infer extensions from third-party guides.

## Source register (official/primary)

- Telegram Fragment collectibles/API: <https://core.telegram.org/api/fragment>
- Telegram `fragment.getCollectibleInfo`: <https://core.telegram.org/method/fragment.getCollectibleInfo>
- Telegram gifts: <https://core.telegram.org/api/gifts>
- Telegram StarGift schemas: <https://core.telegram.org/type/StarGift>, <https://core.telegram.org/type/StarGiftAttribute>
- Telegram unique-gift value: <https://core.telegram.org/type/payments.UniqueStarGiftValueInfo>
- Telegram gift resale schema: <https://core.telegram.org/type/payments.ResaleStarGifts>
- Telegram official product announcements: <https://telegram.org/blog/ultimate-privacy-topics-2-0>, <https://telegram.org/blog/collectible-gifts-and-more>, <https://telegram.org/blog/wear-gifts-blockchain-and-more>, <https://telegram.org/blog/gift-marketplace-and-more>, <https://telegram.org/blog/live-stories-gift-auctions>, <https://telegram.org/blog/crafting-android-design-and-more>
- Fragment About/Terms/Privacy: <https://fragment.com/about>, <https://fragment.com/terms>, <https://fragment.com/privacy>
- TON TEP-62/64/66: <https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md>, <https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md>, <https://github.com/ton-blockchain/TEPs/blob/master/text/0066-nft-royalty-standard.md>
- TON account/address docs: <https://docs.ton.org/foundations/status>, <https://docs.ton.org/foundations/addresses/formats>, <https://docs.ton.org/onboarding/wallet-apps/addresses-workflow>
- TON Center v2/v3 APIs: <https://docs.ton.org/api/v2/accounts/get-address-information>, <https://docs.ton.org/api/v3/overview>, <https://docs.ton.org/api/v3/authentication>, <https://docs.ton.org/api/v3/pagination>, <https://docs.ton.org/api/v3/nfts/get-nft-items>, <https://docs.ton.org/api/v3/nfts/get-nft-transfers>, <https://docs.ton.org/api/v3/nfts/get-nft-sales-and-auctions>, <https://docs.ton.org/api/streaming/overview>, <https://docs.ton.org/api/rate-limit>
- TonAPI: <https://docs.tonapi.io/tonapi/rest-api/events>, <https://docs.tonconsole.com/tonapi>
- Getgems primary contract source/docs: <https://github.com/getgems-io/nft-contracts>, <https://github.com/getgems-io/nft-contracts/blob/main/docs/minting-api-en.md>, <https://getgems.io/public-api>

