import json
import sys
from pathlib import Path


def fail(message: str) -> None:
    raise SystemExit(f"static baseline validation failed: {message}")


def require_number(value: object, label: str) -> None:
    if not isinstance(value, (int, float)):
        fail(f"{label} must be numeric")


def validate_summary(summary: object, label: str) -> None:
    if not isinstance(summary, dict):
        fail(f"{label}.summary must be an object")
    for key in ("detection_rate", "false_positives_per_contract", "findings_per_contract", "contracts_scanned"):
        require_number(summary.get(key), f"{label}.summary.{key}")
    coverage = summary.get("swc_coverage")
    if not isinstance(coverage, dict) or not coverage:
        fail(f"{label}.summary.swc_coverage must be a non-empty object")
    for swc, cell in coverage.items():
        if not isinstance(swc, str) or not swc.startswith("SWC-"):
            fail(f"{label}.summary.swc_coverage contains invalid SWC key {swc!r}")
        if not isinstance(cell, dict):
            fail(f"{label}.summary.swc_coverage.{swc} must be an object")
        require_number(cell.get("found"), f"{label}.summary.swc_coverage.{swc}.found")
        require_number(cell.get("total"), f"{label}.summary.swc_coverage.{swc}.total")


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "output/static_baseline.json")
    data = json.loads(path.read_text())

    if data.get("baseline_id") != "static-analyzer-baselines-v2":
        fail("baseline_id must be static-analyzer-baselines-v2")
    validate_summary(data.get("summary"), "root")

    comparators = data.get("comparators")
    if not isinstance(comparators, list) or not comparators:
        fail("comparators must be a non-empty list")

    ids = set()
    heuristic = None
    for comparator in comparators:
        if not isinstance(comparator, dict):
            fail("each comparator must be an object")
        comparator_id = comparator.get("id")
        if not isinstance(comparator_id, str) or not comparator_id:
            fail("comparator.id must be a non-empty string")
        if comparator_id in ids:
            fail(f"duplicate comparator id {comparator_id}")
        ids.add(comparator_id)
        if comparator_id == "heuristic":
            heuristic = comparator
        if comparator.get("summary") is not None:
            validate_summary(comparator.get("summary"), f"comparators.{comparator_id}")

    if not heuristic:
        fail("heuristic comparator is required")
    if heuristic.get("summary") is None:
        fail("heuristic comparator must have a summary")

    print(f"validated {path}")


if __name__ == "__main__":
    main()
