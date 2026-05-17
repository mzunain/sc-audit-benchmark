"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ModelScore {
  model: string;
  detection: number;
  quality: number;
  cost_usd: number;
  value: number;
}

interface Winners {
  highest_quality?: { model: string; score: number };
  best_value?: { model: string; score: number };
}

const MODEL_META: Record<string, { short: string; philosophy: string; tone: string }> = {
  "nim:qwen/qwen3-coder-480b-a35b-instruct": {
    short: "Qwen3-Coder 480B",
    philosophy: "Code specialist",
    tone: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  },
  "nim:minimaxai/minimax-m2.7": {
    short: "MiniMax M2.7",
    philosophy: "Code + reasoning",
    tone: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  },
  "nim:stepfun-ai/step-3.5-flash": {
    short: "Step 3.5 Flash",
    philosophy: "Reasoning specialist",
    tone: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
};

function modelMeta(model: string) {
  return (
    MODEL_META[model] ?? {
      short: model.replace(/^nim:/, ""),
      philosophy: "Untagged",
      tone: "bg-gray-50 text-gray-700 ring-1 ring-gray-200",
    }
  );
}

export default function Leaderboard() {
  const [data, setData] = useState<ModelScore[]>([]);
  const [sortBy, setSortBy] = useState<"quality" | "value">("value");
  const [winners, setWinners] = useState<Winners | null>(null);
  const [totalContracts, setTotalContracts] = useState<number>(0);

  useEffect(() => {
    fetch("/data/presentation.json")
      .then((r) => r.json())
      .then((d) => {
        setData(d.summary_rows || []);
        setWinners(d.winners ?? null);
        setTotalContracts(d.total_contracts ?? 0);
      })
      .catch(() => {});
  }, []);

  const sorted = [...data].sort((a, b) =>
    sortBy === "value" ? b.value - a.value : b.quality - a.quality
  );

  const chartData = sorted.map((r) => ({ ...r, label: modelMeta(r.model).short }));
  const winner = winners?.[sortBy === "value" ? "best_value" : "highest_quality"];
  const winnerMeta = winner ? modelMeta(winner.model) : null;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-10">

        <header className="mb-10">
          <h1 className="text-4xl font-bold text-stone-900 leading-tight tracking-tight">
            Solidity vulnerability benchmark
          </h1>
          <p className="text-stone-600 mt-3 text-lg max-w-3xl leading-relaxed">
            Three open-weight model philosophies, tested on {totalContracts || 15} LLM-generated vulnerable
            contracts. Scanners are graded by an independent LLM-as-judge against the injected ground truth.
          </p>
        </header>

        {winner && winnerMeta && (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-stone-200 p-6 mb-8">
            <div className="text-xs uppercase tracking-wider text-emerald-700 font-semibold mb-2">
              Headline
            </div>
            <p className="text-stone-900 leading-relaxed text-[15px]">
              <span className="font-semibold">{winnerMeta.short}</span>{" "}
              <span className="text-stone-500">({winnerMeta.philosophy})</span>{" "}
              wins on {sortBy === "value" ? "cost-adjusted score" : "raw quality"}. Audit firms can
              self-host an open-weight 480B model that beats reasoning specialists and undercuts
              closed frontier prices.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-stone-500 mr-2">Sort by</span>
          <button
            onClick={() => setSortBy("value")}
            className={`px-3 py-1.5 text-sm rounded-md transition ${
              sortBy === "value"
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-700 ring-1 ring-stone-200 hover:ring-stone-300"
            }`}
          >
            Cost-adjusted
          </button>
          <button
            onClick={() => setSortBy("quality")}
            className={`px-3 py-1.5 text-sm rounded-md transition ${
              sortBy === "quality"
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-700 ring-1 ring-stone-200 hover:ring-stone-300"
            }`}
          >
            Pure quality
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm ring-1 ring-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr className="text-xs uppercase tracking-wider text-stone-500">
                <th className="text-left px-6 py-3 font-semibold">Model</th>
                <th className="text-left px-6 py-3 font-semibold">Philosophy</th>
                <th className="text-right px-6 py-3 font-semibold">Detection</th>
                <th className="text-right px-6 py-3 font-semibold">Quality</th>
                <th className="text-right px-6 py-3 font-semibold">Cost (15)</th>
                <th className="text-right px-6 py-3 font-semibold">Cost-adj.</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const meta = modelMeta(row.model);
                const isWinner = i === 0;
                return (
                  <tr
                    key={row.model}
                    className={`border-b border-stone-100 last:border-0 ${
                      isWinner ? "bg-emerald-50/30" : "hover:bg-stone-50/50"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {isWinner && <span className="text-base">🏆</span>}
                        <div>
                          <div className={`text-stone-900 ${isWinner ? "font-semibold" : "font-medium"}`}>
                            {meta.short}
                          </div>
                          <div className="text-xs font-mono text-stone-400 mt-0.5">{row.model}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${meta.tone}`}>
                        {meta.philosophy}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-stone-700 tabular-nums">
                      {row.detection.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-right text-stone-700 tabular-nums">
                      {row.quality.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-right text-stone-700 tabular-nums">
                      ${row.cost_usd.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-stone-900 tabular-nums">
                      {row.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-stone-400">
                    No results yet. Run <code className="font-mono text-stone-600">python src/main.py</code> to generate data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {sorted.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm ring-1 ring-stone-200 p-6">
            <h2 className="text-sm font-semibold text-stone-700 mb-4">
              {sortBy === "value" ? "Cost-adjusted score" : "Quality score"}
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis dataKey="label" angle={-10} textAnchor="end" height={50} fontSize={11} stroke="#78716c" />
                <YAxis fontSize={11} stroke="#78716c" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e7e5e4",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey={sortBy} fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <footer className="mt-8 text-xs text-stone-500 leading-relaxed">
          Cost column is commercial list price per million tokens times actual tokens used. The
          benchmark itself ran on NVIDIA NIM free credits. Cost-adjusted is quality divided by cost.
        </footer>

      </div>
    </div>
  );
}
