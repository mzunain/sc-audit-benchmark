"use client";

import { usePathname } from "navigation";

const LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/analysis", label: "Evidence" },
  { href: "/breakdown", label: "Coverage" },
  { href: "/proof-lab", label: "Proof Lab" },
  { href: "/reports", label: "Reports" },
  { href: "/playground", label: "Playground" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/92 backdrop-blur supports-[backdrop-filter]:bg-white/82">
      <div className="section-shell flex min-h-16 flex-col items-stretch justify-between gap-3 py-3 sm:flex-row sm:items-center sm:py-2">
        <a href="/" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-stone-900">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stone-950 shadow-sm"
          >
            <span className="block h-3.5 w-3.5 rounded-sm bg-emerald-400" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm sm:text-base">SC Audit Benchmark</span>
            <span className="hidden sm:block text-[11px] font-medium text-stone-500">
              LLM security model console
            </span>
          </span>
        </a>

        <nav className="flex w-full min-w-0 items-center gap-1 overflow-x-auto rounded-lg border border-stone-200 bg-white p-1 shadow-sm sm:w-auto">
          {LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <a
                key={href}
                href={href}
                className={[
                  "relative whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors focus-ring",
                  active
                    ? "bg-stone-950 font-semibold text-white shadow-sm"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
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
