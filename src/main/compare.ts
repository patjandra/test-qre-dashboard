import type { Run, ComparisonResult, ComparisonMetric, FrontierPoint } from '../shared/types'
import { PRIMARY_METRICS } from '../shared/types'

/** Returns the representative frontier point chosen for a run. */
export function chosenPoint(run: Run): FrontierPoint | null {
  const { frontier, chosenIndex } = run.outputs
  if (chosenIndex < 0 || chosenIndex >= frontier.length) return null
  return frontier[chosenIndex]
}

/**
 * Builds a metric-by-metric comparison across runs. Deltas are percentages
 * relative to the first run in the list (null for the baseline itself or when
 * the baseline value is zero).
 */
export function compareRuns(runs: Run[]): ComparisonResult {
  const points = runs.map(chosenPoint)

  const metrics: ComparisonMetric[] = PRIMARY_METRICS.map((def) => {
    const values = points.map((p) => {
      const v = p ? (p[def.key as keyof FrontierPoint] as number | undefined) : undefined
      return typeof v === 'number' ? v : 0
    })
    const base = values[0]
    const deltasPct = values.map((v, i) => {
      if (i === 0) return null
      if (!base) return null
      return Number((((v - base) / base) * 100).toFixed(2))
    })
    return { name: def.label, values, deltasPct }
  })

  return { runIds: runs.map((r) => r.id), metrics }
}
