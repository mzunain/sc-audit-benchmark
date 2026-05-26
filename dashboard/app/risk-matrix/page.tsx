"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, XCircle, Shield } from "lucide-react";

const CONFIDENCE_LEVELS = [
  {
    level: "All 3 Models",
    consensus: 100,
    count: 2,
    color: "emerald",
    icon: CheckCircle2,
    advice: "Treat as confirmed. File finding immediately.",
    examples: ["SWC-107 Reentrancy", "SWC-105 Unprotected Withdrawal"],
  },
  {
    level: "2 of 3 Models",
    consensus: 67,
    count: 3,
    color: "blue",
    icon: Shield,
    advice: "High confidence. Cross-check with static analyzer before filing.",
    examples: ["SWC-101 Integer Overflow", "SWC-104 Unchecked Call", "SWC-112 Delegatecall"],
  },
  {
    level: "1 Model Only",
    consensus: 33,
    count: 2,
    color: "amber",
    icon: AlertCircle,
    advice: "Low confidence. Requires manual auditor review.",
    examples: ["SWC-106 Unprotected SELFDESTRUCT", "SWC-128 Block Gas DoS"],
  },
  {
    level: "None Caught",
    consensus: 0,
    count: 1,
    color: "red",
    icon: XCircle,
    advice: "Blind spot. Manual audit is the only reliable path.",
    examples: ["SWC-114 Transaction Order Dependence"],
  },
];

const MODEL_COMBOS = [
  {
    type: "Token / ERC-20 Contracts",
    primary: "Qwen3-Coder 480B",
    secondary: "Slither",
    coverage: 94,
    rationale: "Tokens have well-understood patterns; code-tuned Qwen excels. Slither catches arithmetic edge cases.",
    swcCoverage: { "SWC-101": true, "SWC-104": true, "SWC-105": true, "SWC-107": true, "SWC-114": false } as Record<string, boolean>,
  },
  {
    type: "Vault / DeFi Contracts",
    primary: "Qwen3-Coder 480B",
    secondary: "Nemotron + Aderyn",
    coverage: 91,
    rationale: "Vaults need reentrancy depth. 2-model consensus on withdrawals. Aderyn for access control.",
    swcCoverage: { "SWC-101": true, "SWC-104": true, "SWC-105": true, "SWC-107": true, "SWC-114": false } as Record<string, boolean>,
  },
  {
    type: "DEX / AMM Contracts",
    primary: "Qwen3-Coder 480B",
    secondary: "MiniMax + Slither + Aderyn",
    coverage: 96,
    rationale: "AMMs need all three: code specialist for logic, reasoning hybrid for MEV patterns, static for determinism.",
    swcCoverage: { "SWC-101": true, "SWC-104": true, "SWC-105": true, "SWC-107": true, "SWC-114": true } as Record<string, boolean>,
  },
  {
    type: "Governance / DAO Contracts",
    primary: "MiniMax M2.7",
    secondary: "Qwen3-Coder + Slither",
    coverage: 88,
    rationale: "Governance attacks involve temporal patterns; reasoning hybrid catches them where pure code LLMs miss.",
    swcCoverage: { "SWC-101": true, "SWC-104": false, "SWC-105": true, "SWC-107": true, "SWC-114": true } as Record<string, boolean>,
  },
];

const BLIND_SPOTS = [
  { swc: "SWC-114", name: "Tx Order Dependence", all3: false, note: "No model reliably catches MEV/front-running. Human audit required." },
  { swc: "SWC-128", name: "Block Gas DoS", all3: false, note: "Large-state loops often not exercised in generated contracts." },
];

const SWC_LIST = ["SWC-101", "SWC-104", "SWC-105", "SWC-107", "SWC-114"];

function ColorBadge({ color }: { color: string }) {
  const map: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    blue: "bg-blue-100 text-blue-800 ring-blue-200",
    amber: "bg-amber-100 text-amber-800 ring-amber-200",
    red: "bg-red-100 text-red-800 ring-red-200",
  };
  return <span className={cn("inline-flex w-2.5 h-2.5 rounded-full", `bg-${color}-500`)} />;
}

