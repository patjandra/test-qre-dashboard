import { writeFileSync } from 'fs'
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { Channels, type ExportResult, type ImportResult } from '../shared/ipc'
import { runInputsSchema } from '../shared/schema'
import type { RunInputs } from '../shared/types'
import { defaultRunName } from '../shared/naming'
import { createRun, getRuns, getRun, deleteRun } from './db/runs'
import { getBenchmarks, getBenchmark } from './db/benchmarks'
import { getVersions, setActiveVersion } from './db/versions'
import { getEngine, getEngineStatus } from './engine'
import { compareRuns } from './compare'
import { exportRunToMarkdown, exportComparisonToMarkdown } from './export/markdown'

/** Resolves a benchmark id to its display name for Markdown reports. */
const benchmarkNameOf = (id: string): string | undefined => getBenchmark(id)?.name

/** Label for a run's application, used to build a default run name. */
function runApplicationLabel(inputs: RunInputs): string {
  if (inputs.benchmarkId) return getBenchmark(inputs.benchmarkId)?.name ?? inputs.benchmarkId
  return 'Imported program'
}

/** Returns the user-provided name, or a config-derived default when blank. */
function resolveRunName(inputs: RunInputs, name?: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return defaultRunName(
    runApplicationLabel(inputs),
    inputs.errorCorrection.qec,
    inputs.errorBudget
  )
}

/** Registers all ipcMain.handle endpoints. Call once after the engine + db are ready. */
export function registerIpc(): void {
  ipcMain.handle(Channels.runQre, async (_e, raw: RunInputs, name?: string) => {
    const inputs = runInputsSchema.parse(raw)
    const engine = getEngine()
    // Stamp the run with the engine's actual version for reproducibility.
    const stamped: RunInputs = { ...inputs, qreVersion: engine.version() }
    const outputs = await engine.run(stamped)
    return createRun(stamped, outputs, resolveRunName(stamped, name))
  })

  ipcMain.handle(Channels.getRuns, () => getRuns())
  ipcMain.handle(Channels.getRun, (_e, runId: string) => getRun(runId))
  ipcMain.handle(Channels.deleteRun, (_e, runId: string) => {
    deleteRun(runId)
  })

  // Duplication re-executes with the same inputs, producing a new immutable run.
  ipcMain.handle(Channels.duplicateRun, async (_e, runId: string) => {
    const original = getRun(runId)
    if (!original) return null
    const engine = getEngine()
    const inputs: RunInputs = { ...original.inputs, qreVersion: engine.version() }
    const outputs = await engine.run(inputs)
    return createRun(inputs, outputs, `${original.name} (copy)`)
  })

  ipcMain.handle(Channels.getBenchmarks, () => getBenchmarks())

  ipcMain.handle(Channels.importProgram, async (e): Promise<ImportResult> => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: 'Import quantum program',
      properties: ['openFile'],
      filters: [
        { name: 'Q# program', extensions: ['qs'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }
    return { canceled: false, path: result.filePaths[0] }
  })

  ipcMain.handle(Channels.compareRuns, (_e, runIds: string[]) => {
    const runs = runIds.map((id) => getRun(id)).filter((r): r is NonNullable<typeof r> => !!r)
    return compareRuns(runs)
  })

  ipcMain.handle(Channels.exportRun, async (e, runId: string): Promise<ExportResult> => {
    const run = getRun(runId)
    if (!run) return { saved: false }
    return saveMarkdown(
      e.sender,
      `qre-run-${runId.slice(0, 8)}.md`,
      exportRunToMarkdown(run, benchmarkNameOf)
    )
  })

  ipcMain.handle(Channels.exportComparison, async (e, runIds: string[]): Promise<ExportResult> => {
    const runs = runIds.map((id) => getRun(id)).filter((r): r is NonNullable<typeof r> => !!r)
    if (runs.length < 2) return { saved: false }
    return saveMarkdown(
      e.sender,
      'qre-comparison.md',
      exportComparisonToMarkdown(runs, benchmarkNameOf)
    )
  })

  ipcMain.handle(Channels.getEngineStatus, () => getEngineStatus())
  ipcMain.handle(Channels.getVersions, () => getVersions())
  ipcMain.handle(Channels.setActiveVersion, (_e, version: string) => {
    setActiveVersion(version)
  })
}

async function saveMarkdown(
  sender: Electron.WebContents,
  defaultName: string,
  content: string
): Promise<ExportResult> {
  const win = BrowserWindow.fromWebContents(sender) ?? undefined
  const result = await dialog.showSaveDialog(win!, {
    title: 'Export Markdown',
    defaultPath: defaultName,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (result.canceled || !result.filePath) return { saved: false }
  writeFileSync(result.filePath, content, 'utf-8')
  return { saved: true, path: result.filePath }
}
