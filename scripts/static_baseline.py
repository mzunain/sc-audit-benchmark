import argparse
import json
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

try:
    import resource
except ImportError:
    resource = None


SWC_NAMES = {
    "SWC-101": "Integer Overflow/Underflow",
    "SWC-104": "Unchecked Call Return Value",
    "SWC-105": "Unprotected Ether Withdrawal",
    "SWC-106": "Unprotected SELFDESTRUCT",
    "SWC-107": "Reentrancy",
    "SWC-112": "Delegatecall to Untrusted Callee",
    "SWC-114": "Transaction Order Dependence",
    "SWC-128": "DoS with Block Gas Limit",
}

EXTERNAL_TOOL_TIMEOUT_SECONDS = 45

DIRECT_DETECTOR_SWCS = {
    "arbitrary-send-eth": "SWC-105",
    "arbitrary-send-erc20": "SWC-105",
    "arbitrary-send-erc20-permit": "SWC-105",
    "calls-loop": "SWC-128",
    "controlled-array-length": "SWC-128",
    "controlled-delegatecall": "SWC-112",
    "delegatecall-loop": "SWC-112",
    "eth-send-unchecked-address": "SWC-105",
    "reentrancy-benign": "SWC-107",
    "reentrancy-eth": "SWC-107",
    "reentrancy-events": "SWC-107",
    "reentrancy-no-eth": "SWC-107",
    "reentrancy-state-change": "SWC-107",
    "reentrancy-unlimited-gas": "SWC-107",
    "suicidal": "SWC-106",
    "unchecked-lowlevel": "SWC-104",
    "unchecked-send": "SWC-104",
    "unchecked-transfer": "SWC-104",
}

KEYWORD_SWCS = [
    ("SWC-107", ("reentrancy", "reentrant")),
    ("SWC-106", ("selfdestruct", "self destruct", "suicidal", "destruct")),
    ("SWC-112", ("delegatecall", "delegate call")),
    ("SWC-104", ("unchecked low", "unchecked call", "unchecked return", "return value", "low-level call", "low level call")),
    ("SWC-105", ("arbitrary send", "unprotected ether", "withdraw", "access control", "anyone can transfer", "unauthorized transfer")),
    ("SWC-114", ("front-run", "front run", "transaction order", "race condition", "approval race", "erc20 approve")),
    ("SWC-128", ("unbounded loop", "block gas", "gas limit", "costly loop", "loop over")),
    ("SWC-101", ("unchecked arithmetic", "overflow", "underflow", "integer overflow", "integer underflow", "narrow cast")),
]


def disable_core_dumps() -> None:
    if resource is None:
        return
    try:
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    except (OSError, ValueError):
        pass


def line_number(source: str, index: int) -> int:
    return source[:index].count("\n") + 1


def extract_functions(source: str) -> list[dict]:
    functions = []
    for match in re.finditer(r"function\s+([A-Za-z_][A-Za-z0-9_]*)[^{;]*\{", source):
        start = match.start()
        body_start = match.end() - 1
        depth = 0
        end = body_start
        for pos in range(body_start, len(source)):
            if source[pos] == "{":
                depth += 1
            elif source[pos] == "}":
                depth -= 1
                if depth == 0:
                    end = pos + 1
                    break
        functions.append(
            {
                "name": match.group(1),
                "signature": match.group(0),
                "start": start,
                "end": end,
                "text": source[start:end],
            }
        )
    return functions


def has_access_control(function_text: str) -> bool:
    controls = [
        "onlyOwner",
        "onlyAdmin",
        "hasRole",
        "msg.sender == owner",
        "msg.sender==owner",
        "msg.sender == admin",
        "msg.sender==admin",
        "require(owner ==",
        "require(admin ==",
    ]
    return any(control in function_text for control in controls)


