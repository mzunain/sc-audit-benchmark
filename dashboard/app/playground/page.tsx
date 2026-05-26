"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Code2,
  Download,
  Eye,
  FileCode2,
  FileJson,
  FileText,
  Gauge,
  History,
  Layers,
  Loader2,
  Lock,
  Play,
  Printer,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AuditMode = "triage" | "deep" | "exploit";

const EXAMPLES = [
  {
    label: "Reentrancy",
    risk: "DeFi vault holding user deposits",
    code: `// SPDX-License-Identifier: MIT
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
`,
  },
  {
    label: "Unchecked call",
    risk: "Treasury payout contract",
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Payouts {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function distribute(address payable recipient, uint256 amount) external {
        require(msg.sender == owner, "only owner");
        recipient.call{value: amount}("");
    }

    receive() external payable {}
}
`,
  },
  {
    label: "Access control",
    risk: "Upgradeable protocol admin module",
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UpgradeGate {
    address public implementation;
    bool public initialized;

    function initialize(address firstImplementation) external {
        require(!initialized, "initialized");
        implementation = firstImplementation;
        initialized = true;
    }

    function upgradeTo(address nextImplementation) external {
        implementation = nextImplementation;
    }
}
`,
  },
  {
    label: "Ordering risk",
    risk: "Token allowance workflow",
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AllowanceBook {
    mapping(address => mapping(address => uint256)) public allowance;

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
    }

    function spendFrom(address from, uint256 amount) external {
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
    }
}
`,
  },
];

const MODE_COPY: Record<AuditMode, { label: string; detail: string; tone: string }> = {
  triage: {
    label: "Triage",
    detail: "Fast signal, demo-ready findings, low handoff noise.",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-950",
  },
  deep: {
    label: "Deep",
    detail: "Cross-function reasoning across roles and state transitions.",
    tone: "border-cyan-300 bg-cyan-50 text-cyan-950",
  },
  exploit: {
    label: "Exploit",
    detail: "Attacker path, prerequisites, blast radius, and proof narrative.",
    tone: "border-rose-300 bg-rose-50 text-rose-950",
  },
};

const FOCUS_OPTIONS = [
  "Reentrancy",
  "Access control",
  "Unchecked calls",
  "Arithmetic",
  "Delegatecall",
  "MEV / ordering",
  "Gas DoS",
  "Upgradeability",
];

const MODEL_OPTIONS = [
  {
    group: "Recommended NIM models",
    options: [
      ["nim:qwen/qwen3-coder-480b-a35b-instruct", "Qwen3-Coder 480B", "Best benchmark value"],
      ["nim:meta/llama-3.3-70b-instruct", "Llama 3.3 70B", "Stable fallback"],
      ["nim:minimaxai/minimax-m2.7", "MiniMax M2.7", "Second reviewer"],
      ["nim:zai-org/glm-4.5", "GLM-4.5", "Hybrid reasoning"],
    ],
  },
  {
    group: "Reasoning and paid options",
    options: [
      ["nim:stepfun-ai/step-3.5-flash", "Step 3.5 Flash", "Reasoning baseline"],
      ["nim:bytedance/seed-oss-36b-instruct", "Seed-OSS 36B", "Judge-style reasoning"],
      ["anthropic/claude-3.5-sonnet", "Claude 3.5 Sonnet", "OpenRouter paid"],
      ["openai/gpt-4o-mini", "GPT-4o Mini", "OpenRouter paid"],
      ["google/gemini-flash-1.5", "Gemini 1.5 Flash", "OpenRouter paid"],
    ],
  },
];

const MODEL_LABEL = Object.fromEntries(
  MODEL_OPTIONS.flatMap((group) => group.options.map(([value, label]) => [value, label]))
);

interface ScanResult {
  model_requested?: string;
  model_used?: string;
  used_fallback?: boolean;
  audit_mode?: string;
  focus_areas?: string[];
  risk_profile?: string;
  report?: Record<string, unknown> | null;
  usage?: Record<string, unknown> | null;
  attempts?: { model: string; error: string; status: number }[];
  rate_limit?: { limit: number; remaining: number; reset_at: string };
  error?: string;
}

type ReportRecord = Record<string, unknown>;

interface ScanHistoryEntry {
  id: string;
  createdAt: string;
  modelRequested: string;
  modelUsed?: string;
  auditMode: AuditMode;
  riskProfile: string;
  focusAreas: string[];
  codeDigest: string;
  codeSnippet: string;
  lineCount: number;
  findingCount: number;
  highSeverityCount: number;
  riskRating: string;
  result: ScanResult;
}

function isRecord(value: unknown): value is ReportRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown, fallback = "Not provided") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function arrayText(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function findings(report?: Record<string, unknown> | null) {
  const raw = report?.vulnerabilities_found;
  return Array.isArray(raw) ? raw.filter(isRecord) : [];
}

function riskRating(report?: Record<string, unknown> | null) {
  return textValue(report?.risk_rating, report ? "Unrated" : "No report");
}

function highSeverityCount(items: ReportRecord[]) {
  return items.filter((item) => {
    const severity = textValue(item.severity, "").toLowerCase();
    return severity.includes("critical") || severity.includes("high");
  }).length;
}

function severityTone(severity: string) {
  const normalized = severity.toLowerCase();
  if (normalized.includes("critical")) return "bg-rose-700 text-white ring-rose-700";
  if (normalized.includes("high")) return "bg-rose-100 text-rose-800 ring-rose-200";
  if (normalized.includes("medium")) return "bg-amber-100 text-amber-800 ring-amber-200";
  if (normalized.includes("low")) return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  return "bg-stone-100 text-stone-700 ring-stone-200";
}

function codeInsights(code: string) {
  const lines = code.trim() ? code.split(/\r?\n/).length : 0;
  const chars = code.length;
  const contracts = (code.match(/\b(contract|library|interface)\s+\w+/g) || []).length;
  const compiler = code.match(/pragma\s+solidity\s+([^;]+);/)?.[1]?.trim() ?? "Unknown";
  const payable = (code.match(/\bpayable\b/g) || []).length;
  const externalCalls = (code.match(/\.call\s*\{|\.call\s*\(/g) || []).length;
  return { lines, chars, contracts, compiler, payable, externalCalls };
}

function simpleDigest(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildMarkdownPacket(entry: ScanHistoryEntry) {
  const report = entry.result.report;
  const reportFindings = findings(report);
  const assumptions = arrayText(report?.assumptions);
  const nextSteps = arrayText(report?.next_steps);
  const lines = [
    "# SC Audit Playground Report",
    "",
    `Generated: ${new Date(entry.createdAt).toLocaleString()}`,
    `Requested model: ${MODEL_LABEL[entry.modelRequested] ?? entry.modelRequested}`,
    `Used model: ${entry.modelUsed ? MODEL_LABEL[entry.modelUsed] ?? entry.modelUsed : "Not completed"}`,
    `Audit mode: ${entry.auditMode}`,
    `Risk profile: ${entry.riskProfile}`,
    `Focus areas: ${entry.focusAreas.join(", ") || "All"}`,
    `Contract digest: ${entry.codeDigest}`,
    `Lines scanned: ${entry.lineCount}`,
    "",
    "## Summary",
    "",
    textValue(report?.summary, entry.result.error ?? "No summary returned."),
    "",
    `Risk rating: ${entry.riskRating}`,
    `Findings: ${entry.findingCount}`,
    `High/Critical findings: ${entry.highSeverityCount}`,
    "",
    "## Findings",
    "",
  ];

  if (reportFindings.length === 0) {
    lines.push("No vulnerabilities were reported by the selected scanner.", "");
  } else {
    reportFindings.forEach((finding, index) => {
      lines.push(
        `### ${index + 1}. ${textValue(finding.name, "Unnamed finding")}`,
        "",
        `- SWC: ${textValue(finding.swc_id, "SWC-???")}`,
        `- Severity: ${textValue(finding.severity, "Unknown")}`,
        `- Confidence: ${textValue(finding.confidence, "Unknown")}`,
        `- Location: ${textValue(finding.location)}`,
        `- Impact: ${textValue(finding.impact)}`,
        `- Exploit scenario: ${textValue(finding.exploit_scenario)}`,
        `- Recommendation: ${textValue(finding.recommendation)}`,
        "",
        textValue(finding.explanation),
        ""
      );
    });
  }

  if (nextSteps.length > 0) {
    lines.push("## Next Steps", "", ...nextSteps.map((step) => `- ${step}`), "");
  }

  if (assumptions.length > 0) {
    lines.push("## Assumptions", "", ...assumptions.map((assumption) => `- ${assumption}`), "");
  }

  lines.push("## Contract Snippet", "", "```solidity", entry.codeSnippet, "```", "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// File Upload Component
// ---------------------------------------------------------------------------

interface UploadedFile {
  name: string;
  size: number;
  content: string;
}

function FileUploadZone({
  onFile,
  uploadedFile,
  onClear,
}: {
  onFile: (file: UploadedFile) => void;
  uploadedFile: UploadedFile | null;
  onClear: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setError(null);
    if (!file.name.endsWith(".sol")) {
      setError("Only .sol (Solidity) files are supported.");
      return;
    }
    if (file.size > 256_000) {
      setError("File is too large (max 256 KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onFile({ name: file.name, size: file.size, content });
    };
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  if (uploadedFile) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode2 className="h-4 w-4 shrink-0 text-emerald-700" />
          <span className="truncate font-semibold text-emerald-900">{uploadedFile.name}</span>
          <span className="shrink-0 text-emerald-600 text-xs">({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
        </div>
        <button
          onClick={onClear}
          className="shrink-0 rounded-md p-1 text-emerald-700 hover:bg-emerald-200 transition"
          aria-label="Clear uploaded file"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={[
          "cursor-pointer rounded-md border-2 border-dashed px-4 py-4 text-center text-sm transition",
          dragOver
            ? "border-emerald-400 bg-emerald-50"
            : "border-stone-600 hover:border-emerald-400 hover:bg-emerald-50/20",
        ].join(" ")}
      >
        <Upload className="mx-auto h-5 w-5 text-stone-400 mb-2" />
        <span className="text-stone-300 font-medium">Drop a .sol file or click to browse</span>
        <span className="block mt-1 text-xs text-stone-500">Max 256 KB · Solidity only</span>
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".sol"
        onChange={onInputChange}
        className="hidden"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Playground() {
  const [contractCode, setContractCode] = useState(EXAMPLES[0].code);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("nim:qwen/qwen3-coder-480b-a35b-instruct");
  const [enableFallback, setEnableFallback] = useState(true);
  const [auditMode, setAuditMode] = useState<AuditMode>("triage");
  const [riskProfile, setRiskProfile] = useState(EXAMPLES[0].risk);
  const [focusAreas, setFocusAreas] = useState<string[]>(["Reentrancy", "Access control", "Unchecked calls"]);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const insights = useMemo(() => codeInsights(contractCode), [contractCode]);
  const report = scanResult?.report ?? null;
  const reportFindings = findings(report);
  const currentHighSeverityCount = highSeverityCount(reportFindings);
  const nextSteps = arrayText(report?.next_steps);
  const assumptions = arrayText(report?.assumptions);
  const requestedLabel = scanResult?.model_requested ? MODEL_LABEL[scanResult.model_requested] : null;
  const usedLabel = scanResult?.model_used ? MODEL_LABEL[scanResult.model_used] : null;
  const currentHistoryEntry = history.find((entry) => entry.result === scanResult);
  const compareEntries = compareIds
    .map((id) => history.find((entry) => entry.id === id))
    .filter((entry): entry is ScanHistoryEntry => Boolean(entry));
  const codeDigest = simpleDigest(contractCode);
  const activeMode = MODE_COPY[auditMode];
  const sizeReady = insights.chars <= 24000;
  const runDisabled = loading || !contractCode.trim() || !sizeReady;
  const reportRisk = riskRating(report);
  const activeExample = EXAMPLES.find((example) => example.code === contractCode);

  const intakeStats = [
    { label: "Lines", value: insights.lines, icon: FileCode2, tone: "text-cyan-600" },
    { label: "Compiler", value: insights.compiler, icon: Settings2, tone: "text-stone-600" },
    { label: "Calls", value: insights.externalCalls, icon: Activity, tone: "text-rose-600" },
    { label: "Digest", value: codeDigest.slice(0, 8), icon: Lock, tone: "text-emerald-600" },
  ];

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("sc-audit-playground-history");
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      setHistory([]);
    }
  }, []);

  const persistHistory = (nextHistory: ScanHistoryEntry[]) => {
    setHistory(nextHistory);
    try {
      window.localStorage.setItem("sc-audit-playground-history", JSON.stringify(nextHistory));
    } catch {}
  };

  const createHistoryEntry = (result: ScanResult): ScanHistoryEntry => {
    const resultReport = result.report ?? null;
    const resultFindings = findings(resultReport);
    return {
      id: `${Date.now()}-${simpleDigest(contractCode).slice(0, 6)}`,
      createdAt: new Date().toISOString(),
      modelRequested: model,
      modelUsed: result.model_used,
      auditMode,
      riskProfile,
      focusAreas,
      codeDigest: simpleDigest(contractCode),
      codeSnippet: contractCode.trim().slice(0, 1200),
      lineCount: insights.lines,
      findingCount: resultFindings.length,
      highSeverityCount: highSeverityCount(resultFindings),
      riskRating: riskRating(resultReport),
      result,
    };
  };

  const saveHistoryEntry = (entry: ScanHistoryEntry) => {
    const nextHistory = [entry, ...history].slice(0, 12);
    persistHistory(nextHistory);
  };

  const runScan = async () => {
    setLoading(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: contractCode,
          model,
          enableFallback,
          auditMode,
          riskProfile,
          focusAreas,
        }),
      });
      const data = await res.json();
      setScanResult(data);
      saveHistoryEntry(createHistoryEntry(data));
    } catch (e) {
      const failedResult = { error: String(e) };
      setScanResult(failedResult);
      saveHistoryEntry(createHistoryEntry(failedResult));
    } finally {
      setLoading(false);
    }
  };

  const toggleFocus = (area: string) => {
    setFocusAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area]
    );
  };

  const loadExample = (example: (typeof EXAMPLES)[number]) => {
    setContractCode(example.code);
    setRiskProfile(example.risk);
    setScanResult(null);
    setUploadedFile(null);
  };

  const handleUploadedFile = (file: UploadedFile) => {
    setUploadedFile(file);
    setContractCode(file.content);
    setScanResult(null);
    // Auto-set risk profile from filename (strip .sol)
    setRiskProfile(file.name.replace(/\.sol$/i, "").replace(/[-_]/g, " "));
  };

  const clearUploadedFile = () => {
    setUploadedFile(null);
    setContractCode(EXAMPLES[0].code);
    setRiskProfile(EXAMPLES[0].risk);
    setScanResult(null);
  };

  const viewHistoryEntry = (entry: ScanHistoryEntry) => {
    setScanResult(entry.result);
    setModel(entry.modelRequested);
    setAuditMode(entry.auditMode);
    setRiskProfile(entry.riskProfile);
    setFocusAreas(entry.focusAreas);
  };

  const toggleCompare = (id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return [id, ...current].slice(0, 2);
    });
  };

  const clearHistory = () => {
    setCompareIds([]);
    persistHistory([]);
  };

  const exportCurrentJson = () => {
    const entry = currentHistoryEntry ?? createHistoryEntry(scanResult ?? { error: "No scan selected" });
    downloadText(`sc-audit-report-${entry.codeDigest}.json`, JSON.stringify(entry, null, 2), "application/json");
  };

  const exportCurrentMarkdown = () => {
    const entry = currentHistoryEntry ?? createHistoryEntry(scanResult ?? { error: "No scan selected" });
    downloadText(`sc-audit-report-${entry.codeDigest}.md`, buildMarkdownPacket(entry), "text/markdown");
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f8fffb_0%,#f8faf9_34%,#f6f4f1_100%)]">
      <section className="border-b border-stone-200 bg-white/80">
        <div className="section-shell py-8 lg:py-10">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                  Live audit workbench
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 ring-1 ring-cyan-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Fallback {enableFallback ? "armed" : "off"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                  <Gauge className="h-3.5 w-3.5" />
                  {activeMode.label} mode
                </span>
              </div>
              <h1 className="mt-5 max-w-5xl text-4xl font-semibold leading-[1.05] tracking-tight text-stone-950 sm:text-5xl lg:text-6xl">
                Solidity scan command center.
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-stone-600">
                Route contracts through benchmark-backed models, capture fallback behavior, and export a clean audit packet from the same screen.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-stone-800 bg-stone-950 text-white shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Terminal className="h-4 w-4 text-emerald-300" />
                  Scan readiness
                </div>
                <span className={["rounded-full px-2.5 py-1 text-xs font-semibold", sizeReady ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200"].join(" ")}>
                  {sizeReady ? "Ready" : "Over limit"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-white/10">
                {intakeStats.map(({ label, value, icon: Icon, tone }) => (
                  <div key={label} className="bg-stone-950 p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                      <Icon className={`h-3.5 w-3.5 ${tone}`} />
                      {label}
                    </div>
                    <div className="mt-2 truncate font-mono text-lg font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell py-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.03fr)_minmax(420px,0.97fr)] xl:items-start">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-950 px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-emerald-300" />
                  <h2 className="text-sm font-semibold">Contract intake</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((example) => {
                    const active = activeExample?.label === example.label;
                    return (
                      <button
                        key={example.label}
                        onClick={() => loadExample(example)}
                        className={[
                          "focus-ring rounded-md px-3 py-1.5 text-xs font-semibold transition",
                          active
                            ? "bg-emerald-300 text-stone-950"
                            : "bg-white/10 text-stone-200 hover:bg-white/15",
                        ].join(" ")}
                      >
                        {example.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#0c0d0d] p-3 sm:p-4">
                {/* File upload zone */}
                <div className="mb-3">
                  <FileUploadZone
                    onFile={handleUploadedFile}
                    uploadedFile={uploadedFile}
                    onClear={clearUploadedFile}
                  />
                </div>

                <div className="mb-3 flex items-center justify-between gap-3 text-xs text-stone-400">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-2 font-mono">{uploadedFile ? uploadedFile.name : "contract.sol"}</span>
                  </div>
                  <span className="font-mono">{insights.chars.toLocaleString()} chars</span>
                </div>
                <textarea
                  value={contractCode}
                  onChange={(e) => setContractCode(e.target.value)}
                  className="focus-ring h-[520px] w-full resize-y rounded-md border border-white/10 bg-black p-4 font-mono text-[13px] leading-6 text-emerald-50 shadow-inner outline-none placeholder:text-stone-500"
                  placeholder="Paste Solidity code here..."
                  spellCheck={false}
                />
              </div>

              <div className="grid gap-px bg-stone-200 sm:grid-cols-4">
                {[
                  ["Contracts", insights.contracts],
                  ["Payable refs", insights.payable],
                  ["External calls", insights.externalCalls],
                  ["Size gate", sizeReady ? "Ready" : "Too long"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white px-4 py-3">
                    <div className="metric-label">{label}</div>
                    <div className={["mt-1 text-sm font-semibold tabular-nums", label === "Size gate" && !sizeReady ? "text-rose-700" : "text-stone-950"].join(" ")}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">Audit strategy</div>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">Model route and scope</h2>
                </div>
                <label className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-700">
                  <input
                    type="checkbox"
                    checked={enableFallback}
                    onChange={(e) => setEnableFallback(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Auto fallback
                </label>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {(Object.keys(MODE_COPY) as AuditMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setAuditMode(mode)}
                    className={[
                      "focus-ring rounded-lg border p-4 text-left transition",
                      auditMode === mode
                        ? MODE_COPY[mode].tone
                        : "border-stone-200 bg-white text-stone-700 hover:border-emerald-300 hover:bg-emerald-50/40",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{MODE_COPY[mode].label}</span>
                      {auditMode === mode && <CheckCircle2 className="h-4 w-4" />}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-stone-600">{MODE_COPY[mode].detail}</p>
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Model</span>
                  <Select
                    value={model}
                    onValueChange={setModel}
                  >
                    <SelectTrigger aria-label="Choose scanner model" className="mt-2">
                      <SelectValue placeholder="Choose scanner model" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {MODEL_OPTIONS.map((group, groupIndex) => (
                        <SelectGroup key={group.group}>
                          {groupIndex > 0 && <SelectSeparator />}
                          <SelectLabel>{group.group}</SelectLabel>
                          {group.options.map(([value, label, note]) => (
                            <SelectItem key={value} value={value}>
                              <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="truncate font-semibold">{label}</span>
                                <span className="truncate text-xs text-stone-500">{note}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Risk profile</span>
                  <input
                    value={riskProfile}
                    onChange={(e) => setRiskProfile(e.target.value)}
                    className="focus-ring mt-2 w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800"
                    placeholder="Example: DeFi vault holding user deposits"
                  />
                </label>
              </div>

              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold text-stone-700">Focus areas</div>
                <div className="flex flex-wrap gap-2">
                  {FOCUS_OPTIONS.map((area) => {
                    const active = focusAreas.includes(area);
                    return (
                      <button
                        key={area}
                        onClick={() => toggleFocus(area)}
                        className={[
                          "focus-ring rounded-full px-3 py-1.5 text-xs font-semibold transition",
                          active
                            ? "bg-stone-950 text-white"
                            : "bg-white text-stone-700 ring-1 ring-stone-200 hover:ring-emerald-300",
                        ].join(" ")}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-stone-950 text-white">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-emerald-300" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-stone-950">{MODEL_LABEL[model] ?? model}</div>
                    <div className="truncate text-xs text-stone-500">{focusAreas.length || "All"} focus areas x {activeMode.label.toLowerCase()} route</div>
                  </div>
                </div>
                <button
                  onClick={runScan}
                  disabled={runDisabled}
                  className="focus-ring inline-flex items-center gap-2 rounded-md bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {loading ? "Scanning" : "Run scan"}
                </button>
              </div>
            </section>
          </div>

          <div className="space-y-6 xl:sticky xl:top-24">
            <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-200 bg-stone-950 px-5 py-4 text-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      <ShieldAlert className="h-4 w-4" />
                      Scanner report
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Audit packet</h2>
                  </div>
                  <span className={["rounded-full px-3 py-1 text-xs font-semibold ring-1", report ? severityTone(reportRisk) : "bg-white/10 text-stone-200 ring-white/15"].join(" ")}>
                    {report ? reportRisk : loading ? "Scanning" : "Awaiting scan"}
                  </span>
                </div>
              </div>

              <div className="p-5">
                {!scanResult && !loading && (
                  <div className="rounded-lg border border-dashed border-stone-300 bg-[linear-gradient(135deg,#fafaf9,#ecfeff)] p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-stone-950 text-white">
                        <Activity className="h-5 w-5 text-emerald-300" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-stone-950">No scan selected</div>
                        <div className="mt-1 text-sm text-stone-500">Report, trace, export packet, and history will render here.</div>
                      </div>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {["Summary", "Findings", "Handoff"].map((item, index) => (
                        <div key={item} className="rounded-md bg-white/75 p-3 ring-1 ring-stone-200">
                          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Step {index + 1}</div>
                          <div className="mt-1 text-sm font-semibold text-stone-950">{item}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-cyan-950">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Provider call in progress
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="h-3 w-5/6 rounded bg-cyan-100" />
                      <div className="h-3 w-2/3 rounded bg-cyan-100" />
                      <div className="h-3 w-4/5 rounded bg-cyan-100" />
                    </div>
                  </div>
                )}

                {scanResult?.error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                      <AlertTriangle className="h-4 w-4" />
                      Request failed
                    </div>
                    <p className="mt-2 text-sm leading-6 text-stone-700">{scanResult.error}</p>
                  </div>
                )}

                {report && (
                  <div className="space-y-5">
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {usedLabel ?? scanResult?.model_used}
                        </span>
                        {scanResult?.used_fallback && requestedLabel && (
                          <>
                            <ArrowRight className="h-3.5 w-3.5 text-stone-400" />
                            <span className="font-semibold text-amber-700">Fallback from {requestedLabel}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-stone-800">{textValue(report.summary, "No summary returned.")}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        ["Findings", reportFindings.length, "text-stone-950"],
                        ["High+", currentHighSeverityCount, "text-rose-700"],
                        ["Rate left", scanResult?.rate_limit ? `${scanResult.rate_limit.remaining}/${scanResult.rate_limit.limit}` : "n/a", "text-stone-950"],
                      ].map(([label, value, tone]) => (
                        <div key={label} className="rounded-md border border-stone-200 bg-white p-3">
                          <div className="metric-label">{label}</div>
                          <div className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={exportCurrentJson}
                        className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-emerald-300 hover:text-stone-950"
                      >
                        <FileJson className="h-4 w-4" />
                        JSON
                      </button>
                      <button
                        onClick={exportCurrentMarkdown}
                        className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-emerald-300 hover:text-stone-950"
                      >
                        <FileText className="h-4 w-4" />
                        Markdown
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="focus-ring inline-flex items-center gap-2 rounded-md bg-stone-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-stone-800"
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-stone-950">Findings</h3>
                        <span className="text-xs font-medium text-stone-500">{reportFindings.length} reported</span>
                      </div>
                      {reportFindings.length === 0 && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                          The selected scanner did not report vulnerabilities. Treat this as model output, not proof of safety.
                        </div>
                      )}
                      {reportFindings.map((finding, index) => {
                        const severity = textValue(finding.severity, "Unknown");
                        return (
                          <article key={index} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                            <div className="flex border-b border-stone-200">
                              <div className={["w-1.5", severity.toLowerCase().includes("high") || severity.toLowerCase().includes("critical") ? "bg-rose-500" : "bg-amber-400"].join(" ")} />
                              <div className="min-w-0 flex-1 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="font-mono text-xs font-semibold text-stone-500">{textValue(finding.swc_id, "SWC-???")}</div>
                                    <h4 className="mt-1 text-lg font-semibold text-stone-950">{textValue(finding.name, `Finding ${index + 1}`)}</h4>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityTone(severity)}`}>
                                      {severity}
                                    </span>
                                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
                                      {textValue(finding.confidence, "Unknown")}
                                    </span>
                                  </div>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-stone-700">{textValue(finding.explanation)}</p>
                              </div>
                            </div>
                            <div className="grid gap-px bg-stone-200 md:grid-cols-2">
                              <div className="bg-white p-4">
                                <div className="metric-label">Location</div>
                                <p className="mt-2 text-sm leading-6 text-stone-800">{textValue(finding.location)}</p>
                              </div>
                              <div className="bg-white p-4">
                                <div className="metric-label">Impact</div>
                                <p className="mt-2 text-sm leading-6 text-stone-800">{textValue(finding.impact)}</p>
                              </div>
                              <div className="bg-rose-50 p-4">
                                <div className="metric-label text-rose-700">Exploit path</div>
                                <p className="mt-2 text-sm leading-6 text-stone-800">{textValue(finding.exploit_scenario)}</p>
                              </div>
                              <div className="bg-emerald-50 p-4">
                                <div className="metric-label text-emerald-700">Fix</div>
                                <p className="mt-2 text-sm leading-6 text-stone-800">{textValue(finding.recommendation)}</p>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {(nextSteps.length > 0 || assumptions.length > 0) && (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {nextSteps.length > 0 && (
                          <section className="rounded-lg border border-stone-200 bg-white p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              Next steps
                            </div>
                            <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
                              {nextSteps.map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ul>
                          </section>
                        )}
                        {assumptions.length > 0 && (
                          <section className="rounded-lg border border-stone-200 bg-white p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                              <Layers className="h-4 w-4 text-cyan-600" />
                              Assumptions
                            </div>
                            <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
                              {assumptions.map((assumption) => (
                                <li key={assumption}>{assumption}</li>
                              ))}
                            </ul>
                          </section>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                  <RefreshCw className="h-4 w-4 text-amber-600" />
                  Provider trace
                </div>
                {scanResult?.attempts && scanResult.attempts.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {scanResult.attempts.map((attempt) => (
                      <div key={`${attempt.model}-${attempt.status}`} className="rounded-md border border-stone-200 p-3 text-xs">
                        <div className="font-semibold text-stone-800">{MODEL_LABEL[attempt.model] ?? attempt.model}</div>
                        <div className="mt-1 text-stone-500">HTTP {attempt.status}: {attempt.error}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-stone-600">Primary route has no recorded fallback attempts.</p>
                )}
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                  <Download className="h-4 w-4 text-cyan-600" />
                  Raw payload
                </div>
                {scanResult?.usage && (
                  <p className="mt-3 truncate text-xs text-stone-500">Usage: {JSON.stringify(scanResult.usage)}</p>
                )}
                <details className="mt-3">
                  <summary className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700">
                    <Eye className="h-4 w-4" />
                    JSON
                  </summary>
                  <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-stone-950 p-3 text-xs leading-5 text-emerald-50">
                    {scanResult ? JSON.stringify(scanResult, null, 2) : "No response yet."}
                  </pre>
                </details>
              </div>
            </section>
          </div>
        </div>

        <section className="mt-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                <History className="h-4 w-4 text-stone-600" />
                Scan history
              </div>
              <p className="mt-1 text-sm text-stone-500">Local browser entries store a short source snippet and digest.</p>
            </div>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-rose-300 hover:text-rose-700"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-500">
              Completed scans will appear here.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {history.map((entry) => {
                const selected = compareIds.includes(entry.id);
                return (
                  <article key={entry.id} className="rounded-lg border border-stone-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-stone-500">
                          {new Date(entry.createdAt).toLocaleString()} - digest {entry.codeDigest}
                        </div>
                        <h3 className="mt-1 truncate text-sm font-semibold text-stone-950">
                          {MODEL_LABEL[entry.modelUsed ?? entry.modelRequested] ?? entry.modelUsed ?? entry.modelRequested}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-stone-500">
                          {entry.auditMode} - {entry.riskProfile} - {entry.lineCount} lines
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityTone(entry.riskRating)}`}>
                          {entry.riskRating}
                        </span>
                        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
                          {entry.findingCount} findings
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => viewHistoryEntry(entry)}
                        className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:border-emerald-300 hover:text-stone-950"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                      <button
                        onClick={() => toggleCompare(entry.id)}
                        className={[
                          "focus-ring inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition",
                          selected
                            ? "bg-stone-950 text-white"
                            : "border border-stone-200 bg-white text-stone-700 hover:border-emerald-300 hover:text-stone-950",
                        ].join(" ")}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        {selected ? "Selected" : "Compare"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {compareEntries.length > 0 && (
            <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-stone-950">Comparison</h3>
                <span className="text-xs text-stone-500">Up to two scans</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {compareEntries.map((entry) => (
                  <div key={entry.id} className="rounded-md bg-white p-3 ring-1 ring-stone-200">
                    <div className="text-xs font-medium text-stone-500">{new Date(entry.createdAt).toLocaleString()}</div>
                    <div className="mt-1 text-sm font-semibold text-stone-950">
                      {MODEL_LABEL[entry.modelUsed ?? entry.modelRequested] ?? entry.modelUsed ?? entry.modelRequested}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="metric-label">Risk</div>
                        <div className="mt-1 font-semibold text-stone-950">{entry.riskRating}</div>
                      </div>
                      <div>
                        <div className="metric-label">Findings</div>
                        <div className="mt-1 font-semibold text-stone-950">{entry.findingCount}</div>
                      </div>
                      <div>
                        <div className="metric-label">High+</div>
                        <div className="mt-1 font-semibold text-rose-700">{entry.highSeverityCount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
