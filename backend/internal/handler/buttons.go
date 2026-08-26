package handler

import "fmt"

// ============================================================================
// Enhanced inline-keyboard helpers (Bot API 9.3/9.4/10.3 — added 2026-08-25).
//
// Existing markup builders keep passing raw maps; these typed constructors
// make it trivial to opt into the newer optional fields where they add real
// UX value: button color (style), disabled state, and custom-emoji icons.
// ============================================================================

// Button style constants accepted by Telegram since Bot API 9.4.
const (
	BtnStyleDefault  = ""        // platform default
	BtnStylePrimary  = "primary" // accent fill
	BtnStyleDanger   = "danger"  // red — destructive actions
	BtnStyleSuccess  = "success" // green — confirmations
)

// NewButton builds a standard inline button.
func NewButton(text, callbackData string) map[string]interface{} {
	return map[string]interface{}{"text": text, "callback_data": callbackData}
}

// NewStyledButton adds the Bot API 9.4 style field.
func NewStyledButton(text, callbackData, style string) map[string]interface{} {
	b := NewButton(text, callbackData)
	if style != "" {
		b["style"] = style
	}
	return b
}

// NewDisabledButton renders a grayed-out non-interactive button
// (Bot API 10.3). Use for exhausted daily boosts, locked tiers, etc.
func NewDisabledButton(text string) map[string]interface{} {
	return map[string]interface{}{"text": text, "disabled": true}
}

// NewIconButton attaches a custom emoji to the button label
// (Bot API 9.3 — requires the bot owner to have Premium for direct sends).
func NewIconButton(text, callbackData, iconCustomEmojiID string) map[string]interface{} {
	b := NewButton(text, callbackData)
	if iconCustomEmojiID != "" {
		b["icon_custom_emoji_id"] = iconCustomEmojiID
	}
	return b
}

// Danger / Success convenience wrappers used by moderation callbacks.
func DangerButton(text, callbackData string) map[string]interface{} {
	return NewStyledButton(text, callbackData, BtnStyleDanger)
}

func SuccessButton(text, callbackData string) map[string]interface{} {
	return NewStyledButton(text, callbackData, BtnStyleSuccess)
}

// Example usage kept as a compile-time assertion of shape:
// rows := [][]map[string]interface{}{
//     {DangerButton("⛔ Ban", "gban:"+uid), SuccessButton("✅ Approve", "ok:"+uid)},
//     {NewDisabledButton("Turbo finished for today")},
// }
var _ = fmt.Sprintf // retain fmt import if needed by future edits
