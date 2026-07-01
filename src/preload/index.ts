import { contextBridge, ipcRenderer } from 'electron'
import { Channels, type RendererApi } from '../shared/ipc'

const api: RendererApi = {
  runQre: (inputs, name) => ipcRenderer.invoke(Channels.runQre, inputs, name),
  getRuns: () => ipcRenderer.invoke(Channels.getRuns),
  getRun: (runId) => ipcRenderer.invoke(Channels.getRun, runId),
  deleteRun: (runId) => ipcRenderer.invoke(Channels.deleteRun, runId),
  duplicateRun: (runId) => ipcRenderer.invoke(Channels.duplicateRun, runId),
  getBenchmarks: () => ipcRenderer.invoke(Channels.getBenchmarks),
  importProgram: () => ipcRenderer.invoke(Channels.importProgram),
  compareRuns: (runIds) => ipcRenderer.invoke(Channels.compareRuns, runIds),
  exportRun: (runId) => ipcRenderer.invoke(Channels.exportRun, runId),
  exportComparison: (runIds) => ipcRenderer.invoke(Channels.exportComparison, runIds),
  getEngineStatus: () => ipcRenderer.invoke(Channels.getEngineStatus)
}

contextBridge.exposeInMainWorld('api', api)
