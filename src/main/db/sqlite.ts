import { join } from 'path'
import { app } from 'electron'
import Database from 'better-sqlite3'

let db: Database.Database | null = null

/** Opens (once) the SQLite database under the Electron userData dir and runs migrations. */
export function getDb(): Database.Database {
  if (db) return db
  const dir = app.getPath('userData')
  const file = join(dir, 'qre-desktop.db')
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

/** Allows tests to inject an in-memory database. */
export function setDbForTesting(instance: Database.Database): void {
  db = instance
  migrate(db)
}

function migrate(d: Database.Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      timestamp INTEGER NOT NULL,
      inputs TEXT NOT NULL,
      outputs TEXT NOT NULL,
      qre_version TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS benchmarks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      lang TEXT NOT NULL,
      metadata TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS versions (
      version TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0
    );
  `)

  // Add columns introduced after the initial schema, for pre-existing databases.
  addColumnIfMissing(d, 'runs', 'name', "TEXT NOT NULL DEFAULT ''")
}

function addColumnIfMissing(
  d: Database.Database,
  table: string,
  column: string,
  decl: string
): void {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!cols.some((c) => c.name === column)) {
    d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`)
  }
}
