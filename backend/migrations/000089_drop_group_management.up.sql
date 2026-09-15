-- 000089_drop_group_management.up.sql
-- Drop all Group Management tables, constraints, partitions, and related tables safely.

DROP TABLE IF EXISTS group_dynamic_bio_snapshots CASCADE;
DROP TABLE IF EXISTS group_dynamic_bio_templates CASCADE;
DROP TABLE IF EXISTS group_member_tags CASCADE;
DROP TABLE IF EXISTS group_tag_rules CASCADE;
DROP TABLE IF EXISTS group_warnings CASCADE;
DROP TABLE IF EXISTS group_events CASCADE;
DROP TABLE IF EXISTS group_settings CASCADE;
DROP TABLE IF EXISTS billing_subscriptions CASCADE;
DROP TABLE IF EXISTS managed_groups CASCADE;
