"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/analysis", label: "Why these results" },
  { href: "/breakdown", label: "Per-vuln breakdown" },
  { href: "/playground", label: "Playground" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-stone-50/85 backdrop-blur supports-[backdrop-filter]:bg-stone-50/70">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2.5 text-stone-900 font-semibold tracking-tight shrink-0">
          <span
            aria-hidden
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500 shadow-sm shadow-emerald-200"
          >
            <span className="block w-2.5 h-2.5 rounded-sm bg-white" />
          </span>
          <span className="text-sm sm:text-base">SC Audit Benchmark</span>
        </a>

        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <a
                key={href}
                href={href}
                className={[
                  "relative px-3 py-1.5 rounded-md text-sm transition-colors",
                  active
                    ? "text-stone-900 font-semibold bg-white shadow-sm ring-1 ring-stone-200"
                    : "text-stone-600 hover:text-stone-900 hover:bg-white/60",
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
