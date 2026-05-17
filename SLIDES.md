# Slide deck — speaker notes + content

5 slides. Each block below is one slide. Headers are the slide title; the body is content + speaker notes. Take these into Keynote/Google Slides/PowerPoint or convert to PPTX with `marp SLIDES.md --pptx`.

---

## Slide 1 — Generative Solidity Vulnerability Benchmark

**Subtitle:** Self-renewing audit benchmark for LLMs

Muhammad Zulqarnain & Samia
SC Audit Studio challenge · That Crypto Hackathon · Turku, May 2026

**Speaker notes:**
> "We built a benchmark that answers one question for audit firms: which LLM should we deploy for Solidity review? And we built it in a way that won't go stale when the next model drops."

---

## Slide 2 — The problem

- Audit firms want LLM-assisted review. Premium closed-source (Sonnet, GPT-4) costs $3–$15 per million tokens. Open-weight self-hosted is cheaper but is it good enough?
- Existing benchmarks (EVMBench, etc.) use **fixed datasets** — they leak into training data and overfit
- Static benchmarks can't keep up with the model release cadence

**Speaker notes:**
> "The right answer to 'which model should we use?' is data, not vibes. But every existing benchmark is a fixed dataset, which means the next round of model training quietly memorises it. Six months from now, EVMBench tells you nothing."

---

## Slide 3 — Our pipeline

A 3-stage LLM pipeline:

```
GENERATOR  →  SCANNER(S)  →  JUDGE
  inject       try to        grade vs
  known        find vuln     ground truth
  vuln
```

- **Generator** mutates clean Solidity templates to inject a known SWC vulnerability. Different mutation every run → self-renewing test set
- **Scanner** is the thing we measure — gets the contract, outputs a structured vulnerability report
- **Judge** is a separate LLM that grades each scan against the generator's ground truth (`found_correct_vuln`, `swc_id_match`, `severity_match`, …)
- All `temperature=0`, all `nim:` or `:free` providers, full run costs **$0** of API spend

**Speaker notes:**
> "Three stages, three independent models. The generator is what makes this honest — if the contracts are different every run, no scanner can have memorised them. The judge is what makes it scalable — we don't need human graders, and the JSON output makes the score reproducible."

---

## Slide 4 — Methodology

- **8 SWC classes** — reentrancy, integer overflow, unchecked-call, unprotected-ether-withdrawal, unprotected-selfdestruct, delegatecall-untrusted, transaction-order-dependence, DoS-gas-limit
- **5 base templates** — token, vault, multisig, auction, staking
- **3 model philosophies tested** as scanners:
  - **Qwen3-Coder 480B** — pure code-specialist
  - **MiniMax M2.7** (230B) — code + reasoning hybrid
  - **Step-3.5-Flash** (200B sparse MoE) — pure reasoning
- **Judge:** `nim:meta/llama-3.3-70b-instruct` — kept outside the scanner pool, no self-judging
- **Cost-weighted scoring:** `quality / commercial_cost_per_run` — rewards cheap-and-good

**Speaker notes:**
> "We deliberately picked three philosophies, not three random models. That's because what audit firms actually need to know is architectural: do we deploy a code-tuned model, a reasoning model, or something in between? Each scanner is from a different research lab — Alibaba, MiniMax, Stepfun — so no single vendor's house style dominates."

---

## Slide 5 — Results & takeaways

| Model | Detection | Quality | Cost (15 scans) | Cost-adjusted |
|---|---|---|---|---|
| 🏆 **Qwen3-Coder 480B** *(code specialist)* | **71.4%** | **57.5** | **$0.0034** | **17,041** |
| MiniMax M2.7 *(hybrid)* | 64.3% | 44.6 | $0.0237 | 1,882 |
| Step-3.5-Flash *(reasoning)* | 18.2% | 18.2 | $0.0357 | 509 |

**Three takeaways for SC Audit Studio:**

1. **Code-tuning beats reasoning** on Solidity vulnerability detection. Not by a little — Qwen3-Coder finds 4× more bugs than the reasoning model.
2. **Cheap-and-good is the winning combo.** Qwen3-Coder is *also the cheapest of the three on commercial pricing.* 10× cheaper than Sonnet for the same task class.
3. **Universal blind spot:** none of the three reliably catch transaction-order-dependence (SWC-114). If you're auditing for front-running, that still needs a human.

**Bonus:** because the test set regenerates every run, this benchmark can be CI'd against each new model release. It doesn't go stale.

**Speaker notes:**
> "The headline is Qwen3-Coder. It wins on quality, it wins on detection rate, and it also wins on cost — because NVIDIA prices the 480B at thirty cents per million tokens versus Sonnet at three dollars. For SC Audit Studio specifically: you could self-host this today and undercut anyone using closed frontier models, with better Solidity recall."
>
> "The blind spot slide is the one I'd want auditors to pin to the wall. The benchmark is telling you what the models *can't* do, not just what they can."
