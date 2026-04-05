CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1'
);

CREATE TABLE IF NOT EXISTS monitor_tags (
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (monitor_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_monitor_tags_tag_id ON monitor_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_monitor_tags_monitor_id ON monitor_tags(monitor_id);
