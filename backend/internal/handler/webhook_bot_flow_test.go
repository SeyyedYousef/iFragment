package handler

import (
	"testing"

	"ifragment-backend/internal/config"
)

func TestBuildMainMenuMarkupLayout(t *testing.T) {
	h := &WebhookHandler{}
	miniAppURL := "https://t.me/iFragmentBot/iFragment"

	languages := []string{"fa", "en", "ru", "zh"}
	for _, lang := range languages {
		t.Run("lang_"+lang, func(t *testing.T) {
			markup := h.buildMainMenuMarkup(lang, miniAppURL)
			if markup == nil {
				t.Fatalf("expected non-nil markup for lang %s", lang)
			}

			grid, ok := markup["inline_keyboard"].([][]map[string]interface{})
			if !ok {
				t.Fatalf("expected inline_keyboard to be [][]map[string]interface{}")
			}

			// Must be 4 rows
			if len(grid) != 4 {
				t.Fatalf("expected exactly 4 rows, got %d", len(grid))
			}

			// Row 1: Hero Primary CTA (Full width, exactly 1 button)
			if len(grid[0]) != 1 {
				t.Fatalf("expected row 1 to have exactly 1 button, got %d", len(grid[0]))
			}
			heroBtn := grid[0][0]
			if heroBtn["url"] != miniAppURL {
				t.Errorf("expected hero button url to be %s, got %v", miniAppURL, heroBtn["url"])
			}
			if heroBtn["style"] != "primary" {
				t.Errorf("expected hero button style to be 'primary', got %v", heroBtn["style"])
			}
			if heroBtn["icon_custom_emoji_id"] != CustomEmojiDiamond {
				t.Errorf("expected hero button icon_custom_emoji_id to be %s, got %v", CustomEmojiDiamond, heroBtn["icon_custom_emoji_id"])
			}

			// Row 2: Exactly 2 buttons (Username, Number)
			if len(grid[1]) != 2 {
				t.Fatalf("expected row 2 to have exactly 2 buttons, got %d", len(grid[1]))
			}
			if grid[1][0]["callback_data"] != "nav:asset_username" {
				t.Errorf("expected row 2 btn 1 callback to be nav:asset_username, got %v", grid[1][0]["callback_data"])
			}
			if grid[1][0]["icon_custom_emoji_id"] != CustomEmojiTag {
				t.Errorf("expected row 2 btn 1 icon_custom_emoji_id to be %s, got %v", CustomEmojiTag, grid[1][0]["icon_custom_emoji_id"])
			}
			if grid[1][1]["callback_data"] != "nav:asset_number" {
				t.Errorf("expected row 2 btn 2 callback to be nav:asset_number, got %v", grid[1][1]["callback_data"])
			}
			if grid[1][1]["icon_custom_emoji_id"] != CustomEmojiPhone {
				t.Errorf("expected row 2 btn 2 icon_custom_emoji_id to be %s, got %v", CustomEmojiPhone, grid[1][1]["icon_custom_emoji_id"])
			}

			// Row 3: Exactly 2 buttons (Gifts, Profile) — CRITICAL: No longer 3 buttons!
			if len(grid[2]) != 2 {
				t.Fatalf("expected row 3 to have exactly 2 buttons (never 3), got %d", len(grid[2]))
			}
			if grid[2][0]["callback_data"] != "nav:asset_gifts" {
				t.Errorf("expected row 3 btn 1 callback to be nav:asset_gifts, got %v", grid[2][0]["callback_data"])
			}
			if grid[2][0]["icon_custom_emoji_id"] != CustomEmojiGift {
				t.Errorf("expected row 3 btn 1 icon_custom_emoji_id to be %s, got %v", CustomEmojiGift, grid[2][0]["icon_custom_emoji_id"])
			}
			if grid[2][1]["callback_data"] != "nav:profile" {
				t.Errorf("expected row 3 btn 2 callback to be nav:profile, got %v", grid[2][1]["callback_data"])
			}
			if grid[2][1]["icon_custom_emoji_id"] != CustomEmojiUser {
				t.Errorf("expected row 3 btn 2 icon_custom_emoji_id to be %s, got %v", CustomEmojiUser, grid[2][1]["icon_custom_emoji_id"])
			}

			// Row 4: Exactly 2 buttons (Language, Help)
			if len(grid[3]) != 2 {
				t.Fatalf("expected row 4 to have exactly 2 buttons, got %d", len(grid[3]))
			}
			if grid[3][0]["callback_data"] != "nav:language" {
				t.Errorf("expected row 4 btn 1 callback to be nav:language, got %v", grid[3][0]["callback_data"])
			}
			if grid[3][0]["icon_custom_emoji_id"] != CustomEmojiGlobe {
				t.Errorf("expected row 4 btn 1 icon_custom_emoji_id to be %s, got %v", CustomEmojiGlobe, grid[3][0]["icon_custom_emoji_id"])
			}
			if grid[3][1]["callback_data"] != "nav:help" {
				t.Errorf("expected row 4 btn 2 callback to be nav:help, got %v", grid[3][1]["callback_data"])
			}
			if grid[3][1]["icon_custom_emoji_id"] != CustomEmojiBook {
				t.Errorf("expected row 4 btn 2 icon_custom_emoji_id to be %s, got %v", CustomEmojiBook, grid[3][1]["icon_custom_emoji_id"])
			}

			// Ensure no row in the entire menu exceeds 2 buttons
			for rIdx, row := range grid {
				if len(row) > 2 {
					t.Errorf("Row %d has %d buttons, exceeding maximum allowed 2 buttons per row", rIdx+1, len(row))
				}
			}
		})
	}
}

func TestCustomEmojiIDsValid(t *testing.T) {
	emojiIDs := []struct {
		name string
		id   string
	}{
		{"Diamond", CustomEmojiDiamond},
		{"Tag", CustomEmojiTag},
		{"Phone", CustomEmojiPhone},
		{"Gift", CustomEmojiGift},
		{"User", CustomEmojiUser},
		{"Globe", CustomEmojiGlobe},
		{"Book", CustomEmojiBook},
		{"Check", CustomEmojiCheck},
		{"Cross", CustomEmojiCross},
		{"Star", CustomEmojiStar},
		{"Bolt", CustomEmojiBolt},
		{"Coin", CustomEmojiCoin},
		{"Refresh", CustomEmojiRefresh},
	}

	for _, e := range emojiIDs {
		if len(e.id) < 10 {
			t.Errorf("Custom emoji ID for %s seems too short: %q", e.name, e.id)
		}
		for _, c := range e.id {
			if c < '0' || c > '9' {
				t.Errorf("Custom emoji ID for %s should only contain digits, got char %c in %q", e.name, c, e.id)
			}
		}
	}
}

func TestEconomicsCoinExchangeValue(t *testing.T) {
	if config.Economics.CreditsCoinsPerCredit != 150000 {
		t.Errorf("Expected Economics.CreditsCoinsPerCredit to default to 150,000, got %d", config.Economics.CreditsCoinsPerCredit)
	}

	formatted := formatNumberWithCommas(config.Economics.CreditsCoinsPerCredit)
	if formatted != "150,000" {
		t.Errorf("Expected formatted 150,000, got %s", formatted)
	}
}
