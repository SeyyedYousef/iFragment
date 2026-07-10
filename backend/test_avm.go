package main

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/service/username/avm"
	"log"
)

func main() {
	res, err := avm.Valuation(context.Background(), "cars")
	if err != nil {
		log.Fatalf("Error: %v", err)
	}
	out, _ := json.MarshalIndent(res, "", "  ")
	fmt.Println(string(out))
}
