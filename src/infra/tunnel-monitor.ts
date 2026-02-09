import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type TunnelStatus = {
  host: string;
  port: number;
  reachable: boolean;
  latencyMs?: number;
  checkedAt: number;
  error?: string;
};

/**
 * Check if a TCP port is reachable by attempting a connection.
 */
async function checkPortReachable(
  host: string,
  port: number,
  timeoutMs = 5000,
): Promise<TunnelStatus> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const net = require("node:net") as typeof import("node:net");
    const socket = new net.Socket();

    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({
        host,
        port,
        reachable: false,
        latencyMs: Date.now() - startTime,
        checkedAt: Date.now(),
        error: `Connection timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    socket.connect(port, host, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({
        host,
        port,
        reachable: true,
        latencyMs: Date.now() - startTime,
        checkedAt: Date.now(),
      });
    });

    socket.on("error", (err: Error) => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({
        host,
        port,
        reachable: false,
        latencyMs: Date.now() - startTime,
        checkedAt: Date.now(),
        error: err.message,
      });
    });
  });
}

/**
 * Check if the SSH tunnel service is active via systemctl.
 */
async function checkSystemdService(serviceName: string): Promise<{
  active: boolean;
  status?: string;
  error?: string;
}> {
  try {
    const { stdout } = await execFileAsync("systemctl", ["is-active", serviceName]);
    const status = stdout.trim();
    return { active: status === "active", status };
  } catch {
    return { active: false, error: "Service not found or not running" };
  }
}

export type TunnelMonitorResult = {
  tunnel: TunnelStatus;
  service?: {
    name: string;
    active: boolean;
    status?: string;
  };
  checkedAt: number;
};

/**
 * Check tunnel health by verifying both port reachability and systemd service status.
 */
export async function checkTunnelHealth(params: {
  host?: string;
  port: number;
  serviceName?: string;
  timeoutMs?: number;
}): Promise<TunnelMonitorResult> {
  const host = params.host ?? "localhost";
  const timeoutMs = params.timeoutMs ?? 5000;

  const tunnel = await checkPortReachable(host, params.port, timeoutMs);

  let service: TunnelMonitorResult["service"] | undefined;
  if (params.serviceName) {
    const serviceStatus = await checkSystemdService(params.serviceName);
    service = {
      name: params.serviceName,
      active: serviceStatus.active,
      status: serviceStatus.status ?? serviceStatus.error,
    };
  }

  return {
    tunnel,
    service,
    checkedAt: Date.now(),
  };
}
