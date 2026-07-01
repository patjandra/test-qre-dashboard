import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { validateCircuitFile, MAX_CIRCUIT_BYTES } from '../src/main/security/circuitFile'

const CLEAN_QS = `namespace Sample {
    import Std.Diagnostics.*;
    @EntryPoint()
    operation Main() : Result {
        use q = Qubit();
        H(q);
        return MResetZ(q);
    }
}
`

let dir: string
const p = (name: string): string => join(dir, name)

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'qre-circuit-'))
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('validateCircuitFile', () => {
  it('accepts a clean Q# file and returns a sha256', () => {
    writeFileSync(p('clean.qs'), CLEAN_QS)
    const v = validateCircuitFile(p('clean.qs'), 'qsharp')
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.bytes).toBe(Buffer.byteLength(CLEAN_QS))
      expect(v.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('rejects a missing file', () => {
    const v = validateCircuitFile(p('nope.qs'), 'qsharp')
    expect(v).toMatchObject({ ok: false })
  })

  it('rejects an empty file', () => {
    writeFileSync(p('empty.qs'), '')
    expect(validateCircuitFile(p('empty.qs'), 'qsharp')).toMatchObject({ ok: false })
  })

  it('rejects a wrong extension', () => {
    writeFileSync(p('prog.txt'), CLEAN_QS)
    const v = validateCircuitFile(p('prog.txt'), 'qsharp')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toMatch(/unexpected file type/)
  })

  it('rejects a file exceeding the size limit', () => {
    writeFileSync(p('big.qs'), Buffer.alloc(MAX_CIRCUIT_BYTES + 1, 0x20))
    const v = validateCircuitFile(p('big.qs'), 'qsharp')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toMatch(/too large/)
  })

  it('rejects content with NUL bytes (binary)', () => {
    writeFileSync(p('binary.qs'), Buffer.from([0x48, 0x00, 0x49, 0x00]))
    const v = validateCircuitFile(p('binary.qs'), 'qsharp')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toMatch(/NUL|binary/)
  })

  it('rejects an executable disguised by extension (MZ magic)', () => {
    writeFileSync(p('mal.qs'), Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]))
    const v = validateCircuitFile(p('mal.qs'), 'qsharp')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toMatch(/executable/)
  })

  it('rejects embedded script/subprocess payloads', () => {
    writeFileSync(p('payload.qs'), CLEAN_QS + '\n// import os; os.system("rm -rf /")\n')
    const v = validateCircuitFile(p('payload.qs'), 'qsharp')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toMatch(/suspicious/)
  })

  it('rejects invalid UTF-8', () => {
    // 0xff is never valid in UTF-8 and is not a NUL/control byte.
    writeFileSync(p('bad-utf8.qs'), Buffer.from([0x6f, 0x70, 0xff, 0xfe, 0x0a]))
    expect(validateCircuitFile(p('bad-utf8.qs'), 'qsharp')).toMatchObject({ ok: false })
  })

  it('rejects symbolic links', () => {
    writeFileSync(p('target.qs'), CLEAN_QS)
    try {
      symlinkSync(p('target.qs'), p('link.qs'))
    } catch {
      return // some environments disallow symlink creation; skip
    }
    const v = validateCircuitFile(p('link.qs'), 'qsharp')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toMatch(/symbolic link/)
  })
})
