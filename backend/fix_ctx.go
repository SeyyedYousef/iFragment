package main

import (
	"os"
	"strings"
	"fmt"
)

func main() {
	file := os.Args[1]
	data, err := os.ReadFile(file)
	if err != nil {
		fmt.Println("Error:", err)
		os.Exit(1)
	}
	content := string(data)
	replacements := [][2]string{
		{"tg.SendMessage(", "tg.SendMessage(ctx, "},
		{"tg.SendMessageWithResult(", "tg.SendMessageWithResult(ctx, "},
		{"tg.SendMessageWithMarkup(", "tg.SendMessageWithMarkup(ctx, "},
		{"tg.DeleteMessage(", "tg.DeleteMessage(ctx, "},
		{"tg.BanChatMember(", "tg.BanChatMember(ctx, "},
		{"tg.UnbanChatMember(", "tg.UnbanChatMember(ctx, "},
		{"tg.RestrictChatMember(", "tg.RestrictChatMember(ctx, "},
		{"tg.UnrestrictChatMember(", "tg.UnrestrictChatMember(ctx, "},
		{"tg.AnswerCallbackQuery(", "tg.AnswerCallbackQuery(ctx, "},
		{"tg.PinChatMessage(", "tg.PinChatMessage(ctx, "},
		{"tg.GetChatMemberCount(", "tg.GetChatMemberCount(ctx, "},
		{"tg.EditMessageReplyMarkup(", "tg.EditMessageReplyMarkup(ctx, "},
		{"tg.GetChatMember(", "tg.GetChatMember(ctx, "},
		{"tgClient.DeleteMessage(", "tgClient.DeleteMessage(ctx, "},
		{"tgClient.BanChatMember(", "tgClient.BanChatMember(ctx, "},
		{"tgClient.UnbanChatMember(", "tgClient.UnbanChatMember(ctx, "},
		{"tgClient.RestrictChatMember(", "tgClient.RestrictChatMember(ctx, "},
		{"tgClient.UnrestrictChatMember(", "tgClient.UnrestrictChatMember(ctx, "},
	}
	for _, r := range replacements {
		content = strings.ReplaceAll(content, r[0], r[1])
	}
	err = os.WriteFile(file, []byte(content), 0644)
	if err != nil {
		fmt.Println("Error writing:", err)
		os.Exit(1)
	}
	fmt.Println("Done - all tg calls updated with ctx")
}
