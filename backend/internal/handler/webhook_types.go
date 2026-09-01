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

	// ── Bot API 9.4+ / 10.x new-era updates (added 2026-08-25) ──
	// Managed bot lifecycle (Bot API 9.6): fired on this manager bot when a
	// user creates/rotates a managed bot through us.
	ManagedBotUpdated *ManagedBotUpdated `json:"managed_bot_updated,omitempty"`
	// Bot subscription changes (Bot API 10.2): a user's paid subscription to
	// this bot started/stopped/renewed.
	BotSubscriptionUpdated *BotSubscriptionUpdated `json:"bot_subscription_updated,omitempty"`
	// Guest mode (Bot API 10.0): mention in a chat where the bot is not a member.
	GuestMessage *GuestMessageUpdate `json:"guest_message,omitempty"`
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
	// Bot API 9.5: short member tag shown next to the name.
	Tag *string `json:"tag,omitempty"`
}

// ── New-era update payload types (Bot API 9.4 → 10.3) ──

// ManagedBotUpdated (Bot API 9.6): a managed bot owned through this manager
// bot was created or had its token rotated.
type ManagedBotUpdated struct {
	ManagedBot ManagedBotInfo `json:"managed_bot"`
	Date       int            `json:"date,omitempty"`
}

type ManagedBotInfo struct {
	ID       int64  `json:"id"`
	IsBot    bool   `json:"is_bot"`
	Username string `json:"username,omitempty"`
	FirstName string `json:"first_name,omitempty"`
}

// BotSubscriptionUpdated (Bot API 10.2): the user's paid subscription to this
// bot started, renewed, or expired.
type BotSubscriptionUpdated struct {
	Subscription BotSubscription `json:"subscription"`
}

type BotSubscription struct {
	UserID          int64  `json:"user_id,omitempty"`
	PeriodEndDate   int    `json:"period_end_date,omitempty"`
	IsExpired       bool   `json:"is_expired,omitempty"`
	IsRenewal       bool   `json:"is_renewal,omitempty"`
	IsCanceled      bool   `json:"is_canceled,omitempty"`
}

// GuestMessageUpdate (Bot API 10.0): the bot was mentioned in a chat it is
// not a member of; answer via answerGuestQuery.
type GuestMessageUpdate struct {
	GuestQueryID string  `json:"guest_query_id"`
	From         User    `json:"from"`
	Message      Message `json:"message"`
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
	IsTopicMessage     bool                    `json:"is_topic_message,omitempty"`
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
	ExternalReply      *ExternalReplyInfo      `json:"external_reply,omitempty"`
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
	MigrateToChatID    *int64                  `json:"migrate_to_chat_id,omitempty"`
	MigrateFromChatID  *int64                  `json:"migrate_from_chat_id,omitempty"`
}

type ExternalReplyInfo struct {
	Origin             json.RawMessage `json:"origin,omitempty"`
	Chat               *Chat           `json:"chat,omitempty"`
	MessageID          *int            `json:"message_id,omitempty"`
	LinkPreviewOptions json.RawMessage `json:"link_preview_options,omitempty"`
}

type MessageEntity struct {
	Type   string `json:"type"`
	Offset int    `json:"offset"`
	Length int    `json:"length"`
	URL    string `json:"url,omitempty"`
	User   *User  `json:"user,omitempty"`
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
