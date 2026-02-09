import { describe, expect, it, afterEach } from "vitest";
import { getInfrastructureSnapshot, stopInfrastructureMonitor } from "./infrastructure-monitor.js";

afterEach(() => {
  stopInfrastructureMonitor();
});

describe("infrastructure-monitor", () => {
  it("returns a valid snapshot when no monitoring is configured", () => {
    const snap = getInfrastructureSnapshot();
    expect(typeof snap.collectedAt).toBe("number");
    expect(snap.providers).toBeDefined();
    expect(snap.providers!.providers).toEqual({});
  });

  it("exports start and stop functions", async () => {
    const mod = await import("./infrastructure-monitor.js");
    expect(typeof mod.startInfrastructureMonitor).toBe("function");
    expect(typeof mod.stopInfrastructureMonitor).toBe("function");
    expect(typeof mod.probeInfrastructure).toBe("function");
    expect(typeof mod.getInfrastructureSnapshot).toBe("function");
  });
});
