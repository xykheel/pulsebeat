CREATE TABLE IF NOT EXISTS maintenance_windows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  monitor_id INTEGER REFERENCES monitors(id) ON DELETE CASCADE,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  recurring INTEGER NOT NULL DEFAULT 0,
  cron_expression TEXT,
  timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_monitor_id ON maintenance_windows(monitor_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_starts_at ON maintenance_windows(starts_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_ends_at ON maintenance_windows(ends_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_active_time ON maintenance_windows(active, starts_at, ends_at);
