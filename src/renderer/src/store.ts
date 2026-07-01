import { create } from 'zustand'
import type {
  Run,
  Benchmark,
  RunInputs,
  EngineStatus,
  ArchitectureModel,
  ErrorCorrectionModel
} from '@shared/types'

export type Page = 'dashboard' | 'history' | 'comparison' | 'settings'

/** The editable run configuration draft shown on the Dashboard. */
export interface ConfigDraft {
  benchmarkId?: string
  applicationPath: string
  architectureModel: ArchitectureModel
  errorCorrection: ErrorCorrectionModel
  errorBudget: number
}

export const defaultDraft: ConfigDraft = {
  benchmarkId: undefined,
  applicationPath: '',
  architectureModel: {
    kind: 'GateBased',
    errorRate: 1e-4,
    gateTimeNs: 100,
    measurementTimeNs: 500
  },
  errorCorrection: { qec: 'SurfaceCode', factory: 'RoundBasedFactory' },
  errorBudget: 0.01
}

interface AppState {
  page: Page
  benchmarks: Benchmark[]
  runs: Run[]
  engine: EngineStatus | null
  draft: ConfigDraft
  comparisonSelection: string[]

  navigate: (page: Page) => void
  setDraft: (patch: Partial<ConfigDraft>) => void
  resetDraft: () => void
  toggleComparison: (runId: string) => void
  clearComparison: () => void

  refreshBenchmarks: () => Promise<void>
  refreshRuns: () => Promise<void>
  refreshEngine: () => Promise<void>
  executeRun: (name?: string) => Promise<Run>
}

export const useAppStore = create<AppState>((set, get) => ({
  page: 'dashboard',
  benchmarks: [],
  runs: [],
  engine: null,
  draft: defaultDraft,
  comparisonSelection: [],

  navigate: (page) => set({ page }),
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  resetDraft: () => set({ draft: defaultDraft }),
  toggleComparison: (runId) =>
    set((s) => ({
      comparisonSelection: s.comparisonSelection.includes(runId)
        ? s.comparisonSelection.filter((id) => id !== runId)
        : [...s.comparisonSelection, runId]
    })),
  clearComparison: () => set({ comparisonSelection: [] }),

  refreshBenchmarks: async () => set({ benchmarks: await window.api.getBenchmarks() }),
  refreshRuns: async () => set({ runs: await window.api.getRuns() }),
  refreshEngine: async () => set({ engine: await window.api.getEngineStatus() }),

  executeRun: async (name?: string) => {
    const { draft, engine } = get()
    const inputs: RunInputs = {
      benchmarkId: draft.benchmarkId,
      applicationPath: draft.applicationPath,
      applicationLang: 'qsharp',
      architectureModel: draft.architectureModel,
      errorCorrection: draft.errorCorrection,
      errorBudget: draft.errorBudget,
      qreVersion: engine?.qdkVersion ? `qdk-${engine.qdkVersion}` : 'unknown'
    }
    const run = await window.api.runQre(inputs, name)
    await get().refreshRuns()
    return run
  }
}))
