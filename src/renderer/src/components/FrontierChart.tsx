import { useState } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import type { FrontierPoint } from '@shared/types'
import { fmtDuration, fmtNum } from '../format'

interface Props {
  frontier: FrontierPoint[]
  chosenIndex: number
}

interface PlotDatum {
  x: number
  y: number
  point: FrontierPoint
  index: number
}

const compact = (n: number): string =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

/** Tooltip showing the full trade-off detail for a hovered frontier point. */
function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: PlotDatum }[] }): JSX.Element | null {
  if (!active || !payload?.length) return null
  const { point } = payload[0].payload
  return (
    <div
      style={{
        background: '#1f2430',
        border: '1px solid #2a2f3c',
        borderRadius: 8,
        padding: '8px 10px',
        color: '#e6e9ef',
        fontSize: 12
      }}
    >
      <div>Physical qubits: {fmtNum(point.physicalQubits)}</div>
      <div>Runtime: {fmtDuration(point.runtimeNs)}</div>
      {point.codeDistance !== undefined && <div>Code distance: {point.codeDistance}</div>}
      <div>T states: {fmtNum(point.tStates)}</div>
      <div>Logical error: {fmtNum(point.logicalErrorRate)}</div>
    </div>
  )
}

/**
 * Visualizes a run's Pareto frontier as a trade-off curve: physical qubits (cost)
 * on the x-axis against runtime (time) on the y-axis. Each point is an optimal
 * qubits-vs-runtime trade-off; the chosen representative point is highlighted.
 * Runtime spans many orders of magnitude, so a log-scale toggle is offered.
 */
export default function FrontierChart({ frontier, chosenIndex }: Props): JSX.Element {
  const [logScale, setLogScale] = useState(true)

  // Sort by qubits so the connecting line traces the frontier left-to-right.
  const data: PlotDatum[] = frontier
    .map((point, index) => ({ x: point.physicalQubits, y: point.runtimeNs, point, index }))
    .sort((a, b) => a.x - b.x)

  const chosen = data.filter((d) => d.index === chosenIndex)

  // Log scale needs strictly positive values; fall back to linear if any y <= 0.
  const canLog = data.every((d) => d.y > 0)
  const useLog = logScale && canLog

  return (
    <div>
      <div className="chip-row" style={{ justifyContent: 'flex-end' }}>
        <span
          className={`chip ${useLog ? 'on' : ''}`}
          onClick={() => canLog && setLogScale((v) => !v)}
          title={canLog ? 'Toggle runtime axis scale' : 'Log scale unavailable (non-positive runtime)'}
          style={canLog ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
        >
          Runtime axis: {useLog ? 'log' : 'linear'}
        </span>
      </div>
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 24, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3c" />
            <XAxis
              type="number"
              dataKey="x"
              name="Physical qubits"
              stroke="#9aa3b2"
              tickFormatter={compact}
              domain={['auto', 'auto']}
              label={{ value: 'Physical qubits', position: 'insideBottom', offset: -12, fill: '#9aa3b2' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Runtime"
              stroke="#9aa3b2"
              width={64}
              scale={useLog ? 'log' : 'linear'}
              domain={useLog ? ['auto', 'auto'] : [0, 'auto']}
              allowDataOverflow
              tickFormatter={(v: number) => (v > 0 ? fmtDuration(v) : '0')}
            />
            <ZAxis range={[90, 90]} />
            <Tooltip content={<PointTooltip />} cursor={{ stroke: '#2a2f3c' }} />
            <Legend
              verticalAlign="top"
              align="right"
              height={24}
              wrapperStyle={{ color: '#9aa3b2', fontSize: 12 }}
            />
            <Scatter
              name="Frontier point"
              data={data}
              fill="#4f8cff"
              line={{ stroke: '#4f8cff', strokeWidth: 1 }}
              lineJointType="monotoneX"
            />
            <Scatter name="Chosen point" data={chosen} fill="#7c5cff" shape="star" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
