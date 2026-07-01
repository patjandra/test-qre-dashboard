#!/usr/bin/env python3
"""Persistent QRE worker.

Runs the Microsoft Quantum Resource Estimator (qdk.qre). Importing qdk costs
~2.7s, so this worker is long-lived: it imports once, then serves repeated
requests over stdin/stdout as newline-delimited JSON (NDJSON). The first run pays
the import cost; every run after is ~0.1s.

Protocol:
  stdin  : one JSON request object per line
             { "programPath": str, "lang": "qsharp",
               "arch": {errorRate, gateTimeNs, measurementTimeNs},
               "qec": "SurfaceCode"|"SurfaceCodeLowMove",
               "factory": "RoundBasedFactory", "maxError": float }
  stdout : one JSON response object per line
             { "ok": true, "version": str, "frontier": [FrontierPoint, ...] }
             { "ok": false, "error": str }

stdout carries ONLY protocol responses; any library chatter is redirected to
stderr so the NDJSON stream stays clean.

Verified against qdk 1.29.x.
"""
import json
import sys
from pathlib import Path


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
    # Import once. On failure, report on the protocol channel and exit non-zero.
    try:
        import importlib.metadata as md
        from qdk import qsharp
        import qdk
        from qdk.qre.application import QSharpApplication
        from qdk.qre.models import GateBased, SurfaceCode, SurfaceCodeLowMove, RoundBasedFactory
        from qdk.qre import estimate, property_name, instruction_ids
        from qdk.qre.property_keys import DISTANCE, CODE_CYCLE_TIME
    except Exception as e:  # noqa: BLE001
        sys.stdout.write(json.dumps({"ok": False, "error": f"qdk.qre import failed: {e}"}) + "\n")
        sys.stdout.flush()
        sys.exit(1)

    version = md.version("qdk")

    # Keep the protocol channel pure: send responses to the real stdout, and
    # redirect anything qdk/qsharp prints to stderr so it can't corrupt the stream.
    protocol = sys.stdout
    sys.stdout = sys.stderr

    qec_map = {"SurfaceCode": SurfaceCode, "SurfaceCodeLowMove": SurfaceCodeLowMove}

    def prop_name(key):
        try:
            return str(property_name(key))
        except Exception:  # noqa: BLE001
            return str(key)

    def lattice_surgery_metrics(entry):
        """Code distance and code-cycle time are NOT in entry.properties; they live
        on the LATTICE_SURGERY instruction in the entry's ISA source graph (set by the
        QEC model, e.g. qdk.qre.models.qec._surface_code). Walk the graph, find that
        instruction, and read its DISTANCE / CODE_CYCLE_TIME properties.

        Returns (distance, code_cycle_time_ns) — either may be None if not found.
        """
        src = getattr(entry, "source", None)
        if src is None:
            return (None, None)
        try:
            ls_id = instruction_ids.LATTICE_SURGERY
            nodes = src.nodes
            stack = list(src.roots)
        except Exception:  # noqa: BLE001
            return (None, None)
        seen = set()
        while stack:
            nid = stack.pop()
            if nid in seen:
                continue
            seen.add(nid)
            try:
                node = nodes[nid]
                instr = node.instruction
            except Exception:  # noqa: BLE001
                continue
            if getattr(instr, "id", None) == ls_id:
                try:
                    return (instr.get_property(DISTANCE), instr.get_property(CODE_CYCLE_TIME))
                except Exception:  # noqa: BLE001
                    return (None, None)
            stack.extend(getattr(node, "children", []) or [])
        return (None, None)

    def total_t_states(entry):
        """Total magic (T) states, summed across the entry's T-factories. Zero for
        Clifford-only circuits (no factories), which is correct."""
        facs = getattr(entry, "factories", {}) or {}
        total = 0
        for fr in dict(facs).values():
            total += int(getattr(fr, "states", 0) or 0)
        return total

    def build_point(entry):
        props = {prop_name(k): v for k, v in dict(entry.properties).items()}
        distance, code_cycle_time = lattice_surgery_metrics(entry)
        # Logical cycle time = code-cycle time x code distance (see surface_code model:
        # time_value = code_cycle_time * self.distance).
        logical_cycle_time = (
            float(code_cycle_time) * float(distance)
            if code_cycle_time is not None and distance is not None
            else 0.0
        )
        point = {
            "physicalQubits": int(getattr(entry, "qubits", 0) or 0),
            "runtimeNs": to_ns(getattr(entry, "runtime", 0)),
            "logicalCycleTimeNs": logical_cycle_time,
            "tStates": total_t_states(entry),
            "logicalErrorRate": float(getattr(entry, "error", 0) or 0),
            "extra": {
                str(k): (v if isinstance(v, (int, float, str)) else str(v))
                for k, v in props.items()
            },
        }
        if distance is not None:
            point["codeDistance"] = int(distance)
        if code_cycle_time is not None:
            point["extra"]["CODE_CYCLE_TIME"] = int(code_cycle_time)
        factories = getattr(entry, "factories", {}) or {}
        if factories:
            point["extra"]["NUM_FACTORIES"] = len(factories)
        return point

    def handle(cfg) -> dict:
        lang = cfg.get("lang", "qsharp")
        if lang != "qsharp":
            return {"ok": False, "error": f"This worker supports Q# programs only (got lang={lang})."}

        # Reset the interpreter so re-running the same (or a different) program in this
        # long-lived process never collides on redefinitions.
        qsharp.init()
        source = Path(cfg["programPath"]).read_text(encoding="utf-8")
        qsharp.eval(source)
        app = QSharpApplication(qdk.code.Main)

        a = cfg["arch"]
        arch = GateBased(
            error_rate=a["errorRate"],
            gate_time=int(a["gateTimeNs"]),
            measurement_time=int(a["measurementTimeNs"]),
        )
        qec_cls = qec_map.get(cfg.get("qec"), SurfaceCode)
        table = estimate(
            app,
            arch,
            isa_query=qec_cls.q() * RoundBasedFactory.q(),
            max_error=cfg["maxError"],
        )
        return {"ok": True, "version": f"qdk-{version}", "frontier": [build_point(e) for e in table]}

    # Serve requests until stdin closes.
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            cfg = json.loads(line)
        except Exception as e:  # noqa: BLE001
            resp = {"ok": False, "error": f"Invalid request JSON: {e}"}
        else:
            try:
                resp = handle(cfg)
            except Exception as e:  # noqa: BLE001
                resp = {"ok": False, "error": str(e)}
        protocol.write(json.dumps(resp) + "\n")
        protocol.flush()


if __name__ == "__main__":
    main()
