"use client";

import { useState, useMemo } from "react";
import { Calculator, TrendingDown, DollarSign, Shield, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const MODELS = [
  { id: "qwen", name: "Qwen3-Coder 480B", costPerM: 0.30, detectionRate: 0.714, fpRate: 0.06, philosophy: "Code specialist" },
  { id: "minimax", name: "MiniMax M2.7 (230B)", costPerM: 1.58, detectionRate: 0.643, fpRate: 0.11, philosophy: "Reasoning hybrid" },
  { id: "step", name: "Step-3.5-Flash (200B)", costPerM: 2.38, detectionRate: 0.182, fpRate: 0.18, philosophy: "Pure reasoning" },
  { id: "sonnet", name: "Claude Sonnet 4.5", costPerM: 3.00, detectionRate: 0.72, fpRate: 0.08, philosophy: "Frontier closed" },
  { id: "gpt4o", name: "GPT-4o", costPerM: 5.00, detectionRate: 0.68, fpRate: 0.10, philosophy: "Frontier closed" },
];

const CONTRACT_TYPES = [
  { id: "token", label: "ERC-20 Token", avgTokens: 3200, riskMultiplier: 1.0 },
  { id: "vault", label: "DeFi Vault", avgTokens: 7800, riskMultiplier: 1.4 },
  { id: "dex", label: "DEX / AMM", avgTokens: 14000, riskMultiplier: 1.6 },
  { id: "governance", label: "Governance / DAO", avgTokens: 9500, riskMultiplier: 1.3 },
  { id: "nft", label: "NFT / Marketplace", avgTokens: 5200, riskMultiplier: 0.9 },
];

const AUDITOR_RATE = 150; // $/hr
const FP_REVIEW_HOURS = 2; // hours per false positive to triage

type Stack = { primary: string; secondary?: string };

const RECOMMENDED_STACKS: Record<string, Stack> = {
  token: { primary: "qwen", secondary: undefined },
  vault: { primary: "qwen", secondary: "minimax" },
  dex: { primary: "qwen", secondary: "minimax" },
  governance: { primary: "minimax", secondary: "qwen" },
  nft: { primary: "qwen", secondary: undefined },
};

function fmt$(n: number) {
  return n < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

function fmtK(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();
}

export default function CostCalculator() {
  const [contractCount, setContractCount] = useState(20);
  const [contractType, setContractType] = useState("vault");
  const [selectedModels, setSelectedModels] = useState<string[]>(["qwen"]);
  const [auditorRate, setAuditorRate] = useState(AUDITOR_RATE);

  const ctype = CONTRACT_TYPES.find(c => c.id === contractType)!;
  const recommended = RECOMMENDED_STACKS[contractType];

  const results = useMemo(() => {
    return MODELS.filter(m => selectedModels.includes(m.id)).map(model => {
      const tokensPerContract = ctype.avgTokens * 2; // in + out
      const totalTokens = tokensPerContract * contractCount;
      const llmCost = (totalTokens / 1_000_000) * model.costPerM;

      const effectiveDetection = Math.min(0.99, model.detectionRate * ctype.riskMultiplier);
      const expectedMisses = contractCount * (1 - effectiveDetection);
      const falsePositives = contractCount * model.fpRate;
      const fpAuditorCost = falsePositives * FP_REVIEW_HOURS * auditorRate;

      const totalCost = llmCost + fpAuditorCost;
      const costPerVulnFound = totalCost / (contractCount * effectiveDetection);

      return {
        model,
        llmCost,
        fpAuditorCost,
        totalCost,
        effectiveDetection,
        expectedMisses,
        falsePositives,
        costPerVulnFound,
      };
    }).sort((a, b) => a.costPerVulnFound - b.costPerVulnFound);
  }, [selectedModels, contractCount, contractType, auditorRate, ctype]);

  const best = results[0];

  const toggleModel = (id: string) => {
    setSelectedModels(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(m => m !== id) : prev
        : [...prev, id]
    );
  };

  const applyRecommended = () => {
    const s = [recommended.primary, ...(recommended.secondary ? [recommended.secondary] : [])];
    setSelectedModels(s);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <p className="eyebrow mb-3">Audit Economics</p>
          <h1 className="hero-title mb-3">Cost Calculator</h1>
          <p className="hero-sub mb-10">
            What does it actually cost to audit a codebase with AI?
            Factor in LLM fees, false-positive triage time, and missed-vulnerability risk.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="stat-card">
              <p className="metric-label-inv mb-1">Contracts</p>
              <p className="metric-value-inv">{contractCount}</p>
            </div>
            <div className="stat-card">
              <p className="metric-label-inv mb-1">Contract Type</p>
              <p className="text-lg font-bold text-white">{ctype.label}</p>
            </div>
            <div className="stat-card">
              <p className="metric-label-inv mb-1">Best Total Cost</p>
              <p className="metric-value-inv text-emerald-400">{best ? fmt$(best.totalCost) : "—"}</p>
            </div>
            <div className="stat-card">
              <p className="metric-label-inv mb-1">Best Detection</p>
              <p className="metric-value-inv">{best ? `${(best.effectiveDetection * 100).toFixed(0)}%` : "—"}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="section-shell py-10 space-y-8">
        {/* Controls */}
        <div className="shell-panel p-6 space-y-6">
          <h2 className="section-title">Configure Your Audit</h2>

          {/* Contract count */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-stone-700">Number of contracts to audit</label>
              <span className="text-sm font-bold text-stone-950 tabular-nums">{contractCount}</span>
            </div>
            <input
              type="range" min={1} max={200} value={contractCount}
              onChange={e => setContractCount(+e.target.value)}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[11px] text-stone-400">
              <span>1</span><span>50</span><span>100</span><span>200</span>
            </div>
          </div>

          {/* Auditor rate */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-stone-700">Auditor hourly rate (for FP triage)</label>
              <span className="text-sm font-bold text-stone-950 tabular-nums">${auditorRate}/hr</span>
            </div>
            <input
              type="range" min={50} max={500} step={10} value={auditorRate}
              onChange={e => setAuditorRate(+e.target.value)}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[11px] text-stone-400">
              <span>$50</span><span>$150</span><span>$300</span><span>$500</span>
            </div>
          </div>

          {/* Contract type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Contract type</label>
            <div className="flex flex-wrap gap-2">
              {CONTRACT_TYPES.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => setContractType(ct.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                    contractType === ct.id
                      ? "bg-stone-950 text-white border-stone-950"
                      : "border-stone-200 text-stone-600 hover:border-stone-400 bg-white"
                  )}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-stone-700">Select models to compare</label>
              <button onClick={applyRecommended} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                Apply recommended stack →
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleModel(m.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                    selectedModels.includes(m.id)
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-stone-200 text-stone-600 hover:border-stone-400 bg-white"
                  )}
                >
                  {m.name.split(" ")[0]}
                  {(m.id === recommended.primary || m.id === recommended.secondary) && (
                    <span className="ml-1 text-[10px] opacity-75">★</span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-400">★ = recommended for {ctype.label}</p>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="shell-panel overflow-x-auto">
            <div className="px-6 pt-6 pb-4 border-b border-stone-100">
              <h2 className="section-title">Cost Breakdown</h2>
              <p className="text-sm text-stone-500 mt-1">
                LLM cost + auditor time on false positives. Sorted by cost-per-vulnerability-found.
              </p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>LLM Cost</th>
                  <th>FP Triage Cost</th>
                  <th>Total Cost</th>
                  <th>Detection</th>
                  <th>Missed Vulns</th>
                  <th>$/Vuln Found</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.model.id} className={i === 0 ? "bg-emerald-50/50" : ""}>
                    <td>
                      <p className="font-semibold">{r.model.name}</p>
                      <p className="text-xs text-stone-500">{r.model.philosophy}</p>
                      {i === 0 && <span className="badge badge-good mt-1">Best value</span>}
                    </td>
                    <td className="font-mono text-stone-700">{fmt$(r.llmCost)}</td>
                    <td className="font-mono text-orange-700">{fmt$(r.fpAuditorCost)}</td>
                    <td className="font-mono font-bold text-stone-950">{fmt$(r.totalCost)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-12 progress-bar">
                          <div className="progress-fill-green" style={{ width: `${r.effectiveDetection * 100}%` }} />
                        </div>
                        <span className="tabular-nums font-medium">{(r.effectiveDetection * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={cn("tabular-nums font-medium", r.expectedMisses > 2 ? "text-red-600" : "text-stone-700")}>
                        ~{r.expectedMisses.toFixed(1)}
                      </span>
                    </td>
                    <td className="font-mono font-bold text-emerald-700">{fmt$(r.costPerVulnFound)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recommendation callout */}
        {best && (
          <div className="dark-panel p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">Recommendation</p>
                <p className="text-white font-semibold mb-2">
                  For {contractCount} {ctype.label} contracts: use <span className="text-emerald-400">{best.model.name}</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  <div className="glass-card p-3">
                    <p className="text-[11px] text-stone-400 uppercase tracking-wide">Total cost</p>
                    <p className="text-xl font-bold text-white">{fmt$(best.totalCost)}</p>
                  </div>
                  <div className="glass-card p-3">
                    <p className="text-[11px] text-stone-400 uppercase tracking-wide">Expected coverage</p>
                    <p className="text-xl font-bold text-white">{(best.effectiveDetection * 100).toFixed(0)}%</p>
                  </div>
                  <div className="glass-card p-3">
                    <p className="text-[11px] text-stone-400 uppercase tracking-wide">Cost per vuln found</p>
                    <p className="text-xl font-bold text-emerald-400">{fmt$(best.costPerVulnFound)}</p>
                  </div>
                </div>
                <p className="text-sm text-stone-400 mt-4">
                  Note: assumes {FP_REVIEW_HOURS}h auditor review per false positive at ${auditorRate}/hr.
                  Manual review of missed vulnerabilities (est. ~{best.expectedMisses.toFixed(1)} contracts) not included.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
