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
  return "bg-gray-100";
}

export default function Breakdown() {
  const [data, setData] = useState<BreakdownData | null>(null);

  useEffect(() => {
    fetch("/api/breakdown")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-2">
          <a href="/" className="text-sm text-gray-500 hover:underline">← Leaderboard</a>
        </div>
        <h1 className="text-3xl font-bold mb-2">Per-vulnerability breakdown</h1>
        <p className="text-gray-600 mb-8">
          How each model performs by SWC class. Detection rate = fraction of contracts where the
          injected vulnerability was correctly identified.
        </p>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-3">Model</th>
                {data.swc_ids.map((swc) => (
                  <th key={swc} className="p-3 text-center" title={data.swc_names[swc]}>
                    <div className="font-mono text-xs">{swc}</div>
                    <div className="text-xs text-gray-500 font-normal">
                      {data.swc_names[swc].slice(0, 14)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.models.map((m) => (
                <tr key={m} className="border-t">
                  <td className="p-3 font-medium" title={m}>{shortLabel(m)}</td>
                  {data.swc_ids.map((swc) => {
                    const cell = data.breakdown[m]?.[swc];
                    if (!cell || cell.total === 0) {
                      return (
                        <td key={swc} className="p-3 text-center bg-gray-50 text-gray-300">—</td>
                      );
                    }
                    const rate = cell.found / cell.total;
                    return (
                      <td key={swc} className={`p-3 text-center ${cellColor(rate)}`}>
                        <div className="font-semibold">{cell.found}/{cell.total}</div>
                        <div className="text-xs text-gray-600">{Math.round(rate * 100)}%</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex gap-2 text-xs text-gray-600">
          <span className="px-2 py-1 bg-emerald-200">≥80% detection</span>
          <span className="px-2 py-1 bg-emerald-100">50–79%</span>
          <span className="px-2 py-1 bg-amber-100">25–49%</span>
          <span className="px-2 py-1 bg-rose-100">1–24%</span>
          <span className="px-2 py-1 bg-gray-100">0%</span>
        </div>
      </div>
    </div>
  );
}
