import { useState } from 'react'
import { useAppStore } from '../store'
import type { Run } from '@shared/types'
import { defaultRunName } from '@shared/naming'
import MetricsPanel from '../components/MetricsPanel'
import RunHistoryList from '../components/RunHistoryList'
import NumberField from '../components/NumberField'
import Section from '../components/Section'

export default function Dashboard(): JSX.Element {
  const benchmarks = useAppStore((s) => s.benchmarks)
  const draft = useAppStore((s) => s.draft)
  const setDraft = useAppStore((s) => s.setDraft)
  const engine = useAppStore((s) => s.engine)
  const executeRun = useAppStore((s) => s.executeRun)

  const scrollToHistory = (): void =>
    document.getElementById('run-history')?.scrollIntoView({ behavior: 'smooth' })

  const [runName, setRunName] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<Run | null>(null)

  const arch = draft.architectureModel
  const canRun = draft.applicationPath.trim().length > 0 && !running

  // Live preview of the auto-generated name shown when the user leaves the field blank.
  const benchLabel = draft.benchmarkId
    ? (benchmarks.find((b) => b.id === draft.benchmarkId)?.name ?? draft.benchmarkId)
    : draft.applicationPath
      ? 'Imported program'
      : 'Run'
  const placeholderName = defaultRunName(benchLabel, draft.errorCorrection.qec, draft.errorBudget)

  async function pickBenchmark(id: string): Promise<void> {
    if (!id) {
      setDraft({ benchmarkId: undefined, applicationPath: '' })
      return
    }
    const b = benchmarks.find((x) => x.id === id)
    setDraft({ benchmarkId: id, applicationPath: b?.path ?? '' })
  }

  async function importProgram(): Promise<void> {
    const res = await window.api.importProgram()
    if (res.error) {
      setError(`Upload rejected: ${res.error}`)
      return
    }
    if (!res.canceled && res.path) {
      setError(null)
      setDraft({ benchmarkId: undefined, applicationPath: res.path })
    }
  }

  async function run(): Promise<void> {
    setRunning(true)
    setError(null)
    try {
      const r = await executeRun(runName.trim() || undefined)
      setLastRun(r)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">
        Estimate the physical qubits and runtime a quantum program would need. Pick a
        benchmark or import a program, set your hardware assumptions, then run.{' '}
        {engine && (
          <span className="muted">
            Engine:{' '}
            {engine.mock
              ? 'Demo data (synthetic)'
              : engine.available
                ? `Real (qdk ${engine.qdkVersion})`
                : 'Unavailable'}
          </span>
        )}
      </p>

      <Section
        id="configure"
        step={1}
        title="Configure run"
        sub="Define the application, architecture, and error model."
      >
        <div className="card">
        <h3>Application model</h3>
        <div className="grid-2">
          <div className="field">
            <label>Benchmark</label>
            <select
              value={draft.benchmarkId ?? ''}
              onChange={(e) => pickBenchmark(e.target.value)}
            >
              <option value="">— Select a benchmark —</option>
              {benchmarks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Or import a program</label>
            <div className="btn-row">
              <button className="btn" onClick={importProgram}>
                Choose .qs file…
              </button>
            </div>
          </div>
        </div>
        {draft.applicationPath && (
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Program: {draft.applicationPath}
          </p>
        )}
      </div>

      <div className="card">
        <h3>Architecture model (GateBased)</h3>
        <div className="grid-3">
          <NumberField
            label="Physical error rate"
            value={arch.errorRate}
            onChange={(n) => setDraft({ architectureModel: { ...arch, errorRate: n } })}
            hint="e.g. 1e-4"
          />
          <NumberField
            label="Gate time (ns)"
            value={arch.gateTimeNs}
            onChange={(n) => setDraft({ architectureModel: { ...arch, gateTimeNs: n } })}
          />
          <NumberField
            label="Measurement time (ns)"
            value={arch.measurementTimeNs}
            onChange={(n) => setDraft({ architectureModel: { ...arch, measurementTimeNs: n } })}
          />
        </div>
      </div>

      <div className="card">
        <h3>Error correction & budget</h3>
        <div className="grid-3">
          <div className="field">
            <label>QEC scheme</label>
            <select
              value={draft.errorCorrection.qec}
              onChange={(e) =>
                setDraft({
                  errorCorrection: {
                    ...draft.errorCorrection,
                    qec: e.target.value as 'SurfaceCode' | 'SurfaceCodeLowMove'
                  }
                })
              }
            >
              <option value="SurfaceCode">Surface Code</option>
              <option value="SurfaceCodeLowMove">Surface Code (Low Move)</option>
            </select>
          </div>
          <div className="field">
            <label>T-factory model</label>
            <select value={draft.errorCorrection.factory} disabled>
              <option value="RoundBasedFactory">Round Based Factory</option>
            </select>
          </div>
          <NumberField
            label="Error budget (max error)"
            value={draft.errorBudget}
            onChange={(n) => setDraft({ errorBudget: n })}
          />
        </div>
        <div className="field" style={{ marginTop: 6 }}>
          <label>Run name (optional)</label>
          <input
            type="text"
            value={runName}
            placeholder={placeholderName}
            onChange={(e) => setRunName(e.target.value)}
          />
          <span className="muted" style={{ fontSize: 12 }}>
            Leave blank to use the default: <em>{placeholderName}</em>
          </span>
        </div>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button className="btn btn-primary" disabled={!canRun} onClick={run}>
            {running ? 'Running estimation…' : 'Run estimation'}
          </button>
          {!draft.applicationPath && (
            <span className="muted">Select a benchmark or import a program first.</span>
          )}
        </div>
        {error && <div className="error-box">Estimation failed:{'\n'}{error}</div>}
        </div>
      </Section>

      {lastRun && (
        <Section
          id="results"
          step={2}
          title={`Results — ${lastRun.name}`}
          actions={
            <button className="btn btn-sm" onClick={scrollToHistory}>
              View in Run History ↓
            </button>
          }
        >
          <div className="card">
            <MetricsPanel
              frontier={lastRun.outputs.frontier}
              chosenIndex={lastRun.outputs.chosenIndex}
            />
          </div>
        </Section>
      )}

      <Section
        id="history"
        step={lastRun ? 3 : 2}
        title="Run history"
        sub="Immutable record of every estimation."
      >
        <RunHistoryList />
      </Section>
    </div>
  )
}
