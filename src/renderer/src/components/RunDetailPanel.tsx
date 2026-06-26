import { useState } from 'react'
import { useAppStore } from '../store'
import type { Run } from '@shared/types'
import { fmtNum, fmtTimestamp, benchmarkName } from '../format'
import MetricsPanel from './MetricsPanel'

/** Full run detail (config + outputs + export), rendered inline inside the history table. */
export default function RunDetailPanel({ run }: { run: Run }): JSX.Element {
  const benchmarks = useAppStore((s) => s.benchmarks)
  const [msg, setMsg] = useState<string | null>(null)
  const i = run.inputs

  async function exportMd(): Promise<void> {
    const res = await window.api.exportRun(run.id)
    setMsg(res.saved ? `Exported to ${res.path}` : 'Export canceled.')
  }

  return (
    <div className="run-detail-inline">
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <strong>{run.name || 'Run detail'}</strong>
        <div className="spacer" />
        {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
        <button className="btn btn-sm" onClick={exportMd}>
          Export Markdown
        </button>
      </div>

      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div>
          <p>
            <span className="muted">Benchmark:</span> {benchmarkName(run, benchmarks)}
          </p>
          <p>
            <span className="muted">Program:</span> {i.applicationPath} ({i.applicationLang})
          </p>
          <p>
            <span className="muted">QRE version:</span> {run.qreVersion}
          </p>
          <p>
            <span className="muted">Executed:</span> {fmtTimestamp(run.timestamp)}
          </p>
        </div>
        <div>
          <p>
            <span className="muted">Architecture:</span> {i.architectureModel.kind} — error{' '}
            {fmtNum(i.architectureModel.errorRate)}, gate {fmtNum(i.architectureModel.gateTimeNs)} ns,
            meas {fmtNum(i.architectureModel.measurementTimeNs)} ns
          </p>
          <p>
            <span className="muted">Error correction:</span> {i.errorCorrection.qec} +{' '}
            {i.errorCorrection.factory}
          </p>
          <p>
            <span className="muted">Error budget:</span> {fmtNum(i.errorBudget)}
          </p>
        </div>
      </div>

      <MetricsPanel frontier={run.outputs.frontier} chosenIndex={run.outputs.chosenIndex} />
    </div>
  )
}
