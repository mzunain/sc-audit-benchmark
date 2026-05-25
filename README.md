# Generative Solidity Vulnerability Benchmark

A self-renewing benchmark for evaluating LLM performance at detecting smart
contract vulnerabilities. Built for SC Audit Studio at That Crypto Hackathon
(Turku, May 2026).

**Live demo:** [sc-audit-benchmark.vercel.app](https://sc-audit-benchmark.vercel.app/)

- [Leaderboard](https://sc-audit-benchmark.vercel.app/) — cost-adjusted and pure-quality views
- [Why these results](https://sc-audit-benchmark.vercel.app/analysis) — per-SWC rationale: which models passed, which failed, and the architectural reason behind the split
- [Per-vuln breakdown](https://sc-audit-benchmark.vercel.app/breakdown) — heatmap of detection rate by model × SWC class
- [Playground](https://sc-audit-benchmark.vercel.app/playground) — paste a Solidity contract, pick a model, get a structured scan report

The playground hits the same free NIM / OpenRouter tiers the benchmark itself uses. The hosted route now has a model allowlist, payload cap, provider timeout, and rate-limit headers, with optional Upstash Redis backing for durable public demos.

## Results

Three open-weight model philosophies tested across 15 LLM-generated vulnerable
contracts and 8 SWC vulnerability classes. Judge is `nim:meta/llama-3.3-70b-instruct`,
kept outside the scanner pool to avoid self-judging bias.

| Model | Philosophy | Detection | Quality | Cost (15 scans) | Cost-adjusted |
|---|---|---|---|---|---|
| 🏆 **Qwen3-Coder 480B** | Code specialist | **71.4%** | **57.5** | **$0.0034** | **17,041** |
| MiniMax M2.7 (230B) | Code + reasoning hybrid | 64.3% | 44.6 | $0.0237 | 1,882 |
| Step-3.5-Flash (200B) | Pure reasoning | 18.2% | 18.2 | $0.0357 | 509 |

Three takeaways for audit firms:

1. **Code-tuning beats pure reasoning** for Solidity vulnerability detection — 4× detection rate at 1/10th the cost.
2. **Cost wins.** Qwen3-Coder is also the cheapest of the three at commercial pricing. The winner on quality is also the winner on dollars-per-bug.
3. **Universal blind spot.** None of the three reliably catch transaction-order dependence (SWC-114). Front-running auditing still needs a human.

The full benchmark itself ran on free NVIDIA NIM credits. Costs above are
**commercial list prices**, computed from per-model per-million-token rates × actual
token usage — i.e., what an audit firm deploying these in production would pay.

See [DEMO.md](DEMO.md) for the 5-minute demo flow and [SLIDES.md](SLIDES.md) for
the deck content.

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

For a beginner-friendly local setup, use the root runner:

```bash
./run.sh
```

That single command:

- creates `.env` from `.env.example` when missing
- creates/uses `.venv` and installs Python requirements
- installs dashboard npm dependencies
- validates or prepares static analyzer data
- bundles dashboard JSON files
- starts the dashboard on the first free local port, usually `http://127.0.0.1:3000`

No API key is required to view the benchmark dashboard. Add one or both keys to
`.env` when you want live playground scans:

```bash
OPENROUTER_API_KEY=sk-or-v1-...    # https://openrouter.ai/keys
NVIDIA_API_KEY=nvapi-...           # https://build.nvidia.com
```

Useful runner options:

```bash
./run.sh --prepare-only       # install/check deps and bundle data, then stop
./run.sh --refresh-static     # rebuild static analyzer data from local tools
./run.sh --docker-analyzers   # rebuild static analyzer data in Docker
PORT=3005 ./run.sh            # choose a preferred starting port
```

### Full Benchmark Pipeline

The one-command runner starts the dashboard from existing benchmark output. To
generate a fresh benchmark run, add API keys to `.env`, then run:

```bash
./run.sh --prepare-only
source .venv/bin/activate

# Smoke test (~$0, ~2 minutes)
python src/main.py --contracts-count 2

# Full pipeline (15 contracts, 3 scanners, judged, ~$0 with default lineup)
python src/main.py

# Re-run without regenerating contracts
python src/main.py --skip-generation
```

## Dashboard

Four Tailwind-polished pages with a shared responsive shell, sticky navigation, dark product headers, and shadcn/Radix controls where native menus would otherwise leak OS styling:
- `/` — leaderboard, cost frontier, competitor matrix, production gates, and static analyzer comparators
- `/analysis` — evidence handoff by model and SWC class
- `/breakdown` — shadcn-filtered per-model per-SWC detection heatmap
- `/playground` — command-center audit workbench with a styled model picker, strategy controls, scan report, exports, and history

### Run locally

```bash
./run.sh
```

The playground route reads `OPENROUTER_API_KEY` and `NVIDIA_API_KEY` from the
process env. `./run.sh` automatically sources `.env` before starting Next.js.
Run `./run.sh --refresh-static` or `./run.sh --docker-analyzers` after re-running
the Python pipeline so the dashboard picks up new model numbers and static
analyzer comparators.

`scripts/static_baseline.py` always runs the built-in heuristic comparator. It
also detects `slither` and `aderyn` on `PATH`, runs their JSON reports when
available, and normalizes findings back to the benchmark's SWC classes:

```bash
bash scripts/run_static_analyzers.sh --local
bash scripts/run_static_analyzers.sh --docker          # reproducible Slither/Aderyn environment
SC_AUDIT_ANALYZER_PLATFORM=linux/amd64 bash scripts/run_static_analyzers.sh --docker
python scripts/static_baseline.py --tools heuristic    # deterministic fallback only
```

Slither and Aderyn are optional local binaries, not deployment dependencies.
Install them from their upstream docs if you want real analyzer rows in
`dashboard/public/data/static_baseline.json`. On Apple Silicon, the analyzer
image stays native ARM but installs the AMD64 runtime libraries needed by
`solc-select`'s Solidity compiler binary under Docker/Colima qemu emulation. If
your Docker setup does not provide foreign-binary emulation, use a native
Slither/solc install or opt into an AMD64 image with
`SC_AUDIT_ANALYZER_PLATFORM=linux/amd64`.

The repo also includes `.github/workflows/static-analyzers.yml`. It runs on
manual dispatch, weekly schedule, and relevant PRs, installs Slither + Aderyn,
builds `output/static_baseline.json`, bundles dashboard data, validates the
schema, and uploads both JSON files as artifacts. It is read-only by design; it
does not commit generated benchmark output back to the repository.

Optional durable public-demo rate limiting:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Without those variables the route falls back to an in-memory limiter, which is
fine for local demos and acceptable as a degraded fallback on serverless.

### Deploy to Vercel (free tier)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmzunain%2Fsc-audit-benchmark&project-name=sc-audit-benchmark&root-directory=dashboard&env=OPENROUTER_API_KEY,NVIDIA_API_KEY)

Click the button, sign in with GitHub, set Root Directory to `dashboard` (Vercel
auto-detects this from the deploy link), and paste the two API keys when
prompted. Build takes ~1 minute; the resulting URL is shareable and the playground
works end-to-end against the same free NIM + OpenRouter tiers.

**Heads-up:** the playground endpoint is unauthenticated by default. The built-in
rate limit protects casual public demos, but longer-lived deployments should add
durable Redis env vars, authentication, or Cloudflare Turnstile before sharing
widely.

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
├── run.sh                         # One-command local setup + dashboard runner
├── data/                          # SWC categories, templates, generated contracts
├── scripts/                       # Static analyzer, validation, and data helpers
├── src/
│   ├── pipeline/                  # generator.py, scanner.py, judge.py, llm_client.py
│   ├── scoring/                   # metrics.py
│   └── main.py                    # Orchestrator
├── output/                        # Scanner reports, judge scores, leaderboard.json
└── dashboard/                     # Next.js 15 + Tailwind + shadcn/Radix UI
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
