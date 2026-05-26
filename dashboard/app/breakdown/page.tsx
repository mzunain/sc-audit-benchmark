"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, X, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BreakdownData, formatPct, modelMeta, swcAverageRate, SWC_ACTIONS } from "../product";

// ---------------------------------------------------------------------------
// SWC deep-dive data
// ---------------------------------------------------------------------------

interface SwcDetail {
  severity: "Critical" | "High" | "Medium";
  cvss: string;
  description: string;
  attackScenario: string;
  evmNote: string;
  detectionDifficulty: "Low" | "Medium" | "High";
  blindSpot: boolean;
  remediationHint: string;
}

const SWC_DETAILS: Record<string, SwcDetail> = {
  "SWC-101": {
    severity: "High",
    cvss: "7.5",
    description:
      "Integer arithmetic in Solidity wraps silently below 0.8.x (or when using assembly/unchecked blocks). Overflow or underflow can corrupt balances, bypass access guards, and drain funds.",
    attackScenario:
      "Attacker mints a uint256 that wraps to zero, bypassing a require(balance >= amount) check and withdrawing the full vault.",
    evmNote:
      "The EVM operates on 256-bit words with no overflow trap. SafeMath or Solidity ≥ 0.8 adds built-in overflow checks at the cost of ~3 extra gas per operation.",
    detectionDifficulty: "Medium",
    blindSpot: false,
    remediationHint: "Use Solidity ≥ 0.8 or wrap arithmetic in SafeMath / OpenZeppelin's checked math helpers.",
  },
  "SWC-104": {
    severity: "High",
    cvss: "6.5",
    description:
      "When the return value of a low-level call is ignored, a failed transfer is silently treated as success. This can leave state inconsistencies where funds appear spent but the recipient never received them.",
    attackScenario:
      "A payout contract calls recipient.call{value: amount}('') without checking ok. The call fails (e.g., recipient is a reverting contract) but the payout is marked complete.",
    evmNote:
      "`.call()` returns (bool, bytes). Unlike `transfer()` and `send()`, it does not revert on failure—the caller must check the boolean.",
    detectionDifficulty: "Low",
    blindSpot: false,
    remediationHint: "Always check the return value: `(bool ok, ) = addr.call{...}('')`; require(ok, 'transfer failed');",
  },
  "SWC-105": {
    severity: "Critical",
    cvss: "9.1",
    description:
      "A function that withdraws ETH lacks proper authorization, allowing any caller to drain the contract balance.",
    attackScenario:
      "No `onlyOwner` guard on `withdraw()`. Attacker calls it directly, specifying their own address and emptying the contract.",
    evmNote:
      "ETH withdrawal functions are high-value targets. `msg.sender` checks are necessary but insufficient if the owner variable itself is unprotected at initialization.",
    detectionDifficulty: "Low",
    blindSpot: false,
    remediationHint: "Gate all withdrawal functions with `onlyOwner` or role-based access control. Use OpenZeppelin Ownable.",
  },
  "SWC-106": {
    severity: "Critical",
    cvss: "9.8",
    description:
      "An unguarded `selfdestruct` call can be triggered by any account, destroying the contract and sweeping its ETH balance to an arbitrary address.",
    attackScenario:
      "Attacker calls `kill(attacker_address)` on a contract where the SELFDESTRUCT instruction has no access modifier, burning all contract logic and stealing all ETH.",
    evmNote:
      "Post-EIP-6780 (Dencun), `selfdestruct` only clears ETH in the same transaction it was deployed. Contract code is preserved in other cases, but ETH transfer still occurs.",
    detectionDifficulty: "Low",
    blindSpot: false,
    remediationHint: "Guard selfdestruct with `onlyOwner` or remove it entirely if not operationally required.",
  },
  "SWC-107": {
    severity: "Critical",
    cvss: "9.8",
    description:
      "A reentrancy attack occurs when an external call is made before state is finalized, allowing the callee to re-enter the calling function and execute logic that should have been blocked.",
    attackScenario:
      "Attacker's fallback() calls back into withdraw() before balances[msg.sender] is zeroed. Each recursive call passes the balance check, draining the vault.",
    evmNote:
      "The EVM executes call stacks synchronously but allows callees to invoke any function on the caller. Gas limits bound depth but not impact when ETH is at stake.",
    detectionDifficulty: "Medium",
    blindSpot: false,
    remediationHint: "Apply checks-effects-interactions: update state BEFORE external calls. Use ReentrancyGuard from OpenZeppelin.",
  },
  "SWC-112": {
    severity: "Critical",
    cvss: "9.3",
    description:
      "Using `delegatecall` to an address supplied by an untrusted caller allows the callee to overwrite storage slots in the caller's context, including owner, implementation, and any funds.",
    attackScenario:
      "Proxy contract delegates to `_impl` which is user-controlled. Attacker passes a malicious address that overwrites the `owner` slot and then drains funds.",
    evmNote:
      "delegatecall executes the target's code in the caller's storage context. Any SSTORE in the callee writes to the caller's slots—a privileged capability that must never be user-controlled.",
    detectionDifficulty: "High",
    blindSpot: false,
    remediationHint: "Only delegatecall to trusted, audited, and immutable addresses. Never pass the target address as a function parameter without strict allow-listing.",
  },
  "SWC-114": {
    severity: "High",
    cvss: "5.9",
    description:
      "Smart contracts that rely on transaction ordering (e.g., first-come-first-served mechanics) are vulnerable to front-running. Miners and MEV bots can observe pending transactions and insert their own to gain an unfair advantage.",
    attackScenario:
      "A DEX contract emits a price update. A MEV bot spots the pending tx, submits its own swap at the old price with a higher gas fee, and the miner orders it first—profiting at the user's expense.",
    evmNote:
      "Ethereum's mempool is public. Block proposers can arbitrarily reorder transactions within a block. EIP-1559 reduced tip variance but did not eliminate ordering attacks.",
    detectionDifficulty: "High",
    blindSpot: true,
    remediationHint: "Use commit-reveal schemes, slippage protection, time-locks, or private mempools (Flashbots Protect) for sensitive operations.",
  },
  "SWC-128": {
    severity: "Medium",
    cvss: "5.3",
    description:
      "Loops whose iteration count depends on user-supplied data or unbounded storage can consume more gas than the block limit, causing transactions to always revert and permanently bricking contract functionality.",
    attackScenario:
      "Admin registers 10,000 addresses. A payout loop over `registeredUsers` hits the block gas limit on iteration ~800, making `distribute()` permanently uncallable.",
    evmNote:
      "Ethereum blocks have a gas limit (~30M on mainnet). A for-loop over N elements costs O(N) gas. If N grows beyond ~5,000-10,000 (depends on loop body), the function becomes permanently DoS'd.",
    detectionDifficulty: "Medium",
    blindSpot: true,
    remediationHint: "Replace unbounded loops with pull-payment patterns. Use pagination or off-chain processing for large data sets.",
  },
};

