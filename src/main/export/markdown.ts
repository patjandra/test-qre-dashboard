import type { Run, FrontierPoint } from '../../shared/types'
import { PRIMARY_METRICS } from '../../shared/types'
import { compareRuns, chosenPoint } from '../compare'

/** Resolves a benchmark id to a display name. Injected so this module stays pure/testable. */
export type BenchmarkResolver = (benchmarkId: string) => string | undefined

function fmt(v: number | string | undefined): string {
  if (v === undefined) return '—'
  if (typeof v === 'string') return v
  if (!isFinite(v)) return String(v)
  // Use exponential for very large/small magnitudes, otherwise grouped integer/decimal.
  const abs = Math.abs(v)
  if (abs !== 0 && (abs >= 1e9 || abs < 1e-3)) return v.toExponential(3)
  return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(4)
}

function benchmarkLabel(run: Run, resolve?: BenchmarkResolver): string {
  if (run.inputs.benchmarkId) {
    return resolve?.(run.inputs.benchmarkId) ?? run.inputs.benchmarkId
  }
  return `Imported (${run.inputs.applicationPath})`
}

function inputsBlock(run: Run, resolve?: BenchmarkResolver): string {
  const i = run.inputs
  return [
    `- **Name:** ${run.name}`,
    `- **Benchmark:** ${benchmarkLabel(run, resolve)}`,
    `- **Application:** ${i.applicationPath} (${i.applicationLang})`,
    `- **Architecture:** ${i.architectureModel.kind} — error rate ${fmt(i.architectureModel.errorRate)}, gate ${fmt(i.architectureModel.gateTimeNs)} ns, measurement ${fmt(i.architectureModel.measurementTimeNs)} ns`,
    `- **Error correction:** ${i.errorCorrection.qec} + ${i.errorCorrection.factory}`,
    `- **Error budget:** ${fmt(i.errorBudget)}`,
    `- **QRE version:** ${run.qreVersion}`,
    `- **Timestamp:** ${new Date(run.timestamp).toISOString()}`
  ].join('\n')
}

function frontierTable(frontier: FrontierPoint[], chosenIndex: number): string {
  const header =
    '| # | Physical Qubits | Runtime (ns) | Logical Cycle (ns) | T States | Logical Error Rate | Code Distance |'
  const sep = '| --- | --- | --- | --- | --- | --- | --- |'
  const rows = frontier.map((p, idx) => {
    const mark = idx === chosenIndex ? '★' : ''
    return `| ${idx}${mark} | ${fmt(p.physicalQubits)} | ${fmt(p.runtimeNs)} | ${fmt(p.logicalCycleTimeNs)} | ${fmt(p.tStates)} | ${fmt(p.logicalErrorRate)} | ${fmt(p.codeDistance)} |`
  })
  return [header, sep, ...rows].join('\n')
}

/** Renders a single run as a Markdown report (summary + full frontier detail). */
export function exportRunToMarkdown(run: Run, resolve?: BenchmarkResolver): string {
  const point = chosenPoint(run)
  const summary = PRIMARY_METRICS.map((m) => {
    const v = point ? (point[m.key as keyof FrontierPoint] as number | undefined) : undefined
    const unit = m.unit ? ` ${m.unit}` : ''
    return `- **${m.label}:** ${fmt(v)}${unit}`
  }).join('\n')

  return `# QRE Run Report

## Inputs

${inputsBlock(run, resolve)}

## Summary (selected frontier point ★)

${summary}

## Full Pareto Frontier

${frontierTable(run.outputs.frontier, run.outputs.chosenIndex)}

---
_Run id: ${run.id}_
`
}

/** Renders a comparison of multiple runs as a Markdown report. */
export function exportComparisonToMarkdown(runs: Run[], resolve?: BenchmarkResolver): string {
  const cmp = compareRuns(runs)

  const labelRow = `| Metric | ${runs.map((r, i) => `Run ${String.fromCharCode(65 + i)}`).join(' | ')} |`
  const sep = `| --- | ${runs.map(() => '---').join(' | ')} |`
  const metricRows = cmp.metrics.map((m) => {
    const cells = m.values.map((v, i) => {
      const d = m.deltasPct[i]
      const delta = d === null ? '' : ` (${d > 0 ? '+' : ''}${d}%)`
      return `${fmt(v)}${delta}`
    })
    return `| ${m.name} | ${cells.join(' | ')} |`
  })

  const legend = runs
    .map(
      (r, i) =>
        `- **Run ${String.fromCharCode(65 + i)}** (${r.name}) — ${benchmarkLabel(r, resolve)}, ${r.inputs.errorCorrection.qec}, budget ${fmt(r.inputs.errorBudget)}, ${r.qreVersion} _(${r.id})_`
    )
    .join('\n')

  return `# QRE Comparison Report

_Generated ${new Date().toISOString()} · ${runs.length} runs_

## Runs

${legend}

## Metric Comparison (Δ relative to Run A)

${labelRow}
${sep}
${metricRows.join('\n')}
`
}
