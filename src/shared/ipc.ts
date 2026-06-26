// IPC channel names and the typed API contract exposed on window.api.
import type {
  Run,
  RunInputs,
  Benchmark,
  QreVersion,
  EngineStatus,
  ComparisonResult
} from './types'

export const Channels = {
  runQre: 'run-qre',
  getRuns: 'get-runs',
  getRun: 'get-run',
  deleteRun: 'delete-run',
  duplicateRun: 'duplicate-run',
  getBenchmarks: 'get-benchmarks',
  importProgram: 'import-program',
  compareRuns: 'compare-runs',
  exportRun: 'export-run',
  exportComparison: 'export-comparison',
  getEngineStatus: 'get-engine-status',
  getVersions: 'get-versions',
  setActiveVersion: 'set-active-version'
} as const

export interface ExportResult {
  saved: boolean
  path?: string
}

export interface ImportResult {
  canceled: boolean
  path?: string
}

/** Shape of window.api injected by the preload script. */
export interface RendererApi {
  runQre(inputs: RunInputs, name?: string): Promise<Run>
  getRuns(): Promise<Run[]>
  getRun(runId: string): Promise<Run | null>
  deleteRun(runId: string): Promise<void>
  duplicateRun(runId: string): Promise<Run | null>
  getBenchmarks(): Promise<Benchmark[]>
  importProgram(): Promise<ImportResult>
  compareRuns(runIds: string[]): Promise<ComparisonResult>
  exportRun(runId: string): Promise<ExportResult>
  exportComparison(runIds: string[]): Promise<ExportResult>
  getEngineStatus(): Promise<EngineStatus>
  getVersions(): Promise<QreVersion[]>
  setActiveVersion(version: string): Promise<void>
}
