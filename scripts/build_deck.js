const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10" x 5.625"
pres.author = "Muhammad Zulqarnain";
pres.title = "SC Audit Benchmark — Pitch";

// Palette — Charcoal minimal with emerald accent
const COLORS = {
  CHARCOAL: "111827",
  CHARCOAL_SOFT: "1F2937",
  WHITE: "FFFFFF",
  CREAM: "F9FAFB",
  EMERALD: "10B981",
  EMERALD_DARK: "059669",
  SLATE: "475569",
  SLATE_MUTED: "94A3B8",
  BORDER: "E2E8F0",
  AMBER_BG: "FEF3C7",
  AMBER_TEXT: "92400E",
  VIOLET_BG: "EDE9FE",
  VIOLET_TEXT: "5B21B6",
  SKY_BG: "DBEAFE",
  SKY_TEXT: "1D4ED8",
};

const FONT_HEADER = "Helvetica Neue";
const FONT_BODY = "Helvetica Neue";
const FONT_MONO = "Menlo";

// ───────────────────────────────────────────────────────────────────────────
// Slide 1 — Title (dark)
// ───────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: COLORS.CHARCOAL };

  // Tiny eyebrow label
  slide.addText("SC AUDIT STUDIO  ·  THAT CRYPTO HACKATHON  ·  TURKU", {
    x: 0.7, y: 0.6, w: 8.6, h: 0.35,
    fontFace: FONT_BODY, fontSize: 10, color: COLORS.EMERALD, bold: true,
    charSpacing: 4, margin: 0,
  });

  // Title
  slide.addText("Generative Solidity", {
    x: 0.7, y: 1.4, w: 8.6, h: 1.0,
    fontFace: FONT_HEADER, fontSize: 52, color: COLORS.WHITE, bold: true,
    margin: 0, valign: "top",
  });
  slide.addText("Vulnerability Benchmark", {
    x: 0.7, y: 2.2, w: 8.6, h: 1.0,
    fontFace: FONT_HEADER, fontSize: 52, color: COLORS.EMERALD, bold: true,
    margin: 0, valign: "top",
  });

  // Subtitle
  slide.addText(
    "A self-renewing audit benchmark for LLMs. Code-tuned open-weight models beat closed reasoning models on Solidity vulnerability detection — at one-tenth the cost.",
    {
      x: 0.7, y: 3.4, w: 8.6, h: 1.1,
      fontFace: FONT_BODY, fontSize: 16, color: COLORS.SLATE_MUTED,
      margin: 0, valign: "top",
    }
  );

  // Authors at bottom
  slide.addText("Muhammad Zulqarnain  ·  Samia", {
    x: 0.7, y: 5.0, w: 8.6, h: 0.4,
    fontFace: FONT_BODY, fontSize: 12, color: COLORS.WHITE, bold: true,
    margin: 0,
  });

  // Right-side emerald accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 9.85, y: 0, w: 0.15, h: 5.625,
    fill: { color: COLORS.EMERALD }, line: { color: COLORS.EMERALD },
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Slide 2 — The problem
// ───────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: COLORS.WHITE };

  slide.addText("The problem", {
    x: 0.7, y: 0.5, w: 8.6, h: 0.7,
    fontFace: FONT_HEADER, fontSize: 32, color: COLORS.CHARCOAL, bold: true,
    margin: 0,
  });

  slide.addText(
    "Audit firms want LLM-assisted Solidity review. The data to choose between models is missing.",
    {
      x: 0.7, y: 1.25, w: 8.6, h: 0.55,
      fontFace: FONT_BODY, fontSize: 16, color: COLORS.SLATE, italic: true,
      margin: 0,
    }
  );

  // Three cards
  const cardY = 2.3, cardH = 2.6, cardW = 2.85, gap = 0.15;
  const cardXs = [0.7, 0.7 + cardW + gap, 0.7 + 2 * (cardW + gap)];
  const cards = [
    {
      label: "PRICING",
      stat: "$3 – $15",
      unit: "per million tokens (Sonnet / GPT-4)",
      body: "Premium closed models are 10× more expensive than open-weight self-hosted alternatives. Choice matters at scale.",
    },
    {
      label: "OVERFITTING",
      stat: "Static",
      unit: "datasets leak into training",
      body: "EVMBench and similar fixed benchmarks quietly become unreliable as new models train on them. Yesterday's leaderboard, tomorrow's noise.",
    },
    {
      label: "CADENCE",
      stat: "Weeks",
      unit: "between major model releases",
      body: "Hand-curated benchmarks can't keep pace with 2025-era release frequency. Audit decisions need data that refreshes with the field.",
    },
  ];

  cards.forEach((c, i) => {
    const x = cardXs[i];
    // Card background
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: cardW, h: cardH,
      fill: { color: COLORS.CREAM }, line: { color: COLORS.BORDER, width: 0.75 },
    });
    // Left accent bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: 0.08, h: cardH,
      fill: { color: COLORS.EMERALD }, line: { color: COLORS.EMERALD },
    });
    // Label
    slide.addText(c.label, {
      x: x + 0.3, y: cardY + 0.25, w: cardW - 0.4, h: 0.3,
      fontFace: FONT_BODY, fontSize: 9, color: COLORS.EMERALD_DARK, bold: true,
      charSpacing: 4, margin: 0,
    });
    // Stat
    slide.addText(c.stat, {
      x: x + 0.3, y: cardY + 0.55, w: cardW - 0.4, h: 0.85,
      fontFace: FONT_HEADER, fontSize: 38, color: COLORS.CHARCOAL, bold: true,
      margin: 0,
    });
    // Unit
    slide.addText(c.unit, {
      x: x + 0.3, y: cardY + 1.4, w: cardW - 0.4, h: 0.4,
      fontFace: FONT_BODY, fontSize: 11, color: COLORS.SLATE, italic: true,
      margin: 0,
    });
    // Body
    slide.addText(c.body, {
      x: x + 0.3, y: cardY + 1.85, w: cardW - 0.4, h: 0.65,
      fontFace: FONT_BODY, fontSize: 11, color: COLORS.SLATE,
      margin: 0, valign: "top",
    });
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Slide 3 — Pipeline
// ───────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: COLORS.WHITE };

  slide.addText("Three LLMs, three jobs", {
    x: 0.7, y: 0.5, w: 8.6, h: 0.7,
    fontFace: FONT_HEADER, fontSize: 32, color: COLORS.CHARCOAL, bold: true,
    margin: 0,
  });

  slide.addText(
    "Each stage uses a different model. The generator and judge are fixed; the scanner is what we measure.",
    {
      x: 0.7, y: 1.25, w: 8.6, h: 0.55,
      fontFace: FONT_BODY, fontSize: 16, color: COLORS.SLATE, italic: true,
      margin: 0,
    }
  );

  // Three stage boxes
  const boxY = 2.3, boxW = 2.7, boxH = 2.5;
  const startX = 0.7;
  const arrowW = 0.3;
  const totalUsed = boxW * 3 + arrowW * 2;
  const spacing = arrowW;
  const xs = [startX, startX + boxW + spacing, startX + 2 * (boxW + spacing)];

  const stages = [
    {
      n: "01",
      title: "Generator",
      role: "Inject a known vulnerability into a clean Solidity contract",
      detail: "Different mutation every run, so no scanner can have memorised it.",
    },
    {
      n: "02",
      title: "Scanner",
      role: "Find the vulnerability in the mutated contract",
      detail: "Three philosophies tested: code-specialist, hybrid, pure reasoning.",
    },
    {
      n: "03",
      title: "Judge",
      role: "Grade each scan against the generator's ground truth",
      detail: "Independent LLM, structured JSON output, deterministic scoring.",
    },
  ];

  stages.forEach((s, i) => {
    const x = xs[i];
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: boxY, w: boxW, h: boxH,
      fill: { color: COLORS.CHARCOAL }, line: { color: COLORS.CHARCOAL },
    });
    // Stage number
    slide.addText(s.n, {
      x: x + 0.2, y: boxY + 0.15, w: boxW - 0.4, h: 0.4,
      fontFace: FONT_MONO, fontSize: 11, color: COLORS.EMERALD, bold: true,
      margin: 0,
    });
    // Title
    slide.addText(s.title, {
      x: x + 0.2, y: boxY + 0.55, w: boxW - 0.4, h: 0.55,
      fontFace: FONT_HEADER, fontSize: 26, color: COLORS.WHITE, bold: true,
      margin: 0,
    });
    // Role
    slide.addText(s.role, {
      x: x + 0.2, y: boxY + 1.15, w: boxW - 0.4, h: 0.65,
      fontFace: FONT_BODY, fontSize: 12, color: COLORS.WHITE,
      margin: 0, valign: "top",
    });
    // Separator
    slide.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.2, y: boxY + 1.85, w: 0.3, h: 0.02,
      fill: { color: COLORS.EMERALD }, line: { color: COLORS.EMERALD },
    });
    // Detail
    slide.addText(s.detail, {
      x: x + 0.2, y: boxY + 1.97, w: boxW - 0.4, h: 0.5,
      fontFace: FONT_BODY, fontSize: 10, color: COLORS.SLATE_MUTED, italic: true,
      margin: 0, valign: "top",
    });

    // Arrow to next
    if (i < 2) {
      slide.addShape(pres.shapes.RIGHT_TRIANGLE, {
        x: x + boxW + 0.05, y: boxY + boxH / 2 - 0.15, w: 0.2, h: 0.3,
        rotate: 90,
        fill: { color: COLORS.EMERALD }, line: { color: COLORS.EMERALD },
      });
    }
  });

  // Bottom tagline
  slide.addText(
    "All temperature=0 · all open-weight providers · full run on free tiers (NVIDIA NIM + OpenRouter)",
    {
      x: 0.7, y: 5.05, w: 8.6, h: 0.4,
      fontFace: FONT_BODY, fontSize: 11, color: COLORS.SLATE, italic: true,
      align: "center", margin: 0,
    }
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Slide 4 — Methodology
// ───────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: COLORS.WHITE };

  slide.addText("Methodology", {
    x: 0.7, y: 0.5, w: 8.6, h: 0.7,
    fontFace: FONT_HEADER, fontSize: 32, color: COLORS.CHARCOAL, bold: true,
    margin: 0,
  });
  slide.addText(
    "Drawn from SWC Registry. Spans the four economic dimensions Linus surfaced.",
    {
      x: 0.7, y: 1.25, w: 8.6, h: 0.55,
      fontFace: FONT_BODY, fontSize: 16, color: COLORS.SLATE, italic: true,
      margin: 0,
    }
  );

  const tiles = [
    {
      label: "VULNERABILITY CLASSES",
      stat: "8",
      title: "SWC Registry",
      body: "Reentrancy, integer overflow, unchecked-call, unprotected-ether-withdrawal, unprotected-selfdestruct, delegatecall-untrusted, transaction-order-dependence, DoS-gas-limit. Covers ~80% of real-world exploits.",
    },
    {
      label: "BASE TEMPLATES",
      stat: "5",
      title: "Contract patterns",
      body: "Token, vault, multisig, auction, staking. Each pattern × each SWC class produces a different vulnerable contract every run.",
    },
    {
      label: "SCANNER PHILOSOPHIES",
      stat: "3",
      title: "Architectural axis",
      body: "Code-specialist (Qwen3-Coder 480B), hybrid (MiniMax M2.7 230B), pure reasoning (Step-3.5-Flash 200B). Each from a different research lab.",
    },
    {
      label: "SCORING",
      stat: "2",
      title: "Leaderboards",
      body: "Pure quality and cost-adjusted (quality ÷ commercial list price per scan). Rewards cheap-and-good. Same data, two lenses for different audiences.",
    },
  ];

  const tileW = 4.25, tileH = 1.65, gap = 0.15;
  const positions = [
    { x: 0.7, y: 1.95 },
    { x: 0.7 + tileW + gap, y: 1.95 },
    { x: 0.7, y: 1.95 + tileH + gap },
    { x: 0.7 + tileW + gap, y: 1.95 + tileH + gap },
  ];

  tiles.forEach((t, i) => {
    const { x, y } = positions[i];
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: tileW, h: tileH,
      fill: { color: COLORS.CREAM }, line: { color: COLORS.BORDER, width: 0.75 },
    });
    // Stat block (left)
    slide.addText(t.stat, {
      x: x + 0.25, y: y + 0.35, w: 1.1, h: 0.95,
      fontFace: FONT_HEADER, fontSize: 36, color: COLORS.EMERALD_DARK, bold: true,
      margin: 0, valign: "middle",
    });
    // Right content
    slide.addText(t.label, {
      x: x + 1.45, y: y + 0.2, w: tileW - 1.65, h: 0.25,
      fontFace: FONT_BODY, fontSize: 8, color: COLORS.EMERALD_DARK, bold: true,
      charSpacing: 3, margin: 0,
    });
    slide.addText(t.title, {
      x: x + 1.45, y: y + 0.42, w: tileW - 1.65, h: 0.35,
      fontFace: FONT_HEADER, fontSize: 15, color: COLORS.CHARCOAL, bold: true,
      margin: 0,
    });
    slide.addText(t.body, {
      x: x + 1.45, y: y + 0.78, w: tileW - 1.65, h: tileH - 0.85,
      fontFace: FONT_BODY, fontSize: 10, color: COLORS.SLATE,
      margin: 0, valign: "top",
    });
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Slide 5 — Results & takeaways
// ───────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: COLORS.WHITE };

  slide.addText("Results", {
    x: 0.7, y: 0.5, w: 5.0, h: 0.7,
    fontFace: FONT_HEADER, fontSize: 32, color: COLORS.CHARCOAL, bold: true,
    margin: 0,
  });
  slide.addText("15 contracts · 8 SWC classes · judged by Llama-3.3-70B", {
    x: 0.7, y: 1.25, w: 8.6, h: 0.4,
    fontFace: FONT_BODY, fontSize: 13, color: COLORS.SLATE, italic: true,
    margin: 0,
  });

  // Table
  const headerStyle = {
    bold: true, color: COLORS.WHITE, fill: { color: COLORS.CHARCOAL },
    fontFace: FONT_BODY, fontSize: 11, align: "left", valign: "middle",
  };
  const cellStyle = {
    fontFace: FONT_BODY, fontSize: 11, color: COLORS.CHARCOAL, valign: "middle",
  };
  const winnerCellStyle = {
    fontFace: FONT_BODY, fontSize: 11, color: COLORS.CHARCOAL, bold: true,
    fill: { color: "ECFDF5" }, valign: "middle",
  };

  const rows = [
    [
      { text: "Model", options: { ...headerStyle } },
      { text: "Philosophy", options: { ...headerStyle } },
      { text: "Detection", options: { ...headerStyle, align: "right" } },
      { text: "Quality", options: { ...headerStyle, align: "right" } },
      { text: "Cost (15)", options: { ...headerStyle, align: "right" } },
      { text: "Cost-adj.", options: { ...headerStyle, align: "right" } },
    ],
    [
      { text: "🏆  Qwen3-Coder 480B", options: { ...winnerCellStyle } },
      { text: "Code specialist", options: { ...winnerCellStyle } },
      { text: "71.4%", options: { ...winnerCellStyle, align: "right" } },
      { text: "57.5", options: { ...winnerCellStyle, align: "right" } },
      { text: "$0.0034", options: { ...winnerCellStyle, align: "right" } },
      { text: "17,041", options: { ...winnerCellStyle, align: "right" } },
    ],
    [
      { text: "MiniMax M2.7", options: { ...cellStyle } },
      { text: "Code + reasoning", options: { ...cellStyle } },
      { text: "64.3%", options: { ...cellStyle, align: "right" } },
      { text: "44.6", options: { ...cellStyle, align: "right" } },
      { text: "$0.0237", options: { ...cellStyle, align: "right" } },
      { text: "1,882", options: { ...cellStyle, align: "right" } },
    ],
    [
      { text: "Step-3.5-Flash", options: { ...cellStyle } },
      { text: "Pure reasoning", options: { ...cellStyle } },
      { text: "18.2%", options: { ...cellStyle, align: "right" } },
      { text: "18.2", options: { ...cellStyle, align: "right" } },
      { text: "$0.0357", options: { ...cellStyle, align: "right" } },
      { text: "509", options: { ...cellStyle, align: "right" } },
    ],
  ];

  slide.addTable(rows, {
    x: 0.7, y: 1.75, w: 8.6,
    colW: [2.4, 1.6, 1.05, 0.95, 1.2, 1.4],
    rowH: 0.42,
    border: { type: "solid", color: COLORS.BORDER, pt: 0.5 },
  });

  // Three takeaway cards
  const tkY = 4.0, tkH = 1.45, tkW = 2.85, tkGap = 0.15;
  const tkXs = [0.7, 0.7 + tkW + tkGap, 0.7 + 2 * (tkW + tkGap)];
  const takeaways = [
    {
      n: "01",
      head: "Code-tuning beats reasoning",
      body: "4× detection rate at one-tenth the cost. Pattern recognition wins on this task.",
    },
    {
      n: "02",
      head: "Cheap-and-good is the combo",
      body: "Winner is also the cheapest. 10× under Sonnet's commercial rate for the same job.",
    },
    {
      n: "03",
      head: "Universal blind spot: SWC-114",
      body: "No model catches transaction-order dependence reliably. Front-running audit needs a human.",
    },
  ];
  takeaways.forEach((t, i) => {
    const x = tkXs[i];
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: tkY, w: tkW, h: tkH,
      fill: { color: COLORS.CREAM }, line: { color: COLORS.BORDER, width: 0.5 },
    });
    slide.addText(t.n, {
      x: x + 0.2, y: tkY + 0.15, w: 0.6, h: 0.25,
      fontFace: FONT_MONO, fontSize: 11, color: COLORS.EMERALD_DARK, bold: true,
      margin: 0, valign: "top",
    });
    slide.addText(t.head, {
      x: x + 0.2, y: tkY + 0.45, w: tkW - 0.4, h: 0.4,
      fontFace: FONT_HEADER, fontSize: 13, color: COLORS.CHARCOAL, bold: true,
      margin: 0, valign: "top",
    });
    slide.addText(t.body, {
      x: x + 0.2, y: tkY + 0.88, w: tkW - 0.4, h: 0.5,
      fontFace: FONT_BODY, fontSize: 10, color: COLORS.SLATE,
      margin: 0, valign: "top",
    });
  });
}

pres
  .writeFile({ fileName: "/Users/myhome/Documents/Projects/sc-audit-benchmark/sc-audit-benchmark-pitch.pptx" })
  .then((f) => console.log("Wrote", f));
