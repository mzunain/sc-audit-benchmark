import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <div className="text-center space-y-6 px-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/30 mx-auto">
          <span className="font-mono text-2xl font-bold text-emerald-400">?</span>
        </div>
        <div>
          <p className="eyebrow mb-2">404</p>
          <h1 className="text-4xl font-bold text-white mb-3">Page not found</h1>
          <p className="text-stone-400 max-w-sm mx-auto">
            This page doesn&apos;t exist in the benchmark. Try one of the dashboard pages below.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {[
            { href: "/", label: "Leaderboard" },
            { href: "/analysis", label: "Evidence" },
            { href: "/playground", label: "Playground" },
          ].map(l => (
            <Link key={l.href} href={l.href}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium border border-white/10 transition-colors">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
