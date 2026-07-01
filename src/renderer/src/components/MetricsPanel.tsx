import { useState } from 'react'
import type { FrontierPoint } from '@shared/types'
import { PRIMARY_METRICS } from '@shared/types'
import { fmtNum } from '../format'
import FrontierChart from './FrontierChart'

interface Props {
  frontier: FrontierPoint[]
  chosenIndex: number
}

/**
 * Displays the chosen frontier point's metrics plus the full Pareto-frontier
 * table. Metric filter chips toggle visibility only — full output is preserved.
 */
export default function MetricsPanel({ frontier, chosenIndex }: Props): JSX.Element {
  const allKeys = PRIMARY_METRICS.map((m) => m.key as string)
  const [visible, setVisible] = useState<string[]>(allKeys)

  if (frontier.length === 0) {
    return <p className="empty">No frontier points returned.</p>
  }

  const chosen = frontier[chosenIndex] ?? frontier[0]
  const shownMetrics = PRIMARY_METRICS.filter((m) => visible.includes(m.key as string))

  const toggle = (key: string): void =>
    setVisible((v) => (v.includes(key) ? v.filter((k) => k !== key) : [...v, key]))

  return (
    <div>
      <div className="chip-row">
        {PRIMARY_METRICS.map((m) => {
          const key = m.key as string
          const on = visible.includes(key)
          return (
            <span
              key={key}
              className={`chip ${on ? 'on' : ''}`}
              onClick={() => toggle(key)}
            >
              {on ? '✓' : '○'} {m.label}
            </span>
          )
        })}
      </div>

      <div className="metric-grid">
        {shownMetrics.map((m) => {
          const v = chosen[m.key as keyof FrontierPoint] as number | undefined
          return (
            <div className="metric" key={m.key as string}>
              <div className="label">
                {m.label}
                {m.unit ? ` (${m.unit})` : ''}
              </div>
              <div className="value">{fmtNum(v)}</div>
            </div>
          )
        })}
      </div>

      <h3 style={{ marginTop: 20 }}>Trade-off curve (Pareto frontier)</h3>
      <p className="muted" style={{ marginTop: -4 }}>
        Each point is an optimal physical-qubits vs. runtime trade-off. The ★ marks the
        representative point shown above.
      </p>
      <FrontierChart frontier={frontier} chosenIndex={chosenIndex} />

      <h3 style={{ marginTop: 20 }}>Frontier points ({frontier.length})</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            {shownMetrics.map((m) => (
              <th key={m.key as string} className="num">
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {frontier.map((p, idx) => (
            <tr key={idx}>
              <td>{idx === chosenIndex ? `${idx} ★` : idx}</td>
              {shownMetrics.map((m) => (
                <td key={m.key as string} className="num">
                  {fmtNum(p[m.key as keyof FrontierPoint] as number | undefined)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
