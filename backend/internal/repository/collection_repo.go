package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

type CollectionStats struct {
	StatDate    time.Time `json:"stat_date"`
	ItemsCount  string    `json:"items_count"`
	OwnersCount string    `json:"owners_count"`
	FloorPrice  string    `json:"floor_price"`
	TotalVolume string    `json:"total_volume"`
}

type CollectionCategory struct {
	CategoryName string `json:"category_name"`
	Volume       string `json:"volume"`
}

type CollectionAuction struct {
	ItemName string `json:"item_name"`
	Price    string `json:"price"`
	Status   string `json:"status"`
}

type CollectionData struct {
	Stats      *CollectionStats     `json:"stats"`
	Categories []CollectionCategory `json:"categories"`
	Auctions   []CollectionAuction  `json:"auctions"`
}

type CollectionRepo struct {
	db *Database
}

func NewCollectionRepo(db *Database) *CollectionRepo {
	return &CollectionRepo{db: db}
}

func (r *CollectionRepo) GetLatestCollectionData(ctx context.Context) (*CollectionData, error) {
	statsQuery := `
		SELECT stat_date, items_count, owners_count, floor_price, total_volume
		FROM nft_collection_stats
		ORDER BY stat_date DESC
		LIMIT 1
	`
	var stats CollectionStats
	err := r.db.Pool.QueryRow(ctx, statsQuery).Scan(
		&stats.StatDate,
		&stats.ItemsCount,
		&stats.OwnersCount,
		&stats.FloorPrice,
		&stats.TotalVolume,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No data yet
		}
		return nil, err
	}

	data := &CollectionData{
		Stats:      &stats,
		Categories: []CollectionCategory{},
		Auctions:   []CollectionAuction{},
	}

	catQuery := `
		SELECT category_name, volume
		FROM nft_collection_categories
		WHERE stat_date = $1
		ORDER BY volume DESC
	`
	rows, err := r.db.Pool.Query(ctx, catQuery, stats.StatDate)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var cat CollectionCategory
			if err := rows.Scan(&cat.CategoryName, &cat.Volume); err == nil {
				data.Categories = append(data.Categories, cat)
			}
		}
	}

	aucQuery := `
		SELECT item_name, price, status
		FROM nft_collection_recent_auctions
		WHERE stat_date = $1
	`
	aucRows, err := r.db.Pool.Query(ctx, aucQuery, stats.StatDate)
	if err == nil {
		defer aucRows.Close()
		for aucRows.Next() {
			var auc CollectionAuction
			if err := aucRows.Scan(&auc.ItemName, &auc.Price, &auc.Status); err == nil {
				data.Auctions = append(data.Auctions, auc)
			}
		}
	}

	return data, nil
}
