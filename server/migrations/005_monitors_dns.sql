PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE monitors_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('http','tcp','ping','dns')),
  url TEXT NOT NULL,
  interval_sec INTEGER NOT NULL DEFAULT 60,
  timeout_ms INTEGER NOT NULL DEFAULT 10000,
  retries INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  check_ssl INTEGER NOT NULL DEFAULT 0,
  dns_config TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO monitors_new (id, name, type, url, interval_sec, timeout_ms, retries, active, check_ssl, dns_config)
SELECT id, name, type, url, interval_sec, timeout_ms, retries, active, COALESCE(check_ssl, 0), '{}'
FROM monitors;
DROP TABLE monitors;
ALTER TABLE monitors_new RENAME TO monitors;
COMMIT;
PRAGMA foreign_keys=ON;
