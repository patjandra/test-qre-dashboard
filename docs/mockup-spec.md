# QRE Desktop — Mockup Spec (Dashboard & Comparison)

The required **features** and **fields/values** for the Dashboard and Comparison
pages. This defines *what must be present*, not how it should look — layout,
styling, and interaction patterns are the designer's call.

---

## Global (both pages)

- A way to **navigate** between Dashboard, Comparison (and Settings).
- An **engine status** indicator with three states: **Real QRE**, **Demo data**,
  **QRE unavailable**.

---

## Dashboard page

Must let a user configure a run, execute it, view the result, and browse past runs.

### 1) Configure a run

**Application (choose one):**
- **Benchmark** — select from bundled samples: Bernstein–Vazirani, Shor, Grover,
  Deutsch–Jozsa, Phase Estimation, Teleportation, Superdense Coding, Dynamics.
- **Import a program** — pick a `.qs` file. Must show the selected file and an
  error state when a file is rejected.

**Architecture (GateBased):**
- **Physical error rate** — number, default `1e-4` (supports scientific notation).
- **Gate time (ns)** — number, default `100`.
- **Measurement time (ns)** — number, default `500`.

**Error correction & budget:**
- **QEC scheme** — choose: Surface Code, Surface Code (Low Move).
- **T-factory model** — Round Based Factory (only option).
- **Error budget (max error)** — number, default `0.01`.

**Run:**
- **Run name** — optional text; blank uses an auto-generated default.
- **Run** action — disabled until an application is chosen; shows a busy state
  while running; shows an error state on failure.

Number-field rules: positive values; empty/invalid defaults to `0`; no leading
zeros (`0123` invalid); `.124` becomes `0.124`.

### 2) Results (after a run)

Show the result metrics, a **Pareto frontier / trade-off visualization**, and the
full frontier as data. Required metrics:

- Physical Qubits
- Runtime
- Logical Cycle Time
- T States
- Logical Error Rate
- Code Distance

The trade-off view plots **physical qubits vs. runtime** and indicates the chosen
representative point. Users can control which metrics are shown.

### 3) Run history

- List of past runs with their key inputs and metrics.
- Per-run actions: **view details**, **duplicate/re-run**, **delete**.
- Ability to **filter** the list (e.g. by benchmark, architecture, version).
- **Export a run** (Markdown).

**States to cover:** empty (no runs), loading, engine unavailable.

---

## Comparison page

Must let a user compare multiple runs side by side.

- **Select runs** to compare (2 or more) and clear the selection.
- **Comparison table** of metrics per run, including a **delta vs. a baseline run**.
- **Per-metric visualizations** comparing the selected runs.
- **Export the comparison** (Markdown).
- **Empty state** when fewer than 2 runs are selected.

Metrics compared are the same six listed under Results.

---

## Field / value reference

| Field | Type | Values / default |
|---|---|---|
| Benchmark | select | 8 bundled samples |
| Import program | file | `.qs`, validated |
| Physical error rate | number | `1e-4` |
| Gate time (ns) | number | `100` |
| Measurement time (ns) | number | `500` |
| QEC scheme | select | Surface Code / Surface Code (Low Move) |
| T-factory model | select (fixed) | Round Based Factory |
| Error budget (max error) | number | `0.01` |
| Run name | text (optional) | auto default |
| Metrics (results/comparison) | — | Physical Qubits, Runtime, Logical Cycle Time, T States, Logical Error Rate, Code Distance |
| Run selection (comparison) | multi-select | 2+ runs |
