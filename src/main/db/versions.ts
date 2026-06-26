import type { QreVersion } from '../../shared/types'
import { getDb } from './sqlite'

interface VersionRow {
  version: string
  path: string
  active: number
}

export function upsertVersion(v: QreVersion): void {
  getDb()
    .prepare(
      `INSERT INTO versions (version, path, active)
       VALUES (@version, @path, @active)
       ON CONFLICT(version) DO UPDATE SET path = excluded.path`
    )
    .run({ version: v.version, path: v.path, active: v.active ? 1 : 0 })
}

export function getVersions(): QreVersion[] {
  const rows = getDb()
    .prepare('SELECT * FROM versions ORDER BY version ASC')
    .all() as VersionRow[]
  return rows.map((r) => ({ version: r.version, path: r.path, active: !!r.active }))
}

export function getActiveVersion(): QreVersion | null {
  const row = getDb()
    .prepare('SELECT * FROM versions WHERE active = 1 LIMIT 1')
    .get() as VersionRow | undefined
  return row ? { version: row.version, path: row.path, active: true } : null
}

/** Activates one version and deactivates all others (single active version). */
export function setActiveVersion(version: string): void {
  const db = getDb()
  const tx = db.transaction((v: string) => {
    db.prepare('UPDATE versions SET active = 0').run()
    db.prepare('UPDATE versions SET active = 1 WHERE version = ?').run(v)
  })
  tx(version)
}
