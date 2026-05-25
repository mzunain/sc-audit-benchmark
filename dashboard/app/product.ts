export interface ModelScore {
  model: string;
  detection: number;
  quality: number;
  cost_usd: number;
  value: number;
}

export interface ModelMeta {
  short: string;
  philosophy: string;
  thesis: string;
  bestFor: string;
  caution: string;
  tone: string;
  accent: string;
}

export interface BreakdownData {
  models: string[];
  swc_ids: string[];
  swc_names: Record<string, string>;
  breakdown: Record<string, Record<string, { found: number; total: number }>>;
}

export interface StaticBaselineData {
  title: string;
  baseline_id: string;
  generated_at: string;
  primary_comparator_id?: string | null;
  summary: {
    detection_rate: number;
    false_positives_per_contract: number;
    findings_per_contract: number;
    contracts_scanned: number;
    swc_coverage: Record<string, { found: number; total: number }>;
  };
  tools: {
    id: string;
    name: string;
    available: boolean;
    adapter: string;
    status?: string;
  }[];
  comparators?: StaticComparator[];
  notes: string[];
}

export interface StaticComparator {
  id: string;
  name: string;
  available: boolean;
  adapter: string;
  status: "ran" | "ready" | "unavailable" | "error" | "planned" | string;
  summary: StaticBaselineData["summary"] | null;
  errors?: unknown[];
}

export const MODEL_META: Record<string, ModelMeta> = {
  "nim:qwen/qwen3-coder-480b-a35b-instruct": {
    short: "Qwen3-Coder 480B",
    philosophy: "Code specialist",
    thesis: "Best current production pick for Solidity-first recall and cost control.",
    bestFor: "High-volume pre-audit triage, CI gates, and audit assistant routing.",
    caution: "Still misses transaction-order dependence, so humans own mempool and MEV review.",
    tone: "bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200",
    accent: "#0891b2",
  },
  "nim:minimaxai/minimax-m2.7": {
    short: "MiniMax M2.7",
    philosophy: "Code + reasoning",
    thesis: "Strong alternate reviewer when you want a second model family in the loop.",
    bestFor: "Cross-checking access control, delegatecall, unchecked calls, and selfdestruct paths.",
    caution: "Costs more than Qwen on this run and misses modern arithmetic edge cases.",
    tone: "bg-violet-50 text-violet-800 ring-1 ring-violet-200",
    accent: "#7c3aed",
  },
  "nim:stepfun-ai/step-3.5-flash": {
    short: "Step 3.5 Flash",
    philosophy: "Reasoning specialist",
    thesis: "Useful contrast model, but not yet reliable as the lead Solidity scanner.",
    bestFor: "Reasoning baseline and fallback experiments where recall is not the only goal.",
    caution: "Low detection in this dataset makes it risky for automated gates.",
    tone: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    accent: "#d97706",
  },
};

export function modelMeta(model: string): ModelMeta {
  return (
    MODEL_META[model] ?? {
      short: model.replace(/^nim:/, ""),
      philosophy: "Untagged",
      thesis: "No local product metadata is configured for this model yet.",
      bestFor: "Exploratory scans and one-off comparisons.",
      caution: "Add benchmark data before treating this as a production scanner.",
      tone: "bg-stone-100 text-stone-700 ring-1 ring-stone-200",
      accent: "#78716c",
    }
  );
}

export const COMPETITIVE_MATRIX = [
  {
    name: "EVMbench",
    category: "AI agent benchmark",
    marketSignal: "Detect, patch, and exploit modes on curated historical vulnerabilities.",
    tableStakes: "Objective harnesses, exploit validation, and agent lifecycle scoring.",
    ourEdge: "Self-renewing generated SWC corpus, cost-adjusted model economics, and a lightweight demo scanner.",
    source: "https://openai.com/index/introducing-evmbench/",
  },
  {
    name: "Slither / Aderyn",
    category: "Static analyzers",
    marketSignal: "Fast detector-based scans, CI integration, custom detector workflows, and machine-readable reports.",
    tableStakes: "Speed, reproducibility, low-noise findings, and integration with developer workflows.",
    ourEdge: "LLM-vs-LLM model selection, explanation quality scoring, and blind-spot discovery beyond detector coverage.",
    source: "https://github.com/crytic/slither",
  },
  {
    name: "Certora Prover",
    category: "Formal verification",
    marketSignal: "Property rules are checked mathematically against contract bytecode and reported back to teams.",
    tableStakes: "Invariant-driven confidence, every-commit verification, and shareable proof artifacts.",
    ourEdge: "Pre-verification model triage: identify where LLMs help, where formal specs are mandatory, and where humans must review.",
    source: "https://www.certora.com/prover",
  },
  {
    name: "Tenderly / Defender",
    category: "Ops and simulation",
    marketSignal: "Debugging, transaction simulation, deployment workflows, monitoring, alerting, and incident response.",
    tableStakes: "Runtime visibility, alerts, simulated execution, and post-deploy operational controls.",
    ourEdge: "Audit-model benchmarking before production, with a path to route risky classes into monitoring and simulation.",
    source: "https://docs.tenderly.co/",
  },
];

