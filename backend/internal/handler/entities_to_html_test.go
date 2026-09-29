package handler

import (
	"strings"
	"testing"
)

func TestEntitiesToHTML(t *testing.T) {
	tests := []struct {
		name     string
		text     string
		entities []MessageEntity
		want     string
	}{
		{
			name:     "plain text with escaping",
			text:     "Hello <world> & friends!",
			entities: nil,
			want:     "Hello &lt;world&gt; &amp; friends!",
		},
		{
			name: "bold english",
			text: "Hello World",
			entities: []MessageEntity{
				{Type: "bold", Offset: 6, Length: 5},
			},
			want: "Hello <b>World</b>",
		},
		{
			name: "persian bold with emoji",
			text: "سلام به ربات ما خوش آمدید",
			entities: []MessageEntity{
				{Type: "bold", Offset: 8, Length: 4}, // "ربات"
			},
			want: "سلام به <b>ربات</b> ما خوش آمدید",
		},
		{
			name: "custom emoji entity",
			text: "💎 سلام",
			entities: []MessageEntity{
				{Type: "custom_emoji", Offset: 0, Length: 2, CustomEmojiID: "5368324170671202286"},
			},
			want: `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> سلام`,
		},
		{
			name: "multiple entities and text link",
			text: "لینک فرگمنت و کد دستور",
			entities: []MessageEntity{
				{Type: "text_link", Offset: 0, Length: 11, URL: "https://fragment.com"},
				{Type: "code", Offset: 14, Length: 8},
			},
			want: `<a href="https://fragment.com">لینک فرگمنت</a> و <code>کد دستور</code>`,
		},
		{
			name: "blockquote and expandable blockquote",
			text: "نقل قول اول\nنقل قول دوم",
			entities: []MessageEntity{
				{Type: "blockquote", Offset: 0, Length: 11},
				{Type: "expandable_blockquote", Offset: 12, Length: 11},
			},
			want: "<blockquote>نقل قول اول</blockquote>\n<blockquote expandable>نقل قول دوم</blockquote>",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := entitiesToHTML(tt.text, tt.entities)
			if strings.TrimSpace(got) != strings.TrimSpace(tt.want) {
				t.Errorf("entitiesToHTML() = %v, want %v", got, tt.want)
			}
		})
	}
}
