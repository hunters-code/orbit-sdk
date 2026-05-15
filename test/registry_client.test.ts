import { describe, it, expect } from "vitest";
import { createOrbitRegistryClient } from "../src/registry.js";

const samplePk = `0x${"d".repeat(64)}` as `0x${string}`;

describe("createOrbitRegistryClient", () => {
  it("exposes registry contract methods", () => {
    const client = createOrbitRegistryClient({
      rpcUrl: "https://example.invalid",
      privateKey: samplePk,
      registryAddress: "0xbd83d0ae87efc9a2571bf03a7f5bb1e1cdba1954"
    });
    expect(typeof client.registerPlugin).toBe("function");
    expect(typeof client.updatePlugin).toBe("function");
    expect(typeof client.deactivatePlugin).toBe("function");
    expect(typeof client.getPlugin).toBe("function");
    expect(typeof client.isRegistered).toBe("function");
    expect(typeof client.getPluginsByOwner).toBe("function");
  });
});
