import { describe, expect, it, afterEach } from "vitest";
import {
  checkProvider,
  getProviderHealth,
  getProviderHealthSnapshot,
  stopProviderHealthMonitor,
} from "./provider-health.js";

afterEach(() => {
  stopProviderHealthMonitor();
});

describe("provider-health", () => {
  it("returns empty snapshot when no providers checked", () => {
    const snap = getProviderHealthSnapshot();
    expect(snap.providers).toEqual({});
    expect(typeof snap.checkedAt).toBe("number");
  });

  it("returns undefined for unknown provider", () => {
    expect(getProviderHealth("nonexistent")).toBeUndefined();
  });

  it("marks provider as unhealthy when endpoint is unreachable", async () => {
    const result = await checkProvider("test-provider", {
      baseUrl: "http://127.0.0.1:1",
      models: [],
    });
    expect(result.provider).toBe("test-provider");
    expect(result.healthy).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.consecutiveFailures).toBe(0); // first check
  });

  it("tracks consecutive failures", async () => {
    // First failure
    await checkProvider("failing-provider", {
      baseUrl: "http://127.0.0.1:1",
      models: [],
    });
    // Second failure
    const result = await checkProvider("failing-provider", {
      baseUrl: "http://127.0.0.1:1",
      models: [],
    });
    expect(result.consecutiveFailures).toBe(1);
  });

  it("stores health in snapshot after check", async () => {
    await checkProvider("snapshot-test", {
      baseUrl: "http://127.0.0.1:1",
      models: [],
    });
    const snap = getProviderHealthSnapshot();
    expect(snap.providers["snapshot-test"]).toBeDefined();
    expect(snap.providers["snapshot-test"].healthy).toBe(false);
  });
});
