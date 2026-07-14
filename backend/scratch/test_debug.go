//go:build ignore

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

	testNames := []string{"binance", "lambo", "Rare", "Cats"}

	for _, name := range testNames {
		res, err := svc.Valuate(ctx, name, 2.3)
		if err != nil {
			log.Fatalf("Failed to valuate %s: %v", name, err)
		}

		expected, _ := res.ExpectedTON.Float64()
		fmt.Printf("\n=========================================\n")
		fmt.Printf("Username: @%s\n", name)
		fmt.Printf("Expected Price: %.0f TON\n", expected)
		
		resBytes, _ := json.MarshalIndent(res, "", "  ")
		fmt.Println("Full Result JSON:")
		fmt.Println(string(resBytes))
	}
}
