import { spawn } from 'child_process'
import type { RunInputs, RunOutputs, FrontierPoint } from '../../shared/types'
import { type QreEngine, chooseFrontierIndex } from './QreEngine'

interface WorkerResult {
  version: string
  frontier: FrontierPoint[]
}

/**
 * Real engine: spawns a bundled Python worker that drives the qdk.qre module.
 * The worker reads a JSON config on stdin and prints a JSON frontier on stdout.
 */
export class PythonQreEngine implements QreEngine {
  readonly kind = 'python' as const

  constructor(
    private readonly python: string,
    private readonly workerPath: string,
    private readonly qdkVersion: string
  ) {}

  version(): string {
    return `qdk-${this.qdkVersion}`
  }

  run(input: RunInputs): Promise<RunOutputs> {
    const payload = {
      programPath: input.applicationPath,
      lang: input.applicationLang,
      arch: input.architectureModel,
      qec: input.errorCorrection.qec,
      factory: input.errorCorrection.factory,
      maxError: input.errorBudget
    }

    return new Promise<RunOutputs>((resolve, reject) => {
      const proc = spawn(this.python, [this.workerPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (d) => (stdout += d.toString()))
      proc.stderr.on('data', (d) => (stderr += d.toString()))
      proc.on('error', (err) => reject(err))
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr.trim() || `QRE worker exited with code ${code}`))
          return
        }
        try {
          const parsed = JSON.parse(stdout) as WorkerResult
          resolve({
            frontier: parsed.frontier,
            chosenIndex: chooseFrontierIndex(parsed.frontier)
          })
        } catch (e) {
          reject(new Error(`Failed to parse QRE worker output: ${(e as Error).message}`))
        }
      })
      proc.stdin.write(JSON.stringify(payload))
      proc.stdin.end()
    })
  }
}
