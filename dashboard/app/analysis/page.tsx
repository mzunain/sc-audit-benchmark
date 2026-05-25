"use client";

import { useEffect, useMemo, useState } from "react";
import { modelMeta, SWC_ACTIONS } from "../product";

type ResultStatus = "all" | "partial" | "none" | "untested";

interface Result {
  model: string;
  found: number;
  total: number;
  status: ResultStatus;
}

interface Item {
  swc_id: string;
  name: string;
  headline: string;
  description: string;
  results: Result[];
  rationale: string;
  exhibit?: { by: string; quote: string };
}

interface Analysis {
  intro: string;
  items: Item[];
  conclusion: string;
}

function statusBadge(status: ResultStatus) {
  switch (status) {
    case "all":
      return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
    case "partial":
      return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
    case "none":
      return "bg-rose-50 text-rose-800 ring-1 ring-rose-200";
    case "untested":
      return "bg-stone-100 text-stone-500 ring-1 ring-stone-200";
  }
}

function statusLabel(status: ResultStatus) {
  switch (status) {
    case "all":
      return "found all";
    case "partial":
      return "partial";
    case "none":
      return "missed all";
    case "untested":
      return "not tested";
  }
}

function itemRisk(item: Item) {
  const noneCount = item.results.filter((r) => r.status === "none").length;
  if (noneCount === item.results.length) return "Universal miss";
  if (noneCount > 0) return "Mixed coverage";
  return "Model-covered";
}

export default function AnalysisPage() {
  const [data, setData] = useState<Analysis | null>(null);
  const [filter, setFilter] = useState<"all" | "misses" | "mixed" | "covered">("all");

  useEffect(() => {
    fetch("/data/analysis.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    if (!data) return { total: 0, universalMisses: 0, mixed: 0, covered: 0 };
    return data.items.reduce(
      (acc, item) => {
        const risk = itemRisk(item);
        acc.total += 1;
        if (risk === "Universal miss") acc.universalMisses += 1;
        if (risk === "Mixed coverage") acc.mixed += 1;
        if (risk === "Model-covered") acc.covered += 1;
        return acc;
      },
      { total: 0, universalMisses: 0, mixed: 0, covered: 0 }
    );
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.items.filter((item) => {
      const risk = itemRisk(item);
      if (filter === "misses") return risk === "Universal miss";
      if (filter === "mixed") return risk === "Mixed coverage";
      if (filter === "covered") return risk === "Model-covered";
      return true;
    });
  }, [data, filter]);

  if (!data) {
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
          <div className="max-w-4xl">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Failure evidence</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Why models pass, fail, and need human escalation.
            </h1>
            <p className="mt-4 text-lg leading-8 text-stone-300">{data.intro}</p>
          </div>

          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-stone-950 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">SWC classes</div>
              <div className="mt-1 text-2xl font-semibold">{stats.total}</div>
              <p className="mt-2 text-xs text-stone-400">Explained with per-model evidence.</p>
            </div>
            <div className="bg-stone-950 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Universal misses</div>
              <div className="mt-1 text-2xl font-semibold text-rose-200">{stats.universalMisses}</div>
              <p className="mt-2 text-xs text-stone-400">Require non-LLM review before signoff.</p>
            </div>
            <div className="bg-stone-950 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Mixed coverage</div>
              <div className="mt-1 text-2xl font-semibold text-amber-200">{stats.mixed}</div>
              <p className="mt-2 text-xs text-stone-400">Route to model ensemble or reviewer.</p>
            </div>
            <div className="bg-stone-950 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Model-covered</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-200">{stats.covered}</div>
              <p className="mt-2 text-xs text-stone-400">Good candidates for automated first pass.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-stone-950">Evidence cards</h2>
            <p className="mt-1 text-sm text-stone-600">Filter by the kind of decision the audit team needs to make.</p>
          </div>
          <div className="flex rounded-md bg-stone-100 p-1">
            {[
              ["all", "All"],
              ["misses", "Misses"],
              ["mixed", "Mixed"],
              ["covered", "Covered"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key as "all" | "misses" | "mixed" | "covered")}
                className={[
                  "rounded px-3 py-1.5 text-sm font-medium transition focus-ring",
                  filter === key ? "bg-white text-stone-950 shadow-sm" : "text-stone-600 hover:text-stone-950",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5">
          {filtered.map((item) => {
            const risk = itemRisk(item);
            return (
              <article key={item.swc_id} className="panel overflow-hidden rounded-lg">
                <div className="grid gap-0 lg:grid-cols-[0.78fr_1.22fr]">
                  <div className="border-b border-stone-200 bg-stone-50/80 p-5 lg:border-b-0 lg:border-r">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-xs font-semibold text-stone-500">{item.swc_id}</div>
                        <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-950">{item.name}</h2>
                      </div>
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          risk === "Universal miss"
                            ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200"
                            : risk === "Mixed coverage"
                              ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                              : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
                        ].join(" ")}
                      >
                        {risk}
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-stone-600">{item.description}</p>
                    <div className="mt-5 rounded-md border border-stone-200 bg-white p-4">
                      <div className="metric-label">Auditor handoff</div>
                      <p className="mt-2 text-sm leading-relaxed text-stone-700">
                        {SWC_ACTIONS[item.swc_id] ?? "Escalate any low-confidence model output to manual review."}
                      </p>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.results.map((r) => (
                        <div key={r.model} className={`rounded-full px-3 py-1.5 text-xs ${statusBadge(r.status)}`}>
                          <span className="font-semibold">{modelMeta(r.model).short}</span>
                          <span className="opacity-75">
                            {" "}
                            - {r.found}/{r.total} - {statusLabel(r.status)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="mt-5 text-[15px] leading-relaxed text-stone-800">{item.rationale}</p>

                    {item.exhibit && (
                      <blockquote className="mt-5 rounded-md border-l-4 border-emerald-500 bg-emerald-50/55 px-4 py-3">
                        <p className="text-sm leading-relaxed text-stone-700">&ldquo;{item.exhibit.quote}&rdquo;</p>
                        <footer className="mt-2 text-xs font-medium text-stone-500">
                          {modelMeta(item.exhibit.by).short}, benchmark exhibit
                        </footer>
                      </blockquote>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 rounded-lg bg-stone-950 p-6 text-stone-100">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Product decision</div>
          <p className="mt-3 text-[15px] leading-relaxed">{data.conclusion}</p>
        </div>
      </section>
    </main>
  );
}
