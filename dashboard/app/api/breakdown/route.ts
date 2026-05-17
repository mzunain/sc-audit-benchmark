import { NextResponse } from "next/server";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(process.cwd(), "..", "output", "judge_scores");
const CONTRACTS_DIR = join(process.cwd(), "..", "data", "generated_contracts");

export async function GET() {
  try {
    // Build contract_id -> swc_id map from generator metadata
    const groundTruth: Record<string, { swc_id: string; name: string }> = {};
    for (const f of readdirSync(CONTRACTS_DIR)) {
      if (!f.endsWith("_metadata.json")) continue;
      const meta = JSON.parse(readFileSync(join(CONTRACTS_DIR, f), "utf-8"));
      groundTruth[meta.contract_id] = {
        swc_id: meta.vulnerability.swc_id,
        name: meta.vulnerability.name,
      };
    }

    // For each model, aggregate per-SWC detection rates
    const breakdown: Record<string, Record<string, { found: number; total: number }>> = {};

    for (const f of readdirSync(OUTPUT_DIR)) {
      if (!f.endsWith("_judgments.json")) continue;
      const data = JSON.parse(readFileSync(join(OUTPUT_DIR, f), "utf-8"));
      const model = data.model;
      breakdown[model] = {};

      for (const j of data.judgments) {
        const gt = groundTruth[j.contract_id];
        if (!gt) continue;
        const swc = gt.swc_id;
        if (!breakdown[model][swc]) breakdown[model][swc] = { found: 0, total: 0 };
        breakdown[model][swc].total += 1;
        if (j.judgment?.found_correct_vuln) breakdown[model][swc].found += 1;
      }
    }

    // Build sorted SWC list (union across models)
    const swcSet = new Set<string>();
    for (const m of Object.values(breakdown)) {
      for (const s of Object.keys(m)) swcSet.add(s);
    }
    const swcList = Array.from(swcSet).sort();

    return NextResponse.json({
      models: Object.keys(breakdown),
      swc_ids: swcList,
      swc_names: Object.fromEntries(
        swcList.map((s) => {
          const sample = Object.values(groundTruth).find((g) => g.swc_id === s);
          return [s, sample?.name ?? s];
        })
      ),
      breakdown,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
