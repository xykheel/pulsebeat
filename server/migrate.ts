import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.*\.sql$/i.test(f))
    .sort();
  const check = database.prepare('SELECT 1 AS ok FROM schema_migrations WHERE version = ?');
  const mark = database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
  for (const file of files) {
    const version = parseInt(file.slice(0, 3), 10);
    if (!Number.isFinite(version)) continue;
    if (check.get(version)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    database.exec(sql);
    mark.run(version, Date.now());
  }
}
