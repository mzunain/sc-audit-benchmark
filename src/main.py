import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:
    pass

from pipeline.generator import VulnerabilityGenerator
from pipeline.scanner import VulnerabilityScanner
from pipeline.judge import JudgeLLM
from scoring.metrics import generate_leaderboard


def main():
    parser = argparse.ArgumentParser(description="Generative Solidity Vulnerability Benchmark")
    parser.add_argument(
        "--scanner-models",
        nargs="+",
        default=[
            "nim:qwen/qwen3-coder-480b-a35b-instruct",
            "nim:minimaxai/minimax-m2.7",
            "nim:stepfun-ai/step-3.5-flash",
        ],
        help="Models to benchmark as scanners. Prefix 'nim:' = NVIDIA NIM, otherwise OpenRouter.",
    )
    parser.add_argument(
        "--generator-model",
        default="nim:qwen/qwen3-coder-480b-a35b-instruct",
        help="Model to use for generating vulnerable contracts",
    )
    parser.add_argument(
        "--judge-model",
        default="nim:meta/llama-3.3-70b-instruct",
        help="Model to use as judge (pick one NOT in scanner pool to avoid self-judging bias)",
    )
    parser.add_argument(
        "--contracts-count",
        type=int,
        default=15,
        help="Number of contracts to generate",
    )
    parser.add_argument(
        "--skip-generation",
        action="store_true",
        help="Use existing contracts in data/generated_contracts/",
    )

    args = parser.parse_args()

    project_root = Path(__file__).resolve().parents[1]

    print("=" * 70)
    print("GENERATIVE SOLIDITY VULNERABILITY BENCHMARK")
    print("=" * 70)

    if not args.skip_generation:
        print(f"\n[1/3] GENERATING vulnerable contracts...")
        print(f"Generator: {args.generator_model}")
        generator = VulnerabilityGenerator(args.generator_model)
        contracts = generator.generate_dataset(args.contracts_count)
    else:
        print(f"\n[1/3] LOADING existing contracts...")
        contracts = []
        gen_dir = project_root / "data" / "generated_contracts"
        for meta_file in sorted(gen_dir.glob("*_metadata.json")):
            with open(meta_file) as f:
                meta = json.load(f)
            sol_file = gen_dir / f"{meta['contract_id']}.sol"
            meta["code"] = sol_file.read_text()
            contracts.append(meta)
        print(f"  Loaded {len(contracts)} contracts")

    print(f"\n[2/3] SCANNING with {len(args.scanner_models)} models...")
    scanner = VulnerabilityScanner()
    scan_results = scanner.scan_dataset(contracts, args.scanner_models)

    print(f"\n[3/3] JUDGING scanner outputs...")
    print(f"Judge: {args.judge_model}")
    judge = JudgeLLM(args.judge_model)
    judge_results = judge.judge_all(scan_results, contracts)

    print(f"\n[FINAL] Computing leaderboard...")
    leaderboard = generate_leaderboard(
        judge_results["judgments"],
        scan_results["total_costs"],
        len(contracts),
    )

    output_dir = project_root / "output"
    output_dir.mkdir(exist_ok=True)

    with open(output_dir / "leaderboard.json", "w") as f:
        json.dump(leaderboard, f, indent=2)

    presentation_data = {
        "title": "Generative Solidity Vulnerability Benchmark",
        "total_contracts": len(contracts),
        "models_tested": args.scanner_models,
        "summary_rows": [],
    }

    for model, scores in leaderboard["models"].items():
        if "error" not in scores:
            presentation_data["summary_rows"].append({
                "model": model,
                "detection": scores["detection_rate"],
                "quality": scores["quality_score"],
                "cost_usd": scores["total_scan_cost_usd"],
                "value": scores["cost_adjusted_score"],
            })

    presentation_data["winners"] = leaderboard.get("winners", {})

    with open(output_dir / "presentation_data.json", "w") as f:
        json.dump(presentation_data, f, indent=2)

    print("\n" + "=" * 70)
    print("LEADERBOARD")
    print("=" * 70)
    print(f"\n{'Model':<35} {'Quality':>10} {'Cost ($)':>10} {'Value':>10}")
    print("-" * 70)

    sorted_models = sorted(
        [(m, s) for m, s in leaderboard["models"].items() if "error" not in s],
        key=lambda x: x[1]["cost_adjusted_score"],
        reverse=True,
    )

    for model, scores in sorted_models:
        print(
            f"{model:<35} {scores['quality_score']:>9.1f}% "
            f"${scores['total_scan_cost_usd']:>8.4f} {scores['cost_adjusted_score']:>10.1f}"
        )

    if "winners" in leaderboard:
        print(f"\nHighest Quality: {leaderboard['winners']['highest_quality']['model']}")
        print(f"Best Value (cost-adjusted): {leaderboard['winners']['best_value']['model']}")

    print("\n" + "=" * 70)
    print(f"All outputs saved to {output_dir}/")
    print("Run dashboard: cd dashboard && npm install && npm run dev")


if __name__ == "__main__":
    main()
