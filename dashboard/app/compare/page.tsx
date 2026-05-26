"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// Explicit interface so swcRates is Record<string,number> everywhere (prevents TS7053)
interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  philosophy: string;
  tone: string;
  detectionRate: number;
  qualityScore: number;
  costPer15: number;
  costAdjusted: number;
  fpRate: number;
  strengths: string[];
  weaknesses: string[];
  swcRates: Record<string, number>;
}

const ALL_MODELS: ModelEntry[] = [
  {
    id: "qwen",
    name: "Qwen3-Coder 480B",
    provider: "NVIDIA NIM",
    philosophy: "Code specialist",
    tone: "emerald",
    detectionRate: 0.714,
    qualityScore: 57.5,
    costPer15: 0.0034,
    costAdjusted: 17041,
    fpRate: 0.06,
    strengths: ["Best code pattern recognition", "Lowest cost per bug", "Fastest inference among 3"],
    weaknesses: ["SWC-114 blind spot (all models)", "Limited cross-contract reasoning"],
    swcRates: {
      "SWC-107": 0.93, "SWC-101": 0.80, "SWC-104": 0.87, "SWC-105": 0.90,
      "SWC-106": 0.67, "SWC-112": 0.73, "SWC-114": 0.13, "SWC-128": 0.60,
    },
  },
  {
    id: "minimax",
    name: "MiniMax M2.7 (230B)",
    provider: "NVIDIA NIM",
    philosophy: "Reasoning hybrid",
    tone: "blue",
    detectionRate: 0.643,
    qualityScore: 44.6,
    costPer15: 0.0237,
    costAdjusted: 1882,
    fpRate: 0.11,
    strengths: ["Reasoning depth on complex patterns", "Good governance / temporal logic", "Hybrid code+reasoning balance"],
    weaknesses: ["7× more expensive than Qwen", "Slightly lower raw detection rate", "More verbose FP output"],
    swcRates: {
      "SWC-107": 0.87, "SWC-101": 0.73, "SWC-104": 0.80, "SWC-105": 0.80,
      "SWC-106": 0.60, "SWC-112": 0.67, "SWC-114": 0.20, "SWC-128": 0.53,
    },
  },
  {
    id: "step",
    name: "Step-3.5-Flash (200B)",
    provider: "NVIDIA NIM",
    philosophy: "Pure reasoning",
    tone: "amber",
    detectionRate: 0.182,
    qualityScore: 18.2,
    costPer15: 0.0357,
    costAdjusted: 509,
    fpRate: 0.18,
    strengths: ["Chain-of-thought explanations", "Good high-level contract intent", "Academic-style rationale"],
    weaknesses: ["4× lower detection vs Qwen", "Highest cost per scan", "Worst FP rate of the three"],
    swcRates: {
      "SWC-107": 0.27, "SWC-101": 0.20, "SWC-104": 0.23, "SWC-105": 0.20,
      "SWC-106": 0.13, "SWC-112": 0.17, "SWC-114": 0.07, "SWC-128": 0.13,
    },
  },
];

const SWC_LIST = [
  { id: "SWC-107", name: "Reentrancy", severity: "Critical" },
  { id: "SWC-101", name: "Integer Overflow", severity: "High" },
  { id: "SWC-104", name: "Unchecked Call", severity: "High" },
  { id: "SWC-105", name: "Unprotected ETH Withdrawal", severity: "Critical" },
  { id: "SWC-106", name: "Unprotected SELFDESTRUCT", severity: "Critical" },
  { id: "SWC-112", name: "Delegatecall to Untrusted", severity: "Critical" },
  { id: "SWC-114", name: "Tx Order Dependence", severity: "High" },
  { id: "SWC-128", name: "Block Gas DoS", severity: "Medium" },
];

function RateCell({ rate }: { rate: number }) {
  const bg = rate >= 0.8 ? "bg-emerald-100 text-emerald-900" :
              rate >= 0.5 ? "bg-amber-100 text-amber-900" :
              "bg-red-100 text-red-900";
  return (
    <div className={cn("rounded px-2 py-1 text-center text-sm font-semibold tabular-nums", bg)}>
      {(rate * 100).toFixed(0)}%
    </div>
  );
}

function WinnerDot({ values, idx, lower = false }: { values: number[]; idx: number; lower?: boolean }) {
  const sorted = [...values].sort((a, b) => lower ? a - b : b - a);
  const isWinner = values[idx] === sorted[0];
  if (!isWinner) return null;
  return <span className="ml-1 text-emerald-500 text-xs">★</span>;
}

