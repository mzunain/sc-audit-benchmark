#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_DIR="$ROOT_DIR/dashboard"
DEFAULT_PORT="${PORT:-3000}"
HOST="${HOST:-127.0.0.1}"

SKIP_INSTALL=0
PREPARE_ONLY=0
REFRESH_STATIC=0
DOCKER_ANALYZERS=0
PROOF_DOCKER=0
PYTHON_BIN="$ROOT_DIR/.venv/bin/python"

log() {
  printf '\n== %s ==\n' "$1"
}

die() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage:
  ./run.sh

Starts the SC Audit Benchmark dashboard with one command.

Options:
  --prepare-only       Install/check deps and bundle data, then exit
  --refresh-static     Rebuild static analyzer data from local PATH tools
  --docker-analyzers   Rebuild static analyzer data inside Docker
  --proof-docker       Use Docker-backed Foundry for executable Proof Lab harnesses
  --skip-install       Skip Python and npm dependency installation
  --port PORT          Preferred dev-server port (default: 3000 or $PORT)
  --host HOST          Dev-server host (default: 127.0.0.1 or $HOST)
  -h, --help           Show this help

Examples:
  ./run.sh
  PORT=3005 ./run.sh
  ./run.sh --docker-analyzers
  ./run.sh --proof-docker
  ./run.sh --prepare-only
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prepare-only)
      PREPARE_ONLY=1
      shift
      ;;
    --refresh-static)
      REFRESH_STATIC=1
      shift
      ;;
    --docker-analyzers)
      DOCKER_ANALYZERS=1
      REFRESH_STATIC=1
      shift
      ;;
    --proof-docker)
      PROOF_DOCKER=1
      shift
      ;;
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --port)
      [[ $# -ge 2 ]] || die "--port requires a value"
      DEFAULT_PORT="$2"
      shift 2
      ;;
    --host)
      [[ $# -ge 2 ]] || die "--host requires a value"
      HOST="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

need_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but was not found on PATH"
}

port_available() {
  python3 - "$1" "$HOST" <<'PY'
import socket
import sys

port = int(sys.argv[1])
host = sys.argv[2]
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    sock.bind((host, port))
except OSError:
    sys.exit(1)
finally:
    sock.close()
PY
}

pick_port() {
  python3 - "$1" "$HOST" <<'PY'
import socket
import sys

start = int(sys.argv[1])
host = sys.argv[2]
for port in range(start, 65535):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((host, port))
    except OSError:
        continue
    finally:
        sock.close()
    print(port)
    break
else:
    raise SystemExit("no free port found")
PY
}

is_placeholder_or_empty() {
  local value="${1:-}"
  [[ -z "$value" || "$value" == *"..."* || "$value" == "changeme" ]]
}

cd "$ROOT_DIR"

log "Checking prerequisites"
need_command python3
need_command node
need_command npm

if [[ ! -f "$ROOT_DIR/.env" && -f "$ROOT_DIR/.env.example" ]]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  printf 'Created .env from .env.example. Add API keys there when you want live playground scans.\n'
fi

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

if is_placeholder_or_empty "${OPENROUTER_API_KEY:-}" && is_placeholder_or_empty "${NVIDIA_API_KEY:-}"; then
  printf 'No real API keys detected. Dashboard still runs; live playground scans need OPENROUTER_API_KEY or NVIDIA_API_KEY in .env.\n'
fi

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  log "Installing Python dependencies"
  if [[ ! -d "$ROOT_DIR/.venv" ]]; then
    python3 -m venv "$ROOT_DIR/.venv"
  fi
  "$PYTHON_BIN" -m pip install --upgrade pip
  "$PYTHON_BIN" -m pip install -r "$ROOT_DIR/requirements.txt"

  log "Installing dashboard dependencies"
  npm --prefix "$DASHBOARD_DIR" install
else
  log "Skipping dependency installation"
  if [[ ! -x "$PYTHON_BIN" ]]; then
    PYTHON_BIN="$(command -v python3)"
  fi
fi

if [[ "$PROOF_DOCKER" -eq 1 ]]; then
  need_command docker
  export SC_AUDIT_PROOF_RUNNER=docker
  printf 'Proof Lab executable harnesses will use Docker-backed Foundry.\n'
fi

log "Preparing benchmark data"
if [[ "$DOCKER_ANALYZERS" -eq 1 ]]; then
  need_command docker
  bash "$ROOT_DIR/scripts/run_static_analyzers.sh" --docker
else
  if [[ "$REFRESH_STATIC" -eq 1 || ! -f "$ROOT_DIR/output/static_baseline.json" ]]; then
    "$PYTHON_BIN" "$ROOT_DIR/scripts/static_baseline.py"
  else
    "$PYTHON_BIN" "$ROOT_DIR/scripts/validate_static_baseline.py" "$ROOT_DIR/output/static_baseline.json"
  fi
  npm --prefix "$DASHBOARD_DIR" run bundle-data
  "$PYTHON_BIN" "$ROOT_DIR/scripts/validate_static_baseline.py" "$DASHBOARD_DIR/public/data/static_baseline.json"
fi

if [[ "$PREPARE_ONLY" -eq 1 ]]; then
  log "Ready"
  printf 'Prepared dashboard data. Run ./run.sh to start the local app.\n'
  exit 0
fi

PORT_TO_USE="$DEFAULT_PORT"
if ! port_available "$PORT_TO_USE"; then
  PORT_TO_USE="$(pick_port "$DEFAULT_PORT")"
  printf 'Port %s is busy; using %s instead.\n' "$DEFAULT_PORT" "$PORT_TO_USE"
fi

log "Starting dashboard"
printf 'Open http://%s:%s\n' "$HOST" "$PORT_TO_USE"
exec npm --prefix "$DASHBOARD_DIR" run dev -- --hostname "$HOST" --port "$PORT_TO_USE"
