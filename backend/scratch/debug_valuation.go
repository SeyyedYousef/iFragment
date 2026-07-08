package main

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username/avm"
	"log"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load(".env")
	if os.Getenv("DATABASE_URL") == "" {
		log.Fatal("DATABASE_URL must be set")
	}

	ctx := context.Background()
	db, err := repository.NewDatabase(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to db: %v", err)
	}
	defer db.Close()

	cacheService, _ := repository.NewCache(ctx)
	tonClient := tonapi.NewClient()
	svc := avm.NewValuationService(db, cacheService, tonClient)

	for _, username := range []string{"news", "rare", "ruby"} {
		fmt.Printf("\n=== Debugging @%s ===\n", username)
		res, err := svc.Valuate(ctx, username, 0.0)
		if err != nil {
			log.Printf("Failed to valuate %s: %v", username, err)
			continue
		}

		expected, _ := res.ExpectedTON.Float64()
		fmt.Printf("Expected Price: %v TON\n", expected)
		
		reasoningBytes, _ := json.MarshalIndent(res.ReasoningLog, "", "  ")
		fmt.Println("Reasoning Log:")
		fmt.Println(string(reasoningBytes))
	}
}