export const PRODUCT_PILLARS = [
  {
    label: "Benchmark evidence",
    detail: "Fresh vulnerable contracts, independent judge scoring, and per-SWC pass/fail analysis.",
  },
  {
    label: "Buyer economics",
    detail: "Quality, detection, token cost, and value-per-dollar live in the same decision surface.",
  },
  {
    label: "Human handoff",
    detail: "Universal misses and weak SWC classes become explicit review triggers instead of hidden risk.",
  },
  {
    label: "Workflow fit",
    detail: "Playground, fallback model routing, and report shaping make the benchmark usable in demos and trials.",
  },
];

export const MODEL_EXPANSION_ROADMAP = [
  {
    lane: "Closed frontier",
    models: "Claude Sonnet, GPT-4.1/4o family, Gemini Flash/Pro",
    why: "Shows buyers whether open-weight scanners are actually competitive against paid frontier APIs.",
    status: "Add when API budget is available",
  },
  {
    lane: "Static baselines",
    models: "Slither, Aderyn, Mythril",
    why: "Separates LLM judgment from deterministic detector coverage and exposes false-negative classes.",
    status: "Slither/Aderyn adapters ready; Mythril next",
  },
  {
    lane: "Formal path",
    models: "Certora-style property checks and invariant templates",
    why: "Routes LLM blind spots into proof workflows instead of pretending a scanner is enough.",
    status: "Spec-driven follow-up",
  },
  {
    lane: "Ops path",
    models: "Tenderly simulation, Defender monitor, transaction replay",
    why: "Connects pre-audit findings to runtime monitoring, simulation, and incident response.",
    status: "Post-deploy integration",
  },
];

export const PRODUCTION_GATES = [
  {
    gate: "Abuse control",
    ready: "Rate limits, model allowlist, payload size caps, provider timeouts, and optional durable Redis backing.",
  },
  {
    gate: "Evidence export",
    ready: "JSON, Markdown, and print-to-PDF audit packets from playground results.",
  },
  {
    gate: "Decision memory",
    ready: "Local scan history and two-run comparison without server-side contract storage.",
  },
  {
    gate: "Deployment",
    ready: "Vercel config is present; production requires provider API keys in the target project.",
  },
];

export const SWC_ACTIONS: Record<string, string> = {
  "SWC-101": "Require compiler-version review and unchecked arithmetic pass before trusting LLM output.",
  "SWC-104": "Pair model findings with deterministic checks for low-level call handling.",
  "SWC-105": "Treat as access-control review. Confirm roles, ownership, and withdrawal authority manually.",
  "SWC-106": "Gate every selfdestruct path with ownership, upgradeability, and deprecation review.",
  "SWC-107": "Use model output as a first pass, then validate with call-order and state-update review.",
  "SWC-112": "Require delegatecall trust-boundary review and upgrade target provenance checks.",
  "SWC-114": "Escalate to human MEV/front-running review; single-file LLM scanning is not enough.",
  "SWC-128": "Check loops, bounded iteration, and gas-amplification paths with large-state scenarios.",
};

export function formatPct(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

export function formatUsd(value: number) {
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function averageDetection(rows: ModelScore[]) {
  if (rows.length === 0) return 0;
  return rows.reduce((sum, row) => sum + row.detection, 0) / rows.length;
}

export function totalCommercialCost(rows: ModelScore[]) {
  return rows.reduce((sum, row) => sum + row.cost_usd, 0);
}

export function coverageRate(data: BreakdownData, model: string, swc: string) {
  const cell = data.breakdown[model]?.[swc];
  if (!cell || cell.total === 0) return null;
  return cell.found / cell.total;
}

export function swcAverageRate(data: BreakdownData, swc: string) {
  let found = 0;
  let total = 0;
  for (const model of data.models) {
    const cell = data.breakdown[model]?.[swc];
    if (cell) {
      found += cell.found;
      total += cell.total;
    }
  }
  return total === 0 ? 0 : found / total;
}

export function staticCoverageRows(data: StaticBaselineData) {
  return Object.entries(data.summary.swc_coverage)
    .map(([swc, cell]) => ({
      swc,
      found: cell.found,
      total: cell.total,
      rate: cell.total === 0 ? 0 : (cell.found / cell.total) * 100,
    }))
    .sort((a, b) => a.rate - b.rate || a.swc.localeCompare(b.swc));
}

export function staticComparatorRows(data: StaticBaselineData) {
  return (data.comparators ?? [
    {
      id: data.primary_comparator_id ?? "heuristic",
      name: data.title,
      available: true,
      adapter: "built-in",
      status: "ran",
      summary: data.summary,
    },
  ]).map((item) => ({
    ...item,
    recall: item.summary?.detection_rate ?? 0,
    findingsPerContract: item.summary?.findings_per_contract ?? 0,
    falsePositivesPerContract: item.summary?.false_positives_per_contract ?? 0,
    contractsScanned: item.summary?.contracts_scanned ?? 0,
  }));
}
