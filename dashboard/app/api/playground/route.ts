import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type AuditMode = "triage" | "deep" | "exploit";

const ALLOWED_MODELS = new Set([
  "nim:qwen/qwen3-coder-480b-a35b-instruct",
  "nim:meta/llama-3.3-70b-instruct",
  "nim:minimaxai/minimax-m2.7",
  "nim:zai-org/glm-4.5",
  "nim:stepfun-ai/step-3.5-flash",
  "nim:bytedance/seed-oss-36b-instruct",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "google/gemini-flash-1.5",
]);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 6;
const PROVIDER_TIMEOUT_MS = 45_000;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  backend: "upstash" | "memory" | "memory-fallback";
  degraded?: boolean;
}

const AUDIT_MODES: Record<AuditMode, string> = {
  triage: "Prioritize high-signal findings, avoid speculative issues, and keep the report concise.",
  deep: "Audit thoroughly for subtle authorization, accounting, state-machine, and cross-function issues.",
  exploit: "Think like an attacker. Explain reachable exploit paths, prerequisites, and likely impact.",
};

function buildScannerSystemPrompt(auditMode: AuditMode, focusAreas: string[], riskProfile: string) {
  const focus = focusAreas.length > 0 ? focusAreas.join(", ") : "all common Solidity vulnerability classes";
  return `You are a senior smart contract security auditor. Analyze the provided Solidity contract and identify exploitable vulnerabilities.

Audit mode: ${auditMode}
Mode instruction: ${AUDIT_MODES[auditMode]}
Risk profile: ${riskProfile}
Focus areas: ${focus}

Rules:
- Return real security findings only. Do not invent issues.
- Include false-positive caveats when exploitability depends on missing context.
- Prioritize severity by exploit impact and reachability.
- Give concrete next steps that a Solidity engineer can act on.

Respond in this EXACT JSON format (no markdown, no extra text):

{
  "vulnerabilities_found": [
    {
      "swc_id": "SWC-XXX",
      "name": "...",
      "severity": "High",
      "confidence": "High",
      "location": "function withdraw()",
      "impact": "...",
      "exploit_scenario": "...",
      "recommendation": "...",
      "patch_hint": "...",
      "explanation": "..."
    }
  ],
  "risk_rating": "Low | Medium | High | Critical",
  "summary": "Overall security assessment in 1 sentence",
  "assumptions": ["..."],
  "next_steps": ["..."]
}`;
}

// Fallback chain: if the user-selected model 429s or errors, try these in order.
// All three are NIM models we've run end-to-end and seen succeed.
const FALLBACK_CHAIN = [
  "nim:qwen/qwen3-coder-480b-a35b-instruct",
  "nim:meta/llama-3.3-70b-instruct",
  "nim:minimaxai/minimax-m2.7",
];

function clientKey(req: NextRequest) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

function rateLimitBucket(now: number) {
  return Math.floor(now / RATE_LIMIT_WINDOW_MS);
}

async function checkUpstashRateLimit(key: string, now: number): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const bucket = rateLimitBucket(now);
  const resetAt = (bucket + 1) * RATE_LIMIT_WINDOW_MS;
  const redisKey = `sc-audit:playground:${bucket}:${key}`;

  const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) + 10],
    ]),
  });

  if (!response.ok) {
    throw new Error(`Upstash rate limit failed with HTTP ${response.status}`);
  }

  const result = await response.json();
  const count = Number(Array.isArray(result) ? result[0]?.result : result?.result?.[0]?.result);
  if (!Number.isFinite(count)) {
    throw new Error("Upstash rate limit returned an unexpected response");
  }

  return {
    ok: count <= RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - count),
    resetAt,
    backend: "upstash",
  };
}

function checkMemoryRateLimit(key: string, now: number, backend: RateLimitResult["backend"] = "memory"): RateLimitResult {
  for (const [storedKey, value] of rateLimitStore) {
    if (value.resetAt <= now) rateLimitStore.delete(storedKey);
  }

  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { ok: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt, backend };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { ok: false, remaining: 0, resetAt: current.resetAt, backend };
  }

  current.count += 1;
  return { ok: true, remaining: RATE_LIMIT_MAX_REQUESTS - current.count, resetAt: current.resetAt, backend };
}

async function checkRateLimit(req: NextRequest): Promise<RateLimitResult> {
  const now = Date.now();
  const key = clientKey(req);

  try {
    const durable = await checkUpstashRateLimit(key, now);
    if (durable) return durable;
  } catch (error) {
    const fallback = checkMemoryRateLimit(key, now, "memory-fallback");
    return { ...fallback, degraded: true };
  }

  return checkMemoryRateLimit(key, now);
}

