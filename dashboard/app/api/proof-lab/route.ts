import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const PROOF_TIMEOUT_MS = 75_000;
const SUPPORTED_SWCS = new Set(["SWC-107"]);

const REENTRANCY_PROOF = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VulnerableVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "no balance");

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");

        balances[msg.sender] = 0;
    }
}

contract FixedVault {
    mapping(address => uint256) public balances;
    bool private locked;

    modifier nonReentrant() {
        require(!locked, "reentrant");
        locked = true;
        _;
        locked = false;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "no balance");

        balances[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
    }
}

contract VulnerableAttacker {
    VulnerableVault public vault;
    uint256 public reentries;

    constructor(VulnerableVault target) {
        vault = target;
    }

    function attack() external payable {
        require(msg.value == 1 ether, "seed must be one ether");
        vault.deposit{value: msg.value}();
        vault.withdraw();
    }

    receive() external payable {
        if (address(vault).balance >= 1 ether && reentries < 3) {
            reentries += 1;
            vault.withdraw();
        }
    }
}

contract FixedAttacker {
    FixedVault public vault;
    bool public reentryBlocked;

    constructor(FixedVault target) {
        vault = target;
    }

    function attack() external payable {
        require(msg.value == 1 ether, "seed must be one ether");
        vault.deposit{value: msg.value}();
        vault.withdraw();
    }

    receive() external payable {
        try vault.withdraw() {
            revert("reentry should not succeed");
        } catch {
            reentryBlocked = true;
        }
    }
}

contract ReentrancyProofTest {
    function test_ReentrancyExploitDrainsVulnerableVault() public {
        VulnerableVault vault = new VulnerableVault();
        vault.deposit{value: 3 ether}();

        VulnerableAttacker attacker = new VulnerableAttacker(vault);
        attacker.attack{value: 1 ether}();

        require(address(vault).balance == 0, "vulnerable vault should be drained");
        require(address(attacker).balance == 4 ether, "attacker should extract all funds");
        require(attacker.reentries() == 3, "exploit should re-enter three times");
    }

    function test_ReentrancyPatchKeepsVictimFunds() public {
        FixedVault vault = new FixedVault();
        vault.deposit{value: 3 ether}();

        FixedAttacker attacker = new FixedAttacker(vault);
        attacker.attack{value: 1 ether}();

        require(address(vault).balance == 3 ether, "victim funds should remain");
        require(address(attacker).balance == 1 ether, "attacker should only recover own deposit");
        require(attacker.reentryBlocked(), "patch should block re-entry");
    }
}`;

const FOUNDRY_TOML = `[profile.default]
src = "src"
test = "test"
out = "out"
cache_path = "cache"
solc_version = "0.8.20"
optimizer = true
evm_version = "paris"
`;

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function normalizeRunner() {
  const configured = process.env.SC_AUDIT_PROOF_RUNNER?.trim().toLowerCase();
  if (configured === "docker" || configured === "forge") return configured;
  return "forge";
}

function forgeCommand(projectDir: string) {
  const args = ["test", "--match-path", "test/ReentrancyProof.t.sol", "-vv"];
  if (normalizeRunner() === "docker") {
    return {
      command: "docker",
      args: [
        "run",
        "--rm",
        "-v",
        `${projectDir}:/workspace`,
        "-w",
        "/workspace",
        "ghcr.io/foundry-rs/foundry:latest",
        `forge ${args.join(" ")}`,
      ],
      cwd: projectDir,
      runner: "docker",
    };
  }

  return {
    command: "forge",
    args,
    cwd: projectDir,
    runner: "forge",
  };
}

function cleanOutput(value: string) {
  return value.replace(/\u001b\[[0-9;]*m/g, "").trim();
}

async function writeProofProject() {
  const baseDir = path.join(process.cwd(), ".proof-runs");
  await mkdir(baseDir, { recursive: true });
  const projectDir = await mkdtemp(path.join(baseDir, "sc-audit-proof-"));
  await mkdir(path.join(projectDir, "test"), { recursive: true });
  await mkdir(path.join(projectDir, "src"), { recursive: true });
  await writeFile(path.join(projectDir, "foundry.toml"), FOUNDRY_TOML, "utf8");
  await writeFile(path.join(projectDir, "test", "ReentrancyProof.t.sol"), REENTRANCY_PROOF, "utf8");
  return projectDir;
}

export async function POST(req: NextRequest) {
  let payload: { swc?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON payload." }, 400);
  }

  const swc = typeof payload.swc === "string" ? payload.swc : "";
  if (!SUPPORTED_SWCS.has(swc)) {
    return jsonResponse(
      {
        ok: false,
        error: "No executable proof harness is available for this SWC yet.",
        supported_swcs: [...SUPPORTED_SWCS],
      },
      400
    );
  }

  const startedAt = Date.now();
  const projectDir = await writeProofProject();

  try {
    const runner = forgeCommand(projectDir);
    const result = await execFileAsync(runner.command, runner.args, {
      cwd: runner.cwd,
      timeout: PROOF_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });

    return jsonResponse({
      ok: true,
      swc,
      runner: runner.runner,
      command: [runner.command, ...runner.args].join(" "),
      duration_ms: Date.now() - startedAt,
      stdout: cleanOutput(result.stdout),
      stderr: cleanOutput(result.stderr),
      tests: [
        "test_ReentrancyExploitDrainsVulnerableVault",
        "test_ReentrancyPatchKeepsVictimFunds",
      ],
    });
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: string | number;
      signal?: string;
      killed?: boolean;
    };

    const missingRunner = failure.code === "ENOENT";
    return jsonResponse(
      {
        ok: false,
        swc,
        runner: normalizeRunner(),
        duration_ms: Date.now() - startedAt,
        error: missingRunner
          ? "Foundry runner not found. Install forge or start with SC_AUDIT_PROOF_RUNNER=docker."
          : failure.killed
            ? "Proof execution timed out."
            : "Proof execution failed.",
        exit_code: failure.code ?? null,
        signal: failure.signal ?? null,
        stdout: cleanOutput(failure.stdout ?? ""),
        stderr: cleanOutput(failure.stderr ?? failure.message ?? ""),
      },
      missingRunner ? 501 : 200
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
}
