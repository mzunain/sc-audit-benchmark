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
  apiKey: string | undefined;
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

export async function POST(req: NextRequest) {
  const { code, model } = await req.json();

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Missing 'code' in request body" }, { status: 400 });
  }
  if (!model || typeof model !== "string") {
    return NextResponse.json({ error: "Missing 'model' in request body" }, { status: 400 });
  }

  const route = resolveRoute(model);
  if ("error" in route) {
    return NextResponse.json({ error: route.error }, { status: route.status });
  }

  const userPrompt = `Analyze this Solidity contract for security vulnerabilities:\n\n\`\`\`solidity\n${code}\n\`\`\`\n\nRespond with JSON only.`;

  try {
    const res = await fetch(`${route.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${route.apiKey}`,
        "Content-Type": "application/json",
        ...route.extraHeaders,
      },
      body: JSON.stringify({
        model: route.apiModel,
        max_tokens: 1500,
        temperature: 0,
        messages: [
          { role: "system", content: SCANNER_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data }, { status: res.status });
    }

    const text: string = data?.choices?.[0]?.message?.content ?? "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {}
      }
    }

    return NextResponse.json({
      model,
      report: parsed ?? { raw: text },
      usage: data.usage ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
