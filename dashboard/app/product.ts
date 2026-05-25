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

export type ProofStatus = "reproduced" | "likely" | "template" | "blocked";
export type ProofGateState = "passed" | "ready" | "blocked";

export interface ProofTemplate {
  severity: "Critical" | "High" | "Medium";
  exploitGoal: string;
  hypothesis: string;
  foundryTest: string;
  patchAssertion: string;
  reviewerNote: string;
}

export interface ProofGate {
  label: string;
  state: ProofGateState;
  detail: string;
}

export interface ProofCase {
  swc: string;
  name: string;
  status: ProofStatus;
  statusLabel: string;
  proofScore: number;
  llmAverageRate: number;
  bestModel: string;
  bestModelRate: number;
  staticRate: number;
  staticFound: number;
  staticTotal: number;
  template: ProofTemplate;
  gates: ProofGate[];
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

export const PROOF_TEMPLATES: Record<string, ProofTemplate> = {
  "SWC-101": {
    severity: "High",
    exploitGoal: "Force an arithmetic edge case and prove the patched code reverts or preserves accounting.",
    hypothesis: "A boundary value can change balances or supply if arithmetic assumptions are wrong.",
    foundryTest: `function test_IntegerBoundaryRegression() public {
    vm.expectRevert();
    target.applyDelta(type(uint256).max);

    assertEq(target.totalSupply(), expectedSupply);
}`,
    patchAssertion: "Use Solidity 0.8 checked arithmetic or scoped unchecked blocks with explicit bounds.",
    reviewerNote: "Boundary arithmetic is weak across both LLMs and static tools in this run; require manual review.",
  },
  "SWC-104": {
    severity: "High",
    exploitGoal: "Make the low-level call fail and prove the contract cannot continue as if funds moved.",
    hypothesis: "A failed external call is ignored, leaving accounting or payout state inconsistent.",
    foundryTest: `function test_UncheckedCallMustRevert() public {
    receiver.setRejectTransfers(true);

    vm.expectRevert();
    vault.distribute(address(receiver), 1 ether);
}`,
    patchAssertion: "Check the returned success flag and revert or record a recoverable failed-payment state.",
    reviewerNote: "Static analyzers usually help here; LLM output should still explain business impact.",
  },
  "SWC-105": {
    severity: "Critical",
    exploitGoal: "Call the withdrawal path as an unprivileged actor and prove access control blocks it.",
    hypothesis: "A public withdrawal path can move contract funds without owner, role, or balance authority.",
    foundryTest: `function test_OnlyAuthorizedCanWithdraw() public {
    vm.prank(attacker);
    vm.expectRevert();
    treasury.withdraw(attacker, 1 ether);
}`,
    patchAssertion: "Apply owner, role, or capability checks before every fund-moving operation.",
    reviewerNote: "Treat every positive signal as release-blocking until privilege boundaries are explicit.",
  },
  "SWC-106": {
    severity: "Critical",
    exploitGoal: "Reach the selfdestruct path as an attacker and prove only authorized shutdown can execute.",
    hypothesis: "A public or weakly gated destroy function can permanently remove contract code and funds.",
    foundryTest: `function test_SelfdestructRequiresOwner() public {
    vm.prank(attacker);
    vm.expectRevert();
    target.emergencyDestroy(payable(attacker));
}`,
    patchAssertion: "Remove selfdestruct where possible; otherwise gate it behind owner, timelock, and migration policy.",
    reviewerNote: "Require a human signoff because the mitigation is often architectural, not only syntactic.",
  },
  "SWC-107": {
    severity: "Critical",
    exploitGoal: "Re-enter before state is updated and prove the patched version blocks the second withdrawal.",
    hypothesis: "External control returns to the attacker before balances are reduced.",
    foundryTest: `function test_ReentrancyExploitDrainsVulnerableVault() public {
    vault.deposit{value: 3 ether}();
    attacker.attack{value: 1 ether}();

    require(address(vault).balance == 0, "vault should be drained");
    require(address(attacker).balance == 4 ether, "attacker extracts all funds");
}

function test_ReentrancyPatchKeepsVictimFunds() public {
    fixedVault.deposit{value: 3 ether}();
    fixedAttacker.attack{value: 1 ether}();

    require(address(fixedVault).balance == 3 ether, "victim funds remain");
    require(fixedAttacker.reentryBlocked(), "patch blocks re-entry");
}`,
    patchAssertion: "Move state updates before external calls and add a reentrancy guard on fund-moving methods.",
    reviewerNote: "Use this as the default demo proof because it is easy to explain and visually convincing.",
  },
  "SWC-112": {
    severity: "Critical",
    exploitGoal: "Point delegatecall at attacker code and prove storage ownership cannot be overwritten.",
    hypothesis: "Delegatecall executes untrusted code in the caller storage context.",
    foundryTest: `function test_DelegatecallTargetIsAllowlisted() public {
    vm.prank(attacker);
    vm.expectRevert();
    proxy.execute(address(maliciousModule), payload);
}`,
    patchAssertion: "Allowlist delegatecall targets and freeze upgrade authority behind audited governance.",
    reviewerNote: "Pair the PoC with a storage-diff assertion so auditors can see the concrete takeover path.",
  },
  "SWC-114": {
    severity: "Medium",
    exploitGoal: "Simulate attacker ordering before the victim transaction and prove the patch removes profit.",
    hypothesis: "Transaction order changes the economic outcome for an attacker.",
    foundryTest: `function test_OrderingAttackNoLongerProfits() public {
    vm.prank(attacker);
    market.trade(attackerOrder);

    vm.prank(victim);
    market.trade(victimOrder);

    assertLe(token.balanceOf(attacker), attackerStart);
}`,
    patchAssertion: "Use commit-reveal, slippage bounds, deadlines, or batch settlement for order-sensitive flows.",
    reviewerNote: "The benchmark exposes this as a blind spot; require human MEV and protocol-design review.",
  },
  "SWC-128": {
    severity: "High",
    exploitGoal: "Grow state until the operation approaches the gas limit and prove the patched path stays bounded.",
    hypothesis: "An unbounded loop can make key operations impossible as state grows.",
    foundryTest: `function test_GasBoundedAfterLargeStateGrowth() public {
    seedUsers(500);

    uint256 gasBefore = gasleft();
    target.processBatch(0, 50);
    uint256 gasUsed = gasBefore - gasleft();

    assertLt(gasUsed, 2_500_000);
}`,
    patchAssertion: "Paginate loops, cap array growth, or move expensive work to bounded pull-based operations.",
    reviewerNote: "Make gas evidence concrete; a chart is weaker than a failing gas-budget test.",
  },
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

function proofStatus(bestModelRate: number, staticRate: number): ProofStatus {
  if (bestModelRate >= 0.5 && staticRate >= 0.5) return "reproduced";
  if (bestModelRate >= 0.5 || staticRate >= 0.5) return "likely";
  if (bestModelRate > 0 || staticRate > 0) return "template";
  return "blocked";
}

function proofStatusLabel(status: ProofStatus) {
  switch (status) {
    case "reproduced":
      return "Cross-tool reproduced";
    case "likely":
      return "Likely, needs PoC";
    case "template":
      return "Template ready";
    case "blocked":
      return "Human escalation";
  }
}

export function proofStatusTone(status: ProofStatus) {
  switch (status) {
    case "reproduced":
      return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200";
    case "likely":
      return "bg-cyan-100 text-cyan-900 ring-1 ring-cyan-200";
    case "template":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
    case "blocked":
      return "bg-rose-100 text-rose-900 ring-1 ring-rose-200";
  }
}

export function proofGateTone(state: ProofGateState) {
  switch (state) {
    case "passed":
      return "bg-emerald-500 text-white";
    case "ready":
      return "bg-cyan-500 text-white";
    case "blocked":
      return "bg-stone-300 text-stone-700";
  }
}

export function buildProofCases(data: BreakdownData, staticBaseline: StaticBaselineData | null): ProofCase[] {
  return data.swc_ids
    .map((swc) => {
      const modelRates = data.models.map((model) => {
        const cell = data.breakdown[model]?.[swc];
        return {
          model,
          rate: cell && cell.total > 0 ? cell.found / cell.total : 0,
        };
      });
      const best = modelRates.sort((a, b) => b.rate - a.rate)[0] ?? { model: data.models[0] ?? "", rate: 0 };
      const staticCell = staticBaseline?.summary.swc_coverage[swc] ?? { found: 0, total: 0 };
      const staticRate = staticCell.total > 0 ? staticCell.found / staticCell.total : 0;
      const llmAverageRate = swcAverageRate(data, swc);
      const status = proofStatus(best.rate, staticRate);
      const anySignal = best.rate > 0 || staticRate > 0;
      const proofScore = Math.round(best.rate * 50 + staticRate * 35 + llmAverageRate * 15);
      const template =
        PROOF_TEMPLATES[swc] ?? {
          severity: "Medium",
          exploitGoal: "Convert the finding into a minimal failing test.",
          hypothesis: "The finding is not proven until a reviewer can reproduce the path.",
          foundryTest: `function test_${swc.replace("-", "_")}_ProofTemplate() public {
    // Arrange vulnerable state.
    // Act as attacker.
    // Assert patched behavior.
}`,
          patchAssertion: "Add the smallest patch that makes the exploit test fail and the regression test pass.",
          reviewerNote: "No specialized template is configured for this SWC yet.",
        };
      const gates: ProofGate[] = [
        {
          label: "LLM finding",
          state: best.rate > 0 ? "passed" : "blocked",
          detail: best.rate > 0 ? `${modelMeta(best.model).short} found ${formatPct(best.rate * 100, 0)}` : "No model signal",
        },
        {
          label: "Static agreement",
          state: staticRate > 0 ? "passed" : staticBaseline ? "blocked" : "ready",
          detail: staticBaseline
            ? `${staticCell.found}/${staticCell.total || 0} static samples`
            : "Static baseline pending",
        },
        {
          label: "Exploit hypothesis",
          state: anySignal ? "ready" : "blocked",
          detail: anySignal ? template.hypothesis : "Needs human hypothesis",
        },
        {
          label: "Foundry PoC",
          state: anySignal ? "ready" : "blocked",
          detail: anySignal ? "Template generated, execution not run" : "Blocked until a path is identified",
        },
        {
          label: "Patch regression",
          state: status === "reproduced" || status === "likely" ? "ready" : "blocked",
          detail:
            status === "reproduced" || status === "likely"
              ? template.patchAssertion
              : "Wait for a confirmed proof path",
        },
      ];

      return {
        swc,
        name: data.swc_names[swc] ?? swc,
        status,
        statusLabel: proofStatusLabel(status),
        proofScore,
        llmAverageRate,
        bestModel: best.model,
        bestModelRate: best.rate,
        staticRate,
        staticFound: staticCell.found,
        staticTotal: staticCell.total,
        template,
        gates,
      };
    })
    .sort((a, b) => b.proofScore - a.proofScore || a.swc.localeCompare(b.swc));
}
