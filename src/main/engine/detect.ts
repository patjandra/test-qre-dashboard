import { spawnSync } from 'child_process'

export interface PythonProbe {
  available: boolean
  python?: string
  qdkVersion?: string
  detail: string
}

const DEFAULT_CANDIDATES = ['python3', 'python']

/**
 * Probes the machine once for a Python interpreter that can import qdk.qre.
 * Tries `extraCandidates` first (e.g. an explicit QRE_PYTHON or a project venv),
 * then falls back to `python3`/`python` on PATH. Returns the first working
 * interpreter and the detected qdk version.
 */
export function probePython(extraCandidates: string[] = []): PythonProbe {
  const candidates = [...extraCandidates.filter(Boolean), ...DEFAULT_CANDIDATES]
  for (const py of candidates) {
    const res = spawnSync(
      py,
      [
        '-c',
        'import importlib.metadata as m; import qdk.qre; print(m.version("qdk"))'
      ],
      { encoding: 'utf-8', timeout: 15_000 }
    )
    if (res.error) continue // interpreter not found, try next
    if (res.status === 0) {
      return {
        available: true,
        python: py,
        qdkVersion: res.stdout.trim(),
        detail: `Using real QRE engine via ${py} (qdk ${res.stdout.trim()}).`
      }
    }
  }
  return {
    available: false,
    detail:
      'Python with qdk.qre not found. Falling back to the deterministic mock engine. ' +
      'Install with: pip install --upgrade "qdk[qre]"'
  }
}
