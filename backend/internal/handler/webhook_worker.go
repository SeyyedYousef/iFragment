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

// Central Worker Pool configuration for asynchronous webhook execution
type WebhookJob struct {
	ctx    context.Context
	bot    *repository.ManagedBot
	update *TelegramUpdate
}

var (
	jobQueue   chan WebhookJob
	queueOnce  sync.Once
	maxWorkers = 50 // Handles extremely high concurrent webhook updates
)

func initWorkerPool(db *repository.Database, mod *botmgmt.ModeratorService, botRepo *repository.BotRepo, chanServ *channelmgmt.ChannelService) {
	queueOnce.Do(func() {
		jobQueue = make(chan WebhookJob, 10000)
		handler := NewWebhookHandler(db, mod, botRepo, chanServ)
		for i := 0; i < maxWorkers; i++ {
			go func() {
				for job := range jobQueue {
					func() {
						defer func() {
							if r := recover(); r != nil {
								slog.Error("Worker panic recovered during async webhook execution", "panic", r, "stack", string(debug.Stack()))
							}
						}()
						handler.processUpdateAsync(job.ctx, job.bot, job.update)
					}()
				}
			}()
		}
	})
}
