package main

import (
	"context"
	"fmt"
	"ifragment-backend/internal/client/fragment"
)

func main() {
	client := fragment.NewClient()
	sales, err := client.GetHistoricalSales(context.Background(), "thecrypto")
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	fmt.Printf("Sales for thecrypto: %+v\n", sales)
}
