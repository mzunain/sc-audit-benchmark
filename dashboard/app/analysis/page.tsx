"use client";

import { useEffect, useState } from "react";

interface Result {
  model: string;
  found: number;
  total: number;
  status: "all" | "partial" | "none" | "untested";
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

const SHORT_NAME: Record<string, string> = {
  "nim:qwen/qwen3-coder-480b-a35b-instruct": "Qwen3-Coder 480B",
  "nim:minimaxai/minimax-m2.7": "MiniMax M2.7",
  "nim:stepfun-ai/step-3.5-flash": "Step 3.5 Flash",
};

function statusBadge(status: Result["status"]) {
  switch (status) {
    case "all":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
    case "partial":
      return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
    case "none":
      return "bg-rose-100 text-rose-800 ring-1 ring-rose-200";
    case "untested":
      return "bg-stone-100 text-stone-500 ring-1 ring-stone-200";
  }
}

function statusLabel(status: Result["status"]) {
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

export default function AnalysisPage() {
  const [data, setData] = useState<Analysis | null>(null);

  useEffect(() => {
    fetch("/data/analysis.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="max-w-3xl mx-auto px-6 py-10 text-stone-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-6 py-10">

        <header className="mb-10">
          <div className="flex items-center justify-between mb-6 text-sm">
            <a href="/" className="text-stone-500 hover:text-stone-900">← Leaderboard</a>
            <nav className="flex gap-5 text-stone-600">
              <a href="/breakdown" className="hover:text-stone-900">Per-vuln breakdown</a>
              <a href="/playground" className="hover:text-stone-900">Playground</a>
            </nav>
          </div>
          <h1 className="text-4xl font-bold text-stone-900 leading-tight tracking-tight mb-3">
            Why models pass and fail
          </h1>
          <p className="text-stone-600 text-lg leading-relaxed">{data.intro}</p>
        </header>

        <div className="space-y-5">
          {data.items.map((item) => (
            <article
              key={item.swc_id}
              className="bg-white rounded-xl shadow-sm ring-1 ring-stone-200 p-6"
            >
              <div className="flex items-baseline justify-between flex-wrap gap-y-1 mb-2">
                <h2 className="text-lg font-semibold text-stone-900">
                  <span className="font-mono text-xs text-stone-400 mr-2 align-middle">
                    {item.swc_id}
                  </span>
                  {item.name}
                </h2>
                <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">
                  {item.headline}
                </span>
              </div>
              <p className="text-sm text-stone-600 italic mb-4 leading-relaxed">
                {item.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {item.results.map((r) => (
                  <div
                    key={r.model}
                    className={`text-xs px-3 py-1.5 rounded-full ${statusBadge(r.status)}`}
                  >
                    <span className="font-semibold">{SHORT_NAME[r.model] ?? r.model}</span>
                    <span className="opacity-75">
                      {" "}
                      · {r.found}/{r.total} · {statusLabel(r.status)}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[15px] leading-relaxed text-stone-800">{item.rationale}</p>

              {item.exhibit && (
                <blockquote className="mt-4 border-l-3 border-emerald-500 bg-emerald-50/40 pl-4 py-2 rounded-r">
                  <p className="text-sm text-stone-700 italic">
                    &ldquo;{item.exhibit.quote}&rdquo;
                  </p>
                  <footer className="text-xs text-stone-500 mt-1">
                    {SHORT_NAME[item.exhibit.by] ?? item.exhibit.by}, on this contract
                  </footer>
                </blockquote>
              )}
            </article>
          ))}
        </div>

        <div className="mt-8 bg-stone-900 text-stone-100 rounded-xl p-6">
          <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-3">
            Bottom line
          </div>
          <p className="text-[15px] leading-relaxed">{data.conclusion}</p>
        </div>

      </div>
    </div>
  );
}
