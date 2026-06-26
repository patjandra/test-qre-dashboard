import { describe, it, expect } from 'vitest'
import { exportRunToMarkdown, exportComparisonToMarkdown } from '../src/main/export/markdown'
import type { Run, FrontierPoint } from '../src/shared/types'

function makeRun(id: string, benchmarkId: string | undefined, qubits: number): Run {
  const frontier: FrontierPoint[] = [
    {
      physicalQubits: qubits,
      runtimeNs: 1e8,
      logicalCycleTimeNs: 2000,
      tStates: 12000,
      logicalErrorRate: 5e-10,
      codeDistance: 13,
      extra: { logicalQubits: 42 }
    },
    {
      physicalQubits: qubits * 2,
      runtimeNs: 8e7,
      logicalCycleTimeNs: 2500,
      tStates: 12000,
      logicalErrorRate: 1e-12,
      codeDistance: 17,
      extra: { logicalQubits: 42 }
    }
  ]
  return {
    id,
    name: `Run ${id}`,
    timestamp: 1_700_000_000_000,
    qreVersion: 'mock-1.0',
    inputs: {
      benchmarkId,
      applicationPath: '/bench/main.qs',
      applicationLang: 'qsharp',
      architectureModel: { kind: 'GateBased', errorRate: 1e-4, gateTimeNs: 100, measurementTimeNs: 500 },
      errorCorrection: { qec: 'SurfaceCode', factory: 'RoundBasedFactory' },
      errorBudget: 0.01,
      qreVersion: 'mock-1.0'
    },
    outputs: { frontier, chosenIndex: 0 }
  }
}

describe('exportRunToMarkdown', () => {
  const run = makeRun('run-1234abcd', 'bernstein-vazirani', 1000)

  it('includes headers, inputs, summary and full frontier rows', () => {
    const md = exportRunToMarkdown(run, (id) => (id === 'bernstein-vazirani' ? 'Bernstein-Vazirani' : undefined))
    expect(md).toContain('# QRE Run Report')
    expect(md).toContain('**Benchmark:** Bernstein-Vazirani')
    expect(md).toContain('**Error budget:** 0.01')
    expect(md).toContain('## Full Pareto Frontier')
    // One header row + separator + 2 frontier points => the chosen point is starred.
    expect(md).toContain('0★')
    expect(md.match(/^\| \d/gm)?.length).toBe(2)
  })

  it('falls back to the benchmark id then to the imported path', () => {
    expect(exportRunToMarkdown(run).includes('bernstein-vazirani')).toBe(true)
    const imported = makeRun('r2', undefined, 500)
    expect(exportRunToMarkdown(imported)).toContain('Imported (/bench/main.qs)')
  })
})

describe('exportComparisonToMarkdown', () => {
  it('produces a labeled metric table with deltas', () => {
    const runs = [makeRun('a', 'bv', 1000), makeRun('b', 'bv', 1300)]
    const md = exportComparisonToMarkdown(runs, () => 'BV')
    expect(md).toContain('# QRE Comparison Report')
    expect(md).toContain('| Metric | Run A | Run B |')
    expect(md).toContain('**Run A**')
    expect(md).toContain('**Run B**')
    // Physical Qubits row should show the +30% delta for Run B.
    expect(md).toMatch(/Physical Qubits \|[^|]*\| [^|]*\(\+30%\)/)
  })
})
