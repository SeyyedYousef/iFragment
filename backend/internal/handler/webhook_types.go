package handler

import (
	"encoding/json"
	"sync"

	"ifragment-backend/internal/client/telegram"
)

var telegramUpdatePool = sync.Pool{
	New: func() interface{} {
		return new(TelegramUpdate)
	},
}

type TelegramUpdate struct {
	UpdateID          int                `json:"update_id"`
	PreCheckoutQuery  *PreCheckoutQuery  `json:"pre_checkout_query"`
	Message           *Message           `json:"message"`
	EditedMessage     *Message           `json:"edited_message"`
	MyChatMember      *ChatMemberUpdated `json:"my_chat_member"`
	ChatMember        *ChatMemberUpdated `json:"chat_member"`
	CallbackQuery     *CallbackQuery     `json:"callback_query"`
	ChannelPost       *Message           `json:"channel_post"`
	EditedChannelPost *Message           `json:"edited_channel_post"`
	ChatJoinRequest   *ChatJoinRequest   `json:"chat_join_request"`
}

type ChatJoinRequest struct {
	Chat       Chat            `json:"chat"`
	From       User            `json:"from"`
	UserChatID int64           `json:"user_chat_id"`
	Date       int             `json:"date"`
	Bio        string          `json:"bio,omitempty"`
	InviteLink *ChatInviteLink `json:"invite_link,omitempty"`
}

type CallbackQuery struct {
	ID      string   `json:"id"`
	From    User     `json:"from"`
	Message *Message `json:"message"`
	Data    string   `json:"data"`
}

type ChatMemberUpdated struct {
	Chat          Chat            `json:"chat"`
	From          User            `json:"from"`
	Date          int             `json:"date"`
	OldChatMember ChatMember      `json:"old_chat_member"`
	NewChatMember ChatMember      `json:"new_chat_member"`
	InviteLink    *ChatInviteLink `json:"invite_link,omitempty"`
}

type ChatMember struct {
	User   User   `json:"user"`
	Status string `json:"status"`
}

type ChatInviteLink struct {
	InviteLink string `json:"invite_link"`
	Name       string `json:"name,omitempty"`
}

type PreCheckoutQuery struct {
	ID             string `json:"id"`
	InvoicePayload string `json:"invoice_payload"`
	TotalAmount    int    `json:"total_amount"`
	Currency       string `json:"currency"`
	From           *User  `json:"from"`
}

type Chat struct {
	ID       int64  `json:"id"`
	Type     string `json:"type"`
	Title    string `json:"title,omitempty"`
	Username string `json:"username,omitempty"`
}

type Message struct {
	MessageID          int                     `json:"message_id"`
	MessageThreadID    *int                    `json:"message_thread_id,omitempty"`
	From               *User                   `json:"from"`
	Chat               *Chat                   `json:"chat"`
	Date               int                     `json:"date"`
	Text               string                  `json:"text"`
	Caption            string                  `json:"caption"`
	Photo              []interface{}           `json:"photo"`
	Sticker            json.RawMessage         `json:"sticker,omitempty"`
	Location           json.RawMessage         `json:"location,omitempty"`
	Audio              json.RawMessage         `json:"audio,omitempty"`
	Voice              json.RawMessage         `json:"voice,omitempty"`
	Document           json.RawMessage         `json:"document,omitempty"`
	Animation          json.RawMessage         `json:"animation,omitempty"`
	Video              json.RawMessage         `json:"video,omitempty"`
	Poll               json.RawMessage         `json:"poll,omitempty"`
	Game               json.RawMessage         `json:"game,omitempty"`
	Entities           []MessageEntity         `json:"entities"`
	CaptionEntities    []MessageEntity         `json:"caption_entities,omitempty"`
	ReplyToMessage     *Message                `json:"reply_to_message"`
	ForwardFrom        *User                   `json:"forward_from,omitempty"`
	ForwardFromChat    *Chat                   `json:"forward_from_chat"`
	ViaBot             *User                   `json:"via_bot"`
	MediaGroupID       string                  `json:"media_group_id,omitempty"`
	AuthorSignature    string                  `json:"author_signature,omitempty"`
	ReplyMarkup        json.RawMessage         `json:"reply_markup,omitempty"`
	SuccessfulPayment  *SuccessfulPayment      `json:"successful_payment"`
	NewChatMembers     []User                  `json:"new_chat_members"`
	LeftChatMember     *User                   `json:"left_chat_member"`
	IsAutomaticForward bool                    `json:"is_automatic_forward,omitempty"`
	SenderChat         *Chat                   `json:"sender_chat,omitempty"`
	ReceiverUser       *User                   `json:"receiver_user,omitempty"`
	EphemeralMessageID telegram.FlexibleString `json:"ephemeral_message_id,omitempty"`
}

type MessageEntity struct {
	Type   string `json:"type"`
	Offset int    `json:"offset"`
	Length int    `json:"length"`
	URL    string `json:"url,omitempty"`
}

type BotPermissions struct {
	Status             string `json:"status"`
	CanDeleteMessages  bool   `json:"can_delete_messages"`
	CanRestrictMembers bool   `json:"can_restrict_members"`
	CanPromoteMembers  bool   `json:"can_promote_members"`
	CanChangeInfo      bool   `json:"can_change_info"`
	CanInviteUsers     bool   `json:"can_invite_users"`
	CanPinMessages     bool   `json:"can_pin_messages"`
}

type User struct {
	ID           int64  `json:"id"`
	IsBot        bool   `json:"is_bot"`
	FirstName    string `json:"first_name"`
	Username     string `json:"username,omitempty"`
	LanguageCode string `json:"language_code,omitempty"`
	IsPremium    bool   `json:"is_premium,omitempty"`
}

type SuccessfulPayment struct {
	Currency                string `json:"currency"`
	TotalAmount             int    `json:"total_amount"`
	InvoicePayload          string `json:"invoice_payload"`
	TelegramPaymentChargeID string `json:"telegram_payment_charge_id"`
}

type InlineKeyboardButton struct {
	Text         string `json:"text"`
	URL          string `json:"url,omitempty"`
	CallbackData string `json:"callback_data,omitempty"`
	Style        string `json:"style,omitempty"`
}

type InlineKeyboardMarkup struct {
	InlineKeyboard [][]InlineKeyboardButton `json:"inline_keyboard"`
}
