# QRE Desktop

A standalone **Electron + React + TypeScript** desktop application that runs Microsoft's
**Quantum Resource Estimator (QRE v3)** locally — outside VS Code or the command line.

The basic unit is a **run**: a locally executed resource estimation defined by an application
model, architecture model, error-correction/factory model, error budget, and QRE engine
version. Each run is stored as an **immutable** record so estimates stay reproducible,
comparable, and exportable.

## Features

- **Dashboard** — configure and execute an estimation (benchmark or imported `.qs` program,
  GateBased architecture parameters, QEC scheme + factory, error budget) and view the full
  Pareto frontier of results with metric-filter chips.
- **Run History** — browse, filter (benchmark / QEC / version), view, duplicate, and delete
  immutable run records.
- **Comparison** — multi-select runs and compare metrics with a Δ% table and bar charts.
- **Export** — export individual runs and comparison sets to Markdown.
- **Settings** — engine detection status and QRE version management.
- **Fully offline** — local SQLite persistence, no cloud dependencies.

## Engine: mock + real `qdk.qre`

QRE v3 is the open-source [`qdk[qre]`](https://github.com/microsoft/qdk/tree/main/source/qre)
**Python module**, not a standalone binary. The app ships two pluggable engines behind a
single `QreEngine` interface:

- **`PythonQreEngine`** (default when available) — spawns a bundled Python worker
  (`resources/python/qre_worker.py`) that drives `qdk.qre.estimate(...)` and returns a
  normalized Pareto frontier as JSON.
- **`MockQreEngine`** (deterministic fallback) — produces plausible, reproducible outputs
  derived from the inputs, so the entire app works on any machine with no Python.

At startup the app probes for a Python interpreter that can `import qdk.qre`. If found, the
real engine becomes the default; otherwise it falls back to the mock. The active engine is
shown in the sidebar and on the Settings page.

### Enable the real engine

```bash
pip install --upgrade "qdk[qre]"
```

Restart the app — the engine badge flips from **Mock engine** to **Real QRE**.

## Development

```bash
npm install        # installs deps and rebuilds better-sqlite3 for Electron
npm run dev        # launch the app with hot reload
npm test           # run unit tests (mock engine, comparison, Markdown export)
npm run typecheck  # typecheck main + renderer
npm run build      # production bundle into out/
```

## Architecture

```
src/
  main/      Electron main process: window lifecycle, IPC, engine, db, export
    engine/  QreEngine interface + Mock/Python implementations + detection
    db/      SQLite layer (runs / benchmarks / versions); runs are insert+read only
    export/  Markdown report generation
  preload/   contextBridge-exposed typed window.api
  renderer/  React UI (Dashboard, Run History, Run Detail, Comparison, Settings)
  shared/    domain types, zod schemas, IPC contract
resources/
  benchmarks/  bundled Q# samples from microsoft/qdk (see below)
  python/      qre_worker.py
```

Data is stored in a SQLite database under the Electron `userData` directory.

### Bundled benchmarks

Authentic Q# samples vendored from [`microsoft/qdk`](https://github.com/microsoft/qdk/tree/main/samples),
each verified to run through the real estimator:

| Benchmark | Source | Scale (default arch) |
| --- | --- | --- |
| Superdense Coding | `samples/algorithms/SuperdenseCoding.qs` | ~200 physical qubits |
| Quantum Teleportation | `samples/algorithms/Teleportation.qs` | ~200 physical qubits |
| Bernstein-Vazirani | `samples/algorithms/BernsteinVazirani.qs` | ~560 physical qubits |
| Grover's Search | `samples/algorithms/Grover.qs` | ~5k physical qubits |
| Phase Estimation | `samples/algorithms/PhaseEstimation.qs` | ~12k physical qubits |
| Deutsch-Jozsa | `samples/algorithms/DeutschJozsa.qs` | ~14k physical qubits |
| Quantum Dynamics | `samples/estimation/Dynamics.qs` | ~256k physical qubits |
| Shor's Factoring (RE) | `samples/estimation/ShorRE.qs` | ~90k physical qubits, ~33 s runtime |

To add more, drop a `<id>/main.qs` + `<id>/metadata.json` into `resources/benchmarks/`
(metadata: `{ id, name, entry, lang, description }`). The loader syncs them at startup.

### Reproducibility & versioning

Every run records the exact QRE engine version used. The `versions` table tracks installed
engines; the active version is selectable in Settings. Duplicating a run re-executes with the
same inputs as a brand-new immutable record.

## Notes / future work

- PDF export is left as a seam (wrap the Markdown output).
- Application languages beyond Q# (Cirq, OpenQASM, QIR, logical counts) are modeled in the
  type system and can be added to the Python worker.
- A pull-oriented update mechanism for the app and benchmark library is planned (see SOW).
