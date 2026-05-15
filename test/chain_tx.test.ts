import { describe, it, expect, afterEach } from "vitest";
import { resolveRpcUrl } from "../src/chain_tx.js";

describe("resolveRpcUrl", () => {
  const prevOrbit = process.env.ORBIT_RPC_URL;
  const prevRpc = process.env.RPC_URL;

  afterEach(() => {
    if (prevOrbit === undefined) delete process.env.ORBIT_RPC_URL;
    else process.env.ORBIT_RPC_URL = prevOrbit;
    if (prevRpc === undefined) delete process.env.RPC_URL;
    else process.env.RPC_URL = prevRpc;
  });

  it("uses ORBIT_RPC_URL when set", () => {
    process.env.ORBIT_RPC_URL = "https://custom.example";
    delete process.env.RPC_URL;
    expect(resolveRpcUrl()).toBe("https://custom.example");
  });

  it("falls back to default testnet RPC", () => {
    delete process.env.ORBIT_RPC_URL;
    delete process.env.RPC_URL;
    expect(resolveRpcUrl()).toBe("https://evmrpc-testnet.0g.ai");
  });
});
