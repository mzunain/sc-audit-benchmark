#!/usr/bin/env node
// Copies fresh benchmark output into dashboard/public/data so the deployed
// dashboard has data to render. Files in public/ are served as static assets
// by Vercel, so the components fetch them directly — no API route needed.
// Run after the Python pipeline finishes.

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC_DATA = path.join(__dirname, "..", "public", "data");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copy(src, dst) {
  fs.copyFileSync(src, dst);
  console.log("  ", path.relative(REPO_ROOT, src), "→", path.relative(REPO_ROOT, dst));
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

ensureDir(path.join(PUBLIC_DATA, "judgments"));
ensureDir(path.join(PUBLIC_DATA, "contracts"));

const presentation = path.join(REPO_ROOT, "output", "presentation_data.json");
if (!fs.existsSync(presentation)) {
  console.warn("  output/presentation_data.json not found — run `python src/main.py` first.");
  process.exit(0);
}
copy(presentation, path.join(PUBLIC_DATA, "presentation.json"));

const judgmentsDir = path.join(REPO_ROOT, "output", "judge_scores");
const judgmentFiles = [];
if (fs.existsSync(judgmentsDir)) {
  for (const f of fs.readdirSync(judgmentsDir)) {
    if (f.endsWith("_judgments.json")) {
      const src = path.join(judgmentsDir, f);
      const dst = path.join(PUBLIC_DATA, "judgments", f);
      copy(src, dst);
      judgmentFiles.push(dst);
    }
  }
}

const contractsDir = path.join(REPO_ROOT, "data", "generated_contracts");
const contractMetaFiles = [];
if (fs.existsSync(contractsDir)) {
  for (const f of fs.readdirSync(contractsDir)) {
    if (f.endsWith("_metadata.json")) {
      const src = path.join(contractsDir, f);
      const dst = path.join(PUBLIC_DATA, "contracts", f);
      copy(src, dst);
      contractMetaFiles.push(dst);
    }
  }
}

// Pre-compute the per-vuln breakdown so the breakdown page can also be a
// static fetch instead of an API call.
const groundTruth = {};
for (const f of contractMetaFiles) {
  const meta = readJson(f);
  groundTruth[meta.contract_id] = {
    swc_id: meta.vulnerability.swc_id,
    name: meta.vulnerability.name,
  };
}

const breakdown = {};
for (const f of judgmentFiles) {
  const data = readJson(f);
  const model = data.model;
  breakdown[model] = {};
  for (const j of data.judgments) {
    const gt = groundTruth[j.contract_id];
    if (!gt) continue;
    const swc = gt.swc_id;
    if (!breakdown[model][swc]) breakdown[model][swc] = { found: 0, total: 0 };
    breakdown[model][swc].total += 1;
    if (j.judgment && j.judgment.found_correct_vuln) {
      breakdown[model][swc].found += 1;
    }
  }
}

const swcSet = new Set();
for (const m of Object.values(breakdown)) {
  for (const s of Object.keys(m)) swcSet.add(s);
}
const swcIds = Array.from(swcSet).sort();
const swcNames = Object.fromEntries(
  swcIds.map((s) => {
    const sample = Object.values(groundTruth).find((g) => g.swc_id === s);
    return [s, sample ? sample.name : s];
  })
);

const breakdownOut = path.join(PUBLIC_DATA, "breakdown.json");
fs.writeFileSync(
  breakdownOut,
  JSON.stringify(
    {
      models: Object.keys(breakdown),
      swc_ids: swcIds,
      swc_names: swcNames,
      breakdown,
    },
    null,
    2
  )
);
console.log("   computed", path.relative(REPO_ROOT, breakdownOut));

console.log("Done.");
