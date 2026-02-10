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
 * For GPUs that don't report memory via --query-gpu (e.g. NVIDIA GB10),
 * sum per-process GPU memory from --query-compute-apps.
 */
function parseProcessMemory(output: string): number {
  let totalMB = 0;
  for (const line of output.trim().split("\n")) {
    const parts = line.split(",").map((s) => s.trim());
    // Format: pid, name, used_gpu_memory
    if (parts.length >= 3) {
      const mem = parseFloat(parts[parts.length - 1].replace(/[^0-9.]/g, ""));
      if (Number.isFinite(mem)) {
        totalMB += mem;
      }
    }
  }
  return Math.round(totalMB);
}

/**
 * Enrich GPU metrics that are missing memory data by querying per-process memory
 * and system total memory. This handles GPUs like the GB10 with unified memory.
 */
async function enrichMissingMemory(
  gpus: GpuMetrics[],
  runCommand: (cmd: string) => Promise<string>,
): Promise<void> {
  const needsMemory = gpus.some((g) => g.memoryUsedMB === undefined);
  if (!needsMemory) {
    return;
  }

  try {
    // Get per-process GPU memory usage
    const processOutput = await runCommand(
      "nvidia-smi --query-compute-apps=pid,name,used_gpu_memory --format=csv,noheader,nounits 2>/dev/null || true",
    );
    const processMemMB = parseProcessMemory(processOutput);

    // Get total system memory as proxy for unified memory GPUs (in MB)
    let totalMemMB: number | undefined;
    try {
      const memOutput = await runCommand(
        "awk '/MemTotal/{printf \"%.0f\", $2/1024}' /proc/meminfo 2>/dev/null || true",
      );
      const parsed = parseInt(memOutput.trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        totalMemMB = parsed;
      }
    } catch {
      // ignore
    }

    for (const gpu of gpus) {
      if (gpu.memoryUsedMB === undefined && processMemMB > 0) {
        gpu.memoryUsedMB = processMemMB;
      }
      if (gpu.memoryTotalMB === undefined && totalMemMB !== undefined) {
        gpu.memoryTotalMB = totalMemMB;
      }
      if (
        gpu.memoryUsedMB !== undefined &&
        gpu.memoryTotalMB !== undefined &&
        gpu.memoryTotalMB > 0 &&
        gpu.memoryUtilizationPercent === undefined
      ) {
        gpu.memoryUtilizationPercent = Math.round((gpu.memoryUsedMB / gpu.memoryTotalMB) * 100);
      }
    }
  } catch {
    // Best-effort enrichment, don't fail the whole collection
  }
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

    const gpus = parseNvidiaSmiOutput(stdout);
    await enrichMissingMemory(gpus, async (cmd) => {
      const result = await execAsync(cmd, { timeout: 5_000 });
      return result.stdout;
    });

    return {
      host: "localhost",
      gpus,
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

  // Build base SSH args (reused for enrichment queries)
  const baseSshArgs: string[] = [
    "-o",
    "StrictHostKeyChecking=no",
    "-o",
    "ConnectTimeout=10",
    "-o",
    "BatchMode=yes",
  ];
  if (params.sshKeyPath) {
    baseSshArgs.push("-i", params.sshKeyPath);
  }
  if (params.sshPort) {
    baseSshArgs.push("-p", String(params.sshPort));
  }

  const sshArgs = [...baseSshArgs, userHost, nvidiaSmiCmd];

  try {
    const { stdout } = await execFileAsync("ssh", sshArgs, { timeout: 15_000 });

    const gpus = parseNvidiaSmiOutput(stdout);

    // Enrich missing memory data via additional SSH queries
    await enrichMissingMemory(gpus, async (cmd) => {
      const enrichArgs = [...baseSshArgs, userHost, cmd];
      const result = await execFileAsync("ssh", enrichArgs, { timeout: 10_000 });
      return result.stdout;
    });

    return {
      host: params.sshHost,
      gpus,
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
