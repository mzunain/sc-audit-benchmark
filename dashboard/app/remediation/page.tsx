"use client";

import { useState } from "react";
import { Copy, CheckCheck, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PATTERNS = [
  {
    swc: "SWC-107",
    name: "Reentrancy",
    severity: "Critical" as const,
    gasImpact: "+0% (guard is free)",
    summary: "State changes must happen before external calls. Use a reentrancy guard as a safety net.",
    vulnerable: `function withdraw(uint256 amount) public {
    // ❌ External call before state change
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
    balances[msg.sender] -= amount; // too late
}`,
    patched: `// ✅ Checks-Effects-Interactions pattern
function withdraw(uint256 amount) public nonReentrant {
    require(balances[msg.sender] >= amount, "Insufficient");
    balances[msg.sender] -= amount; // effect first
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok, "Transfer failed");
}`,
    testAssertion: `assertEq(vault.balances(attacker), 0, "balance drained");`,
    proofLabLink: "/proof-lab",
  },
  {
    swc: "SWC-101",
    name: "Integer Overflow / Underflow",
    severity: "High" as const,
    gasImpact: "−12% (checked is default in 0.8)",
    summary: "Solidity 0.8+ checks by default. For older code or unchecked blocks, add explicit bounds.",
    vulnerable: `// ❌ Solidity < 0.8 — wraps silently
pragma solidity ^0.7.0;
uint256 public balance;
function deposit(uint256 amount) public {
    balance += amount; // can overflow
}`,
    patched: `// ✅ Use 0.8+ or SafeMath
pragma solidity ^0.8.0;
uint256 public balance;
function deposit(uint256 amount) public {
    balance += amount; // reverts on overflow
}

// If you need unchecked for gas, guard it:
unchecked {
    require(a <= type(uint256).max - b, "overflow");
    balance = a + b;
}`,
    testAssertion: `vm.expectRevert(); target.deposit(type(uint256).max);`,
    proofLabLink: "/proof-lab",
  },
  {
    swc: "SWC-104",
    name: "Unchecked Call Return Value",
    severity: "High" as const,
    gasImpact: "−5%",
    summary: "Low-level calls return a bool. Ignoring it means a failed transfer silently passes.",
    vulnerable: `// ❌ Return value discarded
function distribute(address to, uint256 amount) public {
    to.call{value: amount}(""); // bool ignored!
    emit Distributed(to, amount);
}`,
    patched: `// ✅ Always check the return value
function distribute(address to, uint256 amount) public {
    (bool success,) = to.call{value: amount}("");
    require(success, "ETH transfer failed");
    emit Distributed(to, amount);
}

// Or use Address.sendValue from OpenZeppelin:
Address.sendValue(payable(to), amount);`,
    testAssertion: `receiver.setRejectTransfers(true); vm.expectRevert(); vault.distribute(address(receiver), 1 ether);`,
    proofLabLink: "/proof-lab",
  },
  {
    swc: "SWC-105",
    name: "Unprotected Ether Withdrawal",
    severity: "Critical" as const,
    gasImpact: "+0%",
    summary: "Any public or external function that sends ETH must gate on ownership or role.",
    vulnerable: `// ❌ Anyone can drain the contract
function emergencyWithdraw() external {
    payable(msg.sender).transfer(address(this).balance);
}`,
    patched: `// ✅ Restrict to owner
function emergencyWithdraw() external onlyOwner {
    uint256 bal = address(this).balance;
    (bool ok,) = owner().call{value: bal}("");
    require(ok, "Withdraw failed");
    emit EmergencyWithdraw(bal);
}`,
    testAssertion: `vm.prank(attacker); vm.expectRevert(); vault.emergencyWithdraw();`,
    proofLabLink: "/proof-lab",
  },
  {
    swc: "SWC-114",
    name: "Transaction Order Dependence",
    severity: "High" as const,
    gasImpact: "Varies — commit-reveal adds one tx",
    summary: "Front-runners can observe pending transactions and reorder them. Use commit-reveal or slippage protection.",
    vulnerable: `// ❌ Exploitable by sandwich attack
function swap(uint256 amountIn) external {
    // Price read from state — can be manipulated
    uint256 price = oracle.getPrice();
    uint256 out = amountIn * price;
    token.transfer(msg.sender, out);
}`,
    patched: `// ✅ Slippage tolerance + deadline
function swap(
    uint256 amountIn,
    uint256 minAmountOut,   // caller sets minimum
    uint256 deadline        // tx expires
) external {
    require(block.timestamp <= deadline, "Expired");
    uint256 price = oracle.getPrice();
    uint256 out = amountIn * price;
    require(out >= minAmountOut, "Slippage exceeded");
    token.transfer(msg.sender, out);
}`,
    testAssertion: `vm.expectRevert("Slippage exceeded"); target.swap(1e18, type(uint256).max, block.timestamp);`,
    proofLabLink: "/proof-lab",
  },
  {
    swc: "SWC-112",
    name: "Delegatecall to Untrusted Callee",
    severity: "Critical" as const,
    gasImpact: "+0%",
    summary: "Delegatecall executes in the caller's storage context. Only delegatecall to audited, immutable addresses.",
    vulnerable: `// ❌ User-supplied implementation address
function execute(address impl, bytes calldata data) external {
    // impl can overwrite any storage slot
    impl.delegatecall(data);
}`,
    patched: `// ✅ Allowlist the implementation
address public immutable IMPLEMENTATION;
constructor(address impl) { IMPLEMENTATION = impl; }

function execute(bytes calldata data) external onlyOwner {
    (bool ok,) = IMPLEMENTATION.delegatecall(data);
    require(ok, "Delegatecall failed");
}`,
    testAssertion: `vm.expectRevert(); proxy.execute(maliciousImpl, data);`,
    proofLabLink: "/proof-lab",
  },
  {
    swc: "SWC-106",
    name: "Unprotected SELFDESTRUCT",
    severity: "Critical" as const,
    gasImpact: "+0%",
    summary: "SELFDESTRUCT permanently destroys the contract and sends ETH to a target. Restrict it absolutely.",
    vulnerable: `// ❌ Anyone can destroy the contract
function kill() external {
    selfdestruct(payable(msg.sender));
}`,
    patched: `// ✅ Owner-only + multi-sig recommended
function shutdown(address payable recipient) external onlyOwner {
    require(recipient != address(0), "Zero address");
    emit ContractShutdown(recipient, address(this).balance);
    selfdestruct(recipient);
}`,
    testAssertion: `vm.prank(attacker); vm.expectRevert(); target.kill();`,
    proofLabLink: "/proof-lab",
  },
  {
    swc: "SWC-128",
    name: "DoS with Block Gas Limit",
    severity: "Medium" as const,
    gasImpact: "Depends on batch size cap",
    summary: "Unbounded loops over dynamic arrays can exceed the block gas limit. Use pagination or pull-payment patterns.",
    vulnerable: `// ❌ Unbounded loop — can run out of gas
function distributeRewards() external {
    for (uint i = 0; i < recipients.length; i++) {
        payable(recipients[i]).transfer(rewardAmounts[i]);
    }
}`,
    patched: `// ✅ Pull payment: each user claims individually
mapping(address => uint256) public claimable;

function claimReward() external {
    uint256 amount = claimable[msg.sender];
    require(amount > 0, "Nothing to claim");
    claimable[msg.sender] = 0;
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok, "Transfer failed");
}`,
    testAssertion: `// Batch test: gas used must be < block.gaslimit
assertLt(gasBefore - gasleft(), block.gaslimit);`,
    proofLabLink: "/proof-lab",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs text-stone-400 hover:text-white transition-colors"
    >
      {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

type Severity = "Critical" | "High" | "Medium";
const SEV_FILTER: { label: string; value: Severity | "All" }[] = [
  { label: "All", value: "All" },
  { label: "Critical", value: "Critical" },
  { label: "High", value: "High" },
  { label: "Medium", value: "Medium" },
];

export default function RemediationPage() {
  const [filter, setFilter] = useState<Severity | "All">("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = filter === "All" ? PATTERNS : PATTERNS.filter(p => p.severity === filter);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <p className="eyebrow mb-3">Canonical Fix Patterns</p>
          <h1 className="hero-title mb-3">Remediation Library</h1>
          <p className="hero-sub mb-10">
            Side-by-side vulnerable vs. patched Solidity for all 8 SWC classes.
            Each entry includes the exploit goal, the Foundry test assertion, and a direct link to the Proof Lab harness.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="stat-card"><p className="metric-label-inv mb-1">SWC Classes</p><p className="metric-value-inv">{PATTERNS.length}</p></div>
            <div className="stat-card"><p className="metric-label-inv mb-1">Critical</p><p className="metric-value-inv text-red-400">{PATTERNS.filter(p => p.severity === "Critical").length}</p></div>
            <div className="stat-card"><p className="metric-label-inv mb-1">High</p><p className="metric-value-inv text-orange-400">{PATTERNS.filter(p => p.severity === "High").length}</p></div>
            <div className="stat-card"><p className="metric-label-inv mb-1">Medium</p><p className="metric-value-inv text-amber-400">{PATTERNS.filter(p => p.severity === "Medium").length}</p></div>
          </div>
        </div>
      </section>

      <div className="section-shell py-10 space-y-6">
        {/* Filter pills */}
        <div className="flex items-center gap-2">
          {SEV_FILTER.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                filter === f.value
                  ? "bg-stone-950 text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:border-stone-400"
              )}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-sm text-stone-500">{visible.length} pattern{visible.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Pattern cards */}
        {visible.map((p) => {
          const isOpen = expanded === p.swc;
          return (
            <div key={p.swc} className="shell-panel overflow-hidden">
              {/* Card header */}
              <button
                className="w-full px-6 py-5 flex items-center justify-between gap-4 hover:bg-stone-50 transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : p.swc)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="font-mono text-xs text-stone-400 flex-shrink-0">{p.swc}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-950 truncate">{p.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5 truncate">{p.summary}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={cn(
                    "badge",
                    p.severity === "Critical" ? "badge-critical" :
                    p.severity === "High" ? "badge-high" : "badge-medium"
                  )}>
                    {p.severity}
                  </span>
                  <span className="text-xs text-stone-400 hidden sm:block">Gas: {p.gasImpact}</span>
                  <ArrowRight className={cn("w-4 h-4 text-stone-400 transition-transform", isOpen && "rotate-90")} />
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="border-t border-stone-100">
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-stone-100">
                    {/* Vulnerable */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-red-600">Vulnerable Pattern</span>
                        </div>
                        <CopyButton text={p.vulnerable} />
                      </div>
                      <pre className="code-block-bad text-red-200 text-[11px] leading-5"><code>{p.vulnerable}</code></pre>
                    </div>

                    {/* Patched */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Patched Code</span>
                        </div>
                        <CopyButton text={p.patched} />
                      </div>
                      <pre className="code-block-good text-emerald-200 text-[11px] leading-5"><code>{p.patched}</code></pre>
                    </div>
                  </div>

                  {/* Proof assertion + link */}
                  <div className="px-6 py-4 bg-stone-950 border-t border-stone-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Foundry Test Assertion</p>
                      <code className="font-mono text-xs text-emerald-300 break-all">{p.testAssertion}</code>
                    </div>
                    <a
                      href={p.proofLabLink}
                      className="flex-shrink-0 btn-primary text-xs"
                    >
                      Run in Proof Lab →
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
