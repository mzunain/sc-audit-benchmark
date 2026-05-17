import { NextRequest, NextResponse } from "next/server";

const SCANNER_SYSTEM_PROMPT = `You are a senior smart contract security auditor. Analyze the
provided Solidity contract and identify any vulnerabilities.

Respond in this EXACT JSON format (no markdown, no extra text):

{
  "vulnerabilities_found": [
    {
      "swc_id": "SWC-XXX",
      "name": "...",
      "severity": "High",
      "location": "function withdraw()",
      "explanation": "..."
    }
  ],
  "summary": "Overall security assessment in 1 sentence"
}`;

// Fallback chain — if the user-selected model 429s or errors, try these in order.
// All three are NIM models we've run end-to-end and seen succeed.
const FALLBACK_CHAIN = [
  "nim:qwen/qwen3-coder-480b-a35b-instruct",
  "nim:meta/llama-3.3-70b-instruct",
  "nim:minimaxai/minimax-m2.7",
];

interface RouteInfo {
  baseUrl: string;
  apiKey: string;
  apiModel: string;
  extraHeaders: Record<string, string>;
}

function resolveRoute(model: string): RouteInfo | { error: string; status: number } {
  if (model.startsWith("nim:")) {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return { error: "NVIDIA_API_KEY not configured.", status: 500 };
    }
    return {
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey,
      apiModel: model.slice("nim:".length),
      extraHeaders: {},
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { error: "OPENROUTER_API_KEY not configured.", status: 500 };
  }
  return {
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey,
    apiModel: model,
    extraHeaders: {
      "HTTP-Referer": "https://github.com/sc-audit-benchmark",
      "X-Title": "SC Audit Benchmark",
    },
  };
}

function extractJsonFromText(text: string): unknown {
  try { return JSON.parse(text.trim()); } catch {}
  const cleaned = text
    .replace(/^```(?:json)?\s*\n/m, "")
    .replace(/\n```\s*$/m, "")
    .trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  return null;
}

type ScanResult =
  | { ok: true; report: unknown; usage: unknown; rawText: string }
  | { ok: false; status: number; error: string; isRetryable: boolean };

async function tryScan(model: string, code: string): Promise<ScanResult> {
  const route = resolveRoute(model);
  if ("error" in route) {
    return { ok: false, status: route.status, error: route.error, isRetryable: false };
  }

  const userPrompt = `Analyze this Solidity contract for security vulnerabilities:\n\n\`\`\`solidity\n${code}\n\`\`\`\n\nRespond with JSON only.`;

  let upstream: Response;
  try {
    upstream = await fetch(`${route.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${route.apiKey}`,
        "Content-Type": "application/json",
        ...route.extraHeaders,
      },
      body: JSON.stringify({
        model: route.apiModel,
        max_tokens: 2000,
        temperature: 0,
        messages: [
          { role: "system", content: SCANNER_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, status: 502, error: `Couldn't reach provider: ${String(e)}`, isRetryable: true };
  }

  // Retry on every provider error except auth — fall-back chain can recover
  // from rate limits, DEGRADED models, model-not-found, transient 5xx, etc.
  // Only stop early if the credentials themselves are bad.
  const shouldRetry = (status: number) => status !== 401 && status !== 403;

  const raw = await upstream.text();
  let upstreamJson: any = null;
  try {
    upstreamJson = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      status: upstream.status,
      error: `Provider returned non-JSON (HTTP ${upstream.status}): ${raw.slice(0, 200)}`,
      isRetryable: shouldRetry(upstream.status),
    };
  }

  if (!upstream.ok) {
    const detail =
      upstreamJson?.error?.message ||
      upstreamJson?.error?.detail ||
      upstreamJson?.detail ||
      upstreamJson?.message ||
      upstreamJson?.error ||
      "Unknown provider error";
    return {
      ok: false,
      status: upstream.status,
      error: typeof detail === "string" ? detail : JSON.stringify(detail),
      isRetryable: shouldRetry(upstream.status),
    };
  }

  const text: string = upstreamJson?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJsonFromText(text);

  // Empty content = retryable (we saw this with reasoning models hitting token limits)
  if (!text.trim()) {
    return { ok: false, status: 502, error: "Model returned empty response", isRetryable: true };
  }

  return {
    ok: true,
    report: parsed ?? { raw: text },
    usage: upstreamJson?.usage ?? null,
    rawText: text,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, model, enableFallback } = body as {
    code?: unknown;
    model?: unknown;
    enableFallback?: unknown;
  };

  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "Missing 'code' in request body" }, { status: 400 });
  }
  if (typeof model !== "string" || !model) {
    return NextResponse.json({ error: "Missing 'model' in request body" }, { status: 400 });
  }

  // Build the candidate list: user's pick first, then fallback chain (deduped).
  const useFallback = enableFallback !== false;
  const candidates = useFallback
    ? [model, ...FALLBACK_CHAIN.filter((m) => m !== model)]
    : [model];

  const attempts: { model: string; error: string; status: number }[] = [];

  for (const candidate of candidates) {
    const result = await tryScan(candidate, code);
    if (result.ok) {
      return NextResponse.json({
        model_requested: model,
        model_used: candidate,
        used_fallback: candidate !== model,
        report: result.report,
        usage: result.usage,
        attempts: attempts.length > 0 ? attempts : undefined,
      });
    }
    attempts.push({ model: candidate, error: result.error, status: result.status });
    if (!result.isRetryable) break; // Hard error (e.g. missing API key) — don't keep trying
  }

  return NextResponse.json(
    {
      error: "All models failed",
      attempts,
    },
    { status: 503 }
  );
}
