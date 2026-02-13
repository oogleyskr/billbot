import type { MemoryCortexConfig } from "../config/types.infrastructure.js";

export type MemoryCortexSnapshot = {
  /** Overall status: ok if both llm and middleware are healthy. */
  status: "ok" | "degraded" | "error";
  /** llama-server health status. */
  llmStatus: "ok" | "error";
  /** llama-server host:port. */
  llmEndpoint: string;
  /** Model name from /props or /v1/models. */
  modelName?: string;
  /** GPU name (hardcoded for now since AMD has no monitoring API). */
  gpuName: string;
  /** VRAM total in MB (known from hardware specs). */
  vramTotalMB: number;
  /** Approximate VRAM used in MB (model size + KV cache estimate). */
  vramUsedMB?: number;
  /** Generation speed in tokens/second (computed from metrics delta). */
  generationTokPerSec?: number;
  /** Prompt processing speed in tokens/second. */
  promptTokPerSec?: number;
  /** KV cache usage ratio (0-1). */
  kvCacheUsageRatio?: number;
  /** Number of cached tokens in KV cache. */
  kvCacheTokens?: number;
  /** Number of active/processing requests. */
  requestsProcessing?: number;
  /** Middleware health status. */
  middlewareStatus: "ok" | "error";
  /** Middleware host:port. */
  middlewareEndpoint: string;
  /** Total memories stored in the database. */
  memoriesCount?: number;
  /** Middleware latency in ms. */
  middlewareLatencyMs?: number;
  /** llama-server latency in ms. */
  llmLatencyMs?: number;
  /** Timestamp of collection. */
  collectedAt: number;
  /** Error message if any. */
  error?: string;
};

// Previous metrics totals for computing delta-based tokens/sec.
let prevPredictedTokens: number | null = null;
let prevPredictedSeconds: number | null = null;
let prevPromptTokens: number | null = null;
let prevPromptSeconds: number | null = null;

/**
 * Parse Prometheus-format metrics from llama-server's /metrics endpoint.
 */
function parsePrometheusMetrics(text: string): Record<string, number> {
  const metrics: Record<string, number> = {};
  for (const line of text.split("\n")) {
    if (line.startsWith("#") || line.trim() === "") {
      continue;
    }
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
      const val = parseFloat(parts[1]);
      if (Number.isFinite(val)) {
        metrics[parts[0]] = val;
      }
    }
  }
  return metrics;
}

/**
 * Collect Memory Cortex health data from the llama-server and middleware.
 */
