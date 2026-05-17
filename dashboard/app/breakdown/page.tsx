"use client";

import { useEffect, useState } from "react";

interface BreakdownData {
  models: string[];
  swc_ids: string[];
  swc_names: Record<string, string>;
  breakdown: Record<string, Record<string, { found: number; total: number }>>;
}

function shortLabel(model: string) {
  const stripped = model.replace(/^nim:/, "").replace(/^[^/]+\//, "");
  return stripped.split("-").slice(0, 3).join("-");
}

function cellColor(rate: number) {
  if (rate >= 0.8) return "bg-emerald-200";
  if (rate >= 0.5) return "bg-emerald-100";
  if (rate >= 0.25) return "bg-amber-100";
  if (rate > 0) return "bg-rose-100";
  return "bg-stone-50";
}

export default function Breakdown() {
  const [data, setData] = useState<BreakdownData | null>(null);

  useEffect(() => {
    fetch("/data/breakdown.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-10 text-stone-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-10">

        <header className="mb-10">
          <h1 className="text-4xl font-bold text-stone-900 leading-tight tracking-tight mb-3">
            Per-vulnerability breakdown
          </h1>
          <p className="text-stone-600 text-lg leading-relaxed max-w-3xl">
            How each model performs by SWC class. Detection rate is the fraction of contracts
            where the injected vulnerability was correctly identified.
          </p>
        </header>

        <div className="bg-white rounded-xl shadow-sm ring-1 ring-stone-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-stone-500 font-semibold">
                  Model
                </th>
                {data.swc_ids.map((swc) => (
                  <th
                    key={swc}
                    className="px-3 py-3 text-center text-xs"
                    title={data.swc_names[swc]}
                  >
                    <div className="font-mono text-stone-700 font-semibold">{swc}</div>
                    <div className="text-[10px] text-stone-500 font-normal mt-0.5">
                      {data.swc_names[swc].length > 14
                        ? data.swc_names[swc].slice(0, 14) + "..."
                        : data.swc_names[swc]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.models.map((m) => (
                <tr key={m} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-stone-900" title={m}>
                    {shortLabel(m)}
                  </td>
                  {data.swc_ids.map((swc) => {
                    const cell = data.breakdown[m]?.[swc];
                    if (!cell || cell.total === 0) {
                      return (
                        <td
                          key={swc}
                          className="px-3 py-3 text-center text-stone-300 bg-stone-50/50"
                        >
                          ·
                        </td>
                      );
                    }
                    const rate = cell.found / cell.total;
                    return (
                      <td key={swc} className={`px-3 py-3 text-center ${cellColor(rate)}`}>
                        <div className="font-semibold text-stone-900 tabular-nums">
                          {cell.found}/{cell.total}
                        </div>
                        <div className="text-[10px] text-stone-600 tabular-nums">
                          {Math.round(rate * 100)}%
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs text-stone-600">
          <span className="px-2.5 py-1 bg-emerald-200 rounded">80% or higher</span>
          <span className="px-2.5 py-1 bg-emerald-100 rounded">50 to 79%</span>
          <span className="px-2.5 py-1 bg-amber-100 rounded">25 to 49%</span>
          <span className="px-2.5 py-1 bg-rose-100 rounded">1 to 24%</span>
          <span className="px-2.5 py-1 bg-stone-100 rounded">0%</span>
        </div>

      </div>
    </div>
  );
}
