BEGIN;

CREATE INDEX IF NOT EXISTS idx_clan_members_clan_id ON clan_members(clan_id);

COMMIT;
