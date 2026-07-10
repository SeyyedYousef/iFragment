package main

import (
	"context"
	"fmt"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username/avm"
	"log"
	"math"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load("../.env")
	if os.Getenv("DATABASE_URL") == "" {
		log.Fatal("DATABASE_URL must be set")
	}

	ctx := context.Background()
	db, err := repository.NewDatabase(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to db: %v", err)
	}
	defer db.Close()

	service := avm.NewValuationService(db, nil)

	testNames := []string{
		"rare",
		"cats",
		"dog",
		"news",
		"auto",
		"delicious",
		"information",
		"ali123",
		"good_boy",
		"xkqwz",
		"telegram",
		"wallet",
	}

	fmt.Printf("%-15s | %-12s | %-12s | %-25s\n", "Username", "Expected TON", "Base Price", "Semantic Boost Source")
	fmt.Println("---------------------------------------------------------------------------------------")
	for _, name := range testNames {
		res, err := service.Valuate(ctx, name, 2.3)
		if err != nil {
			fmt.Printf("%-15s | Error: %v\n", name, err)
			continue
		}
		
		boost := res.ReasoningLog["semantic_base_boost"]
		if boost == nil {
			boost = "none"
		}
		
		fmt.Printf("%-15s | %-12.2f | %-12.2f | %-25v\n", 
			name, 
			res.ExpectedTON, 
			math.Exp(res.ReasoningLog["base_log"].(float64)),
			boost,
		)
	}
}
