import type { Benchmark } from '../../shared/types'
import { getDb } from './sqlite'

interface BenchmarkRow {
  id: string
  name: string
  path: string
  lang: string
  metadata: string
}

function rowToBenchmark(row: BenchmarkRow): Benchmark {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    lang: row.lang as Benchmark['lang'],
    metadata: JSON.parse(row.metadata) as Record<string, unknown>
  }
}

export function upsertBenchmark(b: Benchmark): void {
  getDb()
    .prepare(
      `INSERT INTO benchmarks (id, name, path, lang, metadata)
       VALUES (@id, @name, @path, @lang, @metadata)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         path = excluded.path,
         lang = excluded.lang,
         metadata = excluded.metadata`
    )
    .run({
      id: b.id,
      name: b.name,
      path: b.path,
      lang: b.lang,
      metadata: JSON.stringify(b.metadata)
    })
}

export function getBenchmarks(): Benchmark[] {
  const rows = getDb()
    .prepare('SELECT * FROM benchmarks ORDER BY name ASC')
    .all() as BenchmarkRow[]
  return rows.map(rowToBenchmark)
}

export function getBenchmark(id: string): Benchmark | null {
  const row = getDb().prepare('SELECT * FROM benchmarks WHERE id = ?').get(id) as
    | BenchmarkRow
    | undefined
  return row ? rowToBenchmark(row) : null
}
