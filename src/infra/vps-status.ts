/**
 * VPS infrastructure status — MCPJungle, AI Mesh, services, Claude Code.
 *
 * Collects status from local services running on the same VPS as the gateway.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type VpsSnapshot = {
  mcpjungle?: McpJungleStatus;
  mesh?: MeshRelayStatus;
  services: VpsServiceStatus[];
  claudeCode?: ClaudeCodeStatus;
  collectedAt: number;
};

export type McpJungleStatus = {
  healthy: boolean;
  servers: number;
  tools: number;
  port: number;
};

export type MeshRelayStatus = {
  alive: boolean;
  node: string;
  queueSize: number;
  port: number;
};

export type VpsServiceStatus = {
  name: string;
  display: string;
  port: number;
  proto: string;
  active: boolean;
  since?: string;
  memoryMb: number;
};

export type ClaudeCodeStatus = {
  available: boolean;
  version?: string;
};

const VPS_SERVICES = [
  { name: "billbot-gateway", display: "BillBot Gateway", port: 18790, proto: "ws", user: true },
  { name: "mcpjungle", display: "MCPJungle", port: 8090, proto: "tcp", user: true },
  { name: "mesh-relay", display: "AI Mesh Relay", port: 9500, proto: "tcp", user: true },
  { name: "terraria", display: "Terraria", port: 7777, proto: "tcp", user: false },
  { name: "ark", display: "ARK Server", port: 7787, proto: "udp", user: false },
  { name: "nginx", display: "Nginx", port: 80, proto: "tcp", user: false },
];

async function runCmd(cmd: string, args: string[], timeoutMs = 5000): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: timeoutMs });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function httpGet(url: string, timeoutMs = 3000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok ? await res.text() : null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function checkMcpJungle(): Promise<McpJungleStatus> {
  const health = await httpGet("http://127.0.0.1:8090/health", 2000);
  const healthy = health != null && health.includes("ok");

  // Read counts directly from MCPJungle SQLite DB via python3 (instant vs 30s CLI)
  let servers = 0;
  let tools = 0;
  try {
    const dbQuery = await runCmd("python3", [
      "-c",
      `import sqlite3,json;c=sqlite3.connect('file:///home/ubuntu/billbot-mcpjungle/mcpjungle.db?mode=ro',uri=True);s=c.execute("SELECT COUNT(*) FROM mcp_servers WHERE deleted_at IS NULL").fetchone()[0];t=c.execute("SELECT COUNT(*) FROM tools WHERE deleted_at IS NULL AND enabled=1").fetchone()[0];print(json.dumps({"s":s,"t":t}))`,
    ], 3000);
    if (dbQuery) {
      const parsed = JSON.parse(dbQuery);
      servers = parsed.s ?? 0;
      tools = parsed.t ?? 0;
    }
  } catch {
    // DB not available
  }

  return { healthy, servers, tools, port: 8090 };
}

async function checkMeshRelay(): Promise<MeshRelayStatus> {
  const body = await httpGet("http://100.90.209.127:9500/status", 2000);
  if (body) {
    try {
      const data = JSON.parse(body);
      return {
        alive: true,
        node: data.node ?? "vps",
        queueSize: data.queue_size ?? 0,
        port: 9500,
      };
    } catch {
      // non-JSON response but still alive
      return { alive: true, node: "vps", queueSize: 0, port: 9500 };
    }
  }
  // Check systemd as fallback
  const out = await runCmd("systemctl", ["--user", "is-active", "mesh-relay"]);
  return { alive: out === "active", node: "vps", queueSize: 0, port: 9500 };
}

async function checkClaudeCode(): Promise<ClaudeCodeStatus> {
  const out = await runCmd("claude", ["--version"], 5000);
  if (out) {
    return { available: true, version: out.split("\n")[0] };
  }
  return { available: false };
}

async function checkService(svc: {
  name: string;
  display: string;
  port: number;
  proto: string;
  user: boolean;
}): Promise<VpsServiceStatus> {
  const args = svc.user ? ["--user", "is-active", svc.name] : ["is-active", svc.name];
  const out = await runCmd("systemctl", args);
  const active = out === "active";

  let since: string | undefined;
  let memoryMb = 0;
  if (active) {
    const showArgs = svc.user
      ? ["--user", "show", svc.name, "--property=ActiveEnterTimestamp,MemoryCurrent"]
      : ["show", svc.name, "--property=ActiveEnterTimestamp,MemoryCurrent"];
    const showOut = await runCmd("systemctl", showArgs);
    for (const line of showOut.split("\n")) {
      if (line.startsWith("ActiveEnterTimestamp=")) {
        since = line.split("=", 2)[1]?.trim() || undefined;
      }
      if (line.startsWith("MemoryCurrent=")) {
        const val = line.split("=", 2)[1]?.trim();
        if (val && val !== "[not set]" && val !== "infinity") {
          memoryMb = Math.round((parseInt(val, 10) / (1024 * 1024)) * 10) / 10;
        }
      }
    }
  }

  return {
    name: svc.name,
    display: svc.display,
    port: svc.port,
    proto: svc.proto,
    active,
    since,
    memoryMb,
  };
}

/**
 * Collect full VPS infrastructure status.
 */
export async function collectVpsStatus(): Promise<VpsSnapshot> {
  const [mcpjungle, mesh, claudeCode, ...services] = await Promise.allSettled([
    checkMcpJungle(),
    checkMeshRelay(),
    checkClaudeCode(),
    ...VPS_SERVICES.map(checkService),
  ]);

  return {
    mcpjungle: mcpjungle.status === "fulfilled" ? mcpjungle.value : undefined,
    mesh: mesh.status === "fulfilled" ? mesh.value : undefined,
    services: services
      .filter((r): r is PromiseFulfilledResult<VpsServiceStatus> => r.status === "fulfilled")
      .map((r) => r.value),
    claudeCode: claudeCode.status === "fulfilled" ? claudeCode.value : undefined,
    collectedAt: Date.now(),
  };
}
