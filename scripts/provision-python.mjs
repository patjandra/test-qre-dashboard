#!/usr/bin/env node
/**
 * Provisions a self-contained, relocatable Python interpreter with the Microsoft
 * Quantum Resource Estimator (`qdk[qre]`) pre-installed, so the packaged app ships
 * a working real QRE engine and needs no Python on the user's machine.
 *
 * It downloads a "install_only" CPython build from python-build-standalone
 * (https://github.com/astral-sh/python-build-standalone), extracts it to
 * build/python-runtime, then runs `pip install "qdk[qre]"` into it.
 *
 * Run on the SAME OS you are packaging for (native qdk wheels are platform-specific):
 *   - macOS build  -> run on macOS
 *   - Windows build -> run on Windows
 * electron-builder then ships build/python-runtime as <resources>/python-runtime.
 *
 * Usage: node scripts/provision-python.mjs [--triple <rust-triple>] [--py 3.12]
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, renameSync, readdirSync, createWriteStream } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const PY_SERIES = argOf('--py') ?? '3.12'
const DEST = resolve('build', 'python-runtime')
const CACHE = join(tmpdir(), 'qre-python-cache')

function argOf(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

/** Maps the current (or requested) platform to a python-build-standalone target triple. */
function targetTriple() {
  const explicit = argOf('--triple')
  if (explicit) return explicit
  const { platform, arch } = process
  if (platform === 'darwin') return arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin'
  if (platform === 'win32') return 'x86_64-pc-windows-msvc'
  if (platform === 'linux') return 'x86_64-unknown-linux-gnu'
  throw new Error(`Unsupported platform: ${platform}/${arch}`)
}

function interpreterPath(root) {
  return process.platform === 'win32' ? join(root, 'python.exe') : join(root, 'bin', 'python3')
}

async function resolveAssetUrl(triple) {
  // Ask GitHub for the latest release and pick the matching install_only tarball.
  const api = 'https://api.github.com/repos/astral-sh/python-build-standalone/releases/latest'
  const res = await fetch(api, { headers: { 'User-Agent': 'qre-desktop-build' } })
  if (!res.ok) throw new Error(`GitHub API ${res.status} resolving python-build-standalone release`)
  const rel = await res.json()
  const re = new RegExp(`^cpython-${PY_SERIES.replace('.', '\\.')}\\.\\d+\\+\\d+-${triple}-install_only\\.tar\\.gz$`)
  const asset = rel.assets.find((a) => re.test(a.name))
  if (!asset) throw new Error(`No install_only asset for ${triple} (python ${PY_SERIES}) in ${rel.tag_name}`)
  return { url: asset.browser_download_url, name: asset.name }
}

async function download(url, dest) {
  if (existsSync(dest)) {
    console.log(`  cached: ${dest}`)
    return
  }
  console.log(`  downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`)
  await new Promise((ok, err) => {
    const out = createWriteStream(dest)
    res.body.pipeTo(
      new WritableStream({
        write: (chunk) => new Promise((w) => out.write(chunk, w)),
        close: () => out.end(ok),
        abort: err
      })
    ).catch(err)
  })
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} -> exit ${r.status}`)
}

async function main() {
  const triple = targetTriple()
  console.log(`Provisioning embedded Python (${PY_SERIES}, ${triple}) with qdk[qre]…`)
  mkdirSync(CACHE, { recursive: true })

  const { url, name } = await resolveAssetUrl(triple)
  const archive = join(CACHE, name)
  await download(url, archive)

  // Fresh extraction.
  rmSync(DEST, { recursive: true, force: true })
  const staging = join(CACHE, 'extract')
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  console.log('  extracting…')
  run('tar', ['-xzf', archive, '-C', staging]) // `tar` ships on macOS, Linux, and Win10+

  // install_only archives extract to a top-level `python/` directory.
  const top = join(staging, 'python')
  const src = existsSync(top) ? top : join(staging, readdirSync(staging)[0])
  mkdirSync('build', { recursive: true })
  renameSync(src, DEST)

  const py = interpreterPath(DEST)
  console.log('  installing qdk[qre]…')
  run(py, ['-m', 'pip', 'install', '--upgrade', 'pip'])
  run(py, ['-m', 'pip', 'install', '--upgrade', 'qdk[qre]'])

  console.log('  verifying import…')
  run(py, ['-c', 'import importlib.metadata as m; import qdk.qre; print("qdk", m.version("qdk"))'])

  console.log(`\nDone. Embedded runtime ready at ${DEST}`)
}

main().catch((e) => {
  console.error(`\nProvisioning failed: ${e.message}`)
  process.exit(1)
})
