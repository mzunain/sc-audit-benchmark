"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  averageDetection,
  BreakdownData,
  COMPETITIVE_MATRIX,
  formatPct,
  formatUsd,
  modelMeta,
  MODEL_EXPANSION_ROADMAP,
  ModelScore,
  PRODUCT_PILLARS,
  PRODUCTION_GATES,
  StaticBaselineData,
  swcAverageRate,
  staticComparatorRows,
  staticCoverageRows,
  totalCommercialCost,
} from "./product";

interface Winners {
  highest_quality?: { model: string; score: number };
  best_value?: { model: string; score: number };
}

interface PresentationData {
  total_contracts?: number;
  summary_rows?: ModelScore[];
  winners?: Winners;
}

function compactValue(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function scoreBand(score: number) {
  if (score >= 70) return "Strong";
  if (score >= 50) return "Usable";
  if (score >= 25) return "Weak";
  return "Risky";
}

export default function Leaderboard() {
  const [data, setData] = useState<ModelScore[]>([]);
  const [sortBy, setSortBy] = useState<"quality" | "value" | "detection">("value");
  const [winners, setWinners] = useState<Winners | null>(null);
  const [totalContracts, setTotalContracts] = useState<number>(0);
  const [breakdown, setBreakdown] = useState<BreakdownData | null>(null);
  const [staticBaseline, setStaticBaseline] = useState<StaticBaselineData | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/presentation.json").then((r) => r.json() as Promise<PresentationData>),
      fetch("/data/breakdown.json").then((r) => r.json() as Promise<BreakdownData>),
      fetch("/data/static_baseline.json").then((r) => (r.ok ? r.json() as Promise<StaticBaselineData> : null)),
    ])
      .then(([presentation, coverage, baseline]) => {
        setData(presentation.summary_rows || []);
        setWinners(presentation.winners ?? null);
        setTotalContracts(presentation.total_contracts ?? 0);
        setBreakdown(coverage);
        setStaticBaseline(baseline);
      })
      .catch(() => {});
  }, []);

  const sorted = useMemo(
    () => [...data].sort((a, b) => b[sortBy] - a[sortBy]),
    [data, sortBy]
  );

  const best = sorted[0];
  const runnerUp = sorted[1];
  const winner = winners?.[sortBy === "value" ? "best_value" : "highest_quality"];
  const winnerMeta = winner ? modelMeta(winner.model) : best ? modelMeta(best.model) : null;
  const avgDetection = averageDetection(data);
  const totalCost = totalCommercialCost(data);
  const valueMultiplier = best && runnerUp && runnerUp.value > 0 ? best.value / runnerUp.value : 0;
  const hardestSwc = breakdown
    ? [...breakdown.swc_ids].sort((a, b) => swcAverageRate(breakdown, a) - swcAverageRate(breakdown, b))[0]
    : null;
  const weakestSwc = breakdown
    ? [...breakdown.swc_ids].sort((a, b) => swcAverageRate(breakdown, a) - swcAverageRate(breakdown, b))[0]
    : null;
  const baselineCoverage = useMemo(
    () => (staticBaseline ? staticCoverageRows(staticBaseline) : []),
    [staticBaseline]
  );
  const staticComparators = useMemo(
    () => (staticBaseline ? staticComparatorRows(staticBaseline) : []),
    [staticBaseline]
  );
  const availableStaticTools = staticBaseline?.tools.filter((tool) => tool.available).length ?? 0;
  const baselineGap = staticBaseline && best ? best.detection - staticBaseline.summary.detection_rate : null;
  const runnableStaticComparators = staticComparators.filter((tool) => tool.summary).length;

  const chartData = sorted.map((r) => ({
    ...r,
    label: modelMeta(r.model).short,
    fill: modelMeta(r.model).accent,
  }));

  const frontierData = sorted.map((row) => ({
    model: modelMeta(row.model).short,
    cost: row.cost_usd,
    quality: row.quality,
    detection: row.detection,
    fill: modelMeta(row.model).accent,
  }));

  return (
    <main className="min-h-screen">
      <section className="border-b border-stone-200 bg-stone-950 text-white">
        <div className="section-shell py-10 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Evidence-first audit model selection
              </div>
              <h1 className="max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Pick the Solidity scanner that actually earns its place in the audit workflow.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-300">
                A self-renewing benchmark that compares open-weight LLMs on detection, explanation
                quality, commercial token cost, and SWC-specific blind spots before a team trusts a
                model in production.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-emerald-200 ring-1 ring-emerald-400/25">
                  {totalContracts || 15} generated contracts
                </span>
                <span className="rounded-full bg-cyan-400/15 px-3 py-1.5 text-cyan-200 ring-1 ring-cyan-400/25">
                  {data.length || 3} model routes
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-stone-200 ring-1 ring-white/15">
                  SWC-aware scoring
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5 shadow-xl">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Current recommendation
                </div>
              </div>
              {best && winnerMeta ? (
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-2xl font-semibold tracking-tight">
                        {modelMeta(best.model).short}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-stone-300">{modelMeta(best.model).thesis}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/25">
                      No. 1 {sortBy}
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-white/10 text-sm">
                    <div className="bg-stone-950 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Detection</div>
                      <div className="mt-1 font-semibold">{formatPct(best.detection)}</div>
                    </div>
                    <div className="bg-stone-950 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Quality</div>
                      <div className="mt-1 font-semibold">{best.quality.toFixed(1)}</div>
                    </div>
                    <div className="bg-stone-950 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Cost</div>
                      <div className="mt-1 font-semibold">{formatUsd(best.cost_usd)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="p-5 text-sm text-stone-300">Run the benchmark to populate recommendations.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell py-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="panel rounded-lg p-4">
            <div className="metric-label">Contracts</div>
            <div className="metric-value mt-1">{totalContracts || 15}</div>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">Generated vulnerable samples in this run.</p>
          </div>
          <div className="panel rounded-lg p-4">
            <div className="metric-label">Models</div>
            <div className="metric-value mt-1">{data.length || 0}</div>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">Compared with one scoring contract.</p>
          </div>
          <div className="panel rounded-lg p-4">
            <div className="metric-label">Avg detection</div>
            <div className="metric-value mt-1">{formatPct(avgDetection)}</div>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">Portfolio-level recall across scanners.</p>
          </div>
          <div className="panel rounded-lg p-4">
            <div className="metric-label">Total list cost</div>
            <div className="metric-value mt-1">{formatUsd(totalCost)}</div>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">Commercial price for all scanner runs.</p>
          </div>
          <div className="panel rounded-lg p-4">
            <div className="metric-label">Weakest class</div>
            <div className="metric-value mt-1 text-xl">{weakestSwc ?? "Pending"}</div>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              {weakestSwc && breakdown ? `${formatPct(swcAverageRate(breakdown, weakestSwc) * 100, 0)} average coverage.` : "Needs breakdown data."}
            </p>
          </div>
        </div>
      </section>

      <section className="section-shell pb-10">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel overflow-hidden rounded-lg">
            <div className="border-b border-stone-200 bg-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">Leaderboard</div>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-950">
                    Model ranking and audit economics
                  </h2>
                </div>
                <div className="flex rounded-md bg-stone-100 p-1">
                  {[
                    ["value", "Value"],
                    ["quality", "Quality"],
                    ["detection", "Detection"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSortBy(key as "quality" | "value" | "detection")}
                      className={[
                        "rounded px-3 py-1.5 text-sm font-medium transition focus-ring",
                        sortBy === key
                          ? "bg-white text-stone-950 shadow-sm"
                          : "text-stone-600 hover:text-stone-950",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] table-fixed">
                <colgroup>
                  <col className="w-[74px]" />
                  <col className="w-[320px]" />
                  <col className="w-[340px]" />
                  <col className="w-[110px]" />
                  <col className="w-[92px]" />
                  <col className="w-[72px]" />
                  <col className="w-[92px]" />
                </colgroup>
                <thead className="border-b border-stone-200 bg-stone-50">
                  <tr className="text-xs uppercase tracking-wider text-stone-500">
                    <th className="px-5 py-3 text-left font-semibold">Rank</th>
                    <th className="px-5 py-3 text-left font-semibold">Model</th>
                    <th className="px-5 py-3 text-left font-semibold">Best fit</th>
                    <th className="px-5 py-3 text-right font-semibold">Detection</th>
                    <th className="px-5 py-3 text-right font-semibold">Quality</th>
                    <th className="px-5 py-3 text-right font-semibold">Cost</th>
                    <th className="px-5 py-3 text-right font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, index) => {
                    const meta = modelMeta(row.model);
                    return (
                      <tr key={row.model} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/70">
                        <td className="px-5 py-4 text-sm font-semibold text-stone-500">#{index + 1}</td>
                        <td className="px-5 py-4 align-middle">
                          <div className="font-semibold text-stone-950">{meta.short}</div>
                          <div className="mt-1 break-all font-mono text-xs leading-5 text-stone-400">{row.model}</div>
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
                            {meta.philosophy}
                          </span>
                          <div className="mt-2 max-w-[280px] text-xs leading-5 text-stone-600">{meta.bestFor}</div>
                        </td>
                        <td className="px-5 py-4 text-right text-sm tabular-nums text-stone-700">
                          {formatPct(row.detection)}
                        </td>
                        <td className="px-5 py-4 text-right text-sm tabular-nums text-stone-700">
                          {row.quality.toFixed(1)}
                        </td>
                        <td className="px-5 py-4 text-right text-sm tabular-nums text-stone-700">
                          {formatUsd(row.cost_usd)}
                        </td>
                        <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-stone-950">
                          {compactValue(row.value)}
                        </td>
                      </tr>
                    );
                  })}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-stone-400">
                        No results yet. Run <code className="font-mono text-stone-600">python src/main.py</code> to generate data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="panel rounded-lg p-5">
              <div className="eyebrow">Score frontier</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-950">
                Quality versus commercial cost
              </h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 18, bottom: 24, left: 0 }}>
                    <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="cost"
                      name="Cost"
                      tickFormatter={(value) => `$${Number(value).toFixed(3)}`}
                      fontSize={11}
                      stroke="#78716c"
                    />
                    <YAxis dataKey="quality" name="Quality" fontSize={11} stroke="#78716c" />
                    <ZAxis dataKey="detection" range={[80, 240]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{ border: "1px solid #e7e5e4", borderRadius: 8, fontSize: 12 }}
                      formatter={(value, name) => [name === "cost" ? formatUsd(Number(value)) : Number(value).toFixed(1), name]}
                    />
                    <Scatter data={frontierData}>
                      {frontierData.map((entry) => (
                        <Cell key={entry.model} fill={entry.fill} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm leading-relaxed text-stone-600">
                {valueMultiplier > 0
                  ? `The current leader is ${valueMultiplier.toFixed(1)}x stronger on value than the runner-up in this run.`
                  : "Run benchmark data to calculate the value frontier."}
              </p>
            </div>

            <div className="panel rounded-lg p-5">
              <div className="eyebrow">Benchmark signal</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-950">
                {hardestSwc ? `Strongest class: ${hardestSwc}` : "Coverage profile"}
              </h2>
              <div className="mt-5 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 38, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                    <XAxis dataKey="label" angle={-12} textAnchor="end" height={54} fontSize={11} stroke="#78716c" />
                    <YAxis fontSize={11} stroke="#78716c" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #e7e5e4", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey={sortBy} radius={[4, 4, 0, 0]}>
                      {chartData.map((entry) => (
                        <Cell key={entry.model} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </section>

      {staticBaseline && (
        <section className="section-shell pb-10">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="panel rounded-lg p-5">
              <div className="eyebrow">Static baseline</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                Static analyzer comparators, normalized into the same SWC scorecard.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">
                The built-in heuristic baseline runs everywhere. When Slither or Aderyn are installed,
                their JSON reports are normalized into recall, noise rate, and SWC coverage so buyers
                can compare LLM judgment against traditional detectors.
              </p>

              <div className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div>
                    <div className="metric-label">Baseline recall</div>
                    <div className="metric-value mt-1">{formatPct(staticBaseline.summary.detection_rate)}</div>
                  </div>
                  <div>
                    <div className="metric-label">Gap to leader</div>
                    <div className="metric-value mt-1">
                      {baselineGap === null ? "Pending" : `${baselineGap >= 0 ? "+" : ""}${formatPct(baselineGap)}`}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div>
                    <div className="metric-label">Findings / contract</div>
                    <div className="mt-1 text-xl font-semibold text-stone-950">
                      {staticBaseline.summary.findings_per_contract.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="metric-label">False positives / contract</div>
                    <div className="mt-1 text-xl font-semibold text-stone-950">
                      {staticBaseline.summary.false_positives_per_contract.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="py-4">
                  <div className="metric-label">Comparator adapters</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {staticBaseline.tools.map((tool) => (
                      <span
                        key={tool.id}
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                          tool.available
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                            : "bg-stone-100 text-stone-600 ring-stone-200",
                        ].join(" ")}
                      >
                        {tool.name}: {tool.available ? (tool.status ?? "available") : tool.status ?? tool.adapter}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-stone-500">
                    {runnableStaticComparators > 1
                      ? `${runnableStaticComparators} static comparators produced benchmark summaries.`
                      : availableStaticTools > 1
                        ? `${availableStaticTools - 1} external analyzer binary is available on this machine.`
                        : "Install Slither or Aderyn on PATH to add real analyzer rows to this benchmark."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="panel overflow-hidden rounded-lg">
                <div className="border-b border-stone-200 bg-white px-5 py-4">
                  <div className="eyebrow">Analyzer scoreboard</div>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-950">
                    Heuristic, Slither, and Aderyn in one normalized table.
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px]">
                    <thead className="border-b border-stone-200 bg-stone-50">
                      <tr className="text-xs uppercase tracking-wider text-stone-500">
                        <th className="px-5 py-3 text-left font-semibold">Comparator</th>
                        <th className="px-5 py-3 text-left font-semibold">Status</th>
                        <th className="px-5 py-3 text-right font-semibold">Recall</th>
                        <th className="px-5 py-3 text-right font-semibold">Findings</th>
                        <th className="px-5 py-3 text-right font-semibold">Noise</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staticComparators.map((tool) => (
                        <tr key={tool.id} className="border-b border-stone-100 last:border-0">
                          <td className="px-5 py-4">
                            <div className="text-sm font-semibold text-stone-950">{tool.name}</div>
                            <div className="mt-1 font-mono text-xs text-stone-400">{tool.id}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={[
                                "rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                                tool.summary
                                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                                  : "bg-stone-100 text-stone-600 ring-stone-200",
                              ].join(" ")}
                            >
                              {tool.summary ? tool.status : tool.status ?? "not installed"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-sm tabular-nums text-stone-700">
                            {tool.summary ? formatPct(tool.recall) : "-"}
                          </td>
                          <td className="px-5 py-4 text-right text-sm tabular-nums text-stone-700">
                            {tool.summary ? tool.findingsPerContract.toFixed(2) : "-"}
                          </td>
                          <td className="px-5 py-4 text-right text-sm tabular-nums text-stone-700">
                            {tool.summary ? tool.falsePositivesPerContract.toFixed(2) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel overflow-hidden rounded-lg">
                <div className="border-b border-stone-200 bg-white px-5 py-4">
                  <div className="eyebrow">Detector coverage</div>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-950">
                    SWC classes where rules help and where model judgment is still needed.
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead className="border-b border-stone-200 bg-stone-50">
                      <tr className="text-xs uppercase tracking-wider text-stone-500">
                        <th className="px-5 py-3 text-left font-semibold">SWC</th>
                        <th className="px-5 py-3 text-left font-semibold">Result</th>
                        <th className="px-5 py-3 text-right font-semibold">Recall</th>
                        <th className="px-5 py-3 text-right font-semibold">Samples</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baselineCoverage.map((row) => (
                        <tr key={row.swc} className="border-b border-stone-100 last:border-0">
                          <td className="px-5 py-4 text-sm font-semibold text-stone-950">{row.swc}</td>
                          <td className="px-5 py-4">
                            <div className="h-2 w-full rounded-full bg-stone-100">
                              <div
                                className="h-2 rounded-full bg-emerald-600"
                                style={{ width: `${Math.min(row.rate, 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right text-sm tabular-nums text-stone-700">
                            {formatPct(row.rate, 0)}
                          </td>
                          <td className="px-5 py-4 text-right text-sm tabular-nums text-stone-700">
                            {row.found}/{row.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="border-y border-stone-200 bg-white/70">
        <div className="section-shell py-10">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="eyebrow">Competitive positioning</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
                Built to sit between static tools, formal verification, and AI-agent benchmarks.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-stone-600">
                Competitors already cover deterministic detectors, proof systems, simulation,
                monitoring, and large agent benchmarks. This product stands out by answering the
                procurement question audit teams still have: which model should we trust, for which
                bug classes, at what cost, and with which human review triggers?
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {COMPETITIVE_MATRIX.map((item) => (
                <a
                  key={item.name}
                  href={item.source}
                  target="_blank"
                  rel="noreferrer"
                  className="panel rounded-lg p-4 transition hover:-translate-y-0.5 hover:shadow-md focus-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-stone-950">{item.name}</div>
                      <div className="mt-1 text-xs font-medium text-emerald-700">{item.category}</div>
                    </div>
                    <span className="text-xs font-semibold text-stone-400">Source</span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-stone-600">{item.marketSignal}</p>
                  <div className="mt-4 border-t border-stone-100 pt-3">
                    <div className="metric-label">Table stakes</div>
                    <p className="mt-1 text-xs leading-relaxed text-stone-600">{item.tableStakes}</p>
                  </div>
                  <div className="mt-3 border-t border-stone-100 pt-3">
                    <div className="metric-label">Our edge</div>
                    <p className="mt-1 text-xs leading-relaxed text-stone-700">{item.ourEdge}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell py-10">
        <div className="grid gap-6 lg:grid-cols-4">
          {PRODUCT_PILLARS.map((pillar) => (
            <div key={pillar.label} className="panel rounded-lg p-5">
              <div className="text-sm font-semibold text-stone-950">{pillar.label}</div>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{pillar.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel rounded-lg p-5">
            <div className="eyebrow">Expansion roadmap</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
              Next comparators that make the benchmark harder to dismiss.
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {MODEL_EXPANSION_ROADMAP.map((item) => (
                <div key={item.lane} className="flex min-h-[188px] flex-col rounded-lg border border-stone-200 bg-stone-50/70 p-4">
                  <div className="text-sm font-semibold text-stone-950">{item.lane}</div>
                  <p className="mt-2 text-sm font-medium leading-5 text-emerald-700">{item.models}</p>
                  <p className="mt-4 flex-1 text-sm leading-6 text-stone-600">{item.why}</p>
                  <div className="mt-4 border-t border-stone-200 pt-3">
                    <div className="metric-label">Status</div>
                    <div className="mt-1 text-xs font-semibold leading-5 text-stone-700">{item.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel rounded-lg p-5">
            <div className="eyebrow">Production gates</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
              Hardened for public demos without pretending it is a full audit platform.
            </h2>
            <div className="mt-5 space-y-3">
              {PRODUCTION_GATES.map((item) => (
                <div key={item.gate} className="rounded-md border border-stone-200 bg-white p-4">
                  <div className="text-sm font-semibold text-stone-950">{item.gate}</div>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">{item.ready}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {sorted.map((row) => {
            const meta = modelMeta(row.model);
            return (
              <article key={row.model} className="panel rounded-lg p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-950">{meta.short}</h3>
                    <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
                      {meta.philosophy}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="metric-label">Band</div>
                    <div className="mt-1 text-sm font-semibold text-stone-950">{scoreBand(row.detection)}</div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    ["Detection", row.detection, "%"],
                    ["Quality", row.quality, ""],
                  ].map(([label, value, suffix]) => {
                    const numeric = Number(value);
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs font-medium text-stone-600">
                          <span>{label}</span>
                          <span>{numeric.toFixed(1)}{suffix}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-stone-100">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${Math.min(numeric, 100)}%`, backgroundColor: meta.accent }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-5 text-sm leading-relaxed text-stone-600">{meta.thesis}</p>
                <p className="mt-3 text-xs leading-relaxed text-amber-800">{meta.caution}</p>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white/70">
        <div className="section-shell py-6 text-xs leading-relaxed text-stone-500">
          Cost is commercial list price per million tokens times actual tokens used. The benchmark
          itself ran on provider free credits. Cost-adjusted score is quality divided by run cost.
        </div>
      </footer>
    </main>
  );
}
