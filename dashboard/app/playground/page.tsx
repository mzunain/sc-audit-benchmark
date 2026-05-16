"use client";

import { useState } from "react";

export default function Playground() {
  const [contractCode, setContractCode] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<string>("nim:qwen/qwen3-coder-480b-a35b-instruct");

  const runScan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: contractCode, model }),
      });
      const data = await res.json();
      setScanResult(data);
    } catch (e) {
      setScanResult({ error: String(e) });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-2">
          <a href="/" className="text-sm text-gray-500 hover:underline">← Leaderboard</a>
        </div>
        <h1 className="text-3xl font-bold mb-2">Vulnerability Scanner Playground</h1>
        <p className="text-gray-600 mb-8">Test any model against any contract</p>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 font-semibold">Solidity Contract</label>
            <textarea
              value={contractCode}
              onChange={(e) => setContractCode(e.target.value)}
              className="w-full h-96 p-4 border rounded font-mono text-sm"
              placeholder="Paste your Solidity code here..."
            />
            <div className="mt-4 flex gap-4">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="p-2 border rounded"
              >
                <optgroup label="NVIDIA NIM (free credits)">
                  <option value="nim:qwen/qwen3-coder-480b-a35b-instruct">Qwen3-Coder 480B — code specialist</option>
                  <option value="nim:minimaxai/minimax-m2.7">MiniMax M2.7 — coding + reasoning hybrid</option>
                  <option value="nim:stepfun-ai/step-3.5-flash">Step 3.5 Flash — reasoning specialist</option>
                  <option value="nim:bytedance/seed-oss-36b-instruct">Seed-OSS 36B — agentic reasoning</option>
                  <option value="nim:mistralai/mistral-large-3-675b-instruct-2512">Mistral Large 3 675B</option>
                  <option value="nim:nvidia/llama-3.3-nemotron-super-49b-v1">Nemotron Super 49B</option>
                  <option value="nim:meta/llama-3.3-70b-instruct">Llama 3.3 70B</option>
                  <option value="nim:deepseek-ai/deepseek-r1">DeepSeek R1</option>
                  <option value="nim:zai-org/glm-4.5">GLM-4.5</option>
                </optgroup>
                <optgroup label="OpenRouter (free tier)">
                  <option value="qwen/qwen-2.5-coder-32b-instruct:free">Qwen2.5-Coder 32B (free)</option>
                  <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (free)</option>
                  <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash (free)</option>
                  <option value="deepseek/deepseek-chat-v3-0324:free">DeepSeek V3 (free)</option>
                </optgroup>
                <optgroup label="OpenRouter (paid)">
                  <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="openai/gpt-4o">GPT-4o</option>
                  <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                  <option value="google/gemini-flash-1.5">Gemini 1.5 Flash</option>
                </optgroup>
              </select>
              <button
                onClick={runScan}
                disabled={loading || !contractCode}
                className="px-6 py-2 bg-black text-white rounded disabled:opacity-50"
              >
                {loading ? "Scanning..." : "Run Scan"}
              </button>
            </div>
          </div>

          <div>
            <label className="block mb-2 font-semibold">Scanner Report</label>
            <div className="w-full h-96 p-4 border rounded bg-white overflow-auto">
              {scanResult ? (
                <pre className="text-xs">{JSON.stringify(scanResult, null, 2)}</pre>
              ) : (
                <p className="text-gray-400">Run a scan to see results</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
