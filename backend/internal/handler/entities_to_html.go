package handler

import (
	"fmt"
	"sort"
	"strings"
	"unicode/utf16"

	"ifragment-backend/internal/client/telegram"
)

// entitiesToHTML converts a plain text string along with Telegram MessageEntities
// into HTML formatted text valid for Telegram's HTML parse_mode.
// It uses UTF-16 code units for offset and length calculations to properly support
// multi-byte Unicode characters (such as Persian text, emojis, surrogates).
func entitiesToHTML(text string, entities []MessageEntity) string {
	if len(entities) == 0 {
		return telegram.EscapeHTML(text)
	}

	u16 := utf16.Encode([]rune(text))
	textLen := len(u16)

	type tagInsert struct {
		isClose  bool
		tag      string
		priority int // for same position: close tags first, then open tags
	}

	// Map each UTF-16 code unit index to a list of tags to inject
	inserts := make(map[int][]tagInsert)

	// Filter valid entities that fall within text bounds
	validEntities := make([]MessageEntity, 0, len(entities))
	for _, e := range entities {
		if e.Offset >= 0 && e.Length > 0 && e.Offset+e.Length <= textLen {
			validEntities = append(validEntities, e)
		}
	}

	// Sort entities: outer entities (larger length) before inner entities (nested)
	sort.SliceStable(validEntities, func(i, j int) bool {
		if validEntities[i].Offset != validEntities[j].Offset {
			return validEntities[i].Offset < validEntities[j].Offset
		}
		return validEntities[i].Length > validEntities[j].Length
	})

	for _, e := range validEntities {
		var openTag, closeTag string

		switch e.Type {
		case "bold":
			openTag, closeTag = "<b>", "</b>"
		case "italic":
			openTag, closeTag = "<i>", "</i>"
		case "underline":
			openTag, closeTag = "<u>", "</u>"
		case "strikethrough":
			openTag, closeTag = "<s>", "</s>"
		case "spoiler":
			openTag, closeTag = "<tg-spoiler>", "</tg-spoiler>"
		case "code":
			openTag, closeTag = "<code>", "</code>"
		case "pre":
			openTag, closeTag = "<pre>", "</pre>"
		case "blockquote":
			openTag, closeTag = "<blockquote>", "</blockquote>"
		case "expandable_blockquote":
			openTag, closeTag = "<blockquote expandable>", "</blockquote>"
		case "text_link":
			if e.URL != "" {
				openTag = fmt.Sprintf(`<a href="%s">`, telegram.EscapeHTML(e.URL))
				closeTag = "</a>"
			}
		case "custom_emoji":
			if e.CustomEmojiID != "" {
				openTag = fmt.Sprintf(`<tg-emoji emoji-id="%s">`, telegram.EscapeHTML(e.CustomEmojiID))
				closeTag = "</tg-emoji>"
			}
		}

		if openTag == "" || closeTag == "" {
			continue
		}

		startPos := e.Offset
		endPos := e.Offset + e.Length

		// Open tag at startPos
		inserts[startPos] = append(inserts[startPos], tagInsert{
			isClose:  false,
			tag:      openTag,
			priority: 2,
		})

		// Close tag at endPos
		inserts[endPos] = append(inserts[endPos], tagInsert{
			isClose:  true,
			tag:      closeTag,
			priority: 1,
		})
	}

	var sb strings.Builder
	runesChunk := make([]uint16, 0)

	flushChunk := func() {
		if len(runesChunk) > 0 {
			chunkStr := string(utf16.Decode(runesChunk))
			sb.WriteString(telegram.EscapeHTML(chunkStr))
			runesChunk = runesChunk[:0]
		}
	}

	for i := 0; i <= textLen; i++ {
		if tagList, ok := inserts[i]; ok {
			flushChunk()

			// Sort tags at this index: close tags first (reverse order of opening if possible), then open tags
			sort.SliceStable(tagList, func(a, b int) bool {
				return tagList[a].priority < tagList[b].priority
			})

			for _, t := range tagList {
				sb.WriteString(t.tag)
			}
		}

		if i < textLen {
			runesChunk = append(runesChunk, u16[i])
		}
	}
	flushChunk()

	return sb.String()
}
