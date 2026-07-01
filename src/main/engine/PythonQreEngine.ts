import { spawn, type ChildProcess } from 'child_process'
import type { RunInputs, RunOutputs, FrontierPoint } from '../../shared/types'
import { type QreEngine, chooseFrontierIndex } from './QreEngine'

interface WorkerResponse {
  ok: boolean
  version?: string
  frontier?: FrontierPoint[]
  error?: string
}

interface Pending {
  resolve: (out: RunOutputs) => void
  reject: (err: Error) => void
}

/**
 * Real engine: drives the qdk.qre module through a bundled Python worker.
 *
 * The worker is long-lived (importing qdk costs ~2.7s, so we pay it once): we
 * spawn it on first use and keep it warm, exchanging newline-delimited JSON —
 * one request line in, one response line out. Requests are answered in FIFO
 * order, matched to a queue of pending promises. If the process dies, all
 * pending requests reject and the next run respawns it.
 */
export class PythonQreEngine implements QreEngine {
  private proc: ChildProcess | null = null
  private buffer = ''
  private stderr = ''
  private readonly queue: Pending[] = []

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
      const proc = this.ensureProc()
      if (!proc.stdin) {
        reject(new Error('QRE worker stdin unavailable'))
        return
      }
      this.queue.push({ resolve, reject })
      proc.stdin.write(JSON.stringify(payload) + '\n')
    })
  }

  /** Spawns the worker if it isn't already running, wiring up its streams. */
  private ensureProc(): ChildProcess {
    if (this.proc) return this.proc

    const proc = spawn(this.python, [this.workerPath], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.proc = proc
    this.buffer = ''
    this.stderr = ''

    proc.stdout?.on('data', (d) => this.onStdout(d.toString()))
    proc.stderr?.on('data', (d) => {
      this.stderr += d.toString()
    })
    proc.on('error', (err) => {
      this.proc = null
      this.failAll(err)
    })
    proc.on('close', (code) => {
      const err = new Error(this.stderr.trim() || `QRE worker exited with code ${code}`)
      this.proc = null
      this.failAll(err)
    })
    return proc
  }

  /** Parses complete NDJSON lines from stdout and resolves them in FIFO order. */
  private onStdout(chunk: string): void {
    this.buffer += chunk
    let nl: number
    while ((nl = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, nl).trim()
      this.buffer = this.buffer.slice(nl + 1)
      if (!line) continue
      const pending = this.queue.shift()
      if (!pending) continue
      try {
        const resp = JSON.parse(line) as WorkerResponse
        if (resp.ok && resp.frontier) {
          pending.resolve({
            frontier: resp.frontier,
            chosenIndex: chooseFrontierIndex(resp.frontier)
          })
        } else {
          pending.reject(new Error(resp.error || 'QRE worker reported an error'))
        }
      } catch (e) {
        pending.reject(new Error(`Failed to parse QRE worker output: ${(e as Error).message}`))
      }
    }
  }

  private failAll(err: Error): void {
    const pendings = this.queue.splice(0, this.queue.length)
    for (const p of pendings) p.reject(err)
  }

  /** Terminates the warm worker (called on app shutdown). */
  dispose(): void {
    if (!this.proc) return
    this.proc.stdin?.end()
    this.proc.kill()
    this.proc = null
  }
}
