package handler

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"
	"sync"

	"ifragment-backend/internal/repository"
)

const numShards = 32

// WebhookJob encapsulates a Telegram update to be processed asynchronously.
type WebhookJob struct {
	ctx     context.Context
	handler *WebhookHandler
	bot     *repository.ManagedBot
	update  *TelegramUpdate
	chatID  int64
}

var (
	shards    [numShards]chan WebhookJob
	queueOnce sync.Once
)

// initWorkerPool starts 32 dedicated shard workers.
// All updates belonging to the same chatID are hashed to the exact same shard channel,
// guaranteeing strict per-chat sequential FIFO processing while allowing 32 independent chats
// to execute in parallel concurrently.
func initWorkerPool(defaultHandler *WebhookHandler) {
	queueOnce.Do(func() {
		for i := 0; i < numShards; i++ {
			shards[i] = make(chan WebhookJob, 1024)
			shardChan := shards[i]
			go func(ch chan WebhookJob, shardID int) {
				for job := range ch {
					func() {
						var updateID int
						if job.update != nil {
							updateID = job.update.UpdateID
						}
						activeHandler := job.handler
						if activeHandler == nil {
							activeHandler = defaultHandler
						}
						defer func() {
							if r := recover(); r != nil {
								slog.Error("Worker panic recovered during async webhook execution", "shard", shardID, "panic", r, "stack", string(debug.Stack()))
								if activeHandler != nil && activeHandler.webhookInbox != nil && job.bot != nil && updateID != 0 {
									_ = activeHandler.webhookInbox.MarkFailedOrDLQ(context.Background(), job.bot.ID, int64(updateID), fmt.Sprintf("panic: %v", r))
								}
							}
						}()
						if activeHandler != nil {
							activeHandler.processUpdateAsync(job.ctx, job.bot, job.update)
						}
					}()
				}
			}(shardChan, i)
		}
	})
}

// extractChatIDFromUpdate extracts the target chat or user identifier across all Telegram update variants.
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
	if update.CallbackQuery != nil {
		if update.CallbackQuery.Message != nil && update.CallbackQuery.Message.Chat != nil {
			return update.CallbackQuery.Message.Chat.ID
		}
		if update.CallbackQuery.From.ID != 0 {
			return update.CallbackQuery.From.ID
		}
	}
	if update.InlineQuery != nil && update.InlineQuery.From.ID != 0 {
		return update.InlineQuery.From.ID
	}
	if update.ChosenInlineResult != nil && update.ChosenInlineResult.From.ID != 0 {
		return update.ChosenInlineResult.From.ID
	}
	if update.ChatBoost != nil && update.ChatBoost.Chat.ID != 0 {
		return update.ChatBoost.Chat.ID
	}
	if update.RemovedChatBoost != nil && update.RemovedChatBoost.Chat.ID != 0 {
		return update.RemovedChatBoost.Chat.ID
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

// getShardIndex computes a non-negative shard index [0, numShards) using overflow-safe unsigned arithmetic.
func getShardIndex(chatID int64, updateID int) int {
	if chatID != 0 {
		var u uint64
		if chatID < 0 {
			u = uint64(^chatID) + 1
		} else {
			u = uint64(chatID)
		}
		return int(u % uint64(numShards))
	}
	var u uint64
	if updateID < 0 {
		u = uint64(^int64(updateID)) + 1
	} else {
		u = uint64(updateID)
	}
	return int(u % uint64(numShards))
}

// EnqueueWebhookJob routes the job to the appropriate per-chat shard channel.
func EnqueueWebhookJob(job WebhookJob) bool {
	var updateID int
	if job.update != nil {
		updateID = job.update.UpdateID
	}
	idx := getShardIndex(job.chatID, updateID)
	select {
	case shards[idx] <- job:
		return true
	default:
		slog.Error("CRITICAL: Shard job queue full! Webhook dropped.", "shard", idx, "chat_id", job.chatID)
		return false
	}
}

// GetShardQueueLengths returns the current buffer length for each of the 32 shards.
func GetShardQueueLengths() []int {
	lengths := make([]int, numShards)
	for i := 0; i < numShards; i++ {
		if shards[i] != nil {
			lengths[i] = len(shards[i])
		}
	}
	return lengths
}

// GetTotalShardQueueLength returns the sum of pending jobs across all 32 shards.
func GetTotalShardQueueLength() int {
	total := 0
	for i := 0; i < numShards; i++ {
		if shards[i] != nil {
			total += len(shards[i])
		}
	}
	return total
}
