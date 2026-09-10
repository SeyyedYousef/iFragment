package handler

import (
	"context"
	"log/slog"
	"runtime/debug"
	"sync"

	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
	"ifragment-backend/internal/service/channelmgmt"
)

const numShards = 32

// WebhookJob encapsulates a Telegram update to be processed asynchronously.
type WebhookJob struct {
	ctx    context.Context
	bot    *repository.ManagedBot
	update *TelegramUpdate
	chatID int64
}

var (
	shards    [numShards]chan WebhookJob
	queueOnce sync.Once
)

// initWorkerPool starts 32 dedicated shard workers.
// All updates belonging to the same chatID are hashed to the exact same shard channel,
// guaranteeing strict per-chat sequential FIFO processing while allowing 32 independent chats
// to execute in parallel concurrently.
func initWorkerPool(db *repository.Database, mod *botmgmt.ModeratorService, botRepo *repository.BotRepo, chanServ *channelmgmt.ChannelService) {
	queueOnce.Do(func() {
		handler := NewWebhookHandler(db, mod, botRepo, chanServ)
		for i := 0; i < numShards; i++ {
			shards[i] = make(chan WebhookJob, 1024)
			shardChan := shards[i]
			go func(ch chan WebhookJob, shardID int) {
				for job := range ch {
					func() {
						defer func() {
							if r := recover(); r != nil {
								slog.Error("Worker panic recovered during async webhook execution", "shard", shardID, "panic", r, "stack", string(debug.Stack()))
							}
						}()
						handler.processUpdateAsync(job.ctx, job.bot, job.update)
					}()
				}
			}(shardChan, i)
		}
	})
}

// extractChatIDFromUpdate extracts the target chat identifier across all Telegram update variants.
func extractChatIDFromUpdate(update *TelegramUpdate) int64 {
	if update == nil {
		return 0
	}
	if update.Message != nil && update.Message.Chat != nil {
		return update.Message.Chat.ID
	}
	if update.EditedMessage != nil && update.EditedMessage.Chat != nil {
		return update.EditedMessage.Chat.ID
	}
	if update.ChannelPost != nil && update.ChannelPost.Chat != nil {
		return update.ChannelPost.Chat.ID
	}
	if update.EditedChannelPost != nil && update.EditedChannelPost.Chat != nil {
		return update.EditedChannelPost.Chat.ID
	}
	if update.CallbackQuery != nil && update.CallbackQuery.Message != nil && update.CallbackQuery.Message.Chat != nil {
		return update.CallbackQuery.Message.Chat.ID
	}
	if update.MyChatMember != nil && update.MyChatMember.Chat.ID != 0 {
		return update.MyChatMember.Chat.ID
	}
	if update.ChatMember != nil && update.ChatMember.Chat.ID != 0 {
		return update.ChatMember.Chat.ID
	}
	if update.ChatJoinRequest != nil && update.ChatJoinRequest.Chat.ID != 0 {
		return update.ChatJoinRequest.Chat.ID
	}
	return 0
}

func getShardIndex(chatID int64, updateID int) int {
	if chatID != 0 {
		hash := chatID
		if hash < 0 {
			hash = -hash
		}
		return int(hash % int64(numShards))
	}
	if updateID < 0 {
		updateID = -updateID
	}
	return updateID % numShards
}

// EnqueueWebhookJob routes the job to the appropriate per-chat shard channel.
func EnqueueWebhookJob(job WebhookJob) bool {
	idx := getShardIndex(job.chatID, job.update.UpdateID)
	select {
	case shards[idx] <- job:
		return true
	default:
		slog.Error("CRITICAL: Shard job queue full! Webhook dropped.", "shard", idx, "chat_id", job.chatID)
		return false
	}
}
