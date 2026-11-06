import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function openDatabase(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  try {
    for (const [version, filename] of [[1, "001-initial.sql"], [2, "002-briefmint.sql"], [3, "003-briefmint-evidence.sql"]] as const) {
      transaction(db, () => {
        if (db.prepare("SELECT version FROM schema_migrations WHERE version=?").get(version)) return;
        db.exec(readFileSync(resolve(process.cwd(), `src/lib/server/migrations/${filename}`), "utf8"));
        db.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(version, new Date().toISOString());
      });
    }
  } catch (error) { db.close(); throw error; }
  return db;
}
export type Database = ReturnType<typeof openDatabase>;
export function transaction<T>(db: Database, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const value = operation(); db.exec("COMMIT"); return value; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
