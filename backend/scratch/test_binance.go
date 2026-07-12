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

	res, err := svc.Valuate(ctx, "binance", 2.3)
	if err != nil {
		log.Fatalf("Failed to valuate binance: %v", err)
	}

	expected, _ := res.ExpectedTON.Float64()
	fmt.Printf("Expected Price: %.0f TON\n", expected)
	
	reasoningBytes, _ := json.MarshalIndent(res.ReasoningLog, "", "  ")
	fmt.Println("Reasoning Log:")
	fmt.Println(string(reasoningBytes))
}
