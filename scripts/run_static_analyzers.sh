#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${SC_AUDIT_ANALYZER_IMAGE:-sc-audit-analyzers:local}"
PLATFORM="${SC_AUDIT_ANALYZER_PLATFORM:-}"
MODE="${1:-local}"

run_local() {
  cd "$ROOT_DIR"

  echo "== Analyzer availability =="
  for tool in slither aderyn; do
    if command -v "$tool" >/dev/null 2>&1; then
      echo "  $tool: $(command -v "$tool")"
      "$tool" --version 2>/dev/null | head -n 1 || true
    else
      echo "  $tool: not installed"
    fi
  done

  echo "== Building static analyzer baseline =="
  python3 scripts/static_baseline.py --tools heuristic,slither,aderyn
  python3 scripts/validate_static_baseline.py output/static_baseline.json

  echo "== Bundling dashboard data =="
  npm --prefix dashboard run bundle-data
  python3 scripts/validate_static_baseline.py dashboard/public/data/static_baseline.json
}

case "$MODE" in
  --docker|docker)
    cd "$ROOT_DIR"
    if [[ -n "$PLATFORM" ]]; then
      docker build --platform "$PLATFORM" -f Dockerfile.analyzers -t "$IMAGE_NAME" .
      docker run --rm \
        --platform "$PLATFORM" \
        -v "$ROOT_DIR:/workspace" \
        -w /workspace \
        "$IMAGE_NAME" \
        bash scripts/run_static_analyzers.sh --local
    else
      docker build -f Dockerfile.analyzers -t "$IMAGE_NAME" .
      docker run --rm \
        -v "$ROOT_DIR:/workspace" \
        -w /workspace \
        "$IMAGE_NAME" \
        bash scripts/run_static_analyzers.sh --local
    fi
    ;;
  --local|local)
    run_local
    ;;
  *)
    echo "Usage: scripts/run_static_analyzers.sh [--local|--docker]" >&2
    exit 2
    ;;
esac
