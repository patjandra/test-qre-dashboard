#!/usr/bin/env python3
"""QRE worker: reads a JSON estimation config on stdin, runs the Microsoft
Quantum Resource Estimator (qdk.qre), and prints a normalized JSON frontier on
stdout. Non-zero exit + stderr message on failure.

Verified against qdk 1.29.x. The estimator returns an EstimationTable that is a
list of EstimationTableEntry objects; each entry exposes `qubits` (int),
`runtime` (int nanoseconds), `error` (float), `factories` (dict) and
`properties` (dict keyed by integer property ids decoded via property_name).

Input (stdin) JSON:
  { "programPath": str, "lang": str, "arch": {errorRate, gateTimeNs, measurementTimeNs},
    "qec": "SurfaceCode"|"SurfaceCodeLowMove", "factory": "RoundBasedFactory", "maxError": float }

Output (stdout) JSON:
  { "version": str, "frontier": [ FrontierPoint, ... ] }
"""
import json
import sys
from pathlib import Path


def fail(msg: str) -> None:
    print(msg, file=sys.stderr)
    sys.exit(1)


def to_ns(value) -> float:
    """Runtime is an int in ns on entries, but be defensive about Timedelta-likes."""
    if isinstance(value, (int, float)):
        return float(value)
    total_seconds = getattr(value, "total_seconds", None)
    if callable(total_seconds):
        return float(total_seconds()) * 1e9
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def main() -> None:
    try:
        cfg = json.load(sys.stdin)
    except Exception as e:  # noqa: BLE001
        fail(f"Invalid input JSON: {e}")

    try:
        import importlib.metadata as md
        from qdk import qsharp
        import qdk
        from qdk.qre.application import QSharpApplication
        from qdk.qre.models import GateBased, SurfaceCode, SurfaceCodeLowMove, RoundBasedFactory
        from qdk.qre import estimate, property_name
    except Exception as e:  # noqa: BLE001
        fail(f"qdk.qre is not installed or failed to import: {e}")

    lang = cfg.get("lang", "qsharp")
    if lang != "qsharp":
        fail(f"This worker currently supports Q# programs only (got lang={lang}).")

    try:
        source = Path(cfg["programPath"]).read_text(encoding="utf-8")
        qsharp.eval(source)
        app = QSharpApplication(qdk.code.Main)
    except Exception as e:  # noqa: BLE001
        fail(f"Failed to load Q# program '{cfg.get('programPath')}': {e}")

    arch_cfg = cfg["arch"]
    try:
        arch = GateBased(
            error_rate=arch_cfg["errorRate"],
            gate_time=int(arch_cfg["gateTimeNs"]),
            measurement_time=int(arch_cfg["measurementTimeNs"]),
        )
    except Exception as e:  # noqa: BLE001
        fail(f"Failed to build architecture model: {e}")

    qec_map = {"SurfaceCode": SurfaceCode, "SurfaceCodeLowMove": SurfaceCodeLowMove}
    qec_cls = qec_map.get(cfg.get("qec"), SurfaceCode)
    factory_cls = RoundBasedFactory  # only supported factory for now

    try:
        table = estimate(
            app,
            arch,
            isa_query=qec_cls.q() * factory_cls.q(),
            max_error=cfg["maxError"],
        )
    except Exception as e:  # noqa: BLE001
        fail(f"Estimation failed: {e}")

    def prop_name(key):
        try:
            return str(property_name(key))
        except Exception:  # noqa: BLE001
            return str(key)

    frontier = []
    for entry in table:
        props = {prop_name(k): v for k, v in dict(entry.properties).items()}

        # Map known properties onto our schema where available; everything else is
        # preserved in `extra` so no QRE-provided metric is lost.
        point = {
            "physicalQubits": int(getattr(entry, "qubits", 0) or 0),
            "runtimeNs": to_ns(getattr(entry, "runtime", 0)),
            "logicalCycleTimeNs": float(props.get("LOGICAL_CYCLE_TIME", 0) or 0),
            "tStates": int(props.get("NUM_T_STATES", props.get("NUM_TSTATES", 0)) or 0),
            "logicalErrorRate": float(getattr(entry, "error", 0) or 0),
            "extra": {
                str(k): (v if isinstance(v, (int, float, str)) else str(v))
                for k, v in props.items()
            },
        }
        if "CODE_DISTANCE" in props:
            point["codeDistance"] = int(props["CODE_DISTANCE"])

        # Summarize T-factory usage when present.
        factories = getattr(entry, "factories", {}) or {}
        if factories:
            point["extra"]["NUM_FACTORIES"] = len(factories)

        frontier.append(point)

    version = md.version("qdk")
    json.dump({"version": f"qdk-{version}", "frontier": frontier}, sys.stdout)


if __name__ == "__main__":
    main()
