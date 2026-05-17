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
  "nim:stepfun-ai/step-3.5-flash": "Step-3.5-Flash",
};

function statusBadge(status: Result["status"]) {
  switch (status) {
    case "all":
      return "bg-emerald-100 text-emerald-800";
    case "partial":
      return "bg-amber-100 text-amber-800";
    case "none":
      return "bg-rose-100 text-rose-700";
    case "untested":
      return "bg-gray-100 text-gray-500";
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
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-2">
          <a href="/" className="text-sm text-gray-500 hover:underline">← Leaderboard</a>
        </div>
        <h1 className="text-3xl font-bold mb-3">Why models pass and fail</h1>
        <p className="text-gray-700 mb-8 text-[15px] leading-relaxed">{data.intro}</p>

        <div className="space-y-6">
          {data.items.map((item) => (
            <article key={item.swc_id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-baseline justify-between flex-wrap gap-y-1 mb-1">
                <h2 className="text-xl font-semibold text-gray-900">
                  <span className="font-mono text-xs text-gray-400 mr-2">{item.swc_id}</span>
                  {item.name}
                </h2>
                <span className="text-sm text-emerald-700 font-semibold">{item.headline}</span>
              </div>
              <p className="text-sm text-gray-600 italic mb-4">{item.description}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {item.results.map((r) => (
                  <div
                    key={r.model}
                    className={`text-xs px-3 py-1.5 rounded-full ${statusBadge(r.status)}`}
                  >
                    <span className="font-semibold">{SHORT_NAME[r.model] ?? r.model}</span>
                    <span className="opacity-75"> · {r.found}/{r.total} · {statusLabel(r.status)}</span>
                  </div>
                ))}
              </div>

              <p className="text-[15px] leading-relaxed text-gray-800">{item.rationale}</p>

              {item.exhibit && (
                <blockquote className="mt-4 border-l-4 border-emerald-500 bg-emerald-50/50 pl-4 py-2">
                  <p className="text-sm text-gray-700 italic">"{item.exhibit.quote}"</p>
                  <footer className="text-xs text-gray-500 mt-1">
                    — {SHORT_NAME[item.exhibit.by] ?? item.exhibit.by} on this contract
                  </footer>
                </blockquote>
              )}
            </article>
          ))}
        </div>

        <div className="mt-8 bg-gray-900 text-gray-100 rounded-lg p-6">
          <div className="text-xs uppercase tracking-wide text-emerald-400 mb-2">Bottom line</div>
          <p className="text-[15px] leading-relaxed">{data.conclusion}</p>
        </div>
      </div>
    </div>
  );
}
