import { describe, it, expect } from 'vitest'
import { MockQreEngine } from '../src/main/engine/MockQreEngine'
import type { RunInputs } from '../src/shared/types'

const baseInputs: RunInputs = {
  benchmarkId: 'bernstein-vazirani',
  applicationPath: '/benchmarks/bv/main.qs',
  applicationLang: 'qsharp',
  architectureModel: {
    kind: 'GateBased',
    errorRate: 1e-4,
    gateTimeNs: 100,
    measurementTimeNs: 500
  },
  errorCorrection: { qec: 'SurfaceCode', factory: 'RoundBasedFactory' },
  errorBudget: 0.01,
  qreVersion: 'mock-1.0'
}

describe('MockQreEngine', () => {
  const engine = new MockQreEngine()

  it('is deterministic for identical inputs', async () => {
    const a = await engine.run(baseInputs)
    const b = await engine.run(baseInputs)
    expect(a).toEqual(b)
  })

  it('returns a non-empty frontier with the chosen point at minimum physical qubits', async () => {
    const out = await engine.run(baseInputs)
    expect(out.frontier.length).toBeGreaterThan(0)
    const minQubits = Math.min(...out.frontier.map((p) => p.physicalQubits))
    expect(out.frontier[out.chosenIndex].physicalQubits).toBe(minQubits)
  })

  it('produces different results when inputs change', async () => {
    const out1 = await engine.run(baseInputs)
    const out2 = await engine.run({ ...baseInputs, errorBudget: 0.001 })
    expect(out1).not.toEqual(out2)
  })

  it('larger code distance trades more qubits for lower logical error rate', async () => {
    const { frontier } = await engine.run(baseInputs)
    const sorted = [...frontier].sort((a, b) => (a.codeDistance ?? 0) - (b.codeDistance ?? 0))
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].physicalQubits).toBeGreaterThan(sorted[i - 1].physicalQubits)
      expect(sorted[i].logicalErrorRate).toBeLessThanOrEqual(sorted[i - 1].logicalErrorRate)
    }
  })
})
