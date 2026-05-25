"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BreakdownData, formatPct, modelMeta, swcAverageRate, SWC_ACTIONS } from "../product";

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
                      <th key={swc} className="px-3 py-3 text-center text-xs" title={data.swc_names[swc]}>
                        <div className="font-mono font-semibold text-stone-800">{swc}</div>
                        <div className="mt-0.5 text-[10px] font-normal leading-tight text-stone-500">
                          {data.swc_names[swc].length > 18 ? `${data.swc_names[swc].slice(0, 18)}...` : data.swc_names[swc]}
                        </div>
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
                  <button
                    key={item.swc}
                    onClick={() => setSelected({ model: visibleModels[0] ?? data.models[0], swc: item.swc })}
                    className="focus-ring w-full rounded-md border border-stone-200 bg-white p-3 text-left transition hover:border-emerald-300"
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
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
