'use client';
import { useEffect, useState } from 'react';
import { Code2 } from 'lucide-react';
export default function RemediationPage() {
  const [remediation, setRemediation] = useState<any>(null);
  useEffect(() => {
    fetch('/data/presentation.json')
      .then(r => r.json())
      .then(() => {
        setRemediation({
          patterns: [
            {swc:'SWC-101', name:'Integer Overflow', vulnerable:`uint256 balance = userBalance + amount;`, patched:`uint256 balance;
unchecked { balance = userBalance + amount; }
require(balance >= userBalance);`, gas:'−12%'},
            {swc:'SWC-104', name:'Unchecked Call', vulnerable:`receiver.call{value:amount}("");`, patched:`(bool success,) = receiver.call{value:amount}("");
require(success, "Transfer failed");`, gas:'−5%'},
            {swc:'SWC-105', name:'Unprotected Ether', vulnerable:`function withdraw() public { msg.sender.call{value:address(this).balance}(""); }`, patched:`function withdraw() public onlyOwner { msg.sender.call{value:address(this).balance}(""); }`, gas:'+0%'},
          ]
        });
      });
  }, []);
  if(!remediation) return <div className="section-shell py-12">Loading...</div>;
  return (
    <div className="section-shell py-12 space-y-8">
      <div><p className="eyebrow">Canonial Fix Patterns</p><h1 className="text-4xl font-bold text-stone-950">Remediation Library</h1></div>
      {remediation.patterns.map((p: any) => (
        <div key={p.swc} className="shell-panel p-6 space-y-4">
          <div className="flex items-start justify-between"><div><p className="font-mono text-sm text-emerald-600">{p.swc}</p><p className="text-lg font-semibold text-stone-950">{p.name}</p></div><p className="text-sm font-medium text-stone-600">Gas: {p.gas}</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div><p className="text-sm font-semibold text-red-700 mb-2">Vulnerable Code</p><pre className="bg-red-50 border border-red-200 p-3 rounded text-xs overflow-x-auto font-mono"><code>{p.vulnerable}</code></pre></div>
            <div><p className="text-sm font-semibold text-emerald-700 mb-2">Patched Code</p><pre className="bg-emerald-50 border border-emerald-200 p-3 rounded text-xs overflow-x-auto font-mono"><code>{p.patched}</code></pre></div>
          </div>
          <button className="w-full bg-stone-100 hover:bg-stone-200 text-stone-900 px-3 py-2 rounded text-sm font-medium">View in Proof Lab →</button>
        </div>
      ))}
    </div>
  );
}
