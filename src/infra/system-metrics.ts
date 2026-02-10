import { readFile } from "node:fs/promises";

export type SystemMetricsSnapshot = {
  cpuUsagePercent?: number;
  cpuTemperatureCelsius?: number;
  ramUsedMB?: number;
  ramTotalMB?: number;
  ramUsagePercent?: number;
  networkInKBps?: number;
  networkOutKBps?: number;
  collectedAt: number;
  error?: string;
};

// Previous values for delta calculations (CPU and network)
let prevCpuIdle = 0;
let prevCpuTotal = 0;
let prevNetRxBytes = 0;
let prevNetTxBytes = 0;
let prevNetTimestamp = 0;

/**
 * Parse /proc/stat to calculate CPU usage percentage.
 * Returns [idle, total] for delta calculation.
 */
function parseProcStat(content: string): { idle: number; total: number } {
  const cpuLine = content.split("\n").find((l) => l.startsWith("cpu "));
  if (!cpuLine) {
    return { idle: 0, total: 0 };
  }
  // cpu  user nice system idle iowait irq softirq steal guest guest_nice
  const parts = cpuLine.trim().split(/\s+/).slice(1).map(Number);
  const idle = (parts[3] ?? 0) + (parts[4] ?? 0); // idle + iowait
  const total = parts.reduce((a, b) => a + b, 0);
  return { idle, total };
}

/**
 * Parse /proc/meminfo for RAM usage.
 */
function parseProcMeminfo(content: string): {
  totalMB: number;
  usedMB: number;
} {
  const lines = content.split("\n");
  const getValue = (key: string): number => {
    const line = lines.find((l) => l.startsWith(key));
    if (!line) {
      return 0;
    }
    const match = line.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const totalKB = getValue("MemTotal:");
  const availableKB = getValue("MemAvailable:");
  const totalMB = Math.round(totalKB / 1024);
  const usedMB = Math.round((totalKB - availableKB) / 1024);
  return { totalMB, usedMB };
}

/**
 * Parse /proc/net/dev for total network bytes (excluding loopback).
 */
function parseProcNetDev(content: string): { rxBytes: number; txBytes: number } {
  let rxBytes = 0;
  let txBytes = 0;
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip header lines and loopback
    if (!trimmed.includes(":") || trimmed.startsWith("lo:")) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length < 10) {
      continue;
    }
    // Format: iface: rx_bytes rx_packets ... tx_bytes tx_packets ...
    const ifaceParts = parts[0].endsWith(":") ? parts : [parts[0], ...parts.slice(1)];
    const rx = parseInt(ifaceParts[1], 10);
    const tx = parseInt(ifaceParts[9], 10);
    if (Number.isFinite(rx)) {
      rxBytes += rx;
    }
    if (Number.isFinite(tx)) {
      txBytes += tx;
    }
  }
  return { rxBytes, txBytes };
}

/**
 * Read CPU temperature from thermal zones.
 */
async function readCpuTemperature(): Promise<number | undefined> {
  try {
    // Try thermal_zone0 first (most common for CPU)
    const temp = await readFile("/sys/class/thermal/thermal_zone0/temp", "utf-8");
    const milliC = parseInt(temp.trim(), 10);
    if (Number.isFinite(milliC)) {
      return Math.round(milliC / 1000);
    }
  } catch {
    // thermal_zone might not exist (common in WSL2)
  }

  try {
    // Fallback: try sensors command
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);
    const { stdout } = await execAsync(
      "sensors 2>/dev/null | grep -i 'Package\\|Tctl\\|CPU' | head -1",
      {
        timeout: 3000,
      },
    );
    const match = stdout.match(/\+(\d+(?:\.\d+)?)/);
    if (match) {
      return Math.round(parseFloat(match[1]));
    }
  } catch {
    // sensors not available
  }

  return undefined;
}

/**
 * Collect system metrics from the local machine.
 * Uses /proc filesystem for CPU, RAM, and network stats.
 */
export async function collectSystemMetrics(): Promise<SystemMetricsSnapshot> {
  const now = Date.now();

  try {
    // Read all /proc files in parallel
    const [statContent, meminfoContent, netdevContent, cpuTemp] = await Promise.all([
      readFile("/proc/stat", "utf-8"),
      readFile("/proc/meminfo", "utf-8"),
      readFile("/proc/net/dev", "utf-8"),
      readCpuTemperature(),
    ]);

    // CPU usage (delta-based)
    const { idle, total } = parseProcStat(statContent);
    let cpuUsagePercent: number | undefined;
    if (prevCpuTotal > 0) {
      const idleDelta = idle - prevCpuIdle;
      const totalDelta = total - prevCpuTotal;
      if (totalDelta > 0) {
        cpuUsagePercent = Math.round((1 - idleDelta / totalDelta) * 100);
      }
    }
    prevCpuIdle = idle;
    prevCpuTotal = total;

    // RAM usage
    const { totalMB, usedMB } = parseProcMeminfo(meminfoContent);
    const ramUsagePercent = totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : undefined;

    // Network throughput (delta-based, in KB/s)
    const { rxBytes, txBytes } = parseProcNetDev(netdevContent);
    let networkInKBps: number | undefined;
    let networkOutKBps: number | undefined;
    if (prevNetTimestamp > 0) {
      const elapsed = (now - prevNetTimestamp) / 1000; // seconds
      if (elapsed > 0) {
        networkInKBps = Math.round((rxBytes - prevNetRxBytes) / 1024 / elapsed);
        networkOutKBps = Math.round((txBytes - prevNetTxBytes) / 1024 / elapsed);
        // Guard against negative values (interface reset, counter wrap)
        if (networkInKBps < 0) {
          networkInKBps = 0;
        }
        if (networkOutKBps < 0) {
          networkOutKBps = 0;
        }
      }
    }
    prevNetRxBytes = rxBytes;
    prevNetTxBytes = txBytes;
    prevNetTimestamp = now;

    return {
      cpuUsagePercent,
      cpuTemperatureCelsius: cpuTemp,
      ramUsedMB: usedMB,
      ramTotalMB: totalMB,
      ramUsagePercent,
      networkInKBps,
      networkOutKBps,
      collectedAt: now,
    };
  } catch (err) {
    return {
      collectedAt: now,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
