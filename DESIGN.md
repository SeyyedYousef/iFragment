# DESIGN.md - iFragment Design System & Visual Authority

## Visual World & Identity
- **Theme:** Sleek Dark Glassmorphism with High Contrast & Tactile Precision.
- **Aesthetic Tone:** Modern, Premium, High-Tech, Crisp.

## Color System (OKLCH / HSL Tokens)
- **Background Deep:** `hsl(224, 25%, 6%)` / `#0b0e14`
- **Surface Elevation 1 (Card):** `hsla(222, 20%, 12%, 0.7)` / Glass backdrop-blur
- **Surface Elevation 2 (Elevated):** `hsla(220, 18%, 18%, 0.8)`
- **Primary Accent (Emerald Glow):** `hsl(158, 85%, 45%)` / `#10b981` (Energy & Success)
- **Secondary Accent (Cyan Spark):** `hsl(190, 90%, 50%)` / `#06b6d4` (Highlights & Tech)
- **Telegram Native Blue:** `hsl(211, 100%, 50%)` / `#0088cc` (Native Action Buttons)
- **Foreground Primary:** `hsl(210, 40%, 98%)` / `#f8fafc`
- **Foreground Muted:** `hsl(215, 16%, 65%)` / `#94a3b8`

## Typography System
- **Primary Font Stack:** System UI, `Outfit`, `-apple-system`, `BlinkMacSystemFont`, `SF Pro Display`, `Segoe UI`, `Roboto`
- **Heading Scale:**
  - H1: `2.25rem` (36px), font-weight: 700, tracking: `-0.02em`, line-height: 1.15
  - H2: `1.75rem` (28px), font-weight: 600, tracking: `-0.015em`, line-height: 1.2
  - H3: `1.25rem` (20px), font-weight: 600, tracking: `-0.01em`, line-height: 1.3
- **Body:** `1rem` (16px) & `0.875rem` (14px), line-height: 1.5

## Spatial Grid & Rhythm
- **Base Unit:** 4px / 8px grid
- **Card Padding:** Mobile `1rem` (16px), Desktop `1.5rem` (24px)
- **Border Radius:**
  - Outer Container: `1.25rem` (20px)
  - Interactive Button: `0.75rem` (12px)
  - Pill / Badge: `9999px`

## Motion & Tactile Feedback
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (Out-Expo for snappy response)
- **Transitions:** Fast `150ms` to `250ms` duration.
- **Haptic Patterns:** Light impact on tap, medium on state change, heavy on error.

## Anti-Pattern Rules (Banned Choices)
1. ❌ **No AI Slop Gradients:** Banned generic Violet-to-Indigo or Pink-to-Purple default gradients.
2. ❌ **No Flat Boring Borders:** Banned pure 1px gray solid borders without subtle opacity or glass reflection.
3. ❌ **No Unresponsive Layouts:** Banned fixed pixel widths for mobile WebViews; must adapt fluidly across Telegram client sizes.
4. ❌ **No Slow Animation Waterfalls:** Banned sluggish transitions over 300ms.
