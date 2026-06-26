import type { RunInputs, RunOutputs, FrontierPoint } from '../../shared/types'
import { type QreEngine, chooseFrontierIndex } from './QreEngine'

const MOCK_VERSION = 'mock-1.0'

/** Small deterministic string hash (FNV-1a) so identical inputs yield identical outputs. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Deterministic stand-in for the real estimator. Produces a plausible Pareto
 * frontier (qubits vs. runtime trade-off across code distances) derived purely
 * from the run inputs, so the full app works offline and tests are stable.
 */
export class MockQreEngine implements QreEngine {
  readonly kind = 'mock' as const

  version(): string {
    return MOCK_VERSION
  }

  async run(input: RunInputs): Promise<RunOutputs> {
    const seed = hash(
      JSON.stringify({
        app: input.applicationPath,
        bench: input.benchmarkId,
        arch: input.architectureModel,
        qec: input.errorCorrection,
        budget: input.errorBudget
      })
    )

    // Base algorithm "size" derived from the seed and the error budget.
    const tightness = Math.max(1, Math.log10(1 / input.errorBudget))
    const baseLogicalQubits = 50 + (seed % 200)
    const baseTStates = 1_000 + (seed % 50_000)
    const cycleNs =
      (input.architectureModel.gateTimeNs * 2 +
        input.architectureModel.measurementTimeNs) *
      (input.errorCorrection.qec === 'SurfaceCodeLowMove' ? 0.85 : 1)

    const frontier: FrontierPoint[] = []
    // Each candidate code distance is a point on the frontier: larger distance =>
    // more physical qubits but lower logical error rate (and slightly more runtime).
    for (let d = 7; d <= 21; d += 2) {
      const physicalPerLogical = 2 * d * d
      const physicalQubits = Math.round(
        baseLogicalQubits * physicalPerLogical * tightness
      )
      const logicalCycleTimeNs = cycleNs * d
      const runtimeNs = Math.round(logicalCycleTimeNs * baseTStates * 1.5)
      const logicalErrorRate = Number(
        (0.03 * Math.pow(input.architectureModel.errorRate / 1e-3, d / 2)).toPrecision(3)
      )
      frontier.push({
        physicalQubits,
        runtimeNs,
        logicalCycleTimeNs: Math.round(logicalCycleTimeNs),
        tStates: baseTStates,
        logicalErrorRate,
        codeDistance: d,
        extra: {
          logicalQubits: baseLogicalQubits,
          physicalQubitsPerLogical: physicalPerLogical,
          qecScheme: input.errorCorrection.qec,
          factory: input.errorCorrection.factory
        }
      })
    }

    return { frontier, chosenIndex: chooseFrontierIndex(frontier) }
  }
}
