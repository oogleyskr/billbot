import { describe, expect, it } from "vitest";
import { checkTunnelHealth } from "./tunnel-monitor.js";

describe("tunnel-monitor", () => {
  it("returns unreachable for a port that is not listening", async () => {
    // Port 1 is unlikely to have anything listening
    const result = await checkTunnelHealth({
      host: "127.0.0.1",
      port: 1,
      timeoutMs: 1000,
    });
    expect(result.tunnel.reachable).toBe(false);
    expect(result.tunnel.host).toBe("127.0.0.1");
    expect(result.tunnel.port).toBe(1);
    expect(typeof result.checkedAt).toBe("number");
  });

  it("includes service status when serviceName is provided", async () => {
    const result = await checkTunnelHealth({
      port: 1,
      serviceName: "nonexistent-service-12345",
      timeoutMs: 1000,
    });
    expect(result.service).toBeDefined();
    expect(result.service!.name).toBe("nonexistent-service-12345");
    expect(result.service!.active).toBe(false);
  });

  it("omits service when serviceName is not provided", async () => {
    const result = await checkTunnelHealth({
      port: 1,
      timeoutMs: 1000,
    });
    expect(result.service).toBeUndefined();
  });
});
