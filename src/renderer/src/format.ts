import type { Run, FrontierPoint } from '@shared/types'

/** Human-friendly number formatting shared by the UI tables and panels. */
export function fmtNum(v: number | string | undefined): string {
  if (v === undefined || v === null) return '—'
  if (typeof v === 'string') return v
  if (!isFinite(v)) return String(v)
  const abs = Math.abs(v)
  if (abs !== 0 && (abs >= 1e9 || abs < 1e-3)) return v.toExponential(3)
  return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(4)
}

/** Compact runtime rendering from nanoseconds. */
export function fmtDuration(ns: number): string {
  if (!isFinite(ns) || ns <= 0) return '—'
  const units: [number, string][] = [
    [1e9 * 60 * 60, 'h'],
    [1e9 * 60, 'min'],
    [1e9, 's'],
    [1e6, 'ms'],
    [1e3, 'µs'],
    [1, 'ns']
  ]
  for (const [scale, label] of units) {
    if (ns >= scale) return `${(ns / scale).toFixed(2)} ${label}`
  }
  return `${ns} ns`
}

export function fmtTimestamp(ts: number): string {
  return new Date(ts).toLocaleString()
}

export function chosenPoint(run: Run): FrontierPoint | null {
  const { frontier, chosenIndex } = run.outputs
  if (chosenIndex < 0 || chosenIndex >= frontier.length) return null
  return frontier[chosenIndex]
}

export function benchmarkName(run: Run, benchmarks: { id: string; name: string }[]): string {
  if (run.inputs.benchmarkId) {
    return benchmarks.find((b) => b.id === run.inputs.benchmarkId)?.name ?? run.inputs.benchmarkId
  }
  return 'Imported program'
}

export function runLabel(index: number): string {
  return `Run ${String.fromCharCode(65 + index)}`
}
