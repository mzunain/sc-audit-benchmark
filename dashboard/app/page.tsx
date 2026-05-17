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
    tone: "bg-sky-100 text-sky-700",
  },
  "nim:minimaxai/minimax-m2.7": {
    short: "MiniMax M2.7",
    philosophy: "Code + reasoning hybrid",
    tone: "bg-violet-100 text-violet-700",
  },
  "nim:stepfun-ai/step-3.5-flash": {
    short: "Step 3.5 Flash",
    philosophy: "Reasoning specialist",
    tone: "bg-amber-100 text-amber-700",
  },
};

function modelMeta(model: string) {
  return (
    MODEL_META[model] ?? {
      short: model.replace(/^nim:/, ""),
      philosophy: "—",
      tone: "bg-gray-100 text-gray-700",
    }
  );
}

function chartLabel(model: string) {
  return modelMeta(model).short;
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

  const chartData = sorted.map((r) => ({ ...r, label: chartLabel(r.model) }));

  const winner = winners?.[sortBy === "value" ? "best_value" : "highest_quality"];
  const winnerMeta = winner ? modelMeta(winner.model) : null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-3xl font-bold">Solidity Vulnerability Benchmark</h1>
          <div className="flex gap-3 text-sm">
            <a href="/analysis" className="text-gray-700 hover:underline">Why these results →</a>
            <a href="/breakdown" className="text-gray-700 hover:underline">Per-vuln breakdown →</a>
            <a href="/playground" className="text-gray-700 hover:underline">Playground →</a>
          </div>
        </div>
        <p className="text-gray-600 mb-6">
          Three open-weight model philosophies tested on {totalContracts || 15} LLM-generated vulnerable
          contracts. Scanners are graded by an independent LLM-as-judge against the injected ground truth.
        </p>

        {winner && winnerMeta && (
          <div className="bg-white border-l-4 border-emerald-500 p-4 mb-6 rounded shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Headline</div>
            <div className="text-base">
              <span className="font-semibold">{winnerMeta.short}</span>
              <span className="text-gray-500"> ({winnerMeta.philosophy})</span>
              {" "}wins on{" "}
              {sortBy === "value" ? "cost-adjusted score" : "raw quality"}
              {" "}— audit firms can self-host an open-weight 480B model that beats reasoning specialists
              and undercuts closed frontier prices.
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSortBy("value")}
            className={`px-4 py-2 rounded ${sortBy === "value" ? "bg-black text-white" : "bg-white border"}`}
          >
            Cost-adjusted
          </button>
          <button
            onClick={() => setSortBy("quality")}
            className={`px-4 py-2 rounded ${sortBy === "quality" ? "bg-black text-white" : "bg-white border"}`}
          >
            Pure quality
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 text-sm">
              <tr>
                <th className="text-left p-4">Model</th>
                <th className="text-left p-4">Philosophy</th>
                <th className="text-right p-4">Detection</th>
                <th className="text-right p-4">Quality</th>
                <th className="text-right p-4">Cost (15 scans)</th>
                <th className="text-right p-4">Cost-adjusted</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const meta = modelMeta(row.model);
                const isWinner = i === 0;
                return (
                  <tr key={row.model} className={isWinner ? "bg-emerald-50" : ""}>
                    <td className="p-4">
                      <div className={isWinner ? "font-semibold" : ""}>
                        {isWinner && <span className="mr-1">🏆</span>}
                        {meta.short}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">{row.model}</div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded ${meta.tone}`}>{meta.philosophy}</span>
                    </td>
                    <td className="text-right p-4">{row.detection.toFixed(1)}%</td>
                    <td className="text-right p-4">{row.quality.toFixed(1)}</td>
                    <td className="text-right p-4">${row.cost_usd.toFixed(4)}</td>
                    <td className="text-right p-4 font-semibold">{row.value.toFixed(0)}</td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    No results yet. Run <code>python src/main.py</code> to generate data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {sorted.length > 0 && (
          <div className="mt-6 bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3">
              {sortBy === "value" ? "Cost-adjusted score" : "Quality score"}
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" angle={-12} textAnchor="end" height={70} fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey={sortBy} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-6 text-xs text-gray-500">
          Cost column = commercial list price (per million tokens) × actual tokens used. Benchmark
          itself ran on NVIDIA NIM free credits. Cost-adjusted = quality / cost.
        </div>
      </div>
    </div>
  );
}
