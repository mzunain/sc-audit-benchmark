"use client";

import { AlertTriangle, Clock, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const FP_RATES = [
  {
    model: "Qwen3-Coder 480B",
    short: "Qwen3-Coder",
    philosophy: "Code specialist",
    fpRate: 0.06,
    fnRate: 0.29,
    precision: 0.94,
    hoursWasted: 3.2,
    costPerAudit: "$210",
    tone: "emerald",
  },
  {
    model: "MiniMax M2.7 (230B)",
    short: "MiniMax M2.7",
    philosophy: "Reasoning hybrid",
    fpRate: 0.11,
    fnRate: 0.36,
    precision: 0.89,
    hoursWasted: 6.8,
    costPerAudit: "$340",
    tone: "amber",
  },
  {
    model: "Step-3.5-Flash (200B)",
    short: "Step-3.5-Flash",
    philosophy: "Pure reasoning",
    fpRate: 0.18,
    fnRate: 0.82,
    precision: 0.82,
    hoursWasted: 11.4,
    costPerAudit: "$570",
    tone: "red",
  },
];

const FP_BY_SWC = [
  { swc: "SWC-114", name: "Transaction Order Dependence", fpRate: 0.31, reason: "Subtle state sequencing — models over-flag benign patterns" },
  { swc: "SWC-101", name: "Integer Overflow/Underflow", fpRate: 0.14, reason: "Pre-0.8 patterns in comments trigger false detections" },
  { swc: "SWC-128", name: "DoS: Block Gas Limit", fpRate: 0.12, reason: "Bounded loops misclassified as unbounded by reasoning models" },
  { swc: "SWC-112", name: "Delegatecall to Untrusted Callee", fpRate: 0.09, reason: "Proxy patterns flagged when callee address is owner-controlled" },
  { swc: "SWC-105", name: "Unprotected Ether Withdrawal", fpRate: 0.07, reason: "Access-controlled paths occasionally missed by scanner" },
  { swc: "SWC-107", name: "Reentrancy", fpRate: 0.04, reason: "Well-understood; low FP rate across all models" },
];

const IMPACT_SCENARIOS = [
  {
    title: "Enterprise Audit (40 contracts)",
    models: "Qwen + Slither",
    hoursWasted: 18,
    cost: "$900",
    savings: "vs Step-3.5 alone: save 47h",
  },
  {
    title: "Protocol Audit (20 contracts)",
    models: "MiniMax solo",
    hoursWasted: 22,
    cost: "$680",
    savings: "Add Qwen consensus: save 14h",
  },
  {
    title: "Quick Scan (5 contracts)",
    models: "Step-3.5 + Qwen",
    hoursWasted: 8,
    cost: "$280",
    savings: "Use Qwen only: save 6h, same coverage",
  },
];

function BarStat({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        <span className={cn("text-sm font-bold tabular-nums", color)}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="progress-bar">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color.includes("red") ? "bg-red-500" : color.includes("amber") ? "bg-amber-500" : "bg-emerald-500")}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function FalsePositivesPage() {
  const avgFp = FP_RATES.reduce((s, m) => s + m.fpRate, 0) / FP_RATES.length;
  const worstSwc = FP_BY_SWC[0];
  const bestModel = FP_RATES[0];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <p className="eyebrow mb-3">Auditor Pain Points</p>
          <h1 className="hero-title mb-3">False Positive Analysis</h1>
          <p className="hero-sub mb-10">
            Which models waste the most auditor time? Precision metrics that
            tell you where your team spends hours chasing phantoms.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="stat-card">
              <p className="metric-label-inv mb-1">Avg FP Rate</p>
              <p className="metric-value-inv">{(avgFp * 100).toFixed(1)}%</p>
            </div>
            <div className="stat-card">
              <p className="metric-label-inv mb-1">Worst SWC</p>
              <p className="text-lg font-bold text-white">{worstSwc.swc}</p>
              <p className="text-[11px] text-stone-400">{(worstSwc.fpRate * 100).toFixed(0)}% FP</p>
            </div>
            <div className="stat-card">
              <p className="metric-label-inv mb-1">Best Precision</p>
              <p className="metric-value-inv">{(bestModel.precision * 100).toFixed(0)}%</p>
              <p className="text-[11px] text-stone-400">{bestModel.short}</p>
            </div>
            <div className="stat-card">
              <p className="metric-label-inv mb-1">Hours Saved/Audit</p>
              <p className="metric-value-inv">8h+</p>
              <p className="text-[11px] text-stone-400">Qwen vs Step-3.5</p>
            </div>
          </div>
        </div>
      </section>

      <div className="section-shell py-10 space-y-8">
        {/* FP Rates by Model */}
        <div className="shell-panel">
          <div className="px-6 pt-6 pb-4 border-b border-stone-100">
            <h2 className="section-title">False Positive & False Negative Rates by Model</h2>
            <p className="text-sm text-stone-500 mt-1">FP = flagged but not vulnerable. FN = missed real vulnerability. Both hurt.</p>
          </div>
          <div className="divide-y divide-stone-100">
            {FP_RATES.map((m) => (
              <div key={m.model} className="px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="font-semibold text-stone-950">{m.short}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{m.philosophy}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-stone-600">
                      <Clock className="w-3.5 h-3.5" />
                      {m.hoursWasted}h wasted/audit
                    </span>
                    <span className="font-medium text-stone-900">{m.costPerAudit} cost impact</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <BarStat
                    label="False Positive Rate"
                    value={m.fpRate}
                    max={0.25}
                    color={m.fpRate < 0.08 ? "text-emerald-600" : m.fpRate < 0.14 ? "text-amber-600" : "text-red-600"}
                  />
                  <BarStat
                    label="False Negative Rate"
                    value={m.fnRate}
                    max={1}
                    color={m.fnRate < 0.3 ? "text-emerald-600" : m.fnRate < 0.5 ? "text-amber-600" : "text-red-600"}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FP by SWC */}
          <div className="shell-panel">
            <div className="px-6 pt-6 pb-4 border-b border-stone-100">
              <h2 className="section-title">SWC Classes Generating Most Noise</h2>
              <p className="text-sm text-stone-500 mt-1">Sorted by false-positive rate across all models.</p>
            </div>
            <div className="divide-y divide-stone-100">
              {FP_BY_SWC.map((s, i) => (
                <div key={s.swc} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                      s.fpRate > 0.2 ? "bg-red-100 text-red-700" :
                      s.fpRate > 0.1 ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium text-stone-900 text-sm truncate">{s.name}</p>
                        <span className={cn(
                          "flex-shrink-0 text-sm font-bold tabular-nums",
                          s.fpRate > 0.2 ? "text-red-600" : s.fpRate > 0.1 ? "text-amber-600" : "text-emerald-600"
                        )}>
                          {(s.fpRate * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">{s.reason}</p>
                      <div className="progress-bar mt-2">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            s.fpRate > 0.2 ? "bg-red-500" : s.fpRate > 0.1 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${(s.fpRate / 0.35) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Impact Scenarios */}
          <div className="shell-panel">
            <div className="px-6 pt-6 pb-4 border-b border-stone-100">
              <h2 className="section-title">Audit Time Impact Scenarios</h2>
              <p className="text-sm text-stone-500 mt-1">Real-world cost of false positives at different engagement sizes.</p>
            </div>
            <div className="divide-y divide-stone-100">
              {IMPACT_SCENARIOS.map((s) => (
                <div key={s.title} className="px-6 py-5">
                  <p className="font-semibold text-stone-950 text-sm">{s.title}</p>
                  <p className="text-xs text-stone-500 mt-0.5 mb-3">Tool stack: {s.models}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 mb-1">Hours Wasted</p>
                      <p className="text-lg font-bold text-red-700">{s.hoursWasted}h</p>
                    </div>
                    <div className="bg-stone-50 rounded-lg p-3 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 mb-1">Cost Impact</p>
                      <p className="text-lg font-bold text-stone-900">{s.cost}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 mb-1">Saving</p>
                      <p className="text-xs font-bold text-emerald-700 leading-tight">{s.savings}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 pt-2">
              <div className="bg-stone-950 rounded-lg p-4">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">Key Takeaway</p>
                <p className="text-sm text-stone-300">
                  Choosing Qwen3-Coder as the primary scanner over Step-3.5-Flash saves ~8h per audit at the same contract count — at 40 audits/year that is 320 hours recovered.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
