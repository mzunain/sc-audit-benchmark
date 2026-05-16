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

export default function Leaderboard() {
  const [data, setData] = useState<ModelScore[]>([]);
  const [sortBy, setSortBy] = useState<"quality" | "value">("value");
  const [winners, setWinners] = useState<any>(null);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d.summary_rows || []);
        setWinners(d.winners);
      })
      .catch(() => {});
  }, []);

  const sorted = [...data].sort((a, b) =>
    sortBy === "value" ? b.value - a.value : b.quality - a.quality
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Solidity Vulnerability Benchmark</h1>
        <p className="text-gray-600 mb-8">
          Comparing LLM performance at detecting smart contract vulnerabilities
        </p>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setSortBy("value")}
            className={`px-4 py-2 rounded ${sortBy === "value" ? "bg-black text-white" : "bg-white"}`}
          >
            Cost-Adjusted
          </button>
          <button
            onClick={() => setSortBy("quality")}
            className={`px-4 py-2 rounded ${sortBy === "quality" ? "bg-black text-white" : "bg-white"}`}
          >
            Pure Quality
          </button>
          <a
            href="/playground"
            className="px-4 py-2 rounded bg-white border ml-auto"
          >
            Playground →
          </a>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-4">Model</th>
                <th className="text-right p-4">Detection %</th>
                <th className="text-right p-4">Quality Score</th>
                <th className="text-right p-4">Cost ($)</th>
                <th className="text-right p-4">Value</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const isWinner = i === 0;
                return (
                  <tr key={row.model} className={isWinner ? "bg-green-50 font-semibold" : ""}>
                    <td className="p-4">{isWinner && "🏆 "}{row.model}</td>
                    <td className="text-right p-4">{row.detection}%</td>
                    <td className="text-right p-4">{row.quality.toFixed(1)}</td>
                    <td className="text-right p-4">${row.cost_usd.toFixed(4)}</td>
                    <td className="text-right p-4">{row.value.toFixed(1)}</td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No results yet. Run <code>python src/main.py</code> to generate data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {sorted.length > 0 && (
          <div className="mt-8 bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Visualization</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sorted}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" angle={-15} textAnchor="end" height={80} fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey={sortBy} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500">
          <p>Benchmark: 15 LLM-generated vulnerable Solidity contracts. Judged by LLM-as-judge methodology.</p>
        </div>
      </div>
    </div>
  );
}
