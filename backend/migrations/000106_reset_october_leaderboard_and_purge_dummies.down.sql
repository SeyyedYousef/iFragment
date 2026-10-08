-- Migration 000106 down: Keep message log table or drop cleanly
DROP TABLE IF EXISTS fragment_investors_messages;
