# Contributing

Thanks for helping improve the Generative Solidity Vulnerability Benchmark. The
goal is to keep this project useful as shared infrastructure for evaluating LLMs
on smart contract vulnerability detection.

## Run the benchmark locally

```bash
./run.sh --prepare-only
source .venv/bin/activate
python src/main.py --contracts-count 2
```

Use the smoke test above before opening a pull request. For a full run, use:

```bash
python src/main.py
```

To view the dashboard from existing output:

```bash
./run.sh
```

## Add a new model

1. Add the model identifier to `src/pipeline/llm_client.py` if it needs custom
   routing or pricing metadata.
2. Run a smoke benchmark with `--scanner-models`.
3. Bundle dashboard data with `./run.sh --prepare-only`.
4. Include the resulting detection rate, quality score, and cost in your PR
   notes.

Example:

```bash
python src/main.py --contracts-count 2 --scanner-models \
  "nim:qwen/qwen3-coder-480b-a35b-instruct" \
  "openai/gpt-4o-mini"
```

## Add a new SWC category

1. Add the category metadata to `data/swc_categories.json`.
2. Add or update contract templates in `data/contract_templates.json`.
3. Generate a small test run and inspect the generated contract metadata under
   `data/generated_contracts/`.
4. Confirm scanner and judge outputs map back to the intended SWC class.

## Add static analyzer coverage

Static analyzer comparators live in `scripts/static_baseline.py` and are
validated by `scripts/validate_static_baseline.py`. Prefer normalized output
that maps findings back to benchmark SWC IDs.

Useful commands:

```bash
bash scripts/run_static_analyzers.sh --local
bash scripts/run_static_analyzers.sh --docker
python scripts/validate_static_baseline.py output/static_baseline.json
```

## Pull request checklist

- Run `./run.sh --prepare-only`.
- Run a smoke benchmark when changing pipeline, scoring, model, or SWC logic.
- Include before/after benchmark numbers when behavior changes.
- Keep generated output changes focused and explain why they changed.
