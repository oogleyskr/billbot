import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export type GpuMetrics = {
  name: string;
  index: number;
  temperatureCelsius?: number;
  utilizationPercent?: number;
  memoryUsedMB?: number;
  memoryTotalMB?: number;
  memoryUtilizationPercent?: number;
  powerDrawWatts?: number;
  powerLimitWatts?: number;
};

export type GpuMetricsSnapshot = {
  host: string;
  gpus: GpuMetrics[];
  collectedAt: number;
  error?: string;
};

/**
 * Parse nvidia-smi CSV output into structured GPU metrics.
 */
function parseNvidiaSmiOutput(output: string): GpuMetrics[] {
  const gpus: GpuMetrics[] = [];
  const lines = output.trim().split("\n");

  for (const line of lines) {
    const parts = line.split(",").map((s) => s.trim());
    if (parts.length < 8) {
      continue;
    }

    const [indexStr, name, temp, utilGpu, memUsed, memTotal, powerDraw, powerLimit] = parts;

    const parseNum = (s: string): number | undefined => {
      const cleaned = s.replace(/[^0-9.]/g, "");
      const num = parseFloat(cleaned);
      return Number.isFinite(num) ? num : undefined;
    };

    const index = parseInt(indexStr, 10);
    if (!Number.isFinite(index)) {
      continue;
    }

    const memUsedMB = parseNum(memUsed);
    const memTotalMB = parseNum(memTotal);

    gpus.push({
      name,
      index,
      temperatureCelsius: parseNum(temp),
      utilizationPercent: parseNum(utilGpu),
      memoryUsedMB: memUsedMB,
      memoryTotalMB: memTotalMB,
      memoryUtilizationPercent:
        memUsedMB !== undefined && memTotalMB !== undefined && memTotalMB > 0
          ? Math.round((memUsedMB / memTotalMB) * 100)
          : undefined,
      powerDrawWatts: parseNum(powerDraw),
      powerLimitWatts: parseNum(powerLimit),
    });
  }

  return gpus;
}

/**
 * Collect GPU metrics from a local machine via nvidia-smi.
 */
export async function collectLocalGpuMetrics(): Promise<GpuMetricsSnapshot> {
  try {
    const { stdout } = await execAsync(
      "nvidia-smi --query-gpu=index,name,temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw,power.limit --format=csv,noheader,nounits",
      { timeout: 10_000 },
    );

    return {
      host: "localhost",
      gpus: parseNvidiaSmiOutput(stdout),
      collectedAt: Date.now(),
    };
  } catch (err) {
    return {
      host: "localhost",
      gpus: [],
      collectedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Collect GPU metrics from a remote host via SSH + nvidia-smi.
 */
export async function collectRemoteGpuMetrics(params: {
  sshHost: string;
  sshUser?: string;
  sshKeyPath?: string;
  sshPort?: number;
}): Promise<GpuMetricsSnapshot> {
  const userHost = params.sshUser ? `${params.sshUser}@${params.sshHost}` : params.sshHost;

  const nvidiaSmiCmd =
    "nvidia-smi --query-gpu=index,name,temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw,power.limit --format=csv,noheader,nounits";

  // Build args array to avoid shell injection via config values
  const sshArgs: string[] = [
    "-o",
    "StrictHostKeyChecking=no",
    "-o",
    "ConnectTimeout=10",
    "-o",
    "BatchMode=yes",
  ];
  if (params.sshKeyPath) {
    sshArgs.push("-i", params.sshKeyPath);
  }
  if (params.sshPort) {
    sshArgs.push("-p", String(params.sshPort));
  }
  sshArgs.push(userHost, nvidiaSmiCmd);

  try {
    const { stdout } = await execFileAsync("ssh", sshArgs, { timeout: 15_000 });

    return {
      host: params.sshHost,
      gpus: parseNvidiaSmiOutput(stdout),
      collectedAt: Date.now(),
    };
  } catch (err) {
    return {
      host: params.sshHost,
      gpus: [],
      collectedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
