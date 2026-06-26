import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import { useAppStore } from '../store'
import type { ComparisonResult, ComparisonMetric, Run } from '@shared/types'
import { fmtNum, runLabel, benchmarkName } from '../format'

const CHART_COLORS = ['#4f8cff', '#7c5cff', '#2ecc71', '#e0a93b', '#e5484d', '#16c0c0']

/** A single per-metric bar chart comparing the selected runs. */
function MetricChart({ metric }: { metric: ComparisonMetric }): JSX.Element {
  const data = metric.values.map((v, i) => ({ name: runLabel(i), value: v }))
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <h3>{metric.name}</h3>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3c" />
            <XAxis dataKey="name" stroke="#9aa3b2" />
            <YAxis stroke="#9aa3b2" width={70} />
            <Tooltip contentStyle={{ background: '#1f2430', border: '1px solid #2a2f3c' }} />
            <Bar dataKey="value" name={metric.name} radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function Comparison(): JSX.Element {
  const selection = useAppStore((s) => s.comparisonSelection)
  const runs = useAppStore((s) => s.runs)
  const benchmarks = useAppStore((s) => s.benchmarks)
  const clearComparison = useAppStore((s) => s.clearComparison)
  const navigate = useAppStore((s) => s.navigate)

  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  // Names of metrics whose graphs are hidden; empty means all graphs are shown.
  const [hiddenGraphs, setHiddenGraphs] = useState<string[]>([])

  const toggleGraph = (name: string): void =>
    setHiddenGraphs((h) => (h.includes(name) ? h.filter((n) => n !== name) : [...h, name]))

  const selectedRuns = useMemo(
    () => selection.map((id) => runs.find((r) => r.id === id)).filter((r): r is Run => !!r),
    [selection, runs]
  )

  useEffect(() => {
    if (selection.length >= 2) {
      window.api.compareRuns(selection).then(setResult)
    } else {
      setResult(null)
    }
  }, [selection])

  if (selection.length < 2) {
    return (
      <div>
        <h1 className="page-title">Comparison</h1>
        <p className="page-sub">
          Select two or more runs in{' '}
          <button className="link" onClick={() => navigate('history')}>
            Run History
          </button>{' '}
          to compare them.
        </p>
        <div className="empty">Nothing selected yet.</div>
      </div>
    )
  }

  const visibleMetrics = result?.metrics.filter((m) => !hiddenGraphs.includes(m.name)) ?? []

  async function exportMd(): Promise<void> {
    const res = await window.api.exportComparison(selection)
    setMsg(res.saved ? `Exported to ${res.path}` : 'Export canceled.')
  }

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          Comparison
        </h1>
        <div className="spacer" />
        <button className="btn btn-sm" onClick={exportMd}>
          Export Markdown
        </button>
        <button className="btn btn-sm" onClick={clearComparison}>
          Clear selection
        </button>
      </div>
      {msg && <p className="muted">{msg}</p>}

      <div className="card">
        <h3>Selected runs</h3>
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Benchmark</th>
              <th>QEC</th>
              <th>Budget</th>
              <th>Version</th>
            </tr>
          </thead>
          <tbody>
            {selectedRuns.map((r, i) => (
              <tr key={r.id}>
                <td>
                  <strong>{runLabel(i)}</strong>
                </td>
                <td>{benchmarkName(r, benchmarks)}</td>
                <td>{r.inputs.errorCorrection.qec}</td>
                <td>{fmtNum(r.inputs.errorBudget)}</td>
                <td>{r.qreVersion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result && (
        <>
          <div className="card">
            <h3>Metric comparison (Δ relative to {runLabel(0)})</h3>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  {selectedRuns.map((_, i) => (
                    <th key={i} className="num">
                      {runLabel(i)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.metrics.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    {m.values.map((v, i) => {
                      const d = m.deltasPct[i]
                      return (
                        <td key={i} className="num">
                          {fmtNum(v)}
                          {d !== null && (
                            <span className={d > 0 ? 'delta-pos' : 'delta-neg'}>
                              {' '}
                              ({d > 0 ? '+' : ''}
                              {d}%)
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="toolbar" style={{ marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Graphs</h3>
              <div className="spacer" />
              <span className="muted" style={{ fontSize: 12 }}>
                {visibleMetrics.length} of {result.metrics.length} shown
              </span>
            </div>
            <div className="chip-row">
              {result.metrics.map((m) => {
                const on = !hiddenGraphs.includes(m.name)
                return (
                  <span
                    key={m.name}
                    className={`chip ${on ? 'on' : ''}`}
                    onClick={() => toggleGraph(m.name)}
                  >
                    {on ? '✓' : '○'} {m.name}
                  </span>
                )
              })}
            </div>

            {visibleMetrics.length === 0 ? (
              <p className="empty">All graphs hidden. Enable a metric above to show its graph.</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: 16
                }}
              >
                {visibleMetrics.map((m) => (
                  <MetricChart key={m.name} metric={m} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