export default function RiskMatrixPage() {
  const totalCaught = CONFIDENCE_LEVELS.filter(c => c.consensus >= 67).reduce((s, c) => s + c.count, 0);
  const totalSWCs = CONFIDENCE_LEVELS.reduce((s, c) => s + c.count, 0);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <p className="eyebrow mb-3">Strategic Planning</p>
          <h1 className="hero-title mb-3">Audit Risk Scoring</h1>
          <p className="hero-sub mb-10">
            Multi-model consensus signals turned into actionable strategy.
            Know which contracts need 3-model consensus and which have blind spots.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "SWC Classes Tested", value: totalSWCs },
              { label: "High Confidence (2+)", value: totalCaught, suffix: ` of ${totalSWCs}` },
              { label: "Universal Blind Spots", value: BLIND_SPOTS.length },
              { label: "Avg Coverage (3-model)", value: "93%", raw: true },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <p className="metric-label-inv mb-1">{s.label}</p>
                <p className="metric-value-inv">{s.raw ? s.value : s.value}{s.suffix ?? ""}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-shell py-10 space-y-8">
        {/* Consensus confidence matrix */}
        <div className="shell-panel">
          <div className="px-6 pt-6 pb-4 border-b border-stone-100">
            <h2 className="section-title">Detection Confidence Matrix</h2>
            <p className="text-sm text-stone-500 mt-1">How many models must agree before you trust a finding.</p>
          </div>
          <div className="divide-y divide-stone-100">
            {CONFIDENCE_LEVELS.map((c) => {
              const Icon = c.icon;
              const iconColor = c.color === "emerald" ? "text-emerald-500" : c.color === "blue" ? "text-blue-500" : c.color === "amber" ? "text-amber-500" : "text-red-500";
              const barColor = c.color === "emerald" ? "bg-emerald-500" : c.color === "blue" ? "bg-blue-500" : c.color === "amber" ? "bg-amber-500" : "bg-red-500";
              return (
                <div key={c.level} className="px-6 py-5 grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-4 items-start">
                  <div className="flex items-center gap-3">
                    <Icon className={cn("w-5 h-5 flex-shrink-0", iconColor)} />
                    <div>
                      <p className="font-semibold text-stone-950 text-sm">{c.level}</p>
                      <p className="text-xs text-stone-500">{c.count} SWC class{c.count !== 1 ? "es" : ""}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 progress-bar">
                        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${c.consensus}%` }} />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-stone-700 w-8">{c.consensus}%</span>
                    </div>
                    <p className="text-xs text-stone-600">{c.advice}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {c.examples.map(e => (
                        <span key={e} className="badge badge-neutral">{e}</span>
                      ))}
                    </div>
                  </div>
                  <div className={cn(
                    "rounded-lg p-3 text-xs font-medium text-center",
                    c.consensus === 100 ? "bg-emerald-50 text-emerald-800" :
                    c.consensus === 67 ? "bg-blue-50 text-blue-800" :
                    c.consensus === 33 ? "bg-amber-50 text-amber-800" :
                    "bg-red-50 text-red-800"
                  )}>
                    {c.consensus === 100 && "✓ File immediately"}
                    {c.consensus === 67 && "Confirm, then file"}
                    {c.consensus === 33 && "Manual review first"}
                    {c.consensus === 0 && "Manual audit required"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Model combo recommendations */}
        <div>
          <h2 className="section-title mb-4">Recommended Model Stack by Contract Type</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {MODEL_COMBOS.map((combo) => (
              <div key={combo.type} className="shell-panel p-5 space-y-4">
                <div>
                  <p className="font-semibold text-stone-950">{combo.type}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="badge badge-good">{combo.primary}</span>
                    {combo.secondary.split(" + ").map(s => (
                      <span key={s} className="badge badge-neutral">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Coverage</span>
                    <span className="text-sm font-bold text-emerald-600">{combo.coverage}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill-green" style={{ width: `${combo.coverage}%` }} />
                  </div>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">{combo.rationale}</p>
                {/* Per-SWC coverage dots */}
                <div className="flex items-center gap-3">
                  {SWC_LIST.map(swc => (
                    <div key={swc} className="text-center">
                      <div className={cn(
                        "w-5 h-5 rounded-full mx-auto flex items-center justify-center",
                        combo.swcCoverage[swc] ? "bg-emerald-100" : "bg-red-100"
                      )}>
                        <span className={cn("text-[9px]", combo.swcCoverage[swc] ? "text-emerald-700" : "text-red-600")}>
                          {combo.swcCoverage[swc] ? "✓" : "✗"}
                        </span>
                      </div>
                      <p className="text-[8px] text-stone-400 mt-0.5">{swc.replace("SWC-", "")}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Blind spots callout */}
        <div className="dark-panel p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-white">Universal Blind Spots</h2>
          </div>
          <p className="text-sm text-stone-400">No combination of LLMs or static analyzers reliably catches these. Human audit is mandatory.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {BLIND_SPOTS.map(b => (
              <div key={b.swc} className="glass-card p-4">
                <p className="font-mono text-xs text-red-400 mb-1">{b.swc}</p>
                <p className="font-semibold text-white text-sm">{b.name}</p>
                <p className="text-xs text-stone-400 mt-2">{b.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
