// Core domain model shared across main, preload, and renderer.
// A "run" is the basic unit of the application: an immutable record of a single
// locally executed QRE estimation, capturing its full configuration and output.

export type ApplicationLang = 'qsharp' | 'cirq' | 'openqasm' | 'qir' | 'logical-counts'

export type QecScheme = 'SurfaceCode' | 'SurfaceCodeLowMove'
export type FactoryModel = 'RoundBasedFactory'

export interface ArchitectureModel {
  kind: 'GateBased'
  /** Physical error rate, e.g. 1e-4 */
  errorRate: number
  /** Single-qubit gate time in nanoseconds */
  gateTimeNs: number
  /** Measurement time in nanoseconds */
  measurementTimeNs: number
}

export interface ErrorCorrectionModel {
  qec: QecScheme
  factory: FactoryModel
}

export interface RunInputs {
  /** Optional id of a bundled benchmark; absent when the program was imported. */
  benchmarkId?: string
  /** Absolute path to the application program (e.g. a .qs file). */
  applicationPath: string
  applicationLang: ApplicationLang
  architectureModel: ArchitectureModel
  errorCorrection: ErrorCorrectionModel
  /** Maximum allowed error rate for the computation (QRE max_error / error budget). */
  errorBudget: number
  /** QRE engine version used for this run, for reproducibility. */
  qreVersion: string
}

/**
 * A single point on the Pareto frontier returned by the resource estimator.
 * QRE returns a set of optimal (qubits vs. runtime) trade-off points, not one result.
 */
export interface FrontierPoint {
  physicalQubits: number
  runtimeNs: number
  logicalCycleTimeNs: number
  tStates: number
  logicalErrorRate: number
  codeDistance?: number
  /** Any additional QRE-provided metrics, preserved verbatim. */
  extra: Record<string, number | string>
}

export interface RunOutputs {
  frontier: FrontierPoint[]
  /** Index into `frontier` of the representative point shown by default (min physical qubits). */
  chosenIndex: number
}

export interface Run {
  id: string
  /** User-provided name, or a config-derived default (see defaultRunName). */
  name: string
  timestamp: number
  inputs: RunInputs
  outputs: RunOutputs
  qreVersion: string
}

export interface Benchmark {
  id: string
  name: string
  path: string
  lang: ApplicationLang
  metadata: Record<string, unknown>
}

export interface QreVersion {
  version: string
  path: string
  active: boolean
}

export type EngineKind = 'python' | 'mock'

export interface EngineStatus {
  /** Engine actually selected as the default. */
  active: EngineKind
  /** Whether the real Python (qdk.qre) engine is available on this machine. */
  pythonAvailable: boolean
  /** Detected qdk version string, when available. */
  qdkVersion?: string
  /** Human-readable note, e.g. why the mock fallback is in use. */
  detail: string
}

// ---- Comparison ----

export interface ComparisonMetric {
  name: string
  values: number[]
  /** Percentage delta of each run relative to the first selected run. */
  deltasPct: (number | null)[]
}

export interface ComparisonResult {
  runIds: string[]
  metrics: ComparisonMetric[]
}

// ---- Metric metadata (display order, labels, units) ----

export interface MetricDef {
  key: keyof FrontierPoint | string
  label: string
  unit?: string
}

export const PRIMARY_METRICS: MetricDef[] = [
  { key: 'physicalQubits', label: 'Physical Qubits' },
  { key: 'runtimeNs', label: 'Runtime', unit: 'ns' },
  { key: 'logicalCycleTimeNs', label: 'Logical Cycle Time', unit: 'ns' },
  { key: 'tStates', label: 'T States' },
  { key: 'logicalErrorRate', label: 'Logical Error Rate' },
  { key: 'codeDistance', label: 'Code Distance' }
]