function rateLimitHeaders(limit: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
    "X-RateLimit-Remaining": String(limit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(limit.resetAt / 1000)),
    "X-RateLimit-Backend": limit.backend,
    ...(limit.degraded ? { "X-RateLimit-Degraded": "true" } : {}),
  };
}

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

async function tryScan(
  model: string,
  code: string,
  options: { auditMode: AuditMode; focusAreas: string[]; riskProfile: string }
): Promise<ScanResult> {
  const route = resolveRoute(model);
  if ("error" in route) {
    return { ok: false, status: route.status, error: route.error, isRetryable: false };
  }

  const userPrompt = `Analyze this Solidity contract for security vulnerabilities.

Audit mode: ${options.auditMode}
Risk profile: ${options.riskProfile}
Focus areas: ${options.focusAreas.join(", ") || "all"}

\`\`\`solidity
${code}
\`\`\`

Respond with JSON only.`;

  let upstream: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    upstream = await fetch(`${route.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
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
          { role: "system", content: buildScannerSystemPrompt(options.auditMode, options.focusAreas, options.riskProfile) },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, status: 502, error: `Couldn't reach provider: ${String(e)}`, isRetryable: true };
  } finally {
    clearTimeout(timeout);
  }

  // Retry on every provider error except auth; the fallback chain can recover
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
  const rateLimit = await checkRateLimit(req);
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retry_after_seconds: Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
      },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { code, model, enableFallback, auditMode, focusAreas, riskProfile } = body as {
    code?: unknown;
    model?: unknown;
    enableFallback?: unknown;
    auditMode?: unknown;
    focusAreas?: unknown;
    riskProfile?: unknown;
  };

  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json(
      { error: "Missing 'code' in request body" },
      { status: 400, headers: rateLimitHeaders(rateLimit) }
    );
  }
  if (code.length > 24000) {
    return NextResponse.json(
      { error: "Contract is too long for the hosted playground. Keep it under 24,000 characters." },
      { status: 413, headers: rateLimitHeaders(rateLimit) }
    );
  }
  if (typeof model !== "string" || !model) {
    return NextResponse.json(
      { error: "Missing 'model' in request body" },
      { status: 400, headers: rateLimitHeaders(rateLimit) }
    );
  }
  if (!ALLOWED_MODELS.has(model)) {
    return NextResponse.json(
      { error: "Unsupported model for hosted playground" },
      { status: 400, headers: rateLimitHeaders(rateLimit) }
    );
  }

  const scanMode: AuditMode =
    auditMode === "deep" || auditMode === "exploit" || auditMode === "triage" ? auditMode : "triage";
  const selectedFocusAreas = Array.isArray(focusAreas)
    ? focusAreas.filter((item): item is string => typeof item === "string").slice(0, 8)
    : [];
  const selectedRiskProfile =
    typeof riskProfile === "string" && riskProfile.trim() ? riskProfile.slice(0, 120) : "General EVM contract";

  // Build the candidate list: user's pick first, then fallback chain (deduped).
  const useFallback = enableFallback !== false;
  const candidates = useFallback
    ? [model, ...FALLBACK_CHAIN.filter((m) => m !== model)]
    : [model];

  const attempts: { model: string; error: string; status: number }[] = [];

  for (const candidate of candidates) {
    const result = await tryScan(candidate, code, {
      auditMode: scanMode,
      focusAreas: selectedFocusAreas,
      riskProfile: selectedRiskProfile,
    });
    if (result.ok) {
      return NextResponse.json({
        model_requested: model,
        model_used: candidate,
        used_fallback: candidate !== model,
        audit_mode: scanMode,
        focus_areas: selectedFocusAreas,
        risk_profile: selectedRiskProfile,
        report: result.report,
        usage: result.usage,
        attempts: attempts.length > 0 ? attempts : undefined,
        rate_limit: {
          limit: RATE_LIMIT_MAX_REQUESTS,
          remaining: rateLimit.remaining,
          reset_at: new Date(rateLimit.resetAt).toISOString(),
          backend: rateLimit.backend,
          degraded: rateLimit.degraded ?? false,
        },
      }, {
        headers: rateLimitHeaders(rateLimit),
      });
    }
    attempts.push({ model: candidate, error: result.error, status: result.status });
    if (!result.isRetryable) break; // Hard error (e.g. missing API key); don't keep trying
  }

  return NextResponse.json(
    {
      error: "All models failed",
      attempts,
      rate_limit: {
        limit: RATE_LIMIT_MAX_REQUESTS,
        remaining: rateLimit.remaining,
        reset_at: new Date(rateLimit.resetAt).toISOString(),
        backend: rateLimit.backend,
        degraded: rateLimit.degraded ?? false,
      },
    },
    { status: 503, headers: rateLimitHeaders(rateLimit) }
  );
}
