import { describe, it, expect, vi, afterEach } from "vitest";
import * as userConfig from "../src/user_config.js";
import { registerOrbitUserBilling } from "../src/openclaw_user_billing.js";

vi.mock("../src/billing.js", () => {
  const mockBilling = {
    recordInstall: vi.fn().mockResolvedValue({
      txHash: "0xabc",
      blockNumber: 1n,
      chargedWei: 1000n,
    }),
    recordUsage: vi.fn().mockResolvedValue({
      txHash: "0xdef",
      blockNumber: 2n,
      chargedWei: 500n,
    }),
    withdraw: vi.fn(),
    getEarnings: vi.fn(),
    getInstallCount: vi.fn(),
    getUsageCount: vi.fn(),
  };
  return {
    createBilling: vi.fn(() => mockBilling),
    createOrbitBillingClient: vi.fn(),
    __mockBilling: mockBilling,
  };
});

import { createBilling } from "../src/billing.js";

function getMockBilling() {
  return (createBilling as ReturnType<typeof vi.fn>)() as ReturnType<typeof createBilling>;
}

describe("registerOrbitUserBilling", () => {
  const prevPk = process.env.PRIVATE_KEY;

  afterEach(() => {
    if (prevPk === undefined) delete process.env.PRIVATE_KEY;
    else process.env.PRIVATE_KEY = prevPk;
    delete process.env.ORBIT_PLUGIN_ID;
    delete process.env.PLUGIN_KEY;
    vi.clearAllMocks();
  });

  it("registers cli, hooks, and blocks tools without wallet", async () => {
    const walletSpy = vi.spyOn(userConfig, "hasUserPrivateKey").mockReturnValue(false);
    const on = vi.fn();
    const registerCli = vi.fn();
    const api = {
      pluginConfig: {},
      on,
      registerCli,
    };

    registerOrbitUserBilling(api);

    expect(registerCli).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledWith(
      "before_install",
      expect.any(Function),
      { priority: 100 },
    );
    expect(on).toHaveBeenCalledWith("gateway_start", expect.any(Function));
    expect(on).toHaveBeenCalledWith(
      "before_tool_call",
      expect.any(Function),
      { priority: 100 },
    );

    const beforeTool = on.mock.calls.find(([name]) => name === "before_tool_call")?.[1] as
      | ((event?: unknown) => Promise<{ block: boolean; blockReason: string } | undefined>)
      | undefined;
    const blocked = await beforeTool?.();
    expect(blocked).toEqual({
      block: true,
      blockReason: expect.stringContaining("openclaw orbit wallet setup"),
    });
    walletSpy.mockRestore();
  });

  it("calls recordInstall during before_install when pluginId is set", async () => {
    const samplePk = `0x${"a".repeat(64)}`;
    process.env.PRIVATE_KEY = samplePk;

    const on = vi.fn();
    const registerCli = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn() };
    const api = { pluginConfig: {}, on, registerCli, logger };

    registerOrbitUserBilling(api, { pluginId: `0x${"b".repeat(64)}` });

    const beforeInstall = on.mock.calls.find(([name]) => name === "before_install")?.[1] as
      | ((event: unknown) => Promise<unknown>)
      | undefined;

    const event = { manifest: { orbit: { billing: true } } };
    await beforeInstall?.(event);

    const billing = getMockBilling();
    expect(billing.recordInstall).toHaveBeenCalledWith(`0x${"b".repeat(64)}`);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Orbit install recorded"),
    );
  });

  it("blocks install when recordInstall fails", async () => {
    const samplePk = `0x${"a".repeat(64)}`;
    process.env.PRIVATE_KEY = samplePk;

    const on = vi.fn();
    const registerCli = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn() };
    const api = { pluginConfig: {}, on, registerCli, logger };

    const billing = getMockBilling();
    (billing.recordInstall as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("insufficient funds"),
    );

    registerOrbitUserBilling(api, { pluginId: `0x${"b".repeat(64)}` });

    const beforeInstall = on.mock.calls.find(([name]) => name === "before_install")?.[1] as
      | ((event: unknown) => Promise<unknown>)
      | undefined;

    const event = { manifest: { orbit: { billing: true } } };
    const result = await beforeInstall?.(event);

    expect(result).toEqual({
      block: true,
      blockReason: expect.stringContaining("insufficient funds"),
    });
  });

  it("calls recordUsage during before_tool_call when pluginId is set", async () => {
    const samplePk = `0x${"a".repeat(64)}`;
    process.env.PRIVATE_KEY = samplePk;

    const on = vi.fn();
    const registerCli = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn() };
    const api = { pluginConfig: {}, on, registerCli, logger };

    registerOrbitUserBilling(api, { pluginId: `0x${"b".repeat(64)}` });

    const beforeTool = on.mock.calls.find(([name]) => name === "before_tool_call")?.[1] as
      | ((event?: unknown) => Promise<unknown>)
      | undefined;

    const event = { toolName: "translation_translate" };
    await beforeTool?.(event);

    const billing = getMockBilling();
    expect(billing.recordUsage).toHaveBeenCalledWith(
      `0x${"b".repeat(64)}`,
      "translation_translate",
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Orbit billing: usage recorded"),
    );
  });

  it("blocks tool call when recordUsage fails", async () => {
    const samplePk = `0x${"a".repeat(64)}`;
    process.env.PRIVATE_KEY = samplePk;

    const on = vi.fn();
    const registerCli = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn() };
    const api = { pluginConfig: {}, on, registerCli, logger };

    const billing = getMockBilling();
    (billing.recordUsage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("tx reverted"),
    );

    registerOrbitUserBilling(api, { pluginId: `0x${"b".repeat(64)}` });

    const beforeTool = on.mock.calls.find(([name]) => name === "before_tool_call")?.[1] as
      | ((event?: unknown) => Promise<unknown>)
      | undefined;

    const event = { toolName: "translation_translate" };
    const result = await beforeTool?.(event);

    expect(result).toEqual({
      block: true,
      blockReason: expect.stringContaining("tx reverted"),
    });
  });

  it("ignores global ORBIT_PLUGIN_ID env when options.pluginId is unset", async () => {
    const samplePk = `0x${"a".repeat(64)}`;
    process.env.PRIVATE_KEY = samplePk;
    process.env.ORBIT_PLUGIN_ID = `0x${"c".repeat(64)}`;

    const on = vi.fn();
    const registerCli = vi.fn();
    const api = { pluginConfig: {}, on, registerCli };

    registerOrbitUserBilling(api);

    const beforeTool = on.mock.calls.find(([name]) => name === "before_tool_call")?.[1] as
      | ((event?: unknown) => Promise<unknown>)
      | undefined;

    await beforeTool?.({ toolName: "test_tool" });

    const billing = getMockBilling();
    expect(billing.recordUsage).not.toHaveBeenCalled();
  });

  it("resolves pluginId from pluginConfig.orbitPluginId", async () => {
    const samplePk = `0x${"a".repeat(64)}`;
    process.env.PRIVATE_KEY = samplePk;

    const on = vi.fn();
    const registerCli = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn() };
    const api = {
      pluginConfig: { orbitPluginId: `0x${"c".repeat(64)}` },
      on,
      registerCli,
      logger,
    };

    registerOrbitUserBilling(api);

    const beforeTool = on.mock.calls.find(([name]) => name === "before_tool_call")?.[1] as
      | ((event?: unknown) => Promise<unknown>)
      | undefined;

    await beforeTool?.({ toolName: "test_tool" });

    const billing = getMockBilling();
    expect(billing.recordUsage).toHaveBeenCalledWith(
      `0x${"c".repeat(64)}`,
      "test_tool",
    );
  });

  it("skips billing when no pluginId is available", async () => {
    const samplePk = `0x${"a".repeat(64)}`;
    process.env.PRIVATE_KEY = samplePk;

    const on = vi.fn();
    const registerCli = vi.fn();
    const api = { pluginConfig: {}, on, registerCli };

    registerOrbitUserBilling(api);

    const beforeTool = on.mock.calls.find(([name]) => name === "before_tool_call")?.[1] as
      | ((event?: unknown) => Promise<unknown>)
      | undefined;

    const result = await beforeTool?.({ toolName: "test_tool" });

    const billing = getMockBilling();
    expect(billing.recordUsage).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
