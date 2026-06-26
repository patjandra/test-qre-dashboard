import { join } from 'path'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { app } from 'electron'
import type { Benchmark, ApplicationLang } from '../../shared/types'
import { upsertBenchmark } from '../db/benchmarks'

interface BenchmarkMeta {
  id: string
  name: string
  entry: string
  lang?: ApplicationLang
  description?: string
}

function benchmarksRoot(): string {
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath()
  return join(base, 'resources', 'benchmarks')
}

/**
 * Scans the bundled benchmarks directory and syncs each folder (metadata.json +
 * entry program) into the benchmarks table. Returns the number loaded.
 */
export function syncBenchmarks(): number {
  const root = benchmarksRoot()
  if (!existsSync(root)) return 0

  let count = 0
  for (const name of readdirSync(root)) {
    const dir = join(root, name)
    if (!statSync(dir).isDirectory()) continue
    const metaPath = join(dir, 'metadata.json')
    if (!existsSync(metaPath)) continue

    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as BenchmarkMeta
      const entryPath = join(dir, meta.entry)
      if (!existsSync(entryPath)) continue
      const benchmark: Benchmark = {
        id: meta.id,
        name: meta.name,
        path: entryPath,
        lang: meta.lang ?? 'qsharp',
        metadata: { description: meta.description ?? '' }
      }
      upsertBenchmark(benchmark)
      count++
    } catch {
      // Skip malformed benchmark folders rather than failing startup.
    }
  }
  return count
}
