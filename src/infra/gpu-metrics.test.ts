import { describe, expect, it } from "vitest";

// We can't easily test the actual nvidia-smi execution in CI,
// but we can test the parsing logic by importing the module and checking types.

describe("gpu-metrics", () => {
  it("exports collectLocalGpuMetrics and collectRemoteGpuMetrics", async () => {
    const mod = await import("./gpu-metrics.js");
    expect(typeof mod.collectLocalGpuMetrics).toBe("function");
    expect(typeof mod.collectRemoteGpuMetrics).toBe("function");
  });

  it("collectLocalGpuMetrics returns a snapshot even when nvidia-smi is not available", async () => {
    const { collectLocalGpuMetrics } = await import("./gpu-metrics.js");
    const snapshot = await collectLocalGpuMetrics();
    expect(snapshot.host).toBe("localhost");
    expect(Array.isArray(snapshot.gpus)).toBe(true);
    expect(typeof snapshot.collectedAt).toBe("number");
    // In test env without GPU, expect an error but still valid structure
    if (snapshot.gpus.length === 0) {
      expect(snapshot.error).toBeDefined();
    }
  });
});
