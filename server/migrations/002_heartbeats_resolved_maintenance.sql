ALTER TABLE heartbeats ADD COLUMN resolved_value TEXT;
ALTER TABLE heartbeats ADD COLUMN maintenance INTEGER NOT NULL DEFAULT 0;
