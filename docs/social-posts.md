# Social Launch Copy

Use these posts to ask for feedback and stars before submitting the project.

## X / Twitter

I built a self-renewing Solidity vulnerability benchmark for LLMs:

- LLM generates vulnerable smart contracts
- LLM scanners try to find the bugs
- separate judge model scores against ground truth
- leaderboard includes quality + cost-adjusted scores

Built from That Crypto Hackathon, Turku May 2026, now open source benchmark infrastructure for audit firms and researchers.

Repo: https://github.com/mzunain/sc-audit-benchmark
Demo: https://sc-audit-benchmark.vercel.app/

Would appreciate stars, feedback, and model suggestions.

## LinkedIn

I open-sourced a project from That Crypto Hackathon in Turku: a self-renewing benchmark for evaluating LLMs on smart contract vulnerability detection.

Instead of relying on a fixed public dataset, the benchmark generates fresh vulnerable Solidity contracts, asks scanner models to find the bugs, and uses a separate judge model to grade against ground truth metadata.

The v1.0.0 run compares three open-weight model philosophies:

- Qwen3-Coder 480B: 71.4% detection, best quality, best cost-adjusted score
- MiniMax M2.7: 64.3% detection
- Step-3.5-Flash: 18.2% detection

The goal is reusable benchmark infrastructure: audit firms, researchers, and model teams can run it against their own LLMs and publish comparable results.

Repo: https://github.com/mzunain/sc-audit-benchmark
Live demo: https://sc-audit-benchmark.vercel.app/

Feedback, stars, and model suggestions are very welcome.

## dev.to / Medium Draft

Title: Building a Self-Renewing Solidity Vulnerability Benchmark for LLMs

I built an open-source benchmark for evaluating how well LLMs detect smart contract vulnerabilities.

The core idea is simple:

1. Generate fresh vulnerable Solidity contracts.
2. Store ground truth metadata for each generated case.
3. Ask scanner models to audit the contracts.
4. Use a separate judge model to score the scanner reports.
5. Publish quality and cost-adjusted leaderboards.

Why this matters:

Fixed datasets are useful, but LLMs can overfit to public benchmark examples. A self-renewing benchmark can generate new contracts for each run while preserving the same SWC-level evaluation target.

The v1.0.0 snapshot tested three open-weight model philosophies:

| Model | Detection | Quality | Cost-adjusted |
|---|---:|---:|---:|
| Qwen3-Coder 480B | 71.4% | 57.5 | 17,041.6 |
| MiniMax M2.7 | 64.3% | 44.6 | 1,882.4 |
| Step-3.5-Flash | 18.2% | 18.2 | 508.8 |

The biggest finding: code-specialized models beat pure reasoning models on this Solidity vulnerability workload, and the best quality result was also the cheapest at commercial list prices.

Repo: https://github.com/mzunain/sc-audit-benchmark
Live dashboard: https://sc-audit-benchmark.vercel.app/
Methodology: https://github.com/mzunain/sc-audit-benchmark/blob/main/METHODOLOGY.md

I would appreciate feedback, stars, and suggestions for additional models or SWC categories.
