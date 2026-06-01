-- 1. Make owner_id nullable so automated system actions (Honeypot, etc.) can write logs
ALTER TABLE owner_audit_logs ALTER COLUMN owner_id DROP NOT NULL;

-- 2. Prevent any UPDATES or DELETES on the owner_audit_logs table to achieve absolute append-only audit immutability
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'owner_audit_logs is append-only and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_audit BEFORE UPDATE ON owner_audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE TRIGGER no_delete_audit BEFORE DELETE ON owner_audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
