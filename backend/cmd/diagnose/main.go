package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func main() {
	// First print env var if already set
	fmt.Println("Initial DATABASE_URL:", os.Getenv("DATABASE_URL"))

	_ = godotenv.Load("../../.env")
	_ = godotenv.Load(".env")

	dbURL := os.Getenv("DATABASE_URL")
	fmt.Println("Resolved DATABASE_URL:", dbURL)
	if dbURL == "" {
		log.Fatal("DATABASE_URL is empty")
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer conn.Close(ctx)

	fmt.Println("=== Managed Bots ===")
	rows, err := conn.Query(ctx, "SELECT id, bot_username, bot_id, status FROM managed_bots")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, username, status string
			var botID int64
			if err := rows.Scan(&id, &username, &botID, &status); err == nil {
				fmt.Printf("ID: %s | Username: @%s | BotID: %d | Status: %s\n", id, username, botID, status)
			}
		}
	} else {
		fmt.Printf("Error querying managed_bots: %v\n", err)
	}

	fmt.Println("\n=== Managed Groups ===")
	rows2, err := conn.Query(ctx, "SELECT id, bot_id, chat_id, chat_title, subscription_status FROM managed_groups")
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var id, botID, chatTitle, subStatus string
			var chatID int64
			if err := rows2.Scan(&id, &botID, &chatID, &chatTitle, &subStatus); err == nil {
				fmt.Printf("ID: %s | BotID (UUID): %s | ChatID: %d | Title: %s | Subs: %s\n", id, botID, chatID, chatTitle, subStatus)
			}
		}
	} else {
		fmt.Printf("Error querying managed_groups: %v\n", err)
	}
}
