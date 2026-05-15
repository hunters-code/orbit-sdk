import { describe, it, expect } from "vitest";
import { createOrbitRegistryClient, computePluginId } from "../src/registry.js";
import { privateKeyToAccount } from "viem/accounts";

const samplePk = `0x${"d".repeat(64)}` as `0x${string}`;

describe("createOrbitRegistryClient", () => {
  it("exposes registry contract methods", async () => {
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
    expect(typeof client.getSignerAddress).toBe("function");
    await expect(client.getSignerAddress()).resolves.toBe(
      privateKeyToAccount(samplePk).address,
    );
  });

  it("computePluginId matches registerPlugin id derivation", () => {
    const owner = privateKeyToAccount(samplePk).address;
    const id = computePluginId("my-plugin", "1.0.0", owner);
    expect(id).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
