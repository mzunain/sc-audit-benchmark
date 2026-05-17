#!/usr/bin/env node
// Copies fresh benchmark output into dashboard/public/data so the deployed
// dashboard has data to render without depending on parent-dir files at runtime.
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

ensureDir(path.join(PUBLIC_DATA, "judgments"));
ensureDir(path.join(PUBLIC_DATA, "contracts"));

const presentation = path.join(REPO_ROOT, "output", "presentation_data.json");
if (fs.existsSync(presentation)) {
  copy(presentation, path.join(PUBLIC_DATA, "presentation.json"));
} else {
  console.warn("  output/presentation_data.json not found — run `python src/main.py` first.");
  process.exit(0);
}

const judgmentsDir = path.join(REPO_ROOT, "output", "judge_scores");
if (fs.existsSync(judgmentsDir)) {
  for (const f of fs.readdirSync(judgmentsDir)) {
    if (f.endsWith("_judgments.json")) {
      copy(path.join(judgmentsDir, f), path.join(PUBLIC_DATA, "judgments", f));
    }
  }
}

const contractsDir = path.join(REPO_ROOT, "data", "generated_contracts");
if (fs.existsSync(contractsDir)) {
  for (const f of fs.readdirSync(contractsDir)) {
    if (f.endsWith("_metadata.json")) {
      copy(path.join(contractsDir, f), path.join(PUBLIC_DATA, "contracts", f));
    }
  }
}

console.log("Done.");
