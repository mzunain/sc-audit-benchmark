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
  report?: unknown;
  usage?: unknown;
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

  const requestedLabel = scanResult?.model_requested ? MODEL_LABEL[scanResult.model_requested] : null;
  const usedLabel = scanResult?.model_used ? MODEL_LABEL[scanResult.model_used] : null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <a href="/" className="text-sm text-gray-500 hover:underline">← Leaderboard</a>
          <a href="/analysis" className="text-sm text-gray-700 hover:underline">Why these results →</a>
        </div>
        <h1 className="text-3xl font-bold mb-2">Vulnerability Scanner Playground</h1>
        <p className="text-gray-600 mb-6">Test any model against any contract. Falls back automatically if a model rate-limits.</p>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold">Solidity Contract</label>
              <button
                onClick={() => setContractCode(DEMO_CONTRACT)}
                className="text-xs text-emerald-700 hover:underline"
              >
                Load demo contract
              </button>
            </div>
            <textarea
              value={contractCode}
              onChange={(e) => setContractCode(e.target.value)}
              className="w-full h-96 p-4 border rounded font-mono text-sm"
              placeholder="Paste your Solidity code here…"
            />
            <div className="mt-4 flex flex-wrap gap-3 items-center">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="p-2 border rounded text-sm"
              >
                <optgroup label="Recommended (NIM, free credits)">
                  <option value="nim:qwen/qwen3-coder-480b-a35b-instruct">Qwen3-Coder 480B — code specialist</option>
                  <option value="nim:meta/llama-3.3-70b-instruct">Llama 3.3 70B — general (most stable)</option>
                  <option value="nim:minimaxai/minimax-m2.7">MiniMax M2.7 — code + reasoning</option>
                  <option value="nim:zai-org/glm-4.5">GLM-4.5 — code + reasoning hybrid</option>
                </optgroup>
                <optgroup label="Reasoning (NIM, may rate-limit)">
                  <option value="nim:stepfun-ai/step-3.5-flash">Step 3.5 Flash — pure reasoning</option>
                  <option value="nim:bytedance/seed-oss-36b-instruct">Seed-OSS 36B — agentic reasoning</option>
                </optgroup>
                <optgroup label="OpenRouter (paid)">
                  <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                  <option value="google/gemini-flash-1.5">Gemini 1.5 Flash</option>
                </optgroup>
              </select>
              <label className="text-xs flex items-center gap-1.5 text-gray-700">
                <input
                  type="checkbox"
                  checked={enableFallback}
                  onChange={(e) => setEnableFallback(e.target.checked)}
                />
                Auto-fallback on rate limit
              </label>
              <button
                onClick={runScan}
                disabled={loading || !contractCode}
                className="px-6 py-2 bg-black text-white rounded disabled:opacity-50 ml-auto"
              >
                {loading ? "Scanning…" : "Run Scan"}
              </button>
            </div>
          </div>

          <div>
            <label className="block mb-2 font-semibold">Scanner Report</label>
            <div className="w-full h-96 p-4 border rounded bg-white overflow-auto">
              {!scanResult && !loading && (
                <p className="text-gray-400">Run a scan to see results.</p>
              )}
              {loading && <p className="text-gray-500">Calling provider…</p>}
              {scanResult?.error && (
                <div>
                  <div className="text-rose-700 font-semibold text-sm mb-2">All models failed</div>
                  <p className="text-xs text-gray-600 mb-3">
                    The request was retried across the fallback chain and every provider returned an error.
                    Common causes: NIM free-tier rate limit, model temporarily DEGRADED, or contract too long.
                    Try again in a minute or paste a shorter contract.
                  </p>
                  {scanResult.attempts && scanResult.attempts.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-700">Attempts ({scanResult.attempts.length})</summary>
                      <pre className="mt-2 whitespace-pre-wrap text-gray-600">{JSON.stringify(scanResult.attempts, null, 2)}</pre>
                    </details>
                  )}
                </div>
              )}
              {scanResult?.report && (
                <div>
                  <div className="text-xs text-gray-600 mb-2 flex flex-wrap gap-2">
                    <span>
                      Scanned by <span className="font-semibold text-emerald-700">{usedLabel ?? scanResult.model_used}</span>
                    </span>
                    {scanResult.used_fallback && requestedLabel && (
                      <span className="text-amber-700">
                        (fell back from {requestedLabel} — primary was rate-limited)
                      </span>
                    )}
                  </div>
                  <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(scanResult.report, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
