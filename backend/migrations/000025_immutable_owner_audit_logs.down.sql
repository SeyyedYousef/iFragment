-- 1. Revert nullable constraint (warning: this will fail if there are automated system records in the DB with NULL owner_id)
ALTER TABLE owner_audit_logs ALTER COLUMN owner_id SET NOT NULL;

-- 2. Drop the append-only mutation triggers
DROP TRIGGER IF EXISTS no_update_audit ON owner_audit_logs;
DROP TRIGGER IF EXISTS no_delete_audit ON owner_audit_logs;
DROP FUNCTION IF EXISTS prevent_audit_mutation();