// ---------------------------------------------------------------------------
// SWC deep-dive modal (slide-over)
// ---------------------------------------------------------------------------

function SwcModal({
  swcId,
  swcName,
  data,
  onClose,
}: {
  swcId: string;
  swcName: string;
  data: BreakdownData;
  onClose: () => void;
}) {
  const detail = SWC_DETAILS[swcId];
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const modelRows = data.models.map(model => {
    const cell = data.breakdown[model]?.[swcId];
    const rate = cell && cell.total > 0 ? cell.found / cell.total : 0;
    return { model, cell, rate };
  }).sort((a, b) => b.rate - a.rate);

  const severityColor = detail?.severity === "Critical"
    ? "bg-red-100 text-red-800"
    : detail?.severity === "High"
    ? "bg-orange-100 text-orange-800"
    : "bg-amber-100 text-amber-800";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal
      aria-label={`${swcId} deep dive`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-stone-500">{swcId}</span>
              {detail && (
                <>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityColor}`}>
                    {detail.severity}
                  </span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                    CVSS {detail.cvss}
                  </span>
                  {detail.blindSpot && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      Universal blind spot
                    </span>
                  )}
                </>
              )}
            </div>
            <h2 className="mt-1.5 text-xl font-semibold text-stone-950">{swcName}</h2>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 shrink-0 rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-950 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          {detail ? (
            <>
              {/* Description */}
              <section>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
                  <Info className="h-3.5 w-3.5" />
                  What it is
                </div>
                <p className="text-sm leading-7 text-stone-700">{detail.description}</p>
              </section>

              {/* Attack scenario */}
              <section className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Attack scenario
                </div>
                <p className="text-sm leading-7 text-stone-800">{detail.attackScenario}</p>
              </section>

              {/* EVM note */}
              <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  EVM context
                </div>
                <p className="text-sm leading-7 text-stone-700">{detail.evmNote}</p>
              </section>

              {/* Detection difficulty */}
              <section>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Detection difficulty</span>
                  <span className={`text-xs font-bold ${
                    detail.detectionDifficulty === "High" ? "text-red-600" :
                    detail.detectionDifficulty === "Medium" ? "text-amber-600" : "text-emerald-600"
                  }`}>{detail.detectionDifficulty}</span>
                </div>
                <div className="h-1.5 rounded-full bg-stone-100">
                  <div
                    className={`h-1.5 rounded-full ${
                      detail.detectionDifficulty === "High" ? "bg-red-500 w-full" :
                      detail.detectionDifficulty === "Medium" ? "bg-amber-400 w-2/3" : "bg-emerald-500 w-1/3"
                    }`}
                  />
                </div>
              </section>

              {/* Model performance */}
              <section>
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Model detection rates</div>
                <div className="space-y-3">
                  {modelRows.map(({ model, cell, rate }) => (
                    <div key={model}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-stone-800">{modelMeta(model).short}</span>
                        <span className="text-sm font-bold tabular-nums text-stone-950">
                          {cell ? `${cell.found}/${cell.total}` : "—"} ({Math.round(rate * 100)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-stone-100">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            rate >= 0.8 ? "bg-emerald-500" :
                            rate >= 0.5 ? "bg-emerald-300" :
                            rate > 0 ? "bg-amber-400" : "bg-stone-200"
                          }`}
                          style={{ width: `${Math.round(rate * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Remediation hint */}
              <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">Remediation</div>
                <p className="text-sm leading-7 text-stone-800">{detail.remediationHint}</p>
                <a
                  href="/remediation"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  View full pattern library
                  <ExternalLink className="h-3 w-3" />
                </a>
              </section>
            </>
          ) : (
            <p className="text-sm text-stone-500">No deep-dive data available for {swcId}.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function cellColor(rate: number) {
  if (rate >= 0.8) return "bg-emerald-200 text-emerald-950";
  if (rate >= 0.5) return "bg-emerald-100 text-emerald-900";
  if (rate >= 0.25) return "bg-amber-100 text-amber-900";
  if (rate > 0) return "bg-rose-100 text-rose-900";
  return "bg-stone-100 text-stone-500";
}

function modelCoverage(data: BreakdownData, model: string) {
  let found = 0;
  let total = 0;
  for (const swc of data.swc_ids) {
    const cell = data.breakdown[model]?.[swc];
    if (cell) {
      found += cell.found;
      total += cell.total;
    }
  }
  return { found, total, rate: total === 0 ? 0 : found / total };
}

export default function Breakdown() {
  const [data, setData] = useState<BreakdownData | null>(null);
  const [modelFilter, setModelFilter] = useState("all");
  const [coverageFilter, setCoverageFilter] = useState<"all" | "weak" | "covered">("all");
  const [selected, setSelected] = useState<{ model: string; swc: string } | null>(null);
  const [deepDiveSwc, setDeepDiveSwc] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/breakdown.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const visibleModels = useMemo(() => {
    if (!data) return [];
    return modelFilter === "all" ? data.models : data.models.filter((model) => model === modelFilter);
  }, [data, modelFilter]);

  const visibleSwcs = useMemo(() => {
    if (!data) return [];
    if (coverageFilter === "weak") return data.swc_ids.filter((swc) => swcAverageRate(data, swc) < 0.5);
    if (coverageFilter === "covered") return data.swc_ids.filter((swc) => swcAverageRate(data, swc) >= 0.5);
    return data.swc_ids;
  }, [coverageFilter, data]);

  const swcRanking = useMemo(() => {
    if (!data) return [];
    return [...data.swc_ids]
      .map((swc) => ({ swc, rate: swcAverageRate(data, swc), name: data.swc_names[swc] }))
      .sort((a, b) => a.rate - b.rate);
  }, [data]);

  if (!data) {
    return (
      <main className="min-h-screen">
        <div className="section-shell py-10 text-stone-500">Loading...</div>
      </main>
    );
  }

  const selectedCell = selected ? data.breakdown[selected.model]?.[selected.swc] : null;
  const weakest = swcRanking[0];
  const strongest = swcRanking[swcRanking.length - 1];
  const zeroCoverage = swcRanking.filter((item) => item.rate === 0).length;

  return (
    <main className="min-h-screen">
      <section className="border-b border-stone-200 bg-stone-950 text-white">
        <div className="section-shell py-10 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div className="max-w-4xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Coverage intelligence</div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                SWC routing map for model and human review.
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-stone-300">
                See which vulnerability classes are safe for automated first pass, which need model ensemble,
                and which still need a security engineer before signoff.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2">
              <div className="bg-stone-950 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Weakest</div>
                <div className="mt-1 text-2xl font-semibold text-rose-200">{weakest?.swc}</div>
              </div>
              <div className="bg-stone-950 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Strongest</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-200">{strongest?.swc}</div>
              </div>
              <div className="bg-stone-950 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Zero coverage</div>
                <div className="mt-1 text-2xl font-semibold">{zeroCoverage}</div>
              </div>
              <div className="bg-stone-950 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Matrix</div>
                <div className="mt-1 text-2xl font-semibold">{data.models.length} x {data.swc_ids.length}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell py-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-stone-950">Interactive heatmap</h2>
                <p className="mt-1 text-sm text-stone-600">Click a cell to inspect the exact model and vulnerability class.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={modelFilter} onValueChange={setModelFilter}>
                  <SelectTrigger aria-label="Filter model" className="w-[210px]">
                    <SelectValue placeholder="Filter model" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectGroup>
                      <SelectItem value="all">All models</SelectItem>
                      {data.models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {modelMeta(model).short}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <div className="flex rounded-md bg-stone-100 p-1">
                  {[
                    ["all", "All"],
                    ["weak", "Weak"],
                    ["covered", "Covered"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setCoverageFilter(key as "all" | "weak" | "covered")}
                      className={[
                        "rounded px-3 py-1.5 text-sm font-medium transition focus-ring",
                        coverageFilter === key ? "bg-white text-stone-950 shadow-sm" : "text-stone-600 hover:text-stone-950",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel overflow-x-auto rounded-lg">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="border-b border-stone-200 bg-stone-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Model
                    </th>
                    {visibleSwcs.map((swc) => (
                      <th key={swc} className="px-3 py-3 text-center text-xs">
                        <button
                          onClick={() => setDeepDiveSwc(swc)}
                          title={`Deep dive: ${swc} — ${data.swc_names[swc]}`}
                          className="focus-ring rounded px-1 py-0.5 transition hover:bg-stone-200"
                        >
                          <div className="font-mono font-semibold text-stone-800">{swc}</div>
                          <div className="mt-0.5 text-[10px] font-normal leading-tight text-stone-500">
                            {data.swc_names[swc].length > 18 ? `${data.swc_names[swc].slice(0, 18)}...` : data.swc_names[swc]}
                          </div>
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleModels.map((model) => {
                    const total = modelCoverage(data, model);
                    return (
                      <tr key={model} className="border-b border-stone-100 last:border-0">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-stone-950">{modelMeta(model).short}</div>
                          <div className="mt-1 text-xs text-stone-500">{modelMeta(model).philosophy}</div>
                        </td>
                        {visibleSwcs.map((swc) => {
                          const cell = data.breakdown[model]?.[swc];
                          if (!cell || cell.total === 0) {
                            return (
                              <td key={swc} className="bg-stone-50/70 px-2 py-3 text-center text-stone-300">
                                -
                              </td>
                            );
                          }
                          const rate = cell.found / cell.total;
                          const active = selected?.model === model && selected?.swc === swc;
                          return (
                            <td key={swc} className="px-2 py-3 text-center">
                              <button
                                onClick={() => setSelected({ model, swc })}
                                className={[
                                  "focus-ring w-full rounded-md px-2 py-2 transition hover:scale-[1.02]",
                                  cellColor(rate),
                                  active ? "ring-2 ring-stone-950" : "",
                                ].join(" ")}
                              >
                                <div className="font-semibold tabular-nums">{cell.found}/{cell.total}</div>
                                <div className="text-[10px] tabular-nums">{formatPct(rate * 100, 0)}</div>
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-4 py-4 text-right">
                          <div className="font-semibold tabular-nums text-stone-950">{formatPct(total.rate * 100, 0)}</div>
                          <div className="mt-1 text-xs tabular-nums text-stone-500">{total.found}/{total.total}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-600">
              <span className="rounded bg-emerald-200 px-2.5 py-1">80% or higher</span>
              <span className="rounded bg-emerald-100 px-2.5 py-1">50 to 79%</span>
              <span className="rounded bg-amber-100 px-2.5 py-1">25 to 49%</span>
              <span className="rounded bg-rose-100 px-2.5 py-1">1 to 24%</span>
              <span className="rounded bg-stone-100 px-2.5 py-1">0%</span>
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <div className="panel rounded-lg p-5">
              <div className="eyebrow">Selected cell</div>
              {selected && selectedCell ? (
                <>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
                    {modelMeta(selected.model).short} on {selected.swc}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{data.swc_names[selected.swc]}</p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-stone-200 p-3">
                      <div className="metric-label">Found</div>
                      <div className="mt-1 text-lg font-semibold text-stone-950">{selectedCell.found}</div>
                    </div>
                    <div className="rounded-md border border-stone-200 p-3">
                      <div className="metric-label">Total</div>
                      <div className="mt-1 text-lg font-semibold text-stone-950">{selectedCell.total}</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md bg-stone-50 p-3">
                    <div className="metric-label">Next action</div>
                    <p className="mt-2 text-sm leading-relaxed text-stone-700">
                      {SWC_ACTIONS[selected.swc] ?? "Route low-confidence findings to manual triage."}
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-stone-600">
                  Select a heatmap cell to see model-specific coverage and the recommended audit action.
                </p>
              )}
            </div>

            <div className="panel rounded-lg p-5">
              <div className="eyebrow">SWC runbook</div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">Prioritized review order</h2>
              <div className="mt-5 space-y-3">
                {swcRanking.map((item) => (
                  <div key={item.swc} className="flex gap-2">
                    <button
                      onClick={() => setSelected({ model: visibleModels[0] ?? data.models[0], swc: item.swc })}
                      className="focus-ring flex-1 rounded-md border border-stone-200 bg-white p-3 text-left transition hover:border-emerald-300"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-xs font-semibold text-stone-500">{item.swc}</div>
                          <div className="mt-0.5 text-sm font-semibold text-stone-950">{item.name}</div>
                        </div>
                        <div className="text-sm font-semibold tabular-nums text-stone-700">{formatPct(item.rate * 100, 0)}</div>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-stone-100">
                        <div
                          className="h-1.5 rounded-full bg-emerald-500"
                          style={{ width: `${Math.round(item.rate * 100)}%` }}
                        />
                      </div>
                    </button>
                    <button
                      onClick={() => setDeepDiveSwc(item.swc)}
                      title={`Deep dive: ${item.swc}`}
                      className="focus-ring shrink-0 rounded-md border border-stone-200 bg-white px-2.5 text-stone-400 hover:border-stone-400 hover:text-stone-700 transition"
                    >
                      <ShieldAlert className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* SWC deep-dive modal */}
      {deepDiveSwc && (
        <SwcModal
          swcId={deepDiveSwc}
          swcName={data.swc_names[deepDiveSwc] ?? deepDiveSwc}
          data={data}
          onClose={() => setDeepDiveSwc(null)}
        />
      )}
    </main>
  );
}
