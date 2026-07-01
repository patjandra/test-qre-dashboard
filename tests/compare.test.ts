import { describe, it, expect } from 'vitest'
import { compareRuns } from '../src/main/compare'
import type { Run, FrontierPoint } from '../src/shared/types'

function makeRun(id: string, physicalQubits: number, runtimeNs: number): Run {
  const point: FrontierPoint = {
    physicalQubits,
    runtimeNs,
    logicalCycleTimeNs: 1000,
    tStates: 5000,
    logicalErrorRate: 1e-9,
    codeDistance: 11,
    extra: {}
  }
  return {
    id,
    name: `run-${id}`,
    timestamp: 0,
    qreVersion: 'qdk-1.29.1',
    inputs: {
      applicationPath: '/x.qs',
      applicationLang: 'qsharp',
      architectureModel: { kind: 'GateBased', errorRate: 1e-4, gateTimeNs: 100, measurementTimeNs: 500 },
      errorCorrection: { qec: 'SurfaceCode', factory: 'RoundBasedFactory' },
      errorBudget: 0.01,
      qreVersion: 'qdk-1.29.1'
    },
    outputs: { frontier: [point], chosenIndex: 0 }
  }
}

describe('compareRuns', () => {
  it('computes percentage deltas relative to the first run', () => {
    const runs = [makeRun('a', 1000, 100), makeRun('b', 1300, 50)]
    const result = compareRuns(runs)

    const qubits = result.metrics.find((m) => m.name === 'Physical Qubits')!
    expect(qubits.values).toEqual([1000, 1300])
    expect(qubits.deltasPct[0]).toBeNull()
    expect(qubits.deltasPct[1]).toBe(30) // +30%

    const runtime = result.metrics.find((m) => m.name === 'Runtime')!
    expect(runtime.deltasPct[1]).toBe(-50) // -50%
  })

  it('returns null delta when the baseline value is zero', () => {
    const a = makeRun('a', 0, 0)
    const b = makeRun('b', 100, 100)
    const result = compareRuns([a, b])
    const qubits = result.metrics.find((m) => m.name === 'Physical Qubits')!
    expect(qubits.deltasPct[1]).toBeNull()
  })

  it('preserves run ids in order', () => {
    const result = compareRuns([makeRun('a', 1, 1), makeRun('b', 2, 2), makeRun('c', 3, 3)])
    expect(result.runIds).toEqual(['a', 'b', 'c'])
  })
})
