import { join } from 'path'
import { app } from 'electron'
import type { EngineStatus } from '../../shared/types'
import type { QreEngine } from './QreEngine'
import { PythonQreEngine } from './PythonQreEngine'
import { probePython } from './detect'
import { MockQreEngine } from './MockQreEngine'

let engine: QreEngine | null = null
let status: EngineStatus | null = null

/** Resolves the bundled Python worker path in both dev and packaged builds. */
function workerPath(): string {
  // In dev, resources live in the project tree; when packaged they sit in resources/.
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath()
  return join(base, 'resources', 'python', 'qre_worker.py')
}

/**
 * Path to the Python interpreter bundled inside a packaged build. Provisioned at
 * build time by scripts/provision-python.mjs and shipped via electron-builder's
 * extraResources as `<resources>/python-runtime`. Empty string in dev (not packaged).
 */
function bundledPython(): string {
  if (!app.isPackaged) return ''
  const root = join(process.resourcesPath, 'python-runtime')
  return process.platform === 'win32'
    ? join(root, 'python.exe')
    : join(root, 'bin', 'python3')
}

/**
 * Python interpreters to try, most-preferred first:
 *   1. the interpreter bundled in the packaged app (so a download "just works"),
 *   2. an explicit QRE_PYTHON override,
 *   3. a project-local virtual environment (dev convenience).
 * Detection then falls back to `python3`/`python` on PATH (see detect.ts).
 */
function pythonCandidates(): string[] {
  const base = app.getAppPath()
  const venv =
    process.platform === 'win32'
      ? join(base, '.venv', 'Scripts', 'python.exe')
      : join(base, '.venv', 'bin', 'python')
  return [bundledPython(), process.env.QRE_PYTHON ?? '', venv]
}

/** Demo mode: opt-in via QRE_MOCK so the UI can be exercised without qdk. */
function mockRequested(): boolean {
  const v = process.env.QRE_MOCK
  return v === '1' || v === 'true'
}

/**
 * Selects the engine once. Normally the app runs exclusively against the real
 * qdk.qre Python module: when it's available we build the engine and record its
 * version; when it isn't, the engine stays unavailable and runs fail with an
 * actionable error (see getEngine) rather than silently producing fake numbers.
 *
 * The one exception is an explicit demo mode (QRE_MOCK=1), which forces the
 * deterministic MockQreEngine so the UI can be shown end-to-end with synthetic
 * data. It is never a silent fallback — it only activates when asked for.
 */
export function initEngine(): EngineStatus {
  if (status) return status

  if (mockRequested()) {
    engine = new MockQreEngine()
    status = {
      available: true,
      mock: true,
      qdkVersion: engine.version(),
      detail: 'Demo mode (QRE_MOCK): synthetic data for UI testing — not real estimates.'
    }
    return status
  }

  const probe = probePython(pythonCandidates())

  if (probe.available && probe.python && probe.qdkVersion) {
    const py = new PythonQreEngine(probe.python, workerPath(), probe.qdkVersion)
    engine = py
    status = {
      available: true,
      qdkVersion: probe.qdkVersion,
      detail: probe.detail
    }
  } else {
    engine = null
    status = {
      available: false,
      detail: probe.detail
    }
  }
  return status
}

export function getEngine(): QreEngine {
  if (!status) initEngine()
  if (!engine) {
    throw new Error(
      'The real QRE engine (qdk.qre) is not available on this machine, so no run can be executed. ' +
        'Install it and restart: pip install --upgrade "qdk[qre]"'
    )
  }
  return engine
}

/** Tears down any warm worker process held by the active engine (call on quit). */
export function disposeEngine(): void {
  ;(engine as { dispose?: () => void } | null)?.dispose?.()
}

export function getEngineStatus(): EngineStatus {
  if (!status) initEngine()
  return status!
}
