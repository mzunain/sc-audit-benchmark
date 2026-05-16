import json
import re
from pathlib import Path

from llm_client import LLMClient

SCANNER_SYSTEM_PROMPT = """You are a senior smart contract security auditor. Analyze the
provided Solidity contract and identify any vulnerabilities.

For each vulnerability you find, provide:
1. SWC ID (from SWC Registry, e.g., SWC-107)
2. Vulnerability name
3. Severity (Critical/High/Medium/Low)
4. Location (function name or line)
5. Explanation (1-2 sentences)

Respond in this EXACT JSON format (no markdown, no extra text):

{
  "vulnerabilities_found": [
    {
      "swc_id": "SWC-XXX",
      "name": "...",
      "severity": "High",
      "location": "function withdraw()",
      "explanation": "..."
    }
  ],
  "summary": "Overall security assessment in 1 sentence"
}

If no vulnerabilities found, return {"vulnerabilities_found": [], "summary": "..."}"""

SCANNER_USER_TEMPLATE = """Analyze this Solidity contract for security vulnerabilities:

```solidity
{code}
```

Respond with JSON only."""


class VulnerabilityScanner:
    def __init__(self):
        self.client = LLMClient()

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

        return {
            "vulnerabilities_found": [],
            "summary": "Parse error",
            "_raw": text,
        }

    def scan_contract(self, contract: dict, scanner_model: str) -> dict:
        prompt = SCANNER_USER_TEMPLATE.format(code=contract["code"])

        response = self.client.query(
            model=scanner_model,
            prompt=prompt,
            system=SCANNER_SYSTEM_PROMPT,
            max_tokens=1500,
        )

        report = self._extract_json(response.text)

        return {
            "contract_id": contract["contract_id"],
            "scanner_model": scanner_model,
            "report": report,
            "scan_cost_usd": response.cost_usd,
            "scan_tokens_input": response.input_tokens,
            "scan_tokens_output": response.output_tokens,
            "ground_truth_vuln": contract["vulnerability"],
        }

    def scan_dataset(self, contracts: list[dict], models: list[str]) -> dict:
        results = {model: [] for model in models}
        total_cost = {model: 0.0 for model in models}

        for model in models:
            print(f"\n  Scanning with {model}...")
            for i, contract in enumerate(contracts, 1):
                print(f"    [{i}/{len(contracts)}] {contract['contract_id']}")
                try:
                    scan = self.scan_contract(contract, model)
                    results[model].append(scan)
                    total_cost[model] += scan["scan_cost_usd"]
                except Exception as e:
                    print(f"      ERROR: {e}")
                    results[model].append({
                        "contract_id": contract["contract_id"],
                        "scanner_model": model,
                        "error": str(e),
                        "ground_truth_vuln": contract["vulnerability"],
                    })

            print(f"    Total cost for {model}: ${total_cost[model]:.4f}")

        reports_dir = Path(__file__).resolve().parents[2] / "output" / "scanner_reports"
        reports_dir.mkdir(parents=True, exist_ok=True)

        for model, scans in results.items():
            safe_name = model.replace("/", "_").replace(":", "_")
            with open(reports_dir / f"{safe_name}_reports.json", "w") as f:
                json.dump(
                    {"model": model, "scans": scans, "total_cost": total_cost[model]},
                    f,
                    indent=2,
                )

        return {
            "results": results,
            "total_costs": total_cost,
        }
