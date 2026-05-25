"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Code2,
  FileCode2,
  Gauge,
  Layers,
  Loader2,
  Play,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import {
  BreakdownData,
  buildProofCases,
  formatPct,
  modelMeta,
  ProofCase,
  proofGateTone,
  proofStatusTone,
  StaticBaselineData,
  SWC_ACTIONS,
} from "../product";

function severityTone(severity: ProofCase["template"]["severity"]) {
  if (severity === "Critical") return "bg-rose-100 text-rose-900 ring-1 ring-rose-200";
  if (severity === "High") return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
  return "bg-cyan-100 text-cyan-900 ring-1 ring-cyan-200";
}

function gateIcon(state: ProofCase["gates"][number]["state"]) {
  if (state === "passed") return CheckCircle2;
  if (state === "ready") return Zap;
  return AlertTriangle;
}

interface ProofRunResult {
  ok: boolean;
  swc?: string;
  runner?: string;
  command?: string;
  duration_ms?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
  tests?: string[];
  supported_swcs?: string[];
}

export default function ProofLab() {
  const [breakdown, setBreakdown] = useState<BreakdownData | null>(null);
  const [staticBaseline, setStaticBaseline] = useState<StaticBaselineData | null>(null);
  const [selectedSwc, setSelectedSwc] = useState<string>("");
  const [proofRun, setProofRun] = useState<ProofRunResult | null>(null);
  const [proofRunning, setProofRunning] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/data/breakdown.json").then((r) => r.json() as Promise<BreakdownData>),
      fetch("/data/static_baseline.json").then((r) => (r.ok ? r.json() as Promise<StaticBaselineData> : null)),
    ])
      .then(([coverage, baseline]) => {
        setBreakdown(coverage);
        setStaticBaseline(baseline);
      })
      .catch(() => {});
  }, []);

  const proofCases = useMemo(
    () => (breakdown ? buildProofCases(breakdown, staticBaseline) : []),
    [breakdown, staticBaseline]
  );

  useEffect(() => {
    if (proofCases.length > 0 && !selectedSwc) setSelectedSwc(proofCases[0].swc);
  }, [proofCases, selectedSwc]);

  useEffect(() => {
    setProofRun(null);
  }, [selectedSwc]);

  const selected = proofCases.find((item) => item.swc === selectedSwc) ?? proofCases[0];
  const reproducedCount = proofCases.filter((item) => item.status === "reproduced").length;
  const likelyCount = proofCases.filter((item) => item.status === "likely").length;
  const blockedCount = proofCases.filter((item) => item.status === "blocked").length;
  const executable = selected?.swc === "SWC-107";

  const runProof = async () => {
    if (!selected || !executable) return;
    setProofRunning(true);
    setProofRun(null);
    try {
      const response = await fetch("/api/proof-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swc: selected.swc }),
      });
      const result = await response.json();
      setProofRun(result);
    } catch (error) {
      setProofRun({ ok: false, error: String(error) });
    } finally {
      setProofRunning(false);
    }
  };

  if (!breakdown || !selected) {
    return (
      <main className="min-h-screen">
        <div className="section-shell py-10 text-stone-500">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <section className="border-b border-stone-200 bg-stone-950 text-white">
        <div className="section-shell py-10 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-200 ring-1 ring-emerald-400/25">
                <ShieldCheck className="h-3.5 w-3.5" />
                Proof lab
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Turn model findings into evidence an auditor can trust.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-300">
                Convert benchmark signals into a proof queue with exploit hypotheses, Foundry test
                templates, patch assertions, and human escalation gates.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5 shadow-xl">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Gauge className="h-4 w-4 text-emerald-300" />
                  Proof readiness
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-white/10">
                {[
                  ["Cross-tool", reproducedCount, "text-emerald-200"],
                  ["Likely", likelyCount, "text-cyan-200"],
                  ["Escalations", blockedCount, "text-rose-200"],
                  ["Executable", 1, "text-white"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="bg-stone-950 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</div>
                    <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell py-7">
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <div className="panel rounded-lg p-5">
              <div className="eyebrow">Proof queue</div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">Prioritized SWC cases</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Ranked by model recall, static agreement, and average coverage.
              </p>
              <div className="mt-5 space-y-3">
                {proofCases.map((item) => {
                  const active = item.swc === selected.swc;
                  return (
                    <button
                      key={item.swc}
                      onClick={() => setSelectedSwc(item.swc)}
                      className={[
                        "focus-ring w-full rounded-lg border p-4 text-left transition",
                        active
                          ? "border-stone-950 bg-stone-950 text-white shadow-lg"
                          : "border-stone-200 bg-white hover:border-emerald-300",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className={active ? "font-mono text-xs font-semibold text-stone-400" : "font-mono text-xs font-semibold text-stone-500"}>
                            {item.swc}
                          </div>
                          <div className="mt-1 text-sm font-semibold">{item.name}</div>
                        </div>
                        <span className={active ? "text-lg font-semibold tabular-nums text-emerald-300" : "text-lg font-semibold tabular-nums text-stone-950"}>
                          {item.proofScore}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-white/10 text-stone-100 ring-1 ring-white/15" : proofStatusTone(item.status)}`}>
                          {item.statusLabel}
                        </span>
                        <span className={active ? "text-xs text-stone-400" : "text-xs text-stone-500"}>
                          Best {formatPct(item.bestModelRate * 100, 0)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-200 bg-stone-950 px-5 py-4 text-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      <ShieldAlert className="h-4 w-4" />
                      Proof dossier
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      {selected.swc}: {selected.name}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${proofStatusTone(selected.status)}`}>
                      {selected.statusLabel}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${severityTone(selected.template.severity)}`}>
                      {selected.template.severity}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-stone-200 md:grid-cols-4">
                <div className="bg-white p-4">
                  <div className="metric-label">Proof score</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">{selected.proofScore}</div>
                </div>
                <div className="bg-white p-4">
                  <div className="metric-label">Best model</div>
                  <div className="mt-1 text-sm font-semibold text-stone-950">{modelMeta(selected.bestModel).short}</div>
                  <div className="mt-1 text-xs text-stone-500">{formatPct(selected.bestModelRate * 100, 0)} recall</div>
                </div>
                <div className="bg-white p-4">
                  <div className="metric-label">LLM average</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">
                    {formatPct(selected.llmAverageRate * 100, 0)}
                  </div>
                </div>
                <div className="bg-white p-4">
                  <div className="metric-label">Static signal</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">
                    {formatPct(selected.staticRate * 100, 0)}
                  </div>
                  <div className="mt-1 text-xs text-stone-500">
                    {selected.staticFound}/{selected.staticTotal || 0} samples
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="grid gap-4 lg:grid-cols-5">
                  {selected.gates.map((gate, index) => {
                    const Icon = gateIcon(gate.state);
                    return (
                      <div key={gate.label} className="relative rounded-lg border border-stone-200 bg-stone-50 p-4">
                        {index < selected.gates.length - 1 && (
                          <ArrowRight className="absolute -right-3 top-8 hidden h-5 w-5 text-stone-300 lg:block" />
                        )}
                        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${proofGateTone(gate.state)}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="mt-3 text-sm font-semibold text-stone-950">{gate.label}</div>
                        <p className="mt-2 text-xs leading-5 text-stone-600">{gate.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-950 px-5 py-4 text-white">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Terminal className="h-4 w-4 text-emerald-300" />
                    Foundry proof template
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-stone-200 ring-1 ring-white/15">
                      {executable ? "Executable" : "Template only"}
                    </span>
                    <button
                      onClick={runProof}
                      disabled={!executable || proofRunning}
                      className="focus-ring inline-flex items-center gap-2 rounded-md bg-emerald-300 px-3 py-2 text-xs font-semibold text-stone-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-stone-400"
                    >
                      {proofRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      {proofRunning ? "Running" : "Run proof"}
                    </button>
                  </div>
                </div>
                <div className="bg-[#0c0d0d] p-4">
                  <pre className="max-h-[430px] overflow-auto rounded-md bg-black p-4 text-xs leading-6 text-emerald-50">
                    <code>{selected.template.foundryTest}</code>
                  </pre>
                </div>
                <div className="border-t border-stone-200 bg-white p-4">
                  {!executable && (
                    <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-600">
                      Executable Foundry harness is available for SWC-107 first. This case remains a proof template.
                    </div>
                  )}
                  {executable && !proofRun && !proofRunning && (
                    <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm leading-6 text-cyan-950">
                      This will materialize a temporary allowlisted Foundry project and run two tests: exploit reproduction and patch regression.
                    </div>
                  )}
                  {proofRunning && (
                    <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm font-semibold text-cyan-950">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Running local Foundry proof...
                    </div>
                  )}
                  {proofRun && (
                    <div
                      className={[
                        "rounded-md border p-3",
                        proofRun.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className={proofRun.ok ? "text-sm font-semibold text-emerald-950" : "text-sm font-semibold text-amber-950"}>
                          {proofRun.ok ? "Proof passed" : "Proof not executed"}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                          {proofRun.runner && (
                            <span className="rounded-full bg-white px-2.5 py-1 text-stone-700 ring-1 ring-stone-200">
                              {proofRun.runner}
                            </span>
                          )}
                          {proofRun.duration_ms !== undefined && (
                            <span className="rounded-full bg-white px-2.5 py-1 text-stone-700 ring-1 ring-stone-200">
                              {proofRun.duration_ms}ms
                            </span>
                          )}
                        </div>
                      </div>
                      {proofRun.error && <p className="mt-2 text-sm leading-6 text-stone-700">{proofRun.error}</p>}
                      {proofRun.tests && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {proofRun.tests.map((test) => (
                            <span key={test} className="rounded-full bg-white px-2.5 py-1 font-mono text-[11px] text-stone-700 ring-1 ring-stone-200">
                              {test}
                            </span>
                          ))}
                        </div>
                      )}
                      {(proofRun.stdout || proofRun.stderr) && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-medium text-stone-700">Execution log</summary>
                          <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-stone-950 p-3 text-xs leading-5 text-emerald-50">
                            {proofRun.stdout || proofRun.stderr}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="panel rounded-lg p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                    <Activity className="h-4 w-4 text-rose-600" />
                    Exploit objective
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone-700">{selected.template.exploitGoal}</p>
                  <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-4">
                    <div className="metric-label">Hypothesis</div>
                    <p className="mt-2 text-sm leading-6 text-stone-700">{selected.template.hypothesis}</p>
                  </div>
                </div>

                <div className="panel rounded-lg p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                    <FileCode2 className="h-4 w-4 text-cyan-600" />
                    Patch regression
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone-700">{selected.template.patchAssertion}</p>
                  <div className="mt-4 rounded-md bg-stone-950 p-4 font-mono text-xs leading-6 text-emerald-50">
                    forge test --match-test {selected.template.foundryTest.match(/test_[A-Za-z0-9_]+/)?.[0] ?? "test_ProofTemplate"}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="panel rounded-lg p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                  <Layers className="h-4 w-4 text-emerald-600" />
                  Auditor handoff
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-700">{selected.template.reviewerNote}</p>
              </div>

              <div className="panel rounded-lg p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                  <Code2 className="h-4 w-4 text-cyan-600" />
                  Model routing
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-700">
                  Start with {modelMeta(selected.bestModel).short}, then require a second reviewer when
                  the static signal disagrees or the proof score is below 50.
                </p>
              </div>

              <div className="panel rounded-lg p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Review trigger
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-700">
                  {SWC_ACTIONS[selected.swc] ?? "Escalate low-confidence findings to manual review before signoff."}
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
