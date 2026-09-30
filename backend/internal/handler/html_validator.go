package handler

import (
	"fmt"
	"io"
	"regexp"
	"strings"

	"golang.org/x/net/html"
)

var allowedTelegramTags = map[string]bool{
	"b":                     true,
	"strong":                true,
	"i":                     true,
	"em":                    true,
	"u":                     true,
	"ins":                   true,
	"s":                     true,
	"strike":                true,
	"del":                   true,
	"span":                  true,
	"tg-spoiler":            true,
	"a":                     true,
	"tg-emoji":              true,
	"code":                  true,
	"pre":                   true,
	"blockquote":            true,
}

var htmlTagRe = regexp.MustCompile(`(?s)<[^>]*>`)

// StripHTML removes all HTML tags from the string, returning clean plain text.
func StripHTML(s string) string {
	return htmlTagRe.ReplaceAllString(s, "")
}

// ValidateTelegramHTML verifies that the given HTML string only contains allowed Telegram
// tags and that all tags are well-formed and properly closed.
func ValidateTelegramHTML(rawHTML string) error {
	if rawHTML == "" {
		return nil
	}

	tokenizer := html.NewTokenizer(strings.NewReader(rawHTML))
	var stack []string

	for {
		tt := tokenizer.Next()
		switch tt {
		case html.ErrorToken:
			err := tokenizer.Err()
			if err == io.EOF {
				if len(stack) > 0 {
					return fmt.Errorf("unclosed HTML tag: <%s>", stack[len(stack)-1])
				}
				return nil
			}
			return fmt.Errorf("html parse error: %w", err)

		case html.StartTagToken:
			token := tokenizer.Token()
			tagName := strings.ToLower(token.Data)
			if !allowedTelegramTags[tagName] {
				return fmt.Errorf("disallowed tag: <%s>", tagName)
			}
			// Additional attribute check
			if tagName == "tg-emoji" {
				hasID := false
				for _, attr := range token.Attr {
					if attr.Key == "emoji-id" && attr.Val != "" {
						hasID = true
						break
					}
				}
				if !hasID {
					return fmt.Errorf("<tg-emoji> missing required 'emoji-id' attribute")
				}
			} else if tagName == "a" {
				hasHref := false
				for _, attr := range token.Attr {
					if attr.Key == "href" && attr.Val != "" {
						hasHref = true
						break
					}
				}
				if !hasHref {
					return fmt.Errorf("<a> missing required 'href' attribute")
				}
			}
			stack = append(stack, tagName)

		case html.EndTagToken:
			token := tokenizer.Token()
			tagName := strings.ToLower(token.Data)
			if len(stack) == 0 {
				return fmt.Errorf("unexpected closing tag </%s> with empty stack", tagName)
			}
			last := stack[len(stack)-1]
			if last != tagName {
				return fmt.Errorf("tag mismatch: expected </%s>, got </%s>", last, tagName)
			}
			stack = stack[:len(stack)-1]

		case html.SelfClosingTagToken:
			token := tokenizer.Token()
			tagName := strings.ToLower(token.Data)
			if !allowedTelegramTags[tagName] {
				return fmt.Errorf("disallowed self-closing tag: <%s/>", tagName)
			}
		}
	}
}

// IsValidTelegramHTML returns true if the HTML parses strictly with Telegram allowed tags.
func IsValidTelegramHTML(rawHTML string) bool {
	return ValidateTelegramHTML(rawHTML) == nil
}
