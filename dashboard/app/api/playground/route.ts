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
      return {
        error: "NVIDIA_API_KEY not configured. Get one at https://build.nvidia.com",
        status: 500,
      };
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
    return {
      error: "OPENROUTER_API_KEY not configured. Get one at https://openrouter.ai/keys",
      status: 500,
    };
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
  // First try a clean parse
  try {
    return JSON.parse(text.trim());
  } catch {}
  // Strip markdown code fences if any
  const cleaned = text
    .replace(/^```(?:json)?\s*\n/m, "")
    .replace(/\n```\s*$/m, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  // Last resort: regex out the first { ... } block
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, model } = body as { code?: unknown; model?: unknown };

  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "Missing 'code' in request body" }, { status: 400 });
  }
  if (typeof model !== "string" || !model) {
    return NextResponse.json({ error: "Missing 'model' in request body" }, { status: 400 });
  }

  const route = resolveRoute(model);
  if ("error" in route) {
    return NextResponse.json({ error: route.error }, { status: route.status });
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
    return NextResponse.json(
      { error: `Couldn't reach ${route.baseUrl}: ${String(e)}` },
      { status: 502 }
    );
  }

  const raw = await upstream.text();
  let upstreamJson: any = null;
  try {
    upstreamJson = JSON.parse(raw);
  } catch {
    // Upstream returned non-JSON — surface it as a readable error instead of letting
    // JSON.parse crash our handler with a "SyntaxError: Unexpected token..." message.
    return NextResponse.json(
      {
        error: `Provider returned non-JSON (HTTP ${upstream.status}).`,
        status: upstream.status,
        upstream_body: raw.slice(0, 800),
      },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    // Provider returned a JSON error — pass it through.
    const detail =
      upstreamJson?.error?.message ||
      upstreamJson?.error?.detail ||
      upstreamJson?.detail ||
      upstreamJson?.message ||
      upstreamJson?.error ||
      "Unknown provider error";
    return NextResponse.json(
      { error: typeof detail === "string" ? detail : JSON.stringify(detail), upstream_body: upstreamJson, status: upstream.status },
      { status: upstream.status }
    );
  }

  const text: string = upstreamJson?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJsonFromText(text);

  return NextResponse.json({
    model,
    report: parsed ?? { raw: text || "(empty response from model)" },
    usage: upstreamJson?.usage ?? null,
  });
}
