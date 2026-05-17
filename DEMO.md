# Live demo script — 5 minutes

The demo answers one question: *if you're an audit firm picking an LLM for Solidity review, what should you deploy?* Everything else is supporting evidence.

## Pre-flight (do this before the demo, not during)

```bash
# 1. Dependencies installed and dashboard built
cd dashboard && npm install && npm run build && cd ..

# 2. Make sure the full benchmark already ran so the dashboard has data
python src/main.py --skip-generation   # or just run python src/main.py once

# 3. Dev server up
cd dashboard && set -a && source ../.env && set +a && npm run dev &
# wait until you see "Ready in"
```

If you're paranoid about live API failures during the demo, pre-generate one contract you can scan live:

```bash
python src/main.py --contracts-count 1 \
  --scanner-models nim:qwen/qwen3-coder-480b-a35b-instruct \
  --skip-generation false
# Keep data/generated_contracts/contract_001.sol around — you'll cat it later.
```

## The 5-minute flow

### 0:00–0:30 — Setup the problem
> "Audit firms want to deploy LLMs for smart contract review. The question is which one. We built a benchmark to answer that with data — and crucially, one that won't get cheated as new models come out."

Open https://github.com/mzunain/sc-audit-benchmark in a browser tab. Don't dwell.

### 0:30–1:30 — Generator (live)
> "Stage one: we use an LLM to inject a known vulnerability into a clean Solidity contract. This is what makes the benchmark self-renewing — every run produces fresh contracts that aren't in any training set."

Run live:
```bash
python src/main.py --contracts-count 1 \
  --scanner-models nim:qwen/qwen3-coder-480b-a35b-instruct \
  --judge-model nim:meta/llama-3.3-70b-instruct
```

While it runs (~30s):
> "It's also entirely on free tiers — NVIDIA NIM credits and OpenRouter — so the benchmark itself costs $0. Cost numbers on the leaderboard reflect what a commercial deployment would actually pay."

Open `data/generated_contracts/contract_001.sol` in your editor. Point at the injected vuln line.

### 1:30–2:30 — Scanner output
> "Stage two: scanner models try to find it. We're testing three open-weight philosophies — pure code-specialist, code+reasoning hybrid, and pure reasoning."

Show the scanner report:
```bash
cat output/scanner_reports/nim_qwen_qwen3-coder-480b-a35b-instruct_reports.json | jq '.scans[0].report'
```

Highlight: SWC ID, location, explanation. It's structured — that's what makes the judge consistent.

### 2:30–3:00 — Judge
> "Stage three: an independent LLM grades each scan against the generator's ground truth. Llama-3.3-70B in our case, kept out of the scanner pool to avoid self-judging bias."

```bash
cat output/judge_scores/nim_qwen_qwen3-coder-480b-a35b-instruct_judgments.json | jq '.judgments[0].judgment'
```

Point at `found_correct_vuln`, `swc_id_match`, `overall_score`. That's how we score, deterministically.

### 3:00–4:30 — The leaderboard
Switch to browser: http://localhost:3000

> "Across 15 contracts and 8 SWC vulnerability classes, here's what shakes out."

Read the headline callout out loud. Toggle cost-adjusted ↔ pure quality — both leaderboards have the same winner.

Point at the chart. Point at the philosophy chips.

Click **Per-vuln breakdown**:
> "There's a universal blind spot — none of the three models reliably catch transaction-order-dependence bugs. That's actionable: if you're auditing for front-running, you need a human."

### 4:30–5:00 — Punchline
Back to the leaderboard.

> "Three takeaways for SC Audit Studio. One — for Solidity vulnerability detection, code-tuning matters more than reasoning. Two — Qwen3-Coder 480B is also the cheapest of the three on commercial pricing, so cheap-and-good is the winning combo here. Three — because the test set is generated fresh every run, this benchmark won't go stale when the next model drops. You can run it on every release."

Pause. End.

## Backups if the live run fails

- **API 429 / 504:** Pre-recorded GIF of the generator + scanner outputs in `output/`. Just `cat` the existing files instead of re-running.
- **Dashboard offline:** Open the raw JSON: `output/presentation_data.json`. Worst case, walk the table in your terminal.
- **Total NIM outage:** Show the GitHub repo's README "Results" section — same numbers, less impressive but conveys the substance.

## Demo Q&A prep

- **"How do you know the judge isn't biased toward its own family?"** Judge is `meta/llama-3.3-70b-instruct`; scanners are Qwen / MiniMax / Stepfun. Different families. We also chose a non-reasoning judge specifically to avoid the inconsistent JSON output we saw with reasoning-model judges.
- **"Could the generator just produce trivially-detectable bugs?"** The generator's system prompt explicitly asks for subtle injection and adds unrelated helper functions to obscure the bug. The fact that none of the scanners hit 100% confirms the bugs aren't trivial.
- **"Why these 8 SWC classes?"** They cover ~80% of real-world exploits (DAO hack, Parity, Beauty Chain, etc.). It's the standard registry — easy to extend, but starting with the highest-impact ones.
- **"Why is reasoning so much worse than code-tuning here?"** Hypothesis: reasoning models burn token budget on internal deliberation before emitting structured output, which we hit in our `max_tokens` config. Even with `max_tokens=4000`, Step-3.5-Flash only gets 1 in 5. Suggests pattern recognition (code-tuned models) beats deliberation (reasoning models) for this task.
- **"Did you talk to Linus?"** Yes — pipeline architecture (3-stage Generator/Scanner/Judge), focus on Solidity-only, cost weighting in scoring, dataset baseline — all incorporated from his feedback.
