import json
import re
from pathlib import Path

from llm_client import LLMClient

JUDGE_SYSTEM_PROMPT = """You are an impartial judge evaluating a security scanner's report
against ground truth. You have access to:
1. The vulnerable contract
2. The KNOWN vulnerability (ground truth)
3. The scanner's report

Evaluate the scanner objectively. Be strict but fair.

Respond in this EXACT JSON format only:

{
  "found_correct_vuln": true/false,
  "swc_id_match": true/false,
  "severity_match": "exact" | "close" | "wrong",
  "location_accuracy": "exact" | "approximate" | "wrong" | "missing",
  "explanation_quality": 1-5,
  "false_positives": <number of incorrect vulns reported>,
  "overall_score": 0.0-1.0,
  "judge_notes": "1-2 sentence reasoning"
}

Scoring guide:
- found_correct_vuln: Did scanner identify the injected vulnerability?
- swc_id_match: Did scanner use correct SWC ID?
- severity_match: Did scanner rate severity correctly?
- location_accuracy: Did scanner point to right function/line?
- explanation_quality: How well-reasoned is the explanation? (1=garbage, 5=excellent)
- false_positives: Count of reported vulns that aren't real
- overall_score: Composite 0.0-1.0
"""

JUDGE_USER_TEMPLATE = """GROUND TRUTH VULNERABILITY:
- SWC ID: {gt_swc_id}
- Name: {gt_name}
- Severity: {gt_severity}

CONTRACT:
```solidity
{code}
```

SCANNER REPORT:
{scanner_report}

Evaluate the scanner. Respond with JSON only."""


class JudgeLLM:
    def __init__(self, judge_model: str = "nim:meta/llama-3.3-70b-instruct"):
        self.client = LLMClient()
        self.model = judge_model

    def _extract_json(self, text: str) -> dict:
        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            pass

        cleaned = re.sub(r'^```(?:json)?\s*\n', '', text, flags=re.MULTILINE)
        cleaned = re.sub(r'\n```\s*$', '', cleaned, flags=re.MULTILINE)
        try:
            return json.loads(cleaned.strip())
        except json.JSONDecodeError:
            pass

        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        return {"error": "parse_error", "_raw": text, "overall_score": 0.0}

    def judge_scan(self, scan: dict, contract_code: str) -> dict:
        gt = scan["ground_truth_vuln"]

        prompt = JUDGE_USER_TEMPLATE.format(
            gt_swc_id=gt["swc_id"],
            gt_name=gt["name"],
            gt_severity=gt["severity"],
            code=contract_code,
            scanner_report=json.dumps(scan["report"], indent=2),
        )

        response = self.client.query(
            model=self.model,
            prompt=prompt,
            system=JUDGE_SYSTEM_PROMPT,
            max_tokens=4000,
        )

        judgment = self._extract_json(response.text)
        judgment["judge_cost_usd"] = response.cost_usd

        return {
            "contract_id": scan["contract_id"],
            "scanner_model": scan["scanner_model"],
            "judgment": judgment,
            "judge_model": self.model,
        }

    def judge_all(self, scanner_results: dict, contracts: list[dict]) -> dict:
        contracts_by_id = {c["contract_id"]: c for c in contracts}
        all_judgments = {model: [] for model in scanner_results["results"].keys()}
        total_judge_cost = 0.0

        for model, scans in scanner_results["results"].items():
            print(f"\n  Judging {model} scans...")
            for i, scan in enumerate(scans, 1):
                if "error" in scan:
                    continue
                print(f"    [{i}/{len(scans)}] {scan['contract_id']}")

                contract = contracts_by_id[scan["contract_id"]]
                try:
                    judgment = self.judge_scan(scan, contract["code"])
                    all_judgments[model].append(judgment)
                    total_judge_cost += judgment["judgment"].get("judge_cost_usd", 0)
                except Exception as e:
                    print(f"      ERROR: {e}")

        scores_dir = Path(__file__).resolve().parents[2] / "output" / "judge_scores"
        scores_dir.mkdir(parents=True, exist_ok=True)

        for model, judgments in all_judgments.items():
            safe_name = model.replace("/", "_").replace(":", "_")
            with open(scores_dir / f"{safe_name}_judgments.json", "w") as f:
                json.dump({"model": model, "judgments": judgments}, f, indent=2)

        return {
            "judgments": all_judgments,
            "total_judge_cost": total_judge_cost,
        }
