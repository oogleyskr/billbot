import type { OpenClawConfig } from "../config/config.js";
import type { ModelProviderConfig } from "../config/types.models.js";

export type ProviderHealthStatus = {
  provider: string;
  baseUrl: string;
  healthy: boolean;
  lastCheckedAt: number;
  lastHealthyAt?: number;
  latencyMs?: number;
  error?: string;
  consecutiveFailures: number;
};

export type ProviderHealthSnapshot = {
  providers: Record<string, ProviderHealthStatus>;
  checkedAt: number;
};

/**
 * Simple HTTP health check for a provider endpoint.
 * Tries the configured health endpoint (default: /health), falling back to /v1/models.
 */
async function checkProviderHealth(
  providerId: string,
  config: ModelProviderConfig & { healthCheck?: { endpoint?: string } },
): Promise<ProviderHealthStatus> {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const endpoint = config.healthCheck?.endpoint ?? "/health";
  const url = `${baseUrl}${endpoint}`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return {
        provider: providerId,
        baseUrl,
        healthy: true,
        lastCheckedAt: Date.now(),
        lastHealthyAt: Date.now(),
        latencyMs,
        consecutiveFailures: 0,
      };
    }

    // Try fallback endpoint /v1/models
    if (endpoint !== "/v1/models") {
      const fallbackUrl = `${baseUrl}/v1/models`;
      const fallbackController = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackController.abort(), 10_000);

      try {
        const fallbackResponse = await fetch(fallbackUrl, {
          method: "GET",
          signal: fallbackController.signal,
          headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
        });
        clearTimeout(fallbackTimeout);
        const fallbackLatency = Date.now() - startTime;

        if (fallbackResponse.ok) {
          return {
            provider: providerId,
            baseUrl,
            healthy: true,
            lastCheckedAt: Date.now(),
            lastHealthyAt: Date.now(),
            latencyMs: fallbackLatency,
            consecutiveFailures: 0,
          };
        }
      } catch {
        clearTimeout(fallbackTimeout);
      }
    }

    return {
      provider: providerId,
      baseUrl,
      healthy: false,
      lastCheckedAt: Date.now(),
      latencyMs,
      error: `HTTP ${response.status}: ${response.statusText}`,
      consecutiveFailures: 0, // Will be updated by caller
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMessage =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Health check timed out (10s)"
          : err.message
        : String(err);

    return {
      provider: providerId,
      baseUrl,
      healthy: false,
      lastCheckedAt: Date.now(),
      latencyMs,
      error: errorMessage,
      consecutiveFailures: 0, // Will be updated by caller
    };
  }
}

// In-memory health state
const healthState: Record<string, ProviderHealthStatus> = {};
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Get current health status for all configured providers.
 */
export function getProviderHealthSnapshot(): ProviderHealthSnapshot {
  return {
    providers: { ...healthState },
    checkedAt: Date.now(),
  };
}

/**
 * Get health status for a specific provider.
 */
export function getProviderHealth(providerId: string): ProviderHealthStatus | undefined {
  return healthState[providerId];
}

/**
 * Check health of a specific provider immediately.
 */
export async function checkProvider(
  providerId: string,
  providerConfig: ModelProviderConfig,
): Promise<ProviderHealthStatus> {
  const result = await checkProviderHealth(providerId, providerConfig);

  const previous = healthState[providerId];
  if (previous) {
    result.lastHealthyAt = result.healthy ? Date.now() : previous.lastHealthyAt;
    result.consecutiveFailures = result.healthy ? 0 : (previous.consecutiveFailures ?? 0) + 1;
  }

  healthState[providerId] = result;
  return result;
}

/**
 * Check health of all configured providers.
 */
export async function checkAllProviders(cfg: OpenClawConfig): Promise<ProviderHealthSnapshot> {
  const providers = cfg.models?.providers ?? {};

  await Promise.all(
    Object.entries(providers).map(([providerId, providerConfig]) =>
      checkProvider(providerId, providerConfig),
    ),
  );

  return getProviderHealthSnapshot();
}

/**
 * Start periodic health checking for all providers.
 */
export function startProviderHealthMonitor(cfg: OpenClawConfig): void {
  stopProviderHealthMonitor();

  const providers = cfg.models?.providers ?? {};

  // Find the shortest interval among providers that have health checks enabled
  let intervalSeconds = 60; // Default: check every 60 seconds
  for (const [, providerConfig] of Object.entries(providers)) {
    const configured = providerConfig.healthCheck?.intervalSeconds;
    if (typeof configured === "number" && configured > 0) {
      intervalSeconds = Math.min(intervalSeconds, configured);
    }
  }

  // Do an initial check
  void checkAllProviders(cfg);

  // Set up periodic checking
  healthCheckInterval = setInterval(() => {
    void checkAllProviders(cfg);
  }, intervalSeconds * 1000);

  // Don't keep the process alive just for health checks
  if (
    healthCheckInterval &&
    typeof healthCheckInterval === "object" &&
    "unref" in healthCheckInterval
  ) {
    healthCheckInterval.unref();
  }
}

/**
 * Stop periodic health checking.
 */
export function stopProviderHealthMonitor(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}
