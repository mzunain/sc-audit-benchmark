"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/analysis", label: "Evidence" },
  { href: "/breakdown", label: "Coverage" },
  { href: "/proof-lab", label: "Proof Lab" },
  { href: "/reports", label: "Reports" },
  { href: "/false-positives", label: "FP Analysis" },
  { href: "/remediation", label: "Remediation" },
  { href: "/risk-matrix", label: "Risk Matrix" },
  { href: "/cost-calculator", label: "Cost Calc" },
  { href: "/compare", label: "Compare" },
  { href: "/playground", label: "Playground" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-stone-900/80 bg-stone-950">
      <div className="section-shell flex min-h-14 flex-col items-stretch justify-between gap-2 py-2 sm:flex-row sm:items-center">
        {/* Logo */}
        <a href="/" className="flex shrink-0 items-center gap-2.5 group">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 shadow-md shadow-emerald-900/40">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 1L12.196 4V10L7 13L1.804 10V4L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="7" cy="7" r="2" fill="white"/>
            </svg>
          </span>
          <span>
            <span className="block text-sm font-semibold text-white leading-tight">SC Audit Benchmark</span>
            <span className="hidden sm:block text-[10px] font-medium text-stone-500 leading-tight">
              LLM security console
            </span>
          </span>
        </a>

        {/* Nav links */}
        <nav className="flex w-full min-w-0 items-center gap-0.5 overflow-x-auto sm:w-auto">
          {LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <a
                key={href}
                href={href}
                className={[
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-ring",
                  active
                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                    : "text-stone-400 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                {label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
