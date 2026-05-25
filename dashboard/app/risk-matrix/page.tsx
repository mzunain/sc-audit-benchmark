'use client';
export default function RiskMatrixPage() {
  return (
    <div className="section-shell py-12 space-y-8">
      <div><p className="eyebrow">Strategic Planning</p><h1 className="text-4xl font-bold text-stone-950">Audit Risk Scoring</h1><p className="text-lg text-stone-600">Multi-model consensus signals for confidence-based auditing strategy.</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="shell-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-stone-950">Detection Confidence Levels</h2>
          {[{level:'All 3 Models', consensus:100,advice:'Critical findings only'},{level:'2 of 3 Models',consensus:67,advice:'High + Medium severity'},{level:'1 Model Only',consensus:33,advice:'Manual review required'},{level:'None Caught',consensus:0,advice:'Blind spot - audit manually'}].map(c => (<div key={c.level} className="pb-3 border-b last:border-0"><div className="flex justify-between mb-1"><span className="font-medium text-stone-900">{c.level}</span><span className="text-emerald-600 font-bold">{c.consensus}%</span></div><p className="text-xs text-stone-600">{c.advice}</p></div>))}
        </div>
        <div className="shell-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-stone-950">Recommended Model Combos</h2>
          {[{type:'Token Contracts',models:'Qwen + Slither',coverage:'94%'},{type:'Vault Contracts',models:'Qwen + Nemotron',coverage:'91%'},{type:'DEX Contracts',models:'Qwen + Slither + Aderyn',coverage:'96%'}].map(r => (<div key={r.type} className="bg-stone-50 p-3 rounded border border-stone-200"><p className="font-medium text-stone-900">{r.type}</p><p className="text-sm text-stone-600 mt-1">{r.models}</p><p className="text-xs text-emerald-600 font-medium mt-1">Coverage: {r.coverage}</p></div>))}
        </div>
      </div>
    </div>
  );
}