export async function collectMemoryCortexHealth(
  config: MemoryCortexConfig,
): Promise<MemoryCortexSnapshot> {
  const llmHost = config.llmHost ?? "172.17.96.1";
  const llmPort = config.llmPort ?? 8301;
  const mwHost = config.middlewareHost ?? "localhost";
  const mwPort = config.middlewarePort ?? 8300;

  const result: MemoryCortexSnapshot = {
    status: "error",
    llmStatus: "error",
    llmEndpoint: `${llmHost}:${llmPort}`,
    gpuName: "AMD Radeon VII 16GB HBM2",
    vramTotalMB: 16384,
    middlewareStatus: "error",
    middlewareEndpoint: `${mwHost}:${mwPort}`,
    collectedAt: Date.now(),
  };

  // -- Check llama-server --
  const llmHealthUrl = `http://${llmHost}:${llmPort}/health`;
  const llmMetricsUrl = `http://${llmHost}:${llmPort}/metrics`;
  const llmPropsUrl = `http://${llmHost}:${llmPort}/props`;

  // Health check
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const t0 = Date.now();
    const resp = await fetch(llmHealthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    result.llmLatencyMs = Date.now() - t0;

    if (resp.ok) {
      const body = (await resp.json()) as Record<string, unknown>;
      result.llmStatus = body.status === "ok" ? "ok" : "error";
      if (typeof body.slots_processing === "number") {
        result.requestsProcessing = body.slots_processing;
      }
    }
  } catch {
    // llm unreachable
  }

  // Props (model name)
  if (result.llmStatus === "ok") {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3_000);
      const resp = await fetch(llmPropsUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (resp.ok) {
        const body = (await resp.json()) as Record<string, unknown>;
        const settings = body.default_generation_settings as Record<string, unknown> | undefined;
        if (settings && typeof settings.model === "string") {
          // Extract filename from path
          const modelPath = settings.model;
          result.modelName = modelPath.split(/[/\\]/).pop() ?? modelPath;
        }
      }
    } catch {
      // ignore
    }
  }

  // Metrics (tokens/sec, KV cache)
  if (result.llmStatus === "ok") {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3_000);
      const resp = await fetch(llmMetricsUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (resp.ok) {
        const text = await resp.text();
        const m = parsePrometheusMetrics(text);

        // KV cache
        if (m["llamacpp_kv_cache_usage_ratio"] != null) {
          result.kvCacheUsageRatio = Math.round(m["llamacpp_kv_cache_usage_ratio"] * 1000) / 1000;
        }
        if (m["llamacpp_kv_cache_tokens"] != null) {
          result.kvCacheTokens = Math.round(m["llamacpp_kv_cache_tokens"]);
        }

        // Requests
        if (m["llamacpp_requests_processing"] != null) {
          result.requestsProcessing = m["llamacpp_requests_processing"];
        }

        // Compute generation tokens/sec from delta
        const curPredTokens = m["llamacpp_tokens_predicted_total"];
        const curPredSec = m["llamacpp_tokens_predicted_seconds_total"];
        if (
          curPredTokens != null &&
          curPredSec != null &&
          prevPredictedTokens != null &&
          prevPredictedSeconds != null
        ) {
          const dtTokens = curPredTokens - prevPredictedTokens;
          const dtSec = curPredSec - prevPredictedSeconds;
          if (dtSec > 0 && dtTokens > 0) {
            result.generationTokPerSec = Math.round((dtTokens / dtSec) * 10) / 10;
          }
        }
        prevPredictedTokens = curPredTokens ?? null;
        prevPredictedSeconds = curPredSec ?? null;

        // Compute prompt tokens/sec from delta
        const curPromptTokens = m["llamacpp_prompt_tokens_total"];
        const curPromptSec = m["llamacpp_prompt_seconds_total"];
        if (
          curPromptTokens != null &&
          curPromptSec != null &&
          prevPromptTokens != null &&
          prevPromptSeconds != null
        ) {
          const dtTokens = curPromptTokens - prevPromptTokens;
          const dtSec = curPromptSec - prevPromptSeconds;
          if (dtSec > 0 && dtTokens > 0) {
            result.promptTokPerSec = Math.round((dtTokens / dtSec) * 10) / 10;
          }
        }
        prevPromptTokens = curPromptTokens ?? null;
        prevPromptSeconds = curPromptSec ?? null;

        // Estimate VRAM used: ~8.2GB model + proportional KV cache
        // Qwen3-8B Q8_0 is ~8.2GB, KV cache is the rest of the 16GB
        const modelSizeMB = 8400; // ~8.2GB model weight
        const kvRatio = result.kvCacheUsageRatio ?? 0;
        const kvCapacityMB = result.vramTotalMB - modelSizeMB; // ~7.9GB for KV
        result.vramUsedMB = Math.round(modelSizeMB + kvCapacityMB * kvRatio);
      }
    } catch {
      // ignore
    }
  }

  // -- Check middleware --
  const mwHealthUrl = `http://${mwHost}:${mwPort}/health`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    const t0 = Date.now();
    const resp = await fetch(mwHealthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    result.middlewareLatencyMs = Date.now() - t0;

    if (resp.ok) {
      const body = (await resp.json()) as Record<string, unknown>;
      result.middlewareStatus = body.status === "ok" ? "ok" : "error";
      if (typeof body.memories_count === "number") {
        result.memoriesCount = body.memories_count;
      }
    }
  } catch {
    // middleware unreachable
  }

  // -- Middleware stats for memory count --
  if (result.middlewareStatus === "ok" && result.memoriesCount == null) {
    const mwStatsUrl = `http://${mwHost}:${mwPort}/stats`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3_000);
      const resp = await fetch(mwStatsUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (resp.ok) {
        const body = (await resp.json()) as Record<string, unknown>;
        if (typeof body.total_memories === "number") {
          result.memoriesCount = body.total_memories;
        }
      }
    } catch {
      // ignore
    }
  }

  // -- Compute overall status --
  if (result.llmStatus === "ok" && result.middlewareStatus === "ok") {
    result.status = "ok";
  } else if (result.llmStatus === "ok" || result.middlewareStatus === "ok") {
    result.status = "degraded";
  } else {
    result.status = "error";
    result.error = "Both LLM server and middleware are unreachable";
  }

  return result;
}
