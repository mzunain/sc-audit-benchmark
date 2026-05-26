import { NextRequest, NextResponse } from "next/server";
import presentationData from "@/../../public/data/presentation.json";
import breakdownData from "@/../../public/data/breakdown.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelSummary {
  id: string;
  name: string;
  provider: string;
  detection_rate: number;
  quality_score: number;
  cost_per_15_scans_usd: number;
  cost_adjusted_score: number;
  false_positive_rate: number;
  swc_detection: Record<string, { found: number; total: number; rate: number }>;
}

interface BenchmarkResponse {
  meta: {
    version: string;
    generated_at: string;
    total_contracts: number;
    total_swc_classes: number;
    docs: string;
  };
  leaderboard: ModelSummary[];
  swc_registry: Record<string, { name: string; severity: string }>;
  winners: {
    highest_detection: string;
    highest_quality: string;
    best_value: string;
    lowest_fp_rate: string;
  };
}

// ---------------------------------------------------------------------------
// Static enrichment (data not in JSON files)
// ---------------------------------------------------------------------------

const MODEL_META: Record<string, { name: string; provider: string; fp_rate: number; cost_adjusted: number }> = {
  "nim:qwen/qwen3-coder-480b-a35b-instruct": {
    name: "Qwen3-Coder 480B",
    provider: "NVIDIA NIM",
    fp_rate: 0.06,
    cost_adjusted: 17041,
  },
  "nim:minimaxai/minimax-m2.7": {
    name: "MiniMax M2.7 (230B)",
    provider: "NVIDIA NIM",
    fp_rate: 0.11,
    cost_adjusted: 1882,
  },
  "nim:stepfun-ai/step-3.5-flash": {
    name: "Step-3.5-Flash (200B)",
    provider: "NVIDIA NIM",
    fp_rate: 0.18,
    cost_adjusted: 509,
  },
};

const SWC_REGISTRY: Record<string, { name: string; severity: string }> = {
  "SWC-101": { name: "Integer Overflow/Underflow",        severity: "High"     },
  "SWC-104": { name: "Unchecked Call Return Value",        severity: "High"     },
  "SWC-105": { name: "Unprotected Ether Withdrawal",       severity: "Critical" },
  "SWC-106": { name: "Unprotected SELFDESTRUCT",           severity: "Critical" },
  "SWC-107": { name: "Reentrancy",                         severity: "Critical" },
  "SWC-112": { name: "Delegatecall to Untrusted Callee",   severity: "Critical" },
  "SWC-114": { name: "Transaction Order Dependence",       severity: "High"     },
  "SWC-128": { name: "DoS with Block Gas Limit",           severity: "Medium"   },
};

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  };
}

// ---------------------------------------------------------------------------
// Build response
// ---------------------------------------------------------------------------

function buildBenchmark(modelFilter?: string, swcFilter?: string): BenchmarkResponse {
  const presentation = presentationData as {
    total_contracts: number;
    summary_rows: { model: string; detection: number; quality: number; cost_usd: number; value: number }[];
    winners: { highest_quality: { model: string }; best_value: { model: string } };
  };

  const breakdown = breakdownData as {
    breakdown: Record<string, Record<string, { found: number; total: number }>>;
  };

  const summaryMap = Object.fromEntries(
    presentation.summary_rows.map(r => [r.model, r])
  );

  let models = presentation.summary_rows.map(r => r.model);
  if (modelFilter) {
    models = models.filter(m =>
      m.toLowerCase().includes(modelFilter.toLowerCase()) ||
      (MODEL_META[m]?.name ?? "").toLowerCase().includes(modelFilter.toLowerCase())
    );
  }

  let swcIds = Object.keys(SWC_REGISTRY);
  if (swcFilter) {
    swcIds = swcIds.filter(s => s.toLowerCase() === swcFilter.toLowerCase());
  }

  const leaderboard: ModelSummary[] = models.map(modelId => {
    const row = summaryMap[modelId];
    const meta = MODEL_META[modelId] ?? { name: modelId, provider: "Unknown", fp_rate: 0, cost_adjusted: 0 };
    const rawBreakdown = breakdown.breakdown[modelId] ?? {};

    const swc_detection: Record<string, { found: number; total: number; rate: number }> = {};
    for (const swcId of swcIds) {
      const entry = rawBreakdown[swcId];
      if (entry) {
        swc_detection[swcId] = {
          found: entry.found,
          total: entry.total,
          rate: entry.total > 0 ? Math.round((entry.found / entry.total) * 1000) / 1000 : 0,
        };
      }
    }

    return {
      id: modelId,
      name: meta.name,
      provider: meta.provider,
      detection_rate: Math.round((row.detection / 100) * 1000) / 1000,
      quality_score: row.quality,
      cost_per_15_scans_usd: row.cost_usd,
      cost_adjusted_score: meta.cost_adjusted,
      false_positive_rate: meta.fp_rate,
      swc_detection,
    };
  });

  // Sort by detection rate desc
  leaderboard.sort((a, b) => b.detection_rate - a.detection_rate);

  const allModels = presentation.summary_rows.map(r => r.model);
  const byDetection = [...allModels].sort(
    (a, b) => summaryMap[b].detection - summaryMap[a].detection
  );
  const byQuality = [...allModels].sort(
    (a, b) => summaryMap[b].quality - summaryMap[a].quality
  );
  const byValue = [...allModels].sort(
    (a, b) => summaryMap[b].value - summaryMap[a].value
  );
  const byFP = [...allModels].sort(
    (a, b) => (MODEL_META[a]?.fp_rate ?? 1) - (MODEL_META[b]?.fp_rate ?? 1)
  );

  const filteredSWC = swcFilter
    ? Object.fromEntries(Object.entries(SWC_REGISTRY).filter(([id]) => id.toLowerCase() === swcFilter.toLowerCase()))
    : SWC_REGISTRY;

  return {
    meta: {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      total_contracts: presentation.total_contracts,
      total_swc_classes: Object.keys(SWC_REGISTRY).length,
      docs: "https://github.com/mzunain/sc-audit-benchmark#api",
    },
    leaderboard,
    swc_registry: filteredSWC,
    winners: {
      highest_detection: MODEL_META[byDetection[0]]?.name ?? byDetection[0],
      highest_quality:   MODEL_META[byQuality[0]]?.name ?? byQuality[0],
      best_value:        MODEL_META[byValue[0]]?.name ?? byValue[0],
      lowest_fp_rate:    MODEL_META[byFP[0]]?.name ?? byFP[0],
    },
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const modelFilter = searchParams.get("model") ?? undefined;
    const swcFilter   = searchParams.get("swc") ?? undefined;
    const format      = searchParams.get("format") ?? "json";

    const data = buildBenchmark(modelFilter, swcFilter);

    if (format === "csv") {
      const rows = [
        ["model_id", "name", "provider", "detection_rate", "quality_score", "cost_per_15_scans_usd", "false_positive_rate", "cost_adjusted_score"].join(","),
        ...data.leaderboard.map(m =>
          [m.id, `"${m.name}"`, `"${m.provider}"`, m.detection_rate, m.quality_score, m.cost_per_15_scans_usd, m.false_positive_rate, m.cost_adjusted_score].join(",")
        ),
      ].join("\n");

      return new NextResponse(rows, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="sc-benchmark.csv"',
        },
      });
    }

    return NextResponse.json(data, { status: 200, headers: corsHeaders() });
  } catch (err) {
    console.error("[/api/benchmark] error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: String(err) },
      { status: 500, headers: corsHeaders() }
    );
  }
}
