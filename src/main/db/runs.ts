import { randomUUID } from 'crypto'
import type { Run, RunInputs, RunOutputs } from '../../shared/types'
import { getDb } from './sqlite'

interface RunRow {
  id: string
  name: string
  timestamp: number
  inputs: string
  outputs: string
  qre_version: string
}

function rowToRun(row: RunRow): Run {
  return {
    id: row.id,
    name: row.name ?? '',
    timestamp: row.timestamp,
    inputs: JSON.parse(row.inputs) as RunInputs,
    outputs: JSON.parse(row.outputs) as RunOutputs,
    qreVersion: row.qre_version
  }
}

/**
 * Persists a new immutable run. Runs are never updated — duplication creates a
 * brand new record (see duplicateRun in the IPC layer).
 */
export function createRun(inputs: RunInputs, outputs: RunOutputs, name: string): Run {
  const run: Run = {
    id: randomUUID(),
    name,
    timestamp: Date.now(),
    inputs,
    outputs,
    qreVersion: inputs.qreVersion
  }
  getDb()
    .prepare(
      'INSERT INTO runs (id, name, timestamp, inputs, outputs, qre_version) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      run.id,
      run.name,
      run.timestamp,
      JSON.stringify(run.inputs),
      JSON.stringify(run.outputs),
      run.qreVersion
    )
  return run
}

export function getRuns(): Run[] {
  const rows = getDb()
    .prepare('SELECT * FROM runs ORDER BY timestamp DESC')
    .all() as RunRow[]
  return rows.map(rowToRun)
}

export function getRun(id: string): Run | null {
  const row = getDb().prepare('SELECT * FROM runs WHERE id = ?').get(id) as
    | RunRow
    | undefined
  return row ? rowToRun(row) : null
}

export function deleteRun(id: string): void {
  getDb().prepare('DELETE FROM runs WHERE id = ?').run(id)
}