export default function ComparePage() {
  const [selected, setSelected] = useState<string[]>(["qwen", "minimax"]);

  const models = ALL_MODELS.filter(m => selected.includes(m.id));

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(x => x !== id) : prev
        : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const detRates = models.map(m => m.detectionRate);
  const costs = models.map(m => m.costPer15);
  const fps = models.map(m => m.fpRate);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <p className="eyebrow mb-3">Side-by-Side</p>
          <h1 className="hero-title mb-3">Model Comparison</h1>
          <p className="hero-sub mb-8">
            Compare up to 3 models across detection rates, costs, per-SWC coverage,
            and strengths. Pick the right scanner for your audit type.
          </p>
          {/* Model selector */}
          <div className="flex flex-wrap gap-3">
            {ALL_MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all",
                  selected.includes(m.id)
                    ? "border-emerald-400 bg-emerald-500/20 text-white"
                    : "border-white/20 bg-white/5 text-stone-400 hover:border-white/40 hover:text-white",
                  !selected.includes(m.id) && selected.length >= 3 && "opacity-40 cursor-not-allowed"
                )}
                disabled={!selected.includes(m.id) && selected.length >= 3}
              >
                {m.name.split(" ")[0]}
                {selected.includes(m.id) && <span className="ml-2 text-emerald-400">✓</span>}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500 mt-3">Select 2 or 3 models to compare (★ = winner in that metric)</p>
        </div>
      </section>

      <div className="section-shell py-10 space-y-8">
        {/* Top-line metrics */}
        <div className="shell-panel overflow-x-auto">
          <div className="px-6 pt-6 pb-4 border-b border-stone-100">
            <h2 className="section-title">Key Metrics</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                {models.map(m => <th key={m.id}>{m.name.split(" ")[0]}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-medium">Philosophy</td>
                {models.map(m => <td key={m.id} className="text-stone-600">{m.philosophy}</td>)}
              </tr>
              <tr>
                <td className="font-medium">Detection Rate</td>
                {models.map((m, i) => (
                  <td key={m.id}>
                    <span className={cn("font-bold tabular-nums", m.detectionRate === Math.max(...detRates) ? "text-emerald-600" : "text-stone-700")}>
                      {(m.detectionRate * 100).toFixed(1)}%
                      <WinnerDot values={detRates} idx={i} />
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="font-medium">Quality Score</td>
                {models.map((m, i) => (
                  <td key={m.id}>
                    <span className={cn("font-bold tabular-nums", m.qualityScore === Math.max(...models.map(x => x.qualityScore)) ? "text-emerald-600" : "text-stone-700")}>
                      {m.qualityScore}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="font-medium">Cost (15 scans)</td>
                {models.map((m, i) => (
                  <td key={m.id}>
                    <span className={cn("font-mono font-bold", m.costPer15 === Math.min(...costs) ? "text-emerald-600" : "text-stone-700")}>
                      ${m.costPer15.toFixed(4)}
                      <WinnerDot values={costs} idx={i} lower />
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="font-medium">False Positive Rate</td>
                {models.map((m, i) => (
                  <td key={m.id}>
                    <span className={cn("font-bold tabular-nums", m.fpRate === Math.min(...fps) ? "text-emerald-600" : "text-red-600")}>
                      {(m.fpRate * 100).toFixed(0)}%
                      <WinnerDot values={fps} idx={i} lower />
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="font-medium">Cost-Adjusted Score</td>
                {models.map(m => (
                  <td key={m.id}>
                    <span className={cn("font-bold tabular-nums", m.costAdjusted === Math.max(...models.map(x => x.costAdjusted)) ? "text-emerald-600" : "text-stone-700")}>
                      {m.costAdjusted.toLocaleString()}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Per-SWC detection heatmap */}
        <div className="shell-panel overflow-x-auto">
          <div className="px-6 pt-6 pb-4 border-b border-stone-100">
            <h2 className="section-title">Per-SWC Detection Rates</h2>
            <p className="text-sm text-stone-500 mt-1">Green ≥ 80% · Amber ≥ 50% · Red &lt; 50%</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>SWC Class</th>
                <th>Severity</th>
                {models.map(m => <th key={m.id}>{m.name.split(" ")[0]}</th>)}
              </tr>
            </thead>
            <tbody>
              {SWC_LIST.map(swc => (
                <tr key={swc.id}>
                  <td>
                    <span className="font-mono text-stone-500 text-xs">{swc.id}</span>
                    <span className="ml-2 text-stone-800">{swc.name}</span>
                  </td>
                  <td>
                    <span className={cn(
                      "badge",
                      swc.severity === "Critical" ? "badge-critical" :
                      swc.severity === "High" ? "badge-high" : "badge-medium"
                    )}>{swc.severity}</span>
                  </td>
                  {models.map(m => (
                    <td key={m.id}>
                      <RateCell rate={m.swcRates[swc.id] ?? 0} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Strengths and weaknesses */}
        <div className={cn("grid gap-4", models.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
          {models.map(m => (
            <div key={m.id} className="shell-panel p-5 space-y-4">
              <div>
                <p className="font-semibold text-stone-950">{m.name}</p>
                <p className="text-xs text-stone-500 mt-0.5">{m.philosophy} · {m.provider}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Strengths</p>
                <ul className="space-y-1.5">
                  {m.strengths.map(s => (
                    <li key={s} className="flex items-start gap-2 text-xs text-stone-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Weaknesses</p>
                <ul className="space-y-1.5">
                  {m.weaknesses.map(w => (
                    <li key={w} className="flex items-start gap-2 text-xs text-stone-700">
                      <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
