import type { RunInputs, RunOutputs } from '../../shared/types'

/**
 * Abstraction over the QRE execution backend (the real qdk.qre Python module,
 * driven by PythonQreEngine). Kept as an interface so the worker transport can
 * evolve without touching callers.
 */
export interface QreEngine {
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
