import type { RunInputs, RunOutputs, EngineKind } from '../../shared/types'

/**
 * Abstraction over a QRE execution backend. Implementations must be pluggable so
 * the app can run against the real qdk.qre Python module or a deterministic mock.
 */
export interface QreEngine {
  readonly kind: EngineKind
  /** Version string reported for runs executed by this engine. */
  version(): string
  /** Executes an estimation and returns the normalized Pareto frontier. */
  run(input: RunInputs): Promise<RunOutputs>
}

/** Picks the representative frontier point: the one with the fewest physical qubits. */
export function chooseFrontierIndex(frontier: RunOutputs['frontier']): number {
  if (frontier.length === 0) return -1
  let best = 0
  for (let i = 1; i < frontier.length; i++) {
    if (frontier[i].physicalQubits < frontier[best].physicalQubits) best = i
  }
  return best
}
