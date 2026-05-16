# Generative Solidity Vulnerability Benchmark

A self-renewing benchmark for evaluating LLM performance at detecting smart
contract vulnerabilities. Built for SC Audit Studio at That Crypto Hackathon
(Turku, May 2026).

## How It Works (3-Stage Pipeline)

1. **GENERATOR**: LLM injects known vulnerabilities into clean Solidity contracts
2. **SCANNER**: Multiple LLMs try to find the vulnerabilities
3. **JUDGE**: LLM grades the scanner outputs against ground truth

This resists training-data overfitting because the test set is generated fresh
each run, not stored in a public dataset.

## Why Two Providers (and Why It Runs for $0)

The benchmark routes through **NVIDIA NIM** (`build.nvidia.com`) and **OpenRouter**,
both of which offer free tiers strong enough to run end-to-end at $0 actual API
spend:

| Provider | Models used | Free tier |
|----------|------------|-----------|
| NVIDIA NIM | Qwen3-Coder 480B, Nemotron, GLM-4.5, DeepSeek-R1, Llama-3.3 | Free credits on signup |
| OpenRouter | Llama-3.3, Qwen-2.5-Coder, Gemini, DeepSeek-V3 (`:free` suffix) | Rate-limited but $0 |

Models prefixed `nim:` route to NIM; everything else routes to OpenRouter. One
code path, two keys.

**Cost in the leaderboard ≠ what you spent.** The cost-adjusted leaderboard
uses each model's *commercial list price* from `MODEL_COSTS`, even when the
benchmark itself ran on free tiers. This keeps the cost-adjusted story honest
for the audit-firm pitch: *"If you deployed Qwen3-Coder-480B in production at
$0.30/M tokens vs Sonnet at $3/M, here's the quality-per-dollar frontier."*

## Quick Start

```bash
# 1. Install
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add at least one of:
#   OPENROUTER_API_KEY=sk-or-v1-...    (from https://openrouter.ai/keys)
#   NVIDIA_API_KEY=nvapi-...           (from https://build.nvidia.com)
# Defaults use NIM for the headliner model, so NVIDIA_API_KEY is recommended.

# 2. Smoke test (~$0, ~2 minutes)
python src/main.py --contracts-count 2

# 3. Full pipeline (15 contracts, 3 scanners, judged, ~$0 with default lineup)
python src/main.py

# 4. Re-run without regenerating contracts
python src/main.py --skip-generation

# 5. Start dashboard
cd dashboard
npm install
# Forward your keys to the Next.js process so /api/playground works:
export OPENROUTER_API_KEY=...
export NVIDIA_API_KEY=...
npm run dev
# Open http://localhost:3000
```

## Default Lineup

All $0 actual cost. The scanners span three open-weight design philosophies so the
leaderboard answers an architectural question, not just a model-ranking one:

| Role      | Model                                                   | Philosophy                       |
|-----------|---------------------------------------------------------|----------------------------------|
| Generator | `nim:qwen/qwen3-coder-480b-a35b-instruct`               | Code-specialist (480B)           |
| Scanner   | `nim:qwen/qwen3-coder-480b-a35b-instruct`               | Code-specialist (480B)           |
| Scanner   | `nim:minimaxai/minimax-m2.7`                            | Code + reasoning hybrid (230B)   |
| Scanner   | `nim:stepfun-ai/step-3.5-flash`                         | Pure reasoning (200B sparse MoE) |
| Judge     | `nim:bytedance/seed-oss-36b-instruct`                   | Agentic reasoning (36B)          |

Pitch becomes: *"Three open-weight design philosophies — code-specialist vs reasoning-specialist vs hybrid — tested on Solidity vulnerability detection. All from different research labs. All self-hostable."*

## CLI Options

```bash
python src/main.py [options]

--scanner-models     Models to benchmark. Prefix 'nim:' for NIM, else OpenRouter.
--generator-model    Model used to inject vulnerabilities
--judge-model        Model used as judge (keep outside scanner pool)
--contracts-count    Number of contracts to generate (default: 15)
--skip-generation    Reuse existing contracts in data/generated_contracts/
```

### Want to compare against paid frontier models?

```bash
python src/main.py --scanner-models \
  "nim:qwen/qwen3-coder-480b-a35b-instruct" \
  "anthropic/claude-3.5-sonnet" \
  "openai/gpt-4o-mini"
```

This is the most compelling slide: open-weight 480B vs. closed frontier.

## Vulnerability Categories (SWC Registry)

- SWC-107: Reentrancy
- SWC-101: Integer Overflow/Underflow
- SWC-104: Unchecked Call Return Value
- SWC-105: Unprotected Ether Withdrawal
- SWC-106: Unprotected SELFDESTRUCT
- SWC-112: Delegatecall to Untrusted Callee
- SWC-114: Transaction Order Dependence
- SWC-128: DoS with Block Gas Limit

## Scoring

Two leaderboards:

1. **Pure Quality**: Composite of detection rate, SWC accuracy, severity, location, explanation
2. **Cost-Adjusted**: `quality_score / commercial_cost_per_run` — rewards cheap+good models

Note: cost-adjusted uses *commercial list price*, not actual API spend. See
"Why Two Providers" above for the rationale.

## Project Layout

```
sc-audit-benchmark/
├── data/                          # SWC categories, templates, generated contracts
├── src/
│   ├── pipeline/                  # generator.py, scanner.py, judge.py, llm_client.py
│   ├── scoring/                   # metrics.py
│   └── main.py                    # Orchestrator
├── output/                        # Scanner reports, judge scores, leaderboard.json
└── dashboard/                     # Next.js 14 + Tailwind UI
```

## Why This Matters

For audit firms (like SC Audit Studio), this benchmark enables:

- Choosing the right LLM for production audits (quality vs cost)
- Continuously monitoring LLM degradation over model updates
- Resisting overfitting since test set is regenerated

## Differentiates From EVMBench

EVMBench (OpenAI) uses fixed datasets. We generate fresh contracts each run.
Plus we factor commercial cost into the final score across multiple vendors,
including open-weight models that audit firms could self-host.
