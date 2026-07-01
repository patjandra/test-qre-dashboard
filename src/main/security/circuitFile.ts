// Static malware/abuse validation for user-uploaded circuit (quantum program)
// files. The app runs fully offline, so there is no cloud AV to call; instead we
// enforce a defense-in-depth set of checks before a file is ever read by the QRE
// worker (which evaluates its contents via qsharp.eval):
//
//   1. file hygiene   — must be a real, regular, non-symlink file of sane size
//   2. type allowlist — extension must match the declared language
//   3. binary guard   — reject NUL bytes, executable/archive magic, and files
//                        with a high ratio of control bytes (mislabeled binaries)
//   4. encoding       — must decode as strict UTF-8 text
//   5. content scan   — heuristic signatures for embedded scripts/payloads that
//                        have no business in a quantum source file
//
// A passing file also gets a SHA-256 recorded so the accepted artifact is
// identifiable/auditable. This is not a substitute for an antivirus engine; it is
// a domain-specific gate that blocks the obvious abuse vectors for this input.

import { createHash } from 'crypto'
import { lstatSync, readFileSync } from 'fs'
import { extname } from 'path'
import type { ApplicationLang } from '../../shared/types'

/** Circuit source files are tiny; anything larger is rejected outright. */
export const MAX_CIRCUIT_BYTES = 5 * 1024 * 1024 // 5 MB

/** Allowed file extensions per language (lowercase, without the dot). */
export const ALLOWED_EXTENSIONS: Record<ApplicationLang, string[]> = {
  qsharp: ['qs'],
  cirq: ['py'],
  openqasm: ['qasm'],
  qir: ['ll', 'bc'],
  'logical-counts': ['json']
}

/** Max share of control bytes (excluding tab/newline/CR) before we call it binary. */
const CONTROL_BYTE_LIMIT = 0.1

/** Leading magic numbers for executables/archives that must never be a circuit. */
const MAGIC_SIGNATURES: { bytes: number[]; label: string }[] = [
  { bytes: [0x4d, 0x5a], label: 'Windows executable (MZ/PE)' },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], label: 'Linux executable (ELF)' },
  { bytes: [0xfe, 0xed, 0xfa, 0xce], label: 'Mach-O executable' },
  { bytes: [0xfe, 0xed, 0xfa, 0xcf], label: 'Mach-O executable' },
  { bytes: [0xcf, 0xfa, 0xed, 0xfe], label: 'Mach-O executable' },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], label: 'Mach-O/Java executable' },
  { bytes: [0x50, 0x4b, 0x03, 0x04], label: 'ZIP/Office archive' },
  { bytes: [0x25, 0x50, 0x44, 0x46], label: 'PDF document' }
]

/**
 * Content signatures that indicate an embedded script or payload. These are
 * tokens that do not occur in legitimate quantum source (Q#'s `import` keyword is
 * deliberately NOT matched — only `__import__`/script constructs are).
 */
const SUSPICIOUS_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /#!\s*\/(?:usr\/)?(?:bin|sbin)\//, label: 'shell shebang line' },
  { re: /<\s*script\b/i, label: 'embedded <script> tag' },
  { re: /\b__import__\s*\(/, label: 'Python __import__ call' },
  { re: /\b(?:os\.system|subprocess|pty\.spawn|popen)\b/i, label: 'OS/subprocess execution' },
  { re: /\bchild_process\b/i, label: 'Node child_process usage' },
  { re: /\beval\s*\(/, label: 'eval() call' },
  { re: /\bexec\s*\(/, label: 'exec() call' },
  { re: /\b(?:powershell|cmd\.exe)\b|\/bin\/(?:sh|bash)\b/i, label: 'shell command invocation' },
  { re: /data:[^;,\s]*;base64,/i, label: 'base64 data URI payload' }
]

export type CircuitValidation =
  | { ok: true; bytes: number; sha256: string }
  | { ok: false; reason: string }

function fail(reason: string): CircuitValidation {
  return { ok: false, reason }
}

function startsWith(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false
  for (let i = 0; i < bytes.length; i++) {
    if (buf[i] !== bytes[i]) return false
  }
  return true
}

/** True for bytes that should not appear in a text file (tab/LF/CR excepted). */
function isControlByte(b: number): boolean {
  if (b === 0x09 || b === 0x0a || b === 0x0d) return false
  return b < 0x20 || b === 0x7f
}

/**
 * Validates a user-supplied circuit file. Returns `{ ok: true }` with the byte
 * count and a SHA-256 of the contents, or `{ ok: false, reason }` describing why
 * the file was rejected. Pure and synchronous so it can gate both import and run.
 */
export function validateCircuitFile(filePath: string, lang: ApplicationLang): CircuitValidation {
  // 1. File hygiene. lstat (not stat) so a symlink is seen as a symlink and
  //    rejected — a symlink could point the worker at an arbitrary sensitive file.
  let stat
  try {
    stat = lstatSync(filePath)
  } catch {
    return fail('file does not exist or is not accessible')
  }
  if (stat.isSymbolicLink()) return fail('symbolic links are not allowed')
  if (!stat.isFile()) return fail('path is not a regular file')
  if (stat.size === 0) return fail('file is empty')
  if (stat.size > MAX_CIRCUIT_BYTES) {
    return fail(`file is too large (${stat.size} bytes; limit ${MAX_CIRCUIT_BYTES})`)
  }

  // 2. Extension allowlist for the declared language.
  const ext = extname(filePath).slice(1).toLowerCase()
  const allowed = ALLOWED_EXTENSIONS[lang]
  if (!allowed) return fail(`unsupported language: ${lang}`)
  if (!allowed.includes(ext)) {
    return fail(`unexpected file type ".${ext || '(none)'}" for ${lang} (expected ${allowed.map((e) => '.' + e).join(', ')})`)
  }

  // Read once for all content-based checks.
  let buf: Buffer
  try {
    buf = readFileSync(filePath)
  } catch {
    return fail('file could not be read')
  }

  // 3. Binary guard: executable/archive magic, NUL bytes, control-byte ratio.
  for (const sig of MAGIC_SIGNATURES) {
    if (startsWith(buf, sig.bytes)) return fail(`file looks like a ${sig.label}, not a circuit`)
  }
  let control = 0
  for (const b of buf) {
    if (b === 0x00) return fail('file contains NUL bytes (appears to be binary)')
    if (isControlByte(b)) control++
  }
  if (control / buf.length > CONTROL_BYTE_LIMIT) {
    return fail('file appears to be binary, not text')
  }

  // 4. Encoding: must be strict, valid UTF-8 text.
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return fail('file is not valid UTF-8 text')
  }

  // 5. Content scan for embedded scripts/payloads.
  for (const { re, label } of SUSPICIOUS_PATTERNS) {
    if (re.test(text)) return fail(`file contains a suspicious pattern (${label})`)
  }

  const sha256 = createHash('sha256').update(buf).digest('hex')
  return { ok: true, bytes: buf.length, sha256 }
}
