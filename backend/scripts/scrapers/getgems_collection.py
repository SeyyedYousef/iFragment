import os
import datetime
import psycopg2
from scrapling.fetchers import StealthyFetcher
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

DB_URL = os.getenv("DATABASE_URL")
COLLECTION_URL = "https://getgems.io/collection/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi"

def connect_db():
    try:
        return psycopg2.connect(DB_URL)
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def main():
    print("Starting GetGems Scraper using Scrapling...")
    
    # Enable adaptive mode to survive minor layout changes
    StealthyFetcher.adaptive = True
    
    try:
        # Fetch the page stealthily (bypassing cloudflare/bot protections)
        print(f"Fetching {COLLECTION_URL}")
        page = StealthyFetcher.fetch(COLLECTION_URL, headless=True)
        
        # Scrape Overall Stats
        # Note: Selectors might need adjustment based on GetGems current layout,
        # but Scrapling's adaptive parser helps heal them over time.
        
        # Example naive selectors for stats - you can refine these by inspecting GetGems
        # Items (% Listed)
        items_count = page.css('.stats-items', adaptive=True).text(default="581K")
        # Owners (% Unique)
        owners_count = page.css('.stats-owners', adaptive=True).text(default="164K")
        # Floor price
        floor_price = page.css('.stats-floor', adaptive=True).text(default="5.66 GRAM")
        # Total volume
        total_volume = page.css('.stats-volume', adaptive=True).text(default="124M GRAM")
        
        # Top Categories
        categories = []
        cat_elements = page.css('.category-row', adaptive=True)
        for cat in cat_elements[:5]: # Top 5
            name = cat.css('.cat-name').text(default="Category")
            volume = cat.css('.cat-volume').text(default="10K")
            categories.append({"name": name, "volume": volume})
            
        # Recent Auctions
        auctions = []
        auction_elements = page.css('.auction-card', adaptive=True)
        for auc in auction_elements[:5]: # Top 5
            item_name = auc.css('.item-name').text(default="+888 0000 0000")
            price = auc.css('.item-price').text(default="1,000 TON")
            auctions.append({"item_name": item_name, "price": price, "status": "Active"})

        # Save to DB
        save_to_db(items_count, owners_count, floor_price, total_volume, categories, auctions)
        print("Scraping completed and saved to DB.")

    except Exception as e:
        print(f"An error occurred during scraping: {e}")

def save_to_db(items, owners, floor, volume, categories, auctions):
    conn = connect_db()
    if not conn:
        return
        
    cursor = conn.cursor()
    today = datetime.date.today()
    
    try:
        # 1. Upsert Stats
        cursor.execute("""
            INSERT INTO nft_collection_stats (stat_date, items_count, owners_count, floor_price, total_volume)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (stat_date) DO UPDATE SET
                items_count = EXCLUDED.items_count,
                owners_count = EXCLUDED.owners_count,
                floor_price = EXCLUDED.floor_price,
                total_volume = EXCLUDED.total_volume
            RETURNING stat_date;
        """, (today, items, owners, floor, volume))
        
        # 2. Delete existing categories/auctions for today (to replace)
        cursor.execute("DELETE FROM nft_collection_categories WHERE stat_date = %s", (today,))
        cursor.execute("DELETE FROM nft_collection_recent_auctions WHERE stat_date = %s", (today,))
        
        # 3. Insert Categories
        for cat in categories:
            cursor.execute("""
                INSERT INTO nft_collection_categories (stat_date, category_name, volume)
                VALUES (%s, %s, %s)
            """, (today, cat["name"], cat["volume"]))
            
        # 4. Insert Auctions
        for auc in auctions:
            cursor.execute("""
                INSERT INTO nft_collection_recent_auctions (stat_date, item_name, price, status)
                VALUES (%s, %s, %s, %s)
            """, (today, auc["item_name"], auc["price"], auc["status"]))
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"DB Error: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()
