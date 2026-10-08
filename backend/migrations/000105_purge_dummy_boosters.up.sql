-- Migration 000105: Purge dummy screenshot boosters and ensure only real Telegram users exist in fragment_investors_user_stats
DELETE FROM fragment_investors_user_stats WHERE user_id >= 888000000;
