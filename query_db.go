package main

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	ctx := context.Background()
	connStr := "postgresql://neondb_owner:npg_lsVPQM15maSr@ep-billowing-dawn-alw7qbvy.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
	
	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer pool.Close()

	rows, err := pool.Query(ctx, "SELECT user_id, xp FROM user_stats ORDER BY xp DESC LIMIT 10")
	if err != nil {
		log.Fatalf("Query failed: %v\n", err)
	}
	defer rows.Close()

	for rows.Next() {
		var userID int64
		var xp int
		err = rows.Scan(&userID, &xp)
		if err != nil {
			log.Fatalf("Scan failed: %v\n", err)
		}
		fmt.Printf("UserID: %d, XP: %d\n", userID, xp)
	}
}