def finding(swc_id: str, detector_id: str, location: str, line: int, explanation: str, confidence: str = "medium") -> dict:
    return {
        "swc_id": swc_id,
        "name": SWC_NAMES.get(swc_id, swc_id),
        "severity": "High" if swc_id in {"SWC-105", "SWC-106", "SWC-107", "SWC-112"} else "Medium",
        "detector_id": detector_id,
        "location": location,
        "line": line,
        "confidence": confidence,
        "explanation": explanation,
    }


def external_finding(
    swc_id: str,
    detector_id: str,
    location: str,
    line: int,
    explanation: str,
    tool_id: str,
    severity: str = "Medium",
    confidence: str = "medium",
) -> dict:
    item = finding(swc_id, detector_id, location, line, explanation, confidence.lower())
    item["tool"] = tool_id
    item["severity"] = severity
    return item


def normalize_detector_id(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def map_to_swc(detector_id: str, *texts: str) -> str | None:
    normalized = normalize_detector_id(detector_id)
    if normalized in DIRECT_DETECTOR_SWCS:
        return DIRECT_DETECTOR_SWCS[normalized]

    combined = " ".join([normalized, *[text.lower() for text in texts if text]])
    for swc_id, keywords in KEYWORD_SWCS:
        if any(keyword in combined for keyword in keywords):
            return swc_id
    return None


def source_line_from_mapping(mapping: dict | None) -> int:
    if not isinstance(mapping, dict):
        return 0
    lines = mapping.get("lines")
    if isinstance(lines, list) and lines:
        try:
            return int(lines[0])
        except (TypeError, ValueError):
            return 0
    for key in ("line", "line_no", "line_number", "start_line", "starting_line"):
        if key in mapping:
            try:
                return int(mapping[key])
            except (TypeError, ValueError):
                return 0
    return 0


def first_text(*values: object, default: str = "unknown") -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return default


def display_path(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def detect_reentrancy(source: str, functions: list[dict]) -> list[dict]:
    results = []
    state_write = re.compile(r"(\bbalances?\b|\bbalanceOf\b|\btotalSupply\b|\ballowance\b)[^;\n]*(?:-=|\+=|=)")
    for fn in functions:
        call_match = re.search(r"\.call\s*(?:\{[^}]*\})?\s*\(", fn["text"])
        if not call_match:
            continue
        after_call = fn["text"][call_match.end():]
        if state_write.search(after_call):
            results.append(
                finding(
                    "SWC-107",
                    "external-call-before-state-update",
                    f"function {fn['name']}",
                    line_number(source, fn["start"] + call_match.start()),
                    "External call appears before a later state write in the same function.",
                    "high",
                )
            )
    return results


def detect_unchecked_call(source: str, functions: list[dict]) -> list[dict]:
    results = []
    for fn in functions:
        for call in re.finditer(r"\.call\s*(?:\{[^}]*\})?\s*\(", fn["text"]):
            assigned = re.search(r"\(\s*bool\s+([A-Za-z_][A-Za-z0-9_]*)\s*,", fn["text"][: call.start() + 80])
            var_name = assigned.group(1) if assigned else None
            checked = bool(var_name and re.search(rf"require\s*\(\s*{re.escape(var_name)}\b", fn["text"][call.end():]))
            if not checked:
                results.append(
                    finding(
                        "SWC-104",
                        "unchecked-low-level-call",
                        f"function {fn['name']}",
                        line_number(source, fn["start"] + call.start()),
                        "Low-level call result is not clearly checked with require().",
                    )
                )
    return results


def detect_unprotected_withdrawal(source: str, functions: list[dict]) -> list[dict]:
    results = []
    transfer_pattern = re.compile(r"(\.transfer\s*\(|\.send\s*\(|\.call\s*\{\s*value|selfdestruct\s*\()", re.MULTILINE)
    for fn in functions:
        match = transfer_pattern.search(fn["text"])
        if match and not has_access_control(fn["text"]):
            results.append(
                finding(
                    "SWC-105",
                    "value-transfer-without-access-control",
                    f"function {fn['name']}",
                    line_number(source, fn["start"] + match.start()),
                    "Function transfers value or destroys funds without obvious owner/admin gating.",
                )
            )
    return results


def detect_selfdestruct(source: str, functions: list[dict]) -> list[dict]:
    results = []
    for fn in functions:
        match = re.search(r"selfdestruct\s*\(", fn["text"])
        if match and not has_access_control(fn["text"]):
            results.append(
                finding(
                    "SWC-106",
                    "unprotected-selfdestruct",
                    f"function {fn['name']}",
                    line_number(source, fn["start"] + match.start()),
                    "selfdestruct is reachable without obvious owner/admin gating.",
                    "high",
                )
            )
    return results


def detect_delegatecall(source: str, functions: list[dict]) -> list[dict]:
    results = []
    for fn in functions:
        match = re.search(r"\.delegatecall\s*\(", fn["text"])
        if match:
            results.append(
                finding(
                    "SWC-112",
                    "delegatecall-target-review",
                    f"function {fn['name']}",
                    line_number(source, fn["start"] + match.start()),
                    "delegatecall is present; target trust boundary requires review.",
                    "medium",
                )
            )
    return results


def detect_transaction_order_dependence(source: str, functions: list[dict]) -> list[dict]:
    results = []
    for fn in functions:
        if fn["name"].lower() != "approve":
            continue
        assignment = re.search(r"allowance\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=\s*amount", fn["text"])
        zero_guard = "amount == 0" in fn["text"] or "allowance[msg.sender][spender] == 0" in fn["text"]
        if assignment and not zero_guard:
            results.append(
                finding(
                    "SWC-114",
                    "allowance-approval-race",
                    f"function {fn['name']}",
                    line_number(source, fn["start"] + assignment.start()),
                    "Allowance is overwritten directly, which can expose approve race/front-running behavior.",
                )
            )
    return results


def detect_arithmetic(source: str, functions: list[dict]) -> list[dict]:
    results = []
    for fn in functions:
        unchecked = re.search(r"\bunchecked\s*\{", fn["text"])
        narrow_cast = re.search(r"\buint(?:8|16|32|64|128)\s*\(", fn["text"])
        if unchecked or narrow_cast:
            match = unchecked or narrow_cast
            results.append(
                finding(
                    "SWC-101",
                    "unchecked-or-narrow-arithmetic",
                    f"function {fn['name']}",
                    line_number(source, fn["start"] + match.start()),
                    "Unchecked arithmetic or narrow integer casting is present.",
                )
            )
    return results


def detect_gas_dos(source: str, functions: list[dict]) -> list[dict]:
    results = []
    for fn in functions:
        match = re.search(r"for\s*\([^;]+;[^;]+\.length", fn["text"])
        if match:
            results.append(
                finding(
                    "SWC-128",
                    "unbounded-loop-over-dynamic-data",
                    f"function {fn['name']}",
                    line_number(source, fn["start"] + match.start()),
                    "Loop appears bounded by dynamic collection length and may become too expensive.",
                )
            )
    return results


DETECTORS = [
    detect_reentrancy,
    detect_unchecked_call,
    detect_unprotected_withdrawal,
    detect_selfdestruct,
    detect_delegatecall,
    detect_transaction_order_dependence,
    detect_arithmetic,
    detect_gas_dos,
]


def scan_contract(source: str) -> list[dict]:
    functions = extract_functions(source)
    findings = []
    seen = set()
    for detector in DETECTORS:
        for item in detector(source, functions):
            key = (item["swc_id"], item["detector_id"], item["location"], item["line"])
            if key not in seen:
                findings.append(item)
                seen.add(key)
    return findings


def parse_slither_report(report: dict, tool_id: str = "slither") -> list[dict]:
    detectors = report.get("results", {}).get("detectors", [])
    if not isinstance(detectors, list):
        return []

    findings = []
    seen = set()
    for item in detectors:
        if not isinstance(item, dict):
            continue
        detector_id = first_text(item.get("check"), item.get("name"), default="slither-detector")
        description = first_text(item.get("description"), item.get("markdown"), default=detector_id)
        swc_id = map_to_swc(detector_id, description)
        if not swc_id:
            continue

        elements = item.get("elements") if isinstance(item.get("elements"), list) else []
        first_element = elements[0] if elements and isinstance(elements[0], dict) else {}
        source_mapping = first_element.get("source_mapping") if isinstance(first_element, dict) else {}
        line = source_line_from_mapping(source_mapping)
        location = first_text(
            first_element.get("name") if isinstance(first_element, dict) else None,
            item.get("first_markdown_element"),
            detector_id,
        )
        key = (swc_id, detector_id, location, line)
        if key in seen:
            continue
        seen.add(key)
        findings.append(
            external_finding(
                swc_id,
                normalize_detector_id(detector_id),
                location,
                line,
                description.replace("\n", " ").strip(),
                tool_id,
                first_text(item.get("impact"), default="Medium"),
                first_text(item.get("confidence"), default="medium"),
            )
        )
    return findings


def nested_line(value: object) -> int:
    if isinstance(value, dict):
        line = source_line_from_mapping(value)
        if line:
            return line
        for nested in value.values():
            found = nested_line(nested)
            if found:
                return found
    if isinstance(value, list):
        for nested in value:
            found = nested_line(nested)
            if found:
                return found
    return 0


def collect_aderyn_issues(value: object, issues: list[dict]) -> None:
    if isinstance(value, list):
        for item in value:
            collect_aderyn_issues(item, issues)
        return

    if not isinstance(value, dict):
        return

    text_keys = ("title", "name", "check", "detector", "detector_name", "description", "body", "message")
    has_detector_text = any(isinstance(value.get(key), str) and value.get(key) for key in text_keys)
    has_instances = isinstance(value.get("instances"), list) or isinstance(value.get("locations"), list)
    if has_detector_text and (has_instances or any(key in value for key in ("severity", "impact", "confidence"))):
        issues.append(value)
        return

    for nested in value.values():
        collect_aderyn_issues(nested, issues)


def parse_aderyn_report(report: dict, tool_id: str = "aderyn") -> list[dict]:
    issues: list[dict] = []
    collect_aderyn_issues(report, issues)
    findings = []
    seen = set()

    for item in issues:
        detector_id = first_text(
            item.get("check"),
            item.get("detector"),
            item.get("detector_name"),
            item.get("title"),
            item.get("name"),
            default="aderyn-detector",
        )
        description = first_text(item.get("description"), item.get("body"), item.get("message"), item.get("title"), default=detector_id)
        swc_id = map_to_swc(detector_id, description)
        if not swc_id:
            continue

        instances = item.get("instances") if isinstance(item.get("instances"), list) else []
        locations = item.get("locations") if isinstance(item.get("locations"), list) else []
        location_source = (instances or locations or [item])[0]
        location = first_text(
            location_source.get("function") if isinstance(location_source, dict) else None,
            location_source.get("contract") if isinstance(location_source, dict) else None,
            location_source.get("path") if isinstance(location_source, dict) else None,
            location_source.get("file") if isinstance(location_source, dict) else None,
            detector_id,
        )
        line = nested_line(location_source) or nested_line(item)
        key = (swc_id, detector_id, location, line)
        if key in seen:
            continue
        seen.add(key)
        findings.append(
            external_finding(
                swc_id,
                normalize_detector_id(detector_id),
                location,
                line,
                description.replace("\n", " ").strip(),
                tool_id,
                first_text(item.get("severity"), item.get("impact"), default="Medium").title(),
                first_text(item.get("confidence"), default="medium"),
            )
        )
    return findings


def run_json_command(command: list[str], output_path: Path, cwd: Path) -> tuple[dict | None, str | None]:
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=EXTERNAL_TOOL_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return None, f"Timed out after {EXTERNAL_TOOL_TIMEOUT_SECONDS}s"
    except OSError as exc:
        return None, str(exc)

    if output_path.exists():
        try:
            return json.loads(output_path.read_text()), None
        except json.JSONDecodeError as exc:
            return None, f"Invalid JSON output: {exc}"

    stdout = completed.stdout.strip()
    if stdout.startswith("{") or stdout.startswith("["):
        try:
            return json.loads(stdout), None
        except json.JSONDecodeError:
            pass

    detail = completed.stderr.strip() or completed.stdout.strip() or f"exit code {completed.returncode}"
    return None, detail[:500]


def run_external_tool(tool_id: str, executable: str, sol_path: Path, root: Path) -> tuple[list[dict], str | None]:
    with tempfile.TemporaryDirectory(prefix=f"sc-audit-{tool_id}-") as tmp_dir:
        output_path = Path(tmp_dir) / f"{sol_path.stem}-{tool_id}.json"
        if tool_id == "slither":
            command = [executable, str(sol_path), "--json", str(output_path), "--disable-color"]
            report, error = run_json_command(command, output_path, root)
            return (parse_slither_report(report, tool_id) if report else []), error

        if tool_id == "aderyn":
            source_dir = str(sol_path.parent.relative_to(root))
            command = [
                executable,
                str(root),
                "-s",
                source_dir,
                "-i",
                sol_path.name,
                "-o",
                str(output_path),
            ]
            report, error = run_json_command(command, output_path, root)
            return (parse_aderyn_report(report, tool_id) if report else []), error

    return [], f"Unknown tool: {tool_id}"


def evaluate(scans: list[dict]) -> dict:
    found = 0
    total = len(scans)
    false_positives = 0
    total_findings = 0
    swc_totals: dict[str, dict] = {}

    for scan in scans:
        gt = scan["ground_truth"]["swc_id"]
        swc_totals.setdefault(gt, {"found": 0, "total": 0})
        swc_totals[gt]["total"] += 1

        detected = any(item["swc_id"] == gt for item in scan["findings"])
        if detected:
            found += 1
            swc_totals[gt]["found"] += 1
        total_findings += len(scan["findings"])
        false_positives += sum(1 for item in scan["findings"] if item["swc_id"] != gt)

    return {
        "detection_rate": round((found / total) * 100, 1) if total else 0,
        "false_positives_per_contract": round(false_positives / total, 2) if total else 0,
        "findings_per_contract": round(total_findings / total, 2) if total else 0,
        "contracts_scanned": total,
        "swc_coverage": dict(sorted(swc_totals.items())),
    }


def build_heuristic_comparator(contract_records: list[dict]) -> dict:
    scans = []
    for record in contract_records:
        scans.append(
            {
                "contract_id": record["contract_id"],
                "ground_truth": record["ground_truth"],
                "findings": scan_contract(record["source"]),
            }
        )

    return {
        "id": "heuristic",
        "name": "Heuristic static baseline",
        "available": True,
        "adapter": "built-in",
        "status": "ran",
        "summary": evaluate(scans),
        "scans": scans,
        "errors": [],
    }


def build_external_comparator(tool_id: str, name: str, contract_records: list[dict], root: Path) -> dict:
    executable = shutil.which(tool_id)
    if not executable:
        return {
            "id": tool_id,
            "name": name,
            "available": False,
            "adapter": "json-adapter-ready",
            "status": "unavailable",
            "summary": None,
            "scans": [],
            "errors": [f"{tool_id} binary was not found on PATH."],
        }

    scans = []
    errors = []
    for record in contract_records:
        findings, error = run_external_tool(tool_id, executable, record["path"], root)
        if error:
            errors.append({"contract_id": record["contract_id"], "error": error})
        scans.append(
            {
                "contract_id": record["contract_id"],
                "ground_truth": record["ground_truth"],
                "findings": findings,
            }
        )

    if scans and len(errors) == len(scans):
        return {
            "id": tool_id,
            "name": name,
            "available": True,
            "adapter": "json-adapter-ready",
            "status": "error",
            "summary": None,
            "scans": [],
            "errors": errors[:20],
        }

    return {
        "id": tool_id,
        "name": name,
        "available": True,
        "adapter": "json-adapter-ready",
        "status": "ran" if scans else "error",
        "summary": evaluate(scans),
        "scans": scans,
        "errors": errors[:20],
    }


def tool_status() -> list[dict]:
    return [
        {
            "id": "heuristic",
            "name": "Heuristic baseline",
            "available": True,
            "adapter": "built-in",
            "status": "ran",
        },
        {
            "id": "slither",
            "name": "Slither",
            "available": shutil.which("slither") is not None,
            "adapter": "json-adapter-ready",
            "status": "ready" if shutil.which("slither") else "unavailable",
        },
        {
            "id": "aderyn",
            "name": "Aderyn",
            "available": shutil.which("aderyn") is not None,
            "adapter": "json-adapter-ready",
            "status": "ready" if shutil.which("aderyn") else "unavailable",
        },
        {
            "id": "mythril",
            "name": "Mythril",
            "available": shutil.which("myth") is not None or shutil.which("mythril") is not None,
            "adapter": "planned",
            "status": "planned",
        },
    ]


def main() -> None:
    disable_core_dumps()

    parser = argparse.ArgumentParser(description="Build static analyzer baselines for generated Solidity contracts")
    parser.add_argument("--contracts-dir", default="data/generated_contracts")
    parser.add_argument("--out", default="output/static_baseline.json")
    parser.add_argument(
        "--tools",
        default="heuristic,slither,aderyn",
        help="Comma-separated comparator ids to include: heuristic,slither,aderyn",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    contracts_dir = root / args.contracts_dir
    contract_records = []

    for meta_path in sorted(contracts_dir.glob("*_metadata.json")):
        meta = json.loads(meta_path.read_text())
        sol_path = contracts_dir / f"{meta['contract_id']}.sol"
        if not sol_path.exists():
            continue
        source = sol_path.read_text()
        contract_records.append(
            {
                "contract_id": meta["contract_id"],
                "ground_truth": meta["vulnerability"],
                "path": sol_path,
                "source": source,
            }
        )

    selected_tools = [tool.strip() for tool in args.tools.split(",") if tool.strip()]
    comparators = []
    if "heuristic" in selected_tools:
        comparators.append(build_heuristic_comparator(contract_records))
    if "slither" in selected_tools:
        comparators.append(build_external_comparator("slither", "Slither", contract_records, root))
    if "aderyn" in selected_tools:
        comparators.append(build_external_comparator("aderyn", "Aderyn", contract_records, root))

    primary = next((item for item in comparators if item["id"] == "heuristic"), comparators[0] if comparators else None)
    summary = primary["summary"] if primary else evaluate([])
    scans = primary["scans"] if primary else []
    payload = {
        "title": "Static Analyzer Baselines",
        "baseline_id": "static-analyzer-baselines-v2",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "primary_comparator_id": primary["id"] if primary else None,
        "summary": summary,
        "tools": tool_status(),
        "comparators": comparators,
        "scans": scans,
        "notes": [
            "The built-in heuristic comparator is deterministic and runs everywhere.",
            "Slither and Aderyn adapters run real analyzer JSON output when their binaries are available on PATH.",
            "Mythril remains listed as a planned symbolic-analysis comparator.",
        ],
    }

    out_path = root / args.out
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {display_path(out_path, root)}")
    for comparator in comparators:
        if comparator["summary"]:
            print(
                f"{comparator['name']}: {comparator['summary']['detection_rate']}% "
                f"across {comparator['summary']['contracts_scanned']} contracts"
            )
        else:
            print(f"{comparator['name']}: {comparator['status']}")


if __name__ == "__main__":
    main()
