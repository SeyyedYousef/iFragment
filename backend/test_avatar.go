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
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	ctx := context.Background()

	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer conn.Close(ctx)

	fmt.Println("Connected to DB successfully.")

	// Query all tables in public schema
	rows, err := conn.Query(ctx, `
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = 'public' 
		ORDER BY table_name
	`)
	if err != nil {
		log.Fatalf("Querying tables failed: %v\n", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			log.Fatalf("Scan failed: %v\n", err)
		}
		tables = append(tables, name)
	}

	fmt.Printf("Found %d tables in public schema:\n", len(tables))
	for _, table := range tables {
		var count int64
		err := conn.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", table)).Scan(&count)
		if err != nil {
			fmt.Printf("  - %s: error counting rows: %v\n", table, err)
		} else {
			fmt.Printf("  - %s: %d rows\n", table, count)
		}
	}
}
