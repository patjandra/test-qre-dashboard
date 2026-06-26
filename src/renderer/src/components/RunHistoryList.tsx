import { Fragment, useMemo, useState } from 'react'
import { useAppStore } from '../store'
import { fmtNum, fmtTimestamp, chosenPoint, benchmarkName } from '../format'
import RunDetailPanel from './RunDetailPanel'

/** Run history table with filters. Rendered below the estimation form on the Dashboard. */
export default function RunHistoryList(): JSX.Element {
  const runs = useAppStore((s) => s.runs)
  const benchmarks = useAppStore((s) => s.benchmarks)
  const refreshRuns = useAppStore((s) => s.refreshRuns)
  const comparisonSelection = useAppStore((s) => s.comparisonSelection)
  const toggleComparison = useAppStore((s) => s.toggleComparison)
  const navigate = useAppStore((s) => s.navigate)

  const [benchFilter, setBenchFilter] = useState('')
  const [qecFilter, setQecFilter] = useState('')
  const [versionFilter, setVersionFilter] = useState('')
  // Id of the run whose detail is expanded inline (null = none).
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string): void => setExpandedId((cur) => (cur === id ? null : id))

  const versions = useMemo(() => Array.from(new Set(runs.map((r) => r.qreVersion))), [runs])

  const filtered = runs.filter((r) => {
    if (benchFilter && r.inputs.benchmarkId !== benchFilter) return false
    if (qecFilter && r.inputs.errorCorrection.qec !== qecFilter) return false
    if (versionFilter && r.qreVersion !== versionFilter) return false
    return true
  })

  async function onDelete(id: string): Promise<void> {
    await window.api.deleteRun(id)
    await refreshRuns()
  }

  async function onDuplicate(id: string): Promise<void> {
    await window.api.duplicateRun(id)
    await refreshRuns()
  }

  return (
    <div id="run-history">
      <div className="toolbar">
        <h2 className="page-title" style={{ margin: 0, fontSize: 18 }}>
          Run History
        </h2>
        <span className="muted">{runs.length} immutable records</span>
        <div className="spacer" />
        <select value={benchFilter} onChange={(e) => setBenchFilter(e.target.value)}>
          <option value="">All benchmarks</option>
          {benchmarks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select value={qecFilter} onChange={(e) => setQecFilter(e.target.value)}>
          <option value="">All QEC</option>
          <option value="SurfaceCode">Surface Code</option>
          <option value="SurfaceCodeLowMove">Surface Code (Low Move)</option>
        </select>
        <select value={versionFilter} onChange={(e) => setVersionFilter(e.target.value)}>
          <option value="">All versions</option>
          {versions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        {comparisonSelection.length >= 2 && (
          <button className="btn btn-primary btn-sm" onClick={() => navigate('comparison')}>
            Compare {comparisonSelection.length} runs →
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">No runs yet. Run an estimation above to get started.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>When</th>
                <th>Benchmark</th>
                <th>QEC</th>
                <th>Budget</th>
                <th>Version</th>
                <th className="num">Phys. Qubits</th>
                <th className="num">Runtime (ns)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const p = chosenPoint(r)
                const checked = comparisonSelection.includes(r.id)
                const expanded = expandedId === r.id
                return (
                  <Fragment key={r.id}>
                    <tr>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleComparison(r.id)}
                        />
                      </td>
                      <td>
                        <button className="link" onClick={() => toggleExpand(r.id)}>
                          {expanded ? '▾ ' : '▸ '}
                          {r.name || '(unnamed)'}
                        </button>
                      </td>
                      <td>{fmtTimestamp(r.timestamp)}</td>
                      <td>{benchmarkName(r, benchmarks)}</td>
                      <td>{r.inputs.errorCorrection.qec}</td>
                      <td>{fmtNum(r.inputs.errorBudget)}</td>
                      <td>{r.qreVersion}</td>
                      <td className="num">{fmtNum(p?.physicalQubits)}</td>
                      <td className="num">{fmtNum(p?.runtimeNs)}</td>
                      <td>
                        <div className="btn-row">
                          <button className="link" onClick={() => toggleExpand(r.id)}>
                            {expanded ? 'Hide' : 'View'}
                          </button>
                          <button className="link" onClick={() => onDuplicate(r.id)}>
                            Duplicate
                          </button>
                          <button className="link" onClick={() => onDelete(r.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="detail-row">
                        <td colSpan={10}>
                          <RunDetailPanel run={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
