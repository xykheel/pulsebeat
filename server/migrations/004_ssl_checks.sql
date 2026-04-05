CREATE TABLE IF NOT EXISTS ssl_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at INTEGER NOT NULL,
  status INTEGER NOT NULL DEFAULT 1,
  days_remaining INTEGER,
  subject_cn TEXT,
  subject_alt_names TEXT,
  serial_number TEXT,
  sha256_fingerprint TEXT,
  tls_version TEXT,
  cipher_suite TEXT,
  chain_fully_trusted INTEGER,
  self_signed INTEGER,
  valid_from INTEGER,
  valid_to INTEGER,
  message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ssl_checks_monitor_checked ON ssl_checks(monitor_id, checked_at DESC);
