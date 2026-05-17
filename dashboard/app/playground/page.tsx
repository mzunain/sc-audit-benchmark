"use client";

import { useState } from "react";

const DEMO_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Vault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient");
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        balances[msg.sender] -= amount;
    }
}
`;

const MODEL_LABEL: Record<string, string> = {
  "nim:qwen/qwen3-coder-480b-a35b-instruct": "Qwen3-Coder 480B",
  "nim:minimaxai/minimax-m2.7": "MiniMax M2.7",
  "nim:stepfun-ai/step-3.5-flash": "Step 3.5 Flash",
  "nim:zai-org/glm-4.5": "GLM-4.5",
  "nim:meta/llama-3.3-70b-instruct": "Llama 3.3 70B",
  "nim:bytedance/seed-oss-36b-instruct": "Seed-OSS 36B",
};

interface ScanResult {
  model_requested?: string;
  model_used?: string;
  used_fallback?: boolean;
  report?: Record<string, unknown> | null;
  usage?: Record<string, unknown> | null;
  attempts?: { model: string; error: string; status: number }[];
  error?: string;
}

export default function Playground() {
  const [contractCode, setContractCode] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("nim:qwen/qwen3-coder-480b-a35b-instruct");
  const [enableFallback, setEnableFallback] = useState(true);

  const runScan = async () => {
    setLoading(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: contractCode, model, enableFallback }),
      });
      const data = await res.json();
      setScanResult(data);
    } catch (e) {
      setScanResult({ error: String(e) });
    }
    setLoading(false);
  };

  const requestedLabel = scanResult?.model_requested
    ? MODEL_LABEL[scanResult.model_requested]
    : null;
  const usedLabel = scanResult?.model_used ? MODEL_LABEL[scanResult.model_used] : null;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-6 py-10">

        <header className="mb-8">
          <div className="flex items-center justify-between mb-6 text-sm">
            <a href="/" className="text-stone-500 hover:text-stone-900">← Leaderboard</a>
            <nav className="flex gap-5 text-stone-600">
              <a href="/analysis" className="hover:text-stone-900">Why these results</a>
              <a href="/breakdown" className="hover:text-stone-900">Per-vuln breakdown</a>
            </nav>
          </div>
          <h1 className="text-4xl font-bold text-stone-900 leading-tight tracking-tight mb-3">
            Scanner playground
          </h1>
          <p className="text-stone-600 text-lg leading-relaxed">
            Test any model against any contract. Falls back automatically if a model rate-limits.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-white rounded-xl shadow-sm ring-1 ring-stone-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-stone-700">Solidity contract</label>
              <button
                onClick={() => setContractCode(DEMO_CONTRACT)}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
              >
                Load demo contract
              </button>
            </div>
            <textarea
              value={contractCode}
              onChange={(e) => setContractCode(e.target.value)}
              className="w-full h-96 p-3 border border-stone-200 rounded-lg font-mono text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Paste your Solidity code here, or click Load demo contract..."
            />
            <div className="mt-4 flex flex-wrap gap-3 items-center">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <optgroup label="Recommended (NIM, free credits)">
                  <option value="nim:qwen/qwen3-coder-480b-a35b-instruct">
                    Qwen3-Coder 480B, code specialist
                  </option>
                  <option value="nim:meta/llama-3.3-70b-instruct">
                    Llama 3.3 70B, most stable
                  </option>
                  <option value="nim:minimaxai/minimax-m2.7">
                    MiniMax M2.7, code + reasoning
                  </option>
                  <option value="nim:zai-org/glm-4.5">GLM-4.5, hybrid</option>
                </optgroup>
                <optgroup label="Reasoning (NIM, may rate-limit)">
                  <option value="nim:stepfun-ai/step-3.5-flash">Step 3.5 Flash</option>
                  <option value="nim:bytedance/seed-oss-36b-instruct">Seed-OSS 36B</option>
                </optgroup>
                <optgroup label="OpenRouter (paid)">
                  <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                  <option value="google/gemini-flash-1.5">Gemini 1.5 Flash</option>
                </optgroup>
              </select>
              <label className="text-xs flex items-center gap-1.5 text-stone-700">
                <input
                  type="checkbox"
                  checked={enableFallback}
                  onChange={(e) => setEnableFallback(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                Auto-fallback on rate limit
              </label>
              <button
                onClick={runScan}
                disabled={loading || !contractCode}
                className="ml-auto px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {loading ? "Scanning..." : "Run scan"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm ring-1 ring-stone-200 p-5">
            <label className="block mb-3 text-sm font-semibold text-stone-700">
              Scanner report
            </label>
            <div className="w-full h-96 p-3 border border-stone-200 rounded-lg bg-stone-50/30 overflow-auto">
              {!scanResult && !loading && (
                <p className="text-stone-400 text-sm">Run a scan to see results.</p>
              )}
              {loading && (
                <div className="flex items-center gap-2 text-stone-500 text-sm">
                  <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  Calling provider...
                </div>
              )}
              {scanResult?.error && (
                <div>
                  <div className="text-rose-700 font-semibold text-sm mb-2">All models failed</div>
                  <p className="text-xs text-stone-600 mb-3 leading-relaxed">
                    The request was retried across the fallback chain and every provider returned
                    an error. Common causes are NIM free-tier rate limit, a temporarily DEGRADED
                    model, or a contract that's too long. Try again in a minute, or paste a
                    shorter contract.
                  </p>
                  {scanResult.attempts && scanResult.attempts.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-stone-700">
                        Attempts ({scanResult.attempts.length})
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-stone-600 font-mono">
                        {JSON.stringify(scanResult.attempts, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              {scanResult?.report && (
                <div>
                  <div className="text-xs text-stone-600 mb-3 flex flex-wrap gap-x-2 gap-y-1">
                    <span>
                      Scanned by{" "}
                      <span className="font-semibold text-emerald-700">
                        {usedLabel ?? scanResult.model_used}
                      </span>
                    </span>
                    {scanResult.used_fallback && requestedLabel && (
                      <span className="text-amber-700">
                        (fell back from {requestedLabel}, primary was rate-limited)
                      </span>
                    )}
                  </div>
                  <pre className="text-xs whitespace-pre-wrap font-mono text-stone-800">
                    {JSON.stringify(scanResult.report, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
