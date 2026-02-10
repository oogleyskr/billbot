import type { MultimodalServiceConfig } from "../config/types.infrastructure.js";

export type MultimodalServiceStatus = {
  label: string;
  host: string;
  port: number;
  status: "ok" | "loading" | "error";
  model?: string;
  service?: string;
  latencyMs?: number;
  error?: string;
};

export type MultimodalHealthSnapshot = {
  services: MultimodalServiceStatus[];
  servicesUp: number;
  servicesTotal: number;
  checkedAt: number;
};

/**
 * Check health of a single multimodal service via HTTP GET.
 */
async function checkServiceHealth(
  config: MultimodalServiceConfig,
): Promise<MultimodalServiceStatus> {
  const host = config.host ?? "localhost";
  const healthPath = config.healthPath ?? "/health";
  const url = `http://${host}:${config.port}${healthPath}`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        label: config.label,
        host,
        port: config.port,
        status: "error",
        latencyMs,
        error: `HTTP ${response.status}`,
      };
    }

    const body = (await response.json()) as Record<string, unknown>;

    const status = body.status === "ok" ? "ok" : body.status === "loading" ? "loading" : "error";

    return {
      label: config.label,
      host,
      port: config.port,
      status: status as "ok" | "loading" | "error",
      model: typeof body.model === "string" ? body.model : undefined,
      service: typeof body.service === "string" ? body.service : undefined,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMessage =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Health check timed out (2s)"
          : err.message
        : String(err);

    return {
      label: config.label,
      host,
      port: config.port,
      status: "error",
      latencyMs,
      error: errorMessage,
    };
  }
}

/**
 * Check health of all configured multimodal services in parallel.
 */
export async function checkMultimodalHealth(
  configs: MultimodalServiceConfig[],
): Promise<MultimodalHealthSnapshot> {
  const results = await Promise.all(configs.map(checkServiceHealth));
  const servicesUp = results.filter((s) => s.status === "ok").length;

  return {
    services: results,
    servicesUp,
    servicesTotal: results.length,
    checkedAt: Date.now(),
  };
}
