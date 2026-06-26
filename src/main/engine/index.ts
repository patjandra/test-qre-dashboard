import { join } from 'path'
import { app } from 'electron'
import type { EngineStatus } from '../../shared/types'
import type { QreEngine } from './QreEngine'
import { MockQreEngine } from './MockQreEngine'
import { PythonQreEngine } from './PythonQreEngine'
import { probePython } from './detect'
import { upsertVersion, getActiveVersion, setActiveVersion } from '../db/versions'

let engine: QreEngine | null = null
let status: EngineStatus | null = null

/** Resolves the bundled Python worker path in both dev and packaged builds. */
function workerPath(): string {
  // In dev, resources live in the project tree; when packaged they sit in resources/.
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath()
  return join(base, 'resources', 'python', 'qre_worker.py')
}

/**
 * Python interpreters to try before the bare `python3`/`python` on PATH:
 * an explicit QRE_PYTHON override, then a project-local virtual environment.
 * This lets `pip install "qdk[qre]"` into a venv be picked up automatically.
 */
function pythonCandidates(): string[] {
  const base = app.getAppPath()
  const venv =
    process.platform === 'win32'
      ? join(base, '.venv', 'Scripts', 'python.exe')
      : join(base, '.venv', 'bin', 'python')
  return [process.env.QRE_PYTHON ?? '', venv]
}

/**
 * Detects available engines once and selects the default: real Python (qdk.qre)
 * when available, otherwise the deterministic mock. Records the version in the db.
 */
export function initEngine(): EngineStatus {
  if (status && engine) return status

  const probe = probePython(pythonCandidates())
  const mock = new MockQreEngine()

  if (probe.available && probe.python && probe.qdkVersion) {
    const py = new PythonQreEngine(probe.python, workerPath(), probe.qdkVersion)
    engine = py
    status = {
      active: 'python',
      pythonAvailable: true,
      qdkVersion: probe.qdkVersion,
      detail: probe.detail
    }
    registerVersion(py.version())
  } else {
    engine = mock
    status = {
      active: 'mock',
      pythonAvailable: false,
      detail: probe.detail
    }
    registerVersion(mock.version())
  }
  return status
}

function registerVersion(version: string): void {
  upsertVersion({ version, path: workerPath(), active: false })
  if (!getActiveVersion()) setActiveVersion(version)
}

export function getEngine(): QreEngine {
  if (!engine) initEngine()
  return engine!
}

export function getEngineStatus(): EngineStatus {
  if (!status) initEngine()
  return status!
}
