import { describe, expect, it } from 'vitest'
import { MockQreEngine } from '../src/main/engine/MockQreEngine'
import type { RunInputs } from '../src/shared/types'

const inputs: RunInputs = {
  applicationPath: '/tmp/demo.qs',
  applicationLang: 'qsharp',
  architectureModel: { kind: 'GateBased', errorRate: 1e-4, gateTimeNs: 100, measurementTimeNs: 500 },
  errorCorrection: { qec: 'SurfaceCode', factory: 'RoundBasedFactory' },
  errorBudget: 0.01,
  qreVersion: 'mock-1.0'
}

describe('MockQreEngine (demo mode)', () => {
  const engine = new MockQreEngine()

  it('returns a multi-point frontier so the UI has data to render', async () => {
    const out = await engine.run(inputs)
    expect(out.frontier.length).toBeGreaterThan(1)
    expect(out.chosenIndex).toBeGreaterThanOrEqual(0)
    const p = out.frontier[out.chosenIndex]
    expect(p.physicalQubits).toBeGreaterThan(0)
    expect(p.runtimeNs).toBeGreaterThan(0)
    expect(p.codeDistance).toBeGreaterThan(0)
  })

  it('is deterministic: identical inputs yield identical outputs', async () => {
    const a = await engine.run(inputs)
    const b = await engine.run(inputs)
    expect(b).toEqual(a)
  })

  it('varies output when inputs change', async () => {
    const a = await engine.run(inputs)
    const b = await engine.run({ ...inputs, errorBudget: 0.0001 })
    expect(b.frontier[0].physicalQubits).not.toBe(a.frontier[0].physicalQubits)
  })
})
