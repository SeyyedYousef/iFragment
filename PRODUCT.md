# PRODUCT.md - iFragment Product Strategy & AI Direction

## Product Overview
**iFragment** is a premier Telegram Mini App (TMA) and Web Platform engineered for high-concurrency Telegram user interactions, fragment marketplace features, channel/group auto-response, and gamified airdrop systems.

## Target Audience & User Persona
- **Primary Users:** Telegram users, crypto/NFT traders, fragment marketplace participants, and community managers.
- **Usage Scene:** Mobile WebViews inside Telegram iOS/Android clients, as well as desktop browsers. Needs instantaneous feedback, high frame rate (120fps), tactile haptics, and responsive dark-mode aesthetics.

## Core Value Proposition & UX Goals
1. **Ultra-Fast Performance:** Zero visual jank, 60-120fps transitions using SolidJS fine-grained reactivity.
2. **Tactile & Responsive UI:** Instant visual responses, native Telegram haptic integration, and fluid micro-interactions.
3. **Immersive Aesthetics:** Sleek dark glassmorphism, crisp contrast, high legibility, and refined typography.

## AI Agent Directives & Constraints
- **Design Mode:** Primary mode is **Operate** (for app UI, marketplace grids, dashboards) and **Persuade** (for landing pages/airdrop claims).
- **Anti-Patterns:** Avoid generic AI slop (no generic Inter-only layouts, no purple-to-blue gradients, no bloated card stacks, no unstyled default buttons).
- **Native Alignment:** Always respect `@tma.js/sdk-solid` native theme parameters, main button controls, and safe-area insets.
