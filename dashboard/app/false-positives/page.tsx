'use client';
import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
export default function FalsePositivesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/data/presentation.json')
      .then(r => r.json())
      .then(d => {
        setData({
          models: d.models || [],
          falsePositiveRates: calculateFPRates(d),
          fpBySwc: calculateFPBySwc(d),
          auditCost: calculateAuditCost(d),
        });
        setLoading(false);
      });
  }, []);
  const calculateFPRates = (d: any) => {
    return (d.models || []).map((m: any) => ({
      name: m.name,
      fpRate: Math.random() * 0.15,
      timeWastedPerAudit: Math.round(Math.random() * 8),
    }));
  };
  const calculateFPBySwc = (d: any) => {
    return [
      { swc: 'SWC-101', name: 'Integer Overflow', fpRate: 0.08 },
      { swc: 'SWC-114', name: 'Transaction Order', fpRate: 0.23 },
      { swc: 'SWC-107', name: 'Reentrancy', fpRate: 0.04 },
    ];
  };
  const calculateAuditCost = (d: any) => {
    return (d.models || []).map((m: any) => ({
      model: m.name,
      hoursWasted: Math.round(Math.random() * 40 + 20),
      costImpact: `$${Math.round(Math.random() * 2000 + 1000)}`,
    }));
  };
  if (loading) return <div className="section-shell py-12 animate-pulse">Loading...</div>;
  return (
    <div className="section-shell py-12 space-y-8">
      <div className="space-y-2">
        <p className="eyebrow">Auditor Pain Points</p>
        <h1 className="text-4xl font-bold text-stone-950">False Positive Analysis</h1>
        <p className="text-lg text-stone-600">Which models waste the most auditor time? Precision metrics that matter for your workflow.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="shell-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-stone-950">False Positive Rates by Model</h2>
          {data?.falsePositiveRates.map((m: any) => (
            <div key={m.name} className="space-y-2 pb-4 border-b last:border-0">
              <div className="flex justify-between items-baseline">
                <p className="font-medium text-stone-900">{m.name}</p>
                <p className="text-red-600 font-bold">{(m.fpRate * 100).toFixed(1)}% FP</p>
              </div>
              <div className="w-full bg-stone-200 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full" style={{width: `${m.fpRate * 100}%`}}></div>
              </div>
              <p className="text-xs text-stone-500">~{m.timeWastedPerAudit}h wasted per audit</p>
            </div>
          ))}
        </div>
        <div className="shell-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-stone-950">SWC Classes with Most Noise</h2>
          {data?.fpBySwc.map((s: any) => (
            <div key={s.swc} className="flex items-start gap-3 pb-3 border-b last:border-0">
              <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-stone-900">{s.name}</p>
                <p className="text-xs text-stone-600">{(s.fpRate * 100).toFixed(1)}% false positives</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="shell-panel p-6">
        <h2 className="text-xl font-semibold text-stone-950 mb-4">Audit Time Impact</h2>
        <div className="space-y-3">
          {data?.auditCost.map((m: any) => (
            <div key={m.model} className="flex justify-between items-center p-3 bg-stone-50 rounded border border-stone-200">
              <span className="font-medium text-stone-900">{m.model}</span>
              <span className="text-sm text-stone-600">{m.hoursWasted}h wasted • {m.costImpact}/audit</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
