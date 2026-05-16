import json
import re
from pathlib import Path

from llm_client import LLMClient

GENERATOR_SYSTEM_PROMPT = """You are an expert Solidity security researcher. Your job is to take
clean Solidity contracts and inject a SPECIFIC, known vulnerability into them while
keeping the code functional and realistic.

Rules:
1. Add ONE vulnerability of the specified type
2. The vulnerability must be REAL and EXPLOITABLE (not just a comment)
3. The code must still compile (Solidity 0.8.x)
4. Make the vulnerability somewhat subtle, not obvious
5. The contract should look like real-world code, not a textbook example
6. Add 1-2 unrelated helper functions to make detection harder
7. Output ONLY the modified Solidity code - no explanations, no markdown fences
"""

GENERATOR_USER_TEMPLATE = """Inject a {vuln_id} ({vuln_name}) vulnerability into this Solidity contract.

VULNERABILITY DETAILS:
- Type: {vuln_name}
- Description: {vuln_description}
- Pattern example: {vuln_pattern}

CLEAN CONTRACT TO MODIFY:
```solidity
{clean_code}
```

Output the modified contract with the vulnerability injected. Make it realistic and subtle.
Output ONLY the Solidity code, nothing else."""


class VulnerabilityGenerator:
    def __init__(self, generator_model: str = "nim:qwen/qwen3-coder-480b-a35b-instruct"):
        self.client = LLMClient()
        self.model = generator_model
        self.total_cost = 0.0

        data_dir = Path(__file__).resolve().parents[2] / "data"
        with open(data_dir / "swc_categories.json") as f:
            self.swc_categories = json.load(f)["categories"]
        with open(data_dir / "contract_templates.json") as f:
            self.templates = json.load(f)["templates"]

    def _strip_code_fences(self, text: str) -> str:
        text = re.sub(r'^```(?:solidity)?\s*\n', '', text, flags=re.MULTILINE)
        text = re.sub(r'\n```\s*$', '', text, flags=re.MULTILINE)
        return text.strip()

    def generate_contract(self, template_id: str, vuln_id: str, contract_num: int) -> dict:
        template = next(t for t in self.templates if t["id"] == template_id)
        vuln = next(v for v in self.swc_categories if v["id"] == vuln_id)

        prompt = GENERATOR_USER_TEMPLATE.format(
            vuln_id=vuln["id"],
            vuln_name=vuln["name"],
            vuln_description=vuln["description"],
            vuln_pattern=vuln["example_pattern"],
            clean_code=template["clean_code"],
        )

        response = self.client.query(
            model=self.model,
            prompt=prompt,
            system=GENERATOR_SYSTEM_PROMPT,
            max_tokens=2000,
        )

        code = self._strip_code_fences(response.text)
        self.total_cost += response.cost_usd

        contract_id = f"contract_{contract_num:03d}"
        return {
            "contract_id": contract_id,
            "template_id": template_id,
            "vulnerability": {
                "swc_id": vuln["id"],
                "name": vuln["name"],
                "severity": vuln["severity_default"],
            },
            "code": code,
            "generator_model": self.model,
            "generation_cost_usd": response.cost_usd,
        }

    def generate_dataset(self, count: int = 15) -> list[dict]:
        vulns = self.swc_categories
        templates = self.templates

        plan = []
        for i in range(count):
            vuln = vulns[i % len(vulns)]
            template = templates[i % len(templates)]
            plan.append((template["id"], vuln["id"]))

        contracts = []
        output_dir = Path(__file__).resolve().parents[2] / "data" / "generated_contracts"
        output_dir.mkdir(parents=True, exist_ok=True)

        for i, (tid, vid) in enumerate(plan, 1):
            print(f"  Generating {i}/{count}: {tid} + {vid}")
            try:
                contract = self.generate_contract(tid, vid, i)
                contracts.append(contract)

                sol_path = output_dir / f"{contract['contract_id']}.sol"
                meta_path = output_dir / f"{contract['contract_id']}_metadata.json"

                sol_path.write_text(contract["code"])
                with open(meta_path, "w") as f:
                    metadata = {k: v for k, v in contract.items() if k != "code"}
                    json.dump(metadata, f, indent=2)

            except Exception as e:
                print(f"    ERROR: {e}")

        print(f"\n  Total generation cost: ${self.total_cost:.4f}")
        return contracts
